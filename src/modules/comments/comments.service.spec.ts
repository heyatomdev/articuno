import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CommentsService } from './comments.service';
import {
  CommentFiltersQueryDto,
  PublicCommentFiltersQueryDto,
} from './dto/comment-filters-query.dto';
import { SYSTEM_REPORTER_ID } from '@/modules/users/users.constants';

describe('CommentsService', () => {
  const prisma = {
    comment: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    article: { findFirst: jest.fn() },
    user: { upsert: jest.fn() },
    report: { create: jest.fn() },
    $transaction: jest.fn(),
    ensureUser: jest.fn(),
  };
  const moderationPolicy = {
    checkBannedWords: jest.fn(),
    checkUserModeration: jest.fn(),
    applyCreationPolicy: jest.fn(),
  };
  const webhookPublisher = { publishCommentModerationEvent: jest.fn() };
  const service = new CommentsService(
    prisma as any,
    moderationPolicy as any,
    webhookPublisher as any,
  );

  const current = (status: ContentStatus) =>
    prisma.comment.findFirst.mockResolvedValue({
      status,
      author: { externalId: 'ext-1' },
    });

  beforeEach(() => {
    jest.resetAllMocks();
    moderationPolicy.checkBannedWords.mockResolvedValue(false);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.comment.update.mockImplementation(({ data }) => ({
      id: 'c1',
      ...data,
    }));
    prisma.comment.create.mockImplementation(({ data }) => ({
      id: 'new-comment',
      ...data,
    }));
    prisma.article.findFirst.mockResolvedValue({ id: 'a1' });
    prisma.ensureUser.mockResolvedValue({ id: 'u1', externalId: 'ext-1' });
    moderationPolicy.checkUserModeration.mockResolvedValue({ isAllowed: true });
  });

  it('rejects a transition out of BANNED', async () => {
    current(ContentStatus.BANNED);
    await expect(
      service.update('t1', 'c1', { status: ContentStatus.VISIBLE }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('scopes the write to the tenant', async () => {
    current(ContentStatus.VISIBLE);
    await service.update('t1', 'c1', { status: ContentStatus.HIDDEN });
    expect(prisma.comment.update.mock.calls[0][0].where).toEqual({
      id: 'c1',
      tenantId: 't1',
    });
  });

  it('strips tags from the new content', async () => {
    current(ContentStatus.VISIBLE);
    await service.update('t1', 'c1', {
      content: 'ciao <script>alert(1)</script><b>mondo</b>',
    });
    expect(prisma.comment.update.mock.calls[0][0].data.content).toBe(
      'ciao mondo',
    );
  });

  it('rejects content that is empty once tags are gone', async () => {
    current(ContentStatus.VISIBLE);
    await expect(
      service.update('t1', 'c1', { content: '<img src=x onerror=alert(1)>' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('hides the comment and enqueues a webhook when the edit adds a banned word', async () => {
    current(ContentStatus.VISIBLE);
    moderationPolicy.checkBannedWords.mockResolvedValue(true);

    await service.update('t1', 'c1', { content: 'parolaccia' });

    expect(prisma.comment.update.mock.calls[0][0].data.status).toBe(
      ContentStatus.HIDDEN,
    );
    expect(webhookPublisher.publishCommentModerationEvent).toHaveBeenCalledWith(
      't1',
      'c1',
      'ext-1',
      ContentStatus.HIDDEN,
      'BANNED_WORD_DETECTED',
    );
  });

  it('lets an explicit moderator status win over the banned-word auto-hide', async () => {
    current(ContentStatus.HIDDEN);
    moderationPolicy.checkBannedWords.mockResolvedValue(true);

    await service.update('t1', 'c1', {
      content: 'parolaccia',
      status: ContentStatus.VISIBLE,
    });

    expect(prisma.comment.update.mock.calls[0][0].data.status).toBe(
      ContentStatus.VISIBLE,
    );
    expect(
      webhookPublisher.publishCommentModerationEvent,
    ).not.toHaveBeenCalled();
  });

  it('reports a banned-word edit as the system user, on the comment id', async () => {
    current(ContentStatus.VISIBLE);
    moderationPolicy.checkBannedWords.mockResolvedValue(true);

    await service.update('t1', 'c1', { content: 'parolaccia' });

    expect(prisma.report.create.mock.calls[0][0].data).toMatchObject({
      targetId: 'c1',
      reporterId: SYSTEM_REPORTER_ID,
      tenantId: 't1',
    });
  });

  describe('create with a banned word', () => {
    beforeEach(() => {
      moderationPolicy.applyCreationPolicy.mockResolvedValue({
        finalStatus: ContentStatus.HIDDEN,
        autoModerated: true,
        reason: 'BANNED_WORD_DETECTED',
        shouldCreateSystemReport: true,
      });
    });

    const create = () =>
      service.create('t1', {
        articleId: 'a1',
        content: 'parolaccia',
        authorExternalId: 'ext-1',
      });

    it('creates the comment first and reports it by comment id, not article id', async () => {
      await create();

      expect(prisma.comment.create).toHaveBeenCalled();
      expect(prisma.report.create.mock.calls[0][0].data).toMatchObject({
        targetType: 'COMMENT',
        targetId: 'new-comment',
        reporterId: SYSTEM_REPORTER_ID,
      });
      expect(prisma.comment.create.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.report.create.mock.invocationCallOrder[0],
      );
    });

    it('provisions the system reporter in the same tenant (FK onto users)', async () => {
      await create();

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            externalId_tenantId: {
              externalId: SYSTEM_REPORTER_ID,
              tenantId: 't1',
            },
          },
        }),
      );
    });

    it('runs comment and report in one transaction', async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = { ...prisma, report: { create: jest.fn() } };
        tx.report.create.mockRejectedValue(new Error('fk'));
        return fn(tx);
      });
      await expect(create()).rejects.toThrow('fk');
      expect(
        webhookPublisher.publishCommentModerationEvent,
      ).not.toHaveBeenCalled();
    });
  });
});

describe('CommentsService public visibility', () => {
  const ARTICLE_STATUSES = [
    ContentStatus.DRAFT,
    ContentStatus.PUBLISHED,
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ];
  const COMMENT_STATUSES = [
    ContentStatus.VISIBLE,
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ];
  // Tenant t1: one comment per (article status, comment status); tenant t2:
  // one VISIBLE comment on a PUBLISHED article.
  const rows = [
    ...ARTICLE_STATUSES.flatMap((articleStatus) =>
      COMMENT_STATUSES.map((status) => ({
        id: `c-${articleStatus}-${status}`,
        tenantId: 't1',
        articleId: `a-${articleStatus}`,
        status,
        content: 'testo',
        author: { tenantId: 't1', externalId: 'author-1' },
        article: { tenantId: 't1', status: articleStatus },
      })),
    ),
    {
      id: 'c-other',
      tenantId: 't2',
      articleId: 'a-other',
      status: ContentStatus.VISIBLE,
      content: 'testo',
      author: { tenantId: 't2', externalId: 'author-1' },
      article: { tenantId: 't2', status: ContentStatus.PUBLISHED },
    },
  ];
  type Row = (typeof rows)[number];

  // Evaluates the subset of Prisma `where` the service builds for these paths.
  const inList = (value: string, cond: any) =>
    cond === undefined || cond.in.includes(value);
  const matches = (row: Row, where: any) =>
    row.tenantId === where.tenantId &&
    (where.id === undefined || row.id === where.id) &&
    (where.articleId === undefined || row.articleId === where.articleId) &&
    inList(row.status, where.status) &&
    (where.author === undefined ||
      (row.author.tenantId === where.author.tenantId &&
        row.author.externalId === where.author.externalId)) &&
    (where.article === undefined ||
      (row.article.tenantId === where.article.tenantId &&
        inList(row.article.status, where.article.status)));
  const articleMatches = (row: Row, where: any) =>
    row.article.tenantId === where.tenantId &&
    row.articleId === where.id &&
    inList(row.article.status, where.status);

  const prisma = {
    comment: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    article: { findFirst: jest.fn() },
    $transaction: jest.fn(),
    ensureUser: jest.fn(),
  };
  const moderationPolicy = {
    checkUserModeration: jest.fn(),
    applyCreationPolicy: jest.fn(),
  };
  const service = new CommentsService(
    prisma as any,
    moderationPolicy as any,
    { publishCommentModerationEvent: jest.fn() } as any,
  );
  const publicQuery = (extra: object = {}) =>
    Object.assign(new PublicCommentFiltersQueryDto(), { limit: 100 }, extra);
  const idsOf = (result: { data: any[] }) =>
    result.data.map((c) => c.id).sort();

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.comment.findMany.mockImplementation(({ where }) =>
      rows.filter((r) => matches(r, where)),
    );
    prisma.comment.count.mockImplementation(
      ({ where }) => rows.filter((r) => matches(r, where)).length,
    );
    prisma.comment.findFirst.mockImplementation(
      ({ where }) => rows.find((r) => matches(r, where)) ?? null,
    );
    prisma.article.findFirst.mockImplementation(({ where }) => {
      const row = rows.find((r) => articleMatches(r, where));
      return row ? { id: row.articleId } : null;
    });
    prisma.$transaction.mockImplementation((arg) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    );
    prisma.comment.create.mockImplementation(({ data }) => ({
      id: 'new',
      ...data,
    }));
    prisma.ensureUser.mockResolvedValue({ id: 'u1', externalId: 'ext-1' });
    moderationPolicy.checkUserModeration.mockResolvedValue({ isAllowed: true });
    moderationPolicy.applyCreationPolicy.mockResolvedValue({
      finalStatus: ContentStatus.VISIBLE,
      autoModerated: false,
    });
  });

  describe('findAllPublic', () => {
    it('lists only VISIBLE and UNDER_REVIEW comments of PUBLISHED articles', async () => {
      const result = await service.findAllPublic('t1', publicQuery());
      expect(idsOf(result)).toEqual([
        'c-PUBLISHED-UNDER_REVIEW',
        'c-PUBLISHED-VISIBLE',
      ]);
    });

    it.each(ARTICLE_STATUSES.filter((s) => s !== ContentStatus.PUBLISHED))(
      'returns nothing for an article in %s, even filtered by articleId',
      async (status) => {
        const result = await service.findAllPublic(
          't1',
          publicQuery({ articleId: `a-${status}` }),
        );
        expect(result.data).toEqual([]);
        expect(result.meta.total).toBe(0);
      },
    );

    it.each([ContentStatus.VISIBLE, ContentStatus.UNDER_REVIEW])(
      'narrows to status=%s',
      async (status) => {
        const result = await service.findAllPublic(
          't1',
          publicQuery({ status }),
        );
        expect(idsOf(result)).toEqual([`c-PUBLISHED-${status}`]);
      },
    );

    it('nulls the content of UNDER_REVIEW comments', async () => {
      const result = await service.findAllPublic(
        't1',
        publicQuery({ status: ContentStatus.UNDER_REVIEW }),
      );
      expect(result.data[0].content).toBeNull();
    });

    it('stays scoped to the tenant', async () => {
      const result = await service.findAllPublic('t2', publicQuery());
      expect(idsOf(result)).toEqual(['c-other']);
    });
  });

  describe('findOnePublic', () => {
    it('reads a VISIBLE comment of a PUBLISHED article', async () => {
      await expect(
        service.findOnePublic('t1', 'c-PUBLISHED-VISIBLE'),
      ).resolves.toMatchObject({ content: 'testo' });
    });

    it.each(ARTICLE_STATUSES.filter((s) => s !== ContentStatus.PUBLISHED))(
      'answers 404 for a VISIBLE comment of an article in %s',
      async (status) => {
        await expect(
          service.findOnePublic('t1', `c-${status}-VISIBLE`),
        ).rejects.toThrow(NotFoundException);
      },
    );

    it.each([ContentStatus.HIDDEN, ContentStatus.BANNED])(
      'answers 404 for a %s comment',
      async (status) => {
        await expect(
          service.findOnePublic('t1', `c-PUBLISHED-${status}`),
        ).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('findOnePublic with X-User-Id', () => {
    it.each([
      'c-PUBLISHED-HIDDEN',
      'c-PUBLISHED-BANNED',
      'c-HIDDEN-VISIBLE',
      'c-DRAFT-HIDDEN',
    ])('lets the author read own %s, with content', async (id) => {
      await expect(
        service.findOnePublic('t1', id, 'author-1'),
      ).resolves.toMatchObject({ id, content: 'testo' });
    });

    it('answers 404 to a non-author on a HIDDEN comment', async () => {
      await expect(
        service.findOnePublic('t1', 'c-PUBLISHED-HIDDEN', 'someone-else'),
      ).rejects.toThrow(NotFoundException);
    });

    it('applies the public rule to a non-author', async () => {
      await expect(
        service.findOnePublic('t1', 'c-PUBLISHED-UNDER_REVIEW', 'someone-else'),
      ).resolves.toMatchObject({ content: null });
      await expect(
        service.findOnePublic('t1', 'c-HIDDEN-VISIBLE', 'someone-else'),
      ).rejects.toThrow(NotFoundException);
    });

    it('does not match the author across tenants', async () => {
      await expect(
        service.findOnePublic('t2', 'c-PUBLISHED-HIDDEN', 'author-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(['articuno:deleted', 'articuno:system'])(
      'never treats the internal id %s as an author',
      async (viewer) => {
        await service
          .findOnePublic('t1', 'c-PUBLISHED-VISIBLE', viewer)
          .catch(() => undefined);
        expect(
          prisma.comment.findFirst.mock.calls.every(
            ([{ where }]) => where.author === undefined,
          ),
        ).toBe(true);
      },
    );
  });

  describe('create', () => {
    const create = (articleId: string) =>
      service.create('t1', {
        articleId,
        content: 'ciao',
        authorExternalId: 'ext-1',
      });

    it('accepts a comment on a PUBLISHED article', async () => {
      await expect(create('a-PUBLISHED')).resolves.toMatchObject({
        articleId: 'a-PUBLISHED',
      });
    });

    it.each(ARTICLE_STATUSES.filter((s) => s !== ContentStatus.PUBLISHED))(
      'answers 404 on an article in %s',
      async (status) => {
        await expect(create(`a-${status}`)).rejects.toThrow(NotFoundException);
        expect(prisma.comment.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('admin paths stay unfiltered', () => {
    it('findAll returns every comment of the tenant', async () => {
      const query = Object.assign(new CommentFiltersQueryDto(), { limit: 100 });
      const result = await service.findAll('t1', query);
      expect(result.data).toHaveLength(
        ARTICLE_STATUSES.length * COMMENT_STATUSES.length,
      );
      expect(result.data.every((c) => c.content === 'testo')).toBe(true);
    });

    it('findAll honours status', async () => {
      const query = Object.assign(new CommentFiltersQueryDto(), { limit: 100 });
      const result = await service.findAll('t1', query, {
        statuses: [ContentStatus.HIDDEN],
      });
      expect(result.data.map((c) => c.status)).toEqual(
        ARTICLE_STATUSES.map(() => ContentStatus.HIDDEN),
      );
    });

    it('findAll includes the parent article only when asked', async () => {
      const query = Object.assign(new CommentFiltersQueryDto(), { limit: 100 });
      await service.findAll('t1', query, { withArticle: true });
      expect(prisma.comment.findMany.mock.lastCall[0].include.article).toEqual({
        select: {
          id: true,
          translations: {
            select: { title: true, slug: true, languageCode: true },
            orderBy: { languageCode: 'asc' },
            take: 1,
          },
        },
      });
      await service.findAllPublic('t1', publicQuery());
      expect(
        prisma.comment.findMany.mock.lastCall[0].include.article,
      ).toBeUndefined();
    });

    it('findOne reads a HIDDEN comment of a BANNED article', async () => {
      await expect(
        service.findOne('t1', 'c-BANNED-HIDDEN'),
      ).resolves.toMatchObject({ content: 'testo' });
    });
  });
});

describe('PublicCommentFiltersQueryDto validation', () => {
  const validate = (raw: object) =>
    validateSync(plainToInstance(PublicCommentFiltersQueryDto, raw));

  it.each([
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
    ContentStatus.PUBLISHED,
  ])('rejects status=%s', (status) => {
    expect(validate({ status })).not.toHaveLength(0);
  });

  it.each([ContentStatus.VISIBLE, ContentStatus.UNDER_REVIEW])(
    'accepts status=%s',
    (status) => {
      expect(validate({ status })).toHaveLength(0);
    },
  );
});
