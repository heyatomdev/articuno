import { BadRequestException, ConflictException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService resend vs. claim lease', () => {
  const prisma = {
    webhookEvent: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const service = new WebhooksService({} as any, prisma as any);
  const leaseFree = {
    OR: [{ claimedUntil: null }, { claimedUntil: { lte: expect.any(Date) } }],
  };

  beforeEach(() => jest.resetAllMocks());

  it('resendOne resets only an unsent, unleased row of the tenant', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({ id: 'e1', sentAt: null });
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });

    await service.resendOne('t1', 'e1');

    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', tenantId: 't1', sentAt: null, ...leaseFree },
      data: { attempts: 0, nextRetryAt: null, lastError: null },
    });
  });

  it('resendOne refuses a row a worker is delivering', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({ id: 'e1', sentAt: null });
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resendOne('t1', 'e1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('resendOne refuses a delivered row', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({
      id: 'e1',
      sentAt: new Date(),
    });

    await expect(service.resendOne('t1', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.webhookEvent.updateMany).not.toHaveBeenCalled();
  });

  it('resendAllFailed skips leased rows', async () => {
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 4 });

    expect(await service.resendAllFailed('t1')).toEqual({ reset: 4 });
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', sentAt: null, ...leaseFree },
      data: { attempts: 0, nextRetryAt: null, lastError: null },
    });
  });
});
