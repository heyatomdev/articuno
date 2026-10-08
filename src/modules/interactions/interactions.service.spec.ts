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
