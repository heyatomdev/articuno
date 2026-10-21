import { AnalyticsService } from './analytics.service';
import { DEAD_LETTER_DATE } from '@/modules/webhook/webhook.constants';

describe('AnalyticsService.getDashboardStats — webhooks', () => {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([]),
    aggregate: jest.fn().mockResolvedValue({ _sum: { views: 0 } }),
    count: jest.fn().mockResolvedValue(0),
  });
  const prisma = {
    dailyStats: model(),
    article: model(),
    comment: model(),
    report: model(),
    user: model(),
    like: model(),
    bookmark: model(),
    category: model(),
    tag: model(),
    bannedWord: model(),
    articleTranslation: model(),
    webhookEvent: model(),
  };

  it('counts undelivered and dead-lettered outbox rows of the tenant', async () => {
    prisma.webhookEvent.count.mockImplementation(({ where }) =>
      Promise.resolve(where.nextRetryAt ? 6 : 9),
    );
    const service = new AnalyticsService(prisma as any);

    const stats = await service.getDashboardStats('t1');

    expect(stats.webhooks).toEqual({ undelivered: 9, deadLettered: 6 });
    expect(prisma.webhookEvent.count).toHaveBeenCalledWith({
      where: { tenantId: 't1', sentAt: null, nextRetryAt: DEAD_LETTER_DATE },
    });
    expect(prisma.webhookEvent.count).toHaveBeenCalledWith({
      where: { tenantId: 't1', sentAt: null },
    });
  });
});
