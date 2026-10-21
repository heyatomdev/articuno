import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { ReportStatus, TargetType } from '@prisma/client';
import { DELETED_USER_ID, SYSTEM_EXTERNAL_IDS } from './users.constants';

describe('UsersService hides the system reporter', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new UsersService(prisma as any);
  const notSystem = { externalId: { notIn: SYSTEM_EXTERNAL_IDS } };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops) => Promise.all(ops));
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
  });

  it('excludes it from the admin list', async () => {
    await service.findAll('t1', { limit: 20, skip: 0 } as any);
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 't1',
      ...notSystem,
    });
    expect(prisma.user.count.mock.calls[0][0].where).toMatchObject(notSystem);
  });

  it('filters by exact externalId without dropping the system exclusion', async () => {
    await service.findAll('t1', {
      limit: 20,
      skip: 0,
      externalId: 'u-1',
    } as any);
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      ...notSystem,
      AND: [{ externalId: 'u-1' }],
    });
  });

  it('404s on it by id', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findOne('t1', 'sys-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject(
      notSystem,
    );
  });

  it.each(SYSTEM_EXTERNAL_IDS)(
    'refuses to sync or delete %s through the public API',
    async (externalId) => {
      await expect(service.upsert('t1', { externalId } as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.deleteByExternalId('t1', externalId),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.upsert).not.toHaveBeenCalled();
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    },
  );
});

describe('UsersService user deletion', () => {
  const tx = {
    comment: { updateMany: jest.fn() },
    like: { findMany: jest.fn(), deleteMany: jest.fn() },
    article: { updateMany: jest.fn() },
    report: { groupBy: jest.fn() },
    user: { deleteMany: jest.fn() },
  };
  const prisma = {
    user: { findFirst: jest.fn() },
    ensureUser: jest.fn(),
    $transaction: jest.fn(),
  };
  const service = new UsersService(prisma as any);
  const user = { id: 'u1', externalId: 'ext-1' };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(tx));
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.ensureUser.mockResolvedValue({ id: 'deleted-id' });
    tx.like.findMany.mockResolvedValue([]);
    tx.report.groupBy.mockResolvedValue([]);
    tx.user.deleteMany.mockResolvedValue({ count: 1 });
  });

  it('reassigns the comments of a deleted user to the placeholder', async () => {
    await service.deleteByExternalId('t1', 'ext-1');

    expect(prisma.ensureUser).toHaveBeenCalledWith(
      't1',
      DELETED_USER_ID,
      'Utente eliminato',
    );
    expect(tx.comment.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'u1', tenantId: 't1' },
      data: { authorId: 'deleted-id' },
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'u1', tenantId: 't1' },
    });
    // Comments move before the user row goes (comments.authorId is NO ACTION).
    expect(tx.comment.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it('decrements likesCount of the articles the user liked', async () => {
    tx.like.findMany.mockResolvedValue([
      { articleId: 'a1' },
      { articleId: 'a2' },
    ]);

    await service.deleteById('t1', 'u1');

    expect(tx.like.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      tenantId: 't1',
    });
    expect(tx.article.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1', 'a2'] }, tenantId: 't1' },
      data: { likesCount: { decrement: 1 } },
    });
  });

  it("drops the user's open reports from the comments' reportCount", async () => {
    tx.report.groupBy.mockResolvedValue([
      { targetId: 'c1', _count: { _all: 2 } },
    ]);

    await service.deleteByExternalId('t1', 'ext-1');

    expect(tx.report.groupBy.mock.calls[0][0].where).toEqual({
      tenantId: 't1',
      reporterId: 'ext-1',
      targetType: TargetType.COMMENT,
      status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
    });
    expect(tx.comment.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 't1', reportCount: { gte: 2 } },
      data: { reportCount: { decrement: 2 } },
    });
  });

  it('deletes an admin who moderated reports, leaving the reports to the FK', async () => {
    // moderatorId is cleared by `ON DELETE SET NULL ("moderatorId")`: the
    // service must not touch the moderated reports itself.
    await service.deleteById('t1', 'u1');

    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'u1',
      tenantId: 't1',
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({
      where: { id: 'u1', tenantId: 't1' },
    });
    expect(tx.report.groupBy.mock.calls[0][0].where.reporterId).toBe('ext-1');
    expect(tx.article.updateMany).not.toHaveBeenCalled();
  });

  it('404s on an unknown user without opening a transaction', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.deleteByExternalId('t1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
