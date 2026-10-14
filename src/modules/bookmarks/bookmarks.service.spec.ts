import { NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { BookmarksService } from './bookmarks.service';

const ARTICLE_STATUSES = [
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.UNDER_REVIEW,
  ContentStatus.HIDDEN,
  ContentStatus.BANNED,
];

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

describe('BookmarksService.toggle article visibility', () => {
  const prisma = {
    ensureUser: jest.fn(),
    article: { findFirst: jest.fn() },
    bookmark: { deleteMany: jest.fn(), create: jest.fn() },
  };
  const service = new BookmarksService(prisma as any);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ensureUser.mockResolvedValue({ id: 'u1' });
    prisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });
  });

  it.each(ARTICLE_STATUSES)('%s', async (status) => {
    // Fake findFirst honouring the tenant and status filters the service sends.
    prisma.article.findFirst.mockImplementation(({ where }) =>
      where.tenantId === 't1' && (!where.status || where.status === status)
        ? { id: 'a1' }
        : null,
    );
    const call = service.toggle('t1', 'a1', 'ext-1');

    if (status === ContentStatus.PUBLISHED) {
      await expect(call).resolves.toEqual({ bookmarked: true });
    } else {
      await expect(call).rejects.toThrow(NotFoundException);
      expect(prisma.bookmark.create).not.toHaveBeenCalled();
      expect(prisma.bookmark.deleteMany).not.toHaveBeenCalled();
    }
  });
});
