import { Injectable, Logger } from '@nestjs/common';
import { Gauge, Counter } from '@prometheus-io/client';
import { MetricsService } from '@heyatom/nest-common/metrics';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { DEAD_LETTER_DATE } from './webhook.constants';

/**
 * Webhook outbox metrics, on the shared `MetricsService.registry`
 * (`@heyatom/nest-common/metrics`, served on METRICS_PORT).
 *
 * The DB-backed gauge is computed lazily in a `collect()` callback — the
 * client only invokes it on scrape, so an idle process never runs the query.
 * A failed query logs a warning and leaves the gauge at its previous value
 * instead of failing the whole scrape.
 */
@Injectable()
export class WebhookMetrics {
  private readonly logger = new Logger(WebhookMetrics.name);
  readonly webhookDeliveryAttempts: Counter<'result'>;

  constructor(
    metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {
    this.webhookDeliveryAttempts = new Counter({
      name: 'articuno_webhook_delivery_attempts_total',
      help: 'Webhook outbox delivery attempts by outcome, counted after the outcome is persisted',
      labelNames: ['result'],
      registers: [metrics.registry],
    });
    for (const result of [
      'success',
      'failure',
      'unconfigured',
      'dead_lettered',
    ]) {
      this.webhookDeliveryAttempts.inc({ result }, 0);
    }

    const gauge = new Gauge({
      name: 'articuno_webhook_outbox_events',
      help: 'Unsent webhook outbox events: overdue = due for more than 2 minutes (the job runs every 30s, so non-zero means it is stuck), dead = dead-lettered after max attempts (only a manual resend clears it)',
      labelNames: ['state'],
      registers: [metrics.registry],
      collect: async () => {
        try {
          // Columns are camelCase (no @map) and `timestamp(3)` holding UTC,
          // hence `now() AT TIME ZONE 'UTC'`. Dead-lettered and leased
          // rows have nextRetryAt in the future, so `overdue` excludes them
          // by construction.
          const [row] = await this.prisma.$queryRaw<
            { overdue: bigint; dead: bigint }[]
          >`
            SELECT
              count(*) FILTER (
                WHERE COALESCE("nextRetryAt", "createdAt") < (now() AT TIME ZONE 'UTC') - interval '2 minutes'
              ) AS overdue,
              count(*) FILTER (
                WHERE "nextRetryAt" = ${DEAD_LETTER_DATE}
              ) AS dead
            FROM webhook_events
            WHERE "sentAt" IS NULL`;
          gauge.set({ state: 'overdue' }, Number(row.overdue));
          gauge.set({ state: 'dead' }, Number(row.dead));
        } catch (err) {
          this.logger.warn(
            `articuno_webhook_outbox_events collection failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    });
  }
}
