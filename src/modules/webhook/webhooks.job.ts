import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from './webhooks.service';

/** Numero massimo di tentativi prima di mettere l'evento in dead-letter. */
const MAX_ATTEMPTS = 10;

/** Data sentinella usata come "dead-letter": l'evento non verrà più ripreso dal cron. */
export const DEAD_LETTER_DATE = new Date('9999-12-31T23:59:59.000Z');

/** Rows claimed per tick — see `claimDue`. */
export const CLAIM_BATCH_SIZE = 20;

/**
 * How long a claimed row stays invisible to other workers. If the worker that
 * claimed it dies mid-delivery, the row simply becomes due again after this —
 * no reaper needed. Must comfortably exceed a whole batch delivered
 * sequentially (CLAIM_BATCH_SIZE × the 5s HTTP timeout = 100s).
 */
export const CLAIM_LEASE_MINUTES = 5;

/** Rows deleted per statement by the retention cron — see `purgeDelivered`. */
export const RETENTION_BATCH_SIZE = 5000;

@Injectable()
export class WebhooksJob {
  private readonly logger = new Logger(WebhooksJob.name);

  constructor(
    private prisma: PrismaService,
    private webhookService: WebhooksService,
    private config: ConfigService,
  ) {}

  /**
   * Atomically takes ownership of up to CLAIM_BATCH_SIZE due rows, global
   * across tenants (this is the outbox worker, not a tenant-facing query).
   * `FOR UPDATE SKIP LOCKED` makes concurrent claims (other replicas, or an
   * overlapping tick) take disjoint rows; pushing `nextRetryAt` forward by
   * the lease takes them out of the due set once the statement commits.
   *
   * `$queryRaw` because Prisma expresses neither `SKIP LOCKED` nor
   * `UPDATE ... RETURNING` over a subquery. The predicate is served by the
   * partial index `webhook_events_due_idx`.
   */
  async claimDue() {
    // Instants computed here, not with SQL now(): the columns are
    // `timestamp without time zone` written by Prisma in UTC, and the rest
    // of this job schedules `nextRetryAt` off the app clock too.
    const now = new Date();
    const leaseUntil = new Date(
      now.getTime() + CLAIM_LEASE_MINUTES * 60 * 1000,
    );
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
            UPDATE webhook_events
               SET "nextRetryAt" = ${leaseUntil}, "claimedUntil" = ${leaseUntil}
             WHERE id IN (
               SELECT id FROM webhook_events
                WHERE "sentAt" IS NULL
                  AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
                ORDER BY "createdAt"
                LIMIT ${CLAIM_BATCH_SIZE}
                FOR UPDATE SKIP LOCKED
             )
             RETURNING id
        `;
    if (claimed.length === 0) return [];

    return this.prisma.webhookEvent.findMany({
      where: { id: { in: claimed.map((row) => row.id) } },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingWebhooks() {
    const pending = await this.claimDue();

    // Every update below releases the lease (`claimedUntil: null`) and
    // overwrites the lease's `nextRetryAt` with the real next state.
    for (const notif of pending) {
      // --- Dead-letter check ---
      if (notif.attempts >= MAX_ATTEMPTS) {
        this.logger.warn(
          `Webhook ${notif.id} (${notif.event}) ha raggiunto il limite massimo di ${MAX_ATTEMPTS} tentativi — spostato in dead-letter`,
        );
        await this.prisma.webhookEvent.update({
          where: { id: notif.id },
          data: {
            lastError: `Numero massimo di tentativi raggiunto (${MAX_ATTEMPTS})`,
            nextRetryAt: DEAD_LETTER_DATE,
            claimedUntil: null,
          },
        });
        continue;
      }

      if (!notif.tenant.webhookUrl || !notif.tenant.webhookSecret) {
        await this.prisma.webhookEvent.update({
          where: { id: notif.id },
          data: {
            attempts: notif.attempts + 1,
            lastError: 'Tenant webhook non configurato',
            nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
            claimedUntil: null,
          },
        });
        continue;
      }

      const success = await this.webhookService.send(
        notif.tenant.webhookUrl,
        notif.tenant.webhookSecret,
        notif.payload,
      );

      if (success) {
        await this.prisma.webhookEvent.update({
          where: { id: notif.id },
          data: {
            sentAt: new Date(),
            lastError: null,
            claimedUntil: null,
          },
        });
        continue;
      }

      const nextAttempts = notif.attempts + 1;
      const backoffSeconds = Math.min(2 ** nextAttempts, 300);
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

      this.logger.warn(
        `Webhook delivery failed for event ${notif.event} (${notif.id}) — attempt ${nextAttempts}/${MAX_ATTEMPTS}`,
      );

      await this.prisma.webhookEvent.update({
        where: { id: notif.id },
        data: {
          attempts: nextAttempts,
          lastError: 'Webhook delivery failed',
          nextRetryAt,
          claimedUntil: null,
        },
      });
    }
  }

  /**
   * Deletes delivered rows older than WEBHOOK_EVENT_RETENTION_DAYS, in
   * batches with `SKIP LOCKED` so each statement is short and concurrent
   * replicas take different rows instead of blocking each other. Unsent and
   * dead-lettered rows (`sentAt IS NULL`) are never touched: they are still
   * owed to the tenant, or waiting for an admin resend.
   */
  async purgeDelivered(): Promise<number> {
    const days = this.config.getOrThrow<number>('WEBHOOK_EVENT_RETENTION_DAYS');
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let total = 0;
    for (;;) {
      const deleted = await this.prisma.$executeRaw`
                DELETE FROM webhook_events
                 WHERE id IN (
                   SELECT id FROM webhook_events
                    WHERE "sentAt" IS NOT NULL AND "sentAt" < ${cutoff}
                    LIMIT ${RETENTION_BATCH_SIZE}
                    FOR UPDATE SKIP LOCKED
                 )
            `;
      total += deleted;
      if (deleted < RETENTION_BATCH_SIZE) break;
    }
    return total;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async retention() {
    try {
      const purged = await this.purgeDelivered();
      this.logger.log(`Webhook event retention done purged=${purged}`);
    } catch (err) {
      this.logger.error(
        'Webhook event retention failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
