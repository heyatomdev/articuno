import { Logger } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { MetricsService } from '@heyatom/nest-common/metrics';
import { WebhookMetrics } from './webhook.metrics';

describe('WebhookMetrics', () => {
  const queryRaw = jest.fn();
  let service: MetricsService;

  it('registers the counter with every result at 0', async () => {
    service = new MetricsService({ app: 'articuno' });
    new WebhookMetrics(service, {} as PrismaService);
    const text = await service.registry.metrics();
    for (const result of [
      'success',
      'failure',
      'unconfigured',
      'dead_lettered',
    ]) {
      expect(text).toContain(
        `articuno_webhook_delivery_attempts_total{result="${result}",app="articuno"} 0`,
      );
    }
  });

  async function outbox(state: string): Promise<number | undefined> {
    const metric = service.registry.getSingleMetric(
      'articuno_webhook_outbox_events',
    );
    const { values } = await (
      metric as unknown as {
        get(): Promise<{
          values: Array<{ labels: Record<string, string>; value: number }>;
        }>;
      }
    ).get();
    return values.find((v) => v.labels.state === state)?.value;
  }

  beforeEach(() => {
    queryRaw.mockReset();
    service = new MetricsService({ app: 'articuno' });
    new WebhookMetrics(service, {
      $queryRaw: queryRaw,
    } as unknown as PrismaService);
  });

  it('runs no query until scraped', () => {
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('emits both states from one query, bigint converted', async () => {
    queryRaw.mockResolvedValue([{ overdue: 3n, dead: 0n }]);

    expect(await outbox('overdue')).toBe(3);
    expect(await outbox('dead')).toBe(0);
  });

  it('keeps the previous value and warns when the query fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    queryRaw.mockResolvedValueOnce([{ overdue: 2n, dead: 5n }]);
    expect(await outbox('dead')).toBe(5);

    queryRaw.mockRejectedValueOnce(new Error('db down'));
    expect(await outbox('overdue')).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
    warn.mockRestore();
  });
});
