import { Injectable, Logger } from '@nestjs/common';
import {
  Registry,
  Histogram,
  Gauge,
  Counter,
  collectDefaultMetrics,
} from '@prometheus-io/client';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { DEAD_LETTER_DATE } from '@/modules/webhook/webhook.constants';

/**
 * Prometheus metrics for articuno. Uses its own `Registry` rather than the
 * @prometheus-io/client global one, so a `MetricsService` created per test (or per
 * NestJS TestingModule) never collides with metrics registered by another
 * test in the same process.
 *
 * DB-backed gauges are computed lazily in a `collect()` callback — the client
 * only invokes it on scrape, so an idle process never runs the query. A failed
 * query logs a warning and leaves the gauge at its previous value instead of
 * failing the whole scrape.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  readonly registry = new Registry();
  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status'>;
  readonly webhookDeliveryAttempts: Counter<'result'>;

  constructor(private readonly prisma: PrismaService) {
    this.registry.setDefaultLabels({ app: 'articuno' });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.webhookDeliveryAttempts = new Counter({
      name: 'articuno_webhook_delivery_attempts_total',
      help: 'Webhook outbox delivery attempts by outcome, counted after the outcome is persisted',
      labelNames: ['result'],
      registers: [this.registry],
    });
    for (const result of [
      'success',
      'failure',
      'unconfigured',
      'dead_lettered',
    ]) {
      this.webhookDeliveryAttempts.inc({ result }, 0);
    }

    this.registerWebhookOutboxGauge();
  }

  private registerWebhookOutboxGauge(): void {
    const gauge = new Gauge({
      name: 'articuno_webhook_outbox_events',
      help: 'Unsent webhook outbox events: overdue = due for more than 2 minutes (the job runs every 30s, so non-zero means it is stuck), dead = dead-lettered after max attempts (only a manual resend clears it)',
      labelNames: ['state'],
      registers: [this.registry],
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
