import { BookmarksService } from './bookmarks.service';

/** Bookmark toggle: delete-first, and a lost insert race (P2002) still means "bookmarked". */
describe('BookmarksService.toggle', () => {
  const prisma = {
    ensureUser: jest.fn(),
    article: { findFirst: jest.fn() },
    bookmark: { deleteMany: jest.fn(), create: jest.fn() },
  };
  const service = new BookmarksService(prisma as any);
  const toggle = () => service.toggle('t1', 'a1', 'ext-1');

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.article.findFirst.mockResolvedValue({ id: 'a1' });
    prisma.ensureUser.mockResolvedValue({ id: 'u1' });
  });

  it('removes an existing bookmark', async () => {
    prisma.bookmark.deleteMany.mockResolvedValue({ count: 1 });

    await expect(toggle()).resolves.toEqual({ bookmarked: false });
    expect(prisma.bookmark.create).not.toHaveBeenCalled();
  });

  it('reports bookmarked, not 500, when a concurrent click won the insert (P2002)', async () => {
    prisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });
    prisma.bookmark.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );

    await expect(toggle()).resolves.toEqual({ bookmarked: true });
  });

  it('rethrows any other error', async () => {
    prisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });
    prisma.bookmark.create.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'P1001' }),
    );

    await expect(toggle()).rejects.toThrow('boom');
  });
});
