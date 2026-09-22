import { ReportsService } from './reports.service';
import { ContentStatus, TargetType, UserStatus } from '@prisma/client';

/**
 * Covers `withTargets` only — the polymorphic lookup that turns a report's
 * `targetType` + `targetId` into a readable label. Everything else in the
 * service is transactional moderation logic that needs a real database.
 */
describe('ReportsService.withTargets', () => {
  const prisma = {
    article: { findMany: jest.fn() },
    comment: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  };

  const service = new ReportsService(prisma as any, {} as any, {} as any);
  const withTargets = (reports: any[]) =>
    (service as any).withTargets('tenant-1', reports);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.article.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('labels an article with the first translation title', async () => {
    prisma.article.findMany.mockResolvedValue([
      {
        id: 'a1',
        status: ContentStatus.PUBLISHED,
        translations: [{ title: 'Titolo' }],
      },
    ]);

    const [row] = await withTargets([
      { targetType: TargetType.ARTICLE, targetId: 'a1' },
    ]);

    expect(row.target).toEqual({
      id: 'a1',
      label: 'Titolo',
      status: ContentStatus.PUBLISHED,
    });
  });

  it('falls back when an article has no translation to take a title from', async () => {
    prisma.article.findMany.mockResolvedValue([
      { id: 'a1', status: ContentStatus.DRAFT, translations: [] },
    ]);

    const [row] = await withTargets([
      { targetType: TargetType.ARTICLE, targetId: 'a1' },
    ]);

    expect(row.target.label).toBe('Articolo senza traduzioni');
  });

  it('collapses a comment body to a single truncated line', async () => {
    prisma.comment.findMany.mockResolvedValue([
      {
        id: 'c1',
        status: ContentStatus.VISIBLE,
        articleId: 'a9',
        content: `  parola\n\n${'x'.repeat(200)}  `,
      },
    ]);

    const [row] = await withTargets([
      { targetType: TargetType.COMMENT, targetId: 'c1' },
    ]);

    // 'parola ' (7) + 113 x's fills the 120-char cap exactly.
    expect(row.target.label).toBe(`parola ${'x'.repeat(113)}…`);
    expect(row.target.label).not.toMatch(/\n/);
    expect(row.target.articleId).toBe('a9');
  });

  it('matches a USER target by internal uuid or by external id', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u-uuid',
        externalId: 'ext-1',
        username: 'nina',
        status: UserStatus.ACTIVE,
      },
    ]);

    const rows = await withTargets([
      { targetType: TargetType.USER, targetId: 'u-uuid' },
      { targetType: TargetType.USER, targetId: 'ext-1' },
    ]);

    expect(rows.map((r: any) => r.target.label)).toEqual(['nina', 'nina']);
  });

  it('marks an unresolved target as missing and keeps the raw id as the label', async () => {
    const [row] = await withTargets([
      { targetType: TargetType.ARTICLE, targetId: 'gone' },
    ]);

    expect(row.target).toEqual({
      id: 'gone',
      label: 'gone',
      status: null,
      missing: true,
    });
  });

  it('queries each target type once, and only when it is present', async () => {
    await withTargets([
      { targetType: TargetType.ARTICLE, targetId: 'a1' },
      { targetType: TargetType.ARTICLE, targetId: 'a1' },
      { targetType: TargetType.ARTICLE, targetId: 'a2' },
    ]);

    expect(prisma.article.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.article.findMany.mock.calls[0][0].where.id.in).toEqual([
      'a1',
      'a2',
    ]);
    expect(prisma.comment.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
