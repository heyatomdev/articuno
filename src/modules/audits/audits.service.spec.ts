import { AuditsService } from './audits.service';

describe('AuditsService — actor names', () => {
  const row = (id: string, actorUserId: string) => ({
    id,
    actorUserId,
    tenantId: 't1',
  });
  const prisma = {
    auditLog: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = new AuditsService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('adds the username of each actor with one lookup scoped to the tenant', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      row('a', 'u1'),
      row('b', 'u1'),
      row('c', 'gone'),
    ]);
    prisma.auditLog.count.mockResolvedValue(3);
    prisma.user.findMany.mockResolvedValue([
      { externalId: 'u1', username: 'kaish' },
    ]);

    const res = await service.findAll('t1', {
      limit: 20,
      skip: 0,
      page: 1,
    } as any);

    expect(res.data.map((r: any) => r.actorUsername)).toEqual([
      'kaish',
      'kaish',
      null,
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', externalId: { in: ['u1', 'gone'] } },
      select: { externalId: true, username: true },
    });
  });

  it('skips the lookup on an empty page', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await service.findAll('t1', { limit: 20, skip: 0, page: 1 } as any);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('names the actor on a single entry', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(row('a', 'u1'));
    prisma.user.findMany.mockResolvedValue([
      { externalId: 'u1', username: null },
    ]);

    expect((await service.findOne('a', 't1')).actorUsername).toBeNull();
  });
});
