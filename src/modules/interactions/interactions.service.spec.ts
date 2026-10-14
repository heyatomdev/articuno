import { NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { InteractionsService } from './interactions.service';

/** Like toggle: delete-first, and a lost insert race (P2002) still means "liked". */
describe('InteractionsService.toggleLikeArticle', () => {
  const tx = {
    like: { deleteMany: jest.fn(), create: jest.fn() },
    article: { update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    ensureUser: jest.fn(),
    article: { findFirst: jest.fn() },
  };
  const service = new InteractionsService(prisma as any);
  const toggle = () => service.toggleLikeArticle('t1', 'a1', 'ext-1');

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => unknown) => fn(tx),
    );
    prisma.article.findFirst.mockResolvedValue({ id: 'a1' });
    prisma.ensureUser.mockResolvedValue({ id: 'u1' });
  });

  it('unlikes when a like was deleted', async () => {
    tx.like.deleteMany.mockResolvedValue({ count: 1 });

    await expect(toggle()).resolves.toEqual({ liked: false });
    expect(tx.article.update.mock.calls[0][0].data).toEqual({
      likesCount: { decrement: 1 },
    });
    expect(tx.like.create).not.toHaveBeenCalled();
  });

  it('likes when there was nothing to delete', async () => {
    tx.like.deleteMany.mockResolvedValue({ count: 0 });

    await expect(toggle()).resolves.toEqual({ liked: true });
    expect(tx.article.update.mock.calls[0][0].data).toEqual({
      likesCount: { increment: 1 },
    });
  });

  it('reports liked, not 500, when a concurrent click won the insert (P2002)', async () => {
    tx.like.deleteMany.mockResolvedValue({ count: 0 });
    tx.like.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );

    await expect(toggle()).resolves.toEqual({ liked: true });
  });

  it('rethrows any other error', async () => {
    tx.like.deleteMany.mockResolvedValue({ count: 0 });
    tx.like.create.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'P1001' }),
    );

    await expect(toggle()).rejects.toThrow('boom');
  });
});

describe('InteractionsService article visibility', () => {
  const prisma = {
    $transaction: jest.fn(),
    ensureUser: jest.fn(),
    article: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    like: { count: jest.fn() },
    bookmark: { count: jest.fn() },
  };
  const service = new InteractionsService(prisma as any);
  const statuses = [
    ContentStatus.DRAFT,
    ContentStatus.PUBLISHED,
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ];
  const articleIn = (status: ContentStatus) =>
    prisma.article.findFirst.mockImplementation(({ where }) =>
      where.tenantId === 't1' && (!where.status || where.status === status)
        ? { id: 'a1' }
        : null,
    );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ensureUser.mockResolvedValue({ id: 'u1' });
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.like.count.mockResolvedValue(1);
    prisma.bookmark.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (arg) =>
      Array.isArray(arg) ? Promise.all(arg) : true,
    );
  });

  it.each(statuses)('toggleLikeArticle on %s', async (status) => {
    articleIn(status);
    const call = service.toggleLikeArticle('t1', 'a1', 'ext-1');

    if (status === ContentStatus.PUBLISHED) {
      await expect(call).resolves.toEqual({ liked: true });
    } else {
      await expect(call).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it.each(statuses)('getArticleStatus on %s', async (status) => {
    articleIn(status);
    const call = service.getArticleStatus('t1', 'a1', 'ext-1');

    if (status === ContentStatus.PUBLISHED) {
      await expect(call).resolves.toEqual({ liked: true, bookmarked: false });
    } else {
      await expect(call).rejects.toThrow(NotFoundException);
    }
  });

  it('scopes the like/bookmark counts to the tenant', async () => {
    articleIn(ContentStatus.PUBLISHED);
    await service.getArticleStatus('t1', 'a1', 'ext-1');
    expect(prisma.like.count.mock.calls[0][0].where.tenantId).toBe('t1');
    expect(prisma.bookmark.count.mock.calls[0][0].where.tenantId).toBe('t1');
  });
});
