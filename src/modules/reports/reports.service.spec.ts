import { ReportsService } from './reports.service';
import { ConflictException } from '@nestjs/common';
import {
  ContentStatus,
  ReportStatus,
  TargetType,
  UserStatus,
} from '@prisma/client';

/**
 * `withTargets` — the polymorphic lookup that turns a report's
 * `targetType` + `targetId` into a readable label.
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

/**
 * Auto-moderation thresholds against a mocked transaction client. The races
 * themselves (row lock, atomic increment, partial unique index) are enforced
 * by Postgres; these pin down what the service does with the values it gets.
 */
describe('ReportsService auto-moderation', () => {
  const tx = {
    $queryRaw: jest.fn(),
    report: { create: jest.fn(), count: jest.fn(), update: jest.fn() },
    article: { update: jest.fn(), findFirst: jest.fn() },
    comment: { update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    ensureUser: jest.fn(),
    article: { findFirst: jest.fn(), findMany: jest.fn() },
    comment: { findFirst: jest.fn(), findMany: jest.fn() },
    report: { findFirst: jest.fn() },
  };
  const policy = {
    getReportThreshold: (t: 'ARTICLE' | 'COMMENT') =>
      t === 'ARTICLE' ? 10 : 5,
  };
  const publisher = {
    publishArticleStatusChangedEvent: jest.fn(),
    publishArticleFlaggedEvent: jest.fn(),
    publishCommentHiddenEvent: jest.fn(),
    publishCommentModerationEvent: jest.fn(),
  };
  const service = new ReportsService(
    prisma as any,
    policy as any,
    publisher as any,
  );

  const report = (targetType: TargetType) =>
    service.create('t1', {
      targetType,
      targetId: 'x1',
      reason: 'SPAM',
      reporterId: 'ext-1',
    } as any);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => unknown) => fn(tx),
    );
    prisma.ensureUser.mockResolvedValue({ externalId: 'ext-1' });
    prisma.article.findFirst.mockResolvedValue({ id: 'x1' });
    prisma.comment.findFirst.mockResolvedValue({ id: 'x1' });
    prisma.article.findMany.mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);
    tx.report.create.mockImplementation(({ data }) => ({ id: 'r1', ...data }));
    tx.user.findFirst.mockResolvedValue({ externalId: 'author-ext' });
  });

  describe('article (threshold 10)', () => {
    beforeEach(() => {
      tx.$queryRaw.mockResolvedValue([
        { id: 'x1', status: ContentStatus.PUBLISHED },
      ]);
    });

    it('locks the article row, scoped by tenant, before counting', async () => {
      tx.report.count.mockResolvedValue(1);
      await report(TargetType.ARTICLE);

      const sql = tx.$queryRaw.mock.calls[0][0].join('?');
      expect(sql).toMatch(/FOR UPDATE/);
      expect(sql).toMatch(/"tenantId" = \?/);
      expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(['x1', 't1']);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.report.count.mock.invocationCallOrder[0],
      );
    });

    it('stays PUBLISHED below the threshold', async () => {
      tx.report.count.mockResolvedValue(9);
      await report(TargetType.ARTICLE);

      expect(tx.article.update).not.toHaveBeenCalled();
      expect(publisher.publishArticleFlaggedEvent).not.toHaveBeenCalled();
    });

    it('goes UNDER_REVIEW at the threshold and enqueues both events in the tx', async () => {
      tx.report.count.mockResolvedValue(10);
      await report(TargetType.ARTICLE);

      expect(tx.article.update).toHaveBeenCalledWith({
        where: { id: 'x1', tenantId: 't1' },
        data: { status: ContentStatus.UNDER_REVIEW },
      });
      expect(
        publisher.publishArticleStatusChangedEvent.mock.calls[0].at(-1),
      ).toBe(tx);
      expect(publisher.publishArticleFlaggedEvent).toHaveBeenCalledWith(
        't1',
        'x1',
        10,
        10,
        tx,
      );
    });

    it('does nothing once the article is already UNDER_REVIEW', async () => {
      tx.$queryRaw.mockResolvedValue([
        { id: 'x1', status: ContentStatus.UNDER_REVIEW },
      ]);
      tx.report.count.mockResolvedValue(11);
      await report(TargetType.ARTICLE);

      expect(tx.article.update).not.toHaveBeenCalled();
      expect(publisher.publishArticleStatusChangedEvent).not.toHaveBeenCalled();
    });
  });

  describe('comment (threshold 5)', () => {
    it('increments atomically and does not hide below the threshold', async () => {
      tx.comment.update.mockResolvedValue({ reportCount: 4, authorId: 'u1' });
      await report(TargetType.COMMENT);

      expect(tx.comment.update).toHaveBeenCalledWith({
        where: { id: 'x1', tenantId: 't1' },
        data: { reportCount: { increment: 1 } },
        select: { reportCount: true, authorId: true },
      });
      expect(tx.comment.updateMany).not.toHaveBeenCalled();
    });

    it('hides only a VISIBLE comment at the threshold and publishes in the tx', async () => {
      tx.comment.update.mockResolvedValue({ reportCount: 5, authorId: 'u1' });
      tx.comment.updateMany.mockResolvedValue({ count: 1 });
      await report(TargetType.COMMENT);

      expect(tx.comment.updateMany).toHaveBeenCalledWith({
        where: { id: 'x1', tenantId: 't1', status: ContentStatus.VISIBLE },
        data: { status: ContentStatus.HIDDEN },
      });
      expect(publisher.publishCommentHiddenEvent).toHaveBeenCalledWith(
        't1',
        'x1',
        'author-ext',
        'REPORT_THRESHOLD_REACHED',
        5,
        5,
        tx,
      );
    });

    it('publishes nothing when another report already hid it', async () => {
      tx.comment.update.mockResolvedValue({ reportCount: 6, authorId: 'u1' });
      tx.comment.updateMany.mockResolvedValue({ count: 0 });
      await report(TargetType.COMMENT);

      expect(publisher.publishCommentHiddenEvent).not.toHaveBeenCalled();
    });
  });

  it('maps the open-report unique violation (P2002) to 409', async () => {
    tx.report.create.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );
    await expect(report(TargetType.COMMENT)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps P2002 on reopening a report (another open one exists) to 409', async () => {
    prisma.report.findFirst.mockResolvedValue({
      id: 'r1',
      targetType: TargetType.ARTICLE,
      targetId: 'x1',
    });
    tx.report.update.mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );

    await expect(
      service.updateStatus('r1', 't1', { status: ReportStatus.PENDING } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('resolving a report whose comment was deleted does not throw', async () => {
    prisma.report.findFirst.mockResolvedValue({
      id: 'r1',
      targetType: TargetType.COMMENT,
      targetId: 'gone',
    });
    tx.report.update.mockResolvedValue({
      id: 'r1',
      targetType: TargetType.COMMENT,
      targetId: 'gone',
    });
    tx.comment.findFirst.mockResolvedValue(null);

    await expect(
      service.updateStatus('r1', 't1', {
        status: ReportStatus.RESOLVED,
      } as any),
    ).resolves.toBeDefined();
    expect(tx.comment.update).not.toHaveBeenCalled();
    expect(publisher.publishCommentModerationEvent).not.toHaveBeenCalled();
  });
});
