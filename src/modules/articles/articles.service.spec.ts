import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ArticlesService } from './articles.service';
import {
  ArticleFiltersQueryDto,
  PublicArticleFiltersQueryDto,
  adminArticleOrderBy,
} from './dto/article-filters-query.dto';

describe('ArticlesService.update status FSM', () => {
  const prisma = {
    article: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const webhookPublisher = { publishArticleStatusChangedEvent: jest.fn() };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    webhookPublisher as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.article.update.mockImplementation(({ data }) => ({
      id: 'a1',
      ...data,
    }));
  });

  it('rejects an invalid transition without writing', async () => {
    prisma.article.findFirst.mockResolvedValue({
      id: 'a1',
      status: ContentStatus.BANNED,
    });
    await expect(
      service.update('t1', 'a1', { status: ContentStatus.PUBLISHED }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('allows a valid transition and enqueues the status webhook', async () => {
    prisma.article.findFirst.mockResolvedValue({
      id: 'a1',
      status: ContentStatus.DRAFT,
    });
    await service.update('t1', 'a1', { status: ContentStatus.PUBLISHED });
    expect(prisma.article.update).toHaveBeenCalled();
    expect(
      webhookPublisher.publishArticleStatusChangedEvent,
    ).toHaveBeenCalledWith(
      't1',
      'a1',
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      undefined,
      undefined,
      prisma,
    );
  });
});

describe('ArticlesService.create with a banned word', () => {
  const prisma = {
    category: { findFirst: jest.fn() },
    article: { create: jest.fn() },
    articleTranslation: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const bannedWords = { checkText: jest.fn() };
  const webhookPublisher = {
    publishArticleStatusChangedEvent: jest.fn(),
    publishArticleLifecycleEvent: jest.fn(),
  };
  const service = new ArticlesService(
    prisma as any,
    bannedWords as any,
    {} as any,
    webhookPublisher as any,
  );
  const dto = (extra: object = {}) => ({
    categoryId: 'cat-1',
    translations: [{ languageCode: 'it', title: 'Titolo', content: 'testo' }],
    ...extra,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
    prisma.articleTranslation.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.article.create.mockImplementation(({ data }) => ({
      id: 'a1',
      status: data.status,
    }));
  });

  it('slugs translations without random suffixes, numbering only collisions', async () => {
    bannedWords.checkText.mockResolvedValue(false);
    prisma.articleTranslation.findMany.mockResolvedValue([{ slug: 'pizza' }]);

    await service.create(
      't1',
      dto({
        translations: [
          { languageCode: 'it', title: 'Pizza', content: 'x' },
          { languageCode: 'en', title: 'Pizza', content: 'x' },
          { languageCode: 'fr', title: 'Crêpe', content: 'x' },
        ],
      }) as any,
    );

    const created =
      prisma.article.create.mock.calls[0][0].data.translations.create;
    expect(created.map((t) => t.slug)).toEqual(['pizza-2', 'pizza-3', 'crepe']);
    expect(
      prisma.articleTranslation.findMany.mock.calls[0][0].where.tenantId,
    ).toBe('t1');
  });

  it('creates the article HIDDEN and enqueues article.status_changed in the same tx', async () => {
    bannedWords.checkText.mockResolvedValue(true);

    const article = await service.create('t1', dto() as any);

    expect(article.status).toBe(ContentStatus.HIDDEN);
    expect(
      webhookPublisher.publishArticleStatusChangedEvent,
    ).toHaveBeenCalledWith(
      't1',
      'a1',
      ContentStatus.DRAFT,
      ContentStatus.HIDDEN,
      'BANNED_WORD_DETECTED',
      'system',
      prisma,
    );
  });

  it('reports the requested status as the old one', async () => {
    bannedWords.checkText.mockResolvedValue(true);

    await service.create('t1', dto({ status: ContentStatus.PUBLISHED }) as any);

    expect(
      webhookPublisher.publishArticleStatusChangedEvent.mock.calls[0][2],
    ).toBe(ContentStatus.PUBLISHED);
  });

  it('rolls the article back if the outbox write fails', async () => {
    bannedWords.checkText.mockResolvedValue(true);
    webhookPublisher.publishArticleStatusChangedEvent.mockRejectedValue(
      new Error('outbox'),
    );

    await expect(service.create('t1', dto() as any)).rejects.toThrow('outbox');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it.each([ContentStatus.HIDDEN, ContentStatus.BANNED])(
    'keeps a requested %s status and emits nothing',
    async (status) => {
      bannedWords.checkText.mockResolvedValue(true);

      const article = await service.create('t1', dto({ status }) as any);

      expect(article.status).toBe(status);
      expect(
        webhookPublisher.publishArticleStatusChangedEvent,
      ).not.toHaveBeenCalled();
    },
  );

  it('emits nothing for clean content', async () => {
    bannedWords.checkText.mockResolvedValue(false);

    const article = await service.create('t1', dto() as any);

    expect(article.status).toBe(ContentStatus.DRAFT);
    expect(
      webhookPublisher.publishArticleStatusChangedEvent,
    ).not.toHaveBeenCalled();
    expect(
      webhookPublisher.publishArticleLifecycleEvent,
    ).not.toHaveBeenCalled();
  });

  it('enqueues article.published in the same tx when created PUBLISHED', async () => {
    bannedWords.checkText.mockResolvedValue(false);
    const publishedAt = new Date();
    webhookPublisher.publishArticleLifecycleEvent.mockResolvedValue(
      publishedAt,
    );

    const article = await service.create(
      't1',
      dto({ status: ContentStatus.PUBLISHED }) as any,
    );

    expect(webhookPublisher.publishArticleLifecycleEvent).toHaveBeenCalledWith(
      't1',
      'a1',
      null,
      ContentStatus.PUBLISHED,
      prisma,
    );
    expect(article.publishedAt).toBe(publishedAt);
  });
});

describe('ArticlesService.remove', () => {
  const prisma = {
    article: { findFirst: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  };
  const webhookPublisher = {
    articleSummary: jest.fn(),
    publishArticleDeletedEvent: jest.fn(),
  };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    webhookPublisher as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
  });

  it('reads the summary, deletes and enqueues article.deleted in one tx', async () => {
    prisma.article.findFirst.mockResolvedValue({ id: 'a1', coverImage: null });
    const summary = { id: 'a1', translations: [] };
    webhookPublisher.articleSummary.mockResolvedValue(summary);

    await service.remove('t1', 'a1');

    expect(webhookPublisher.articleSummary).toHaveBeenCalledWith(
      prisma,
      't1',
      'a1',
    );
    expect(prisma.article.delete).toHaveBeenCalledWith({
      where: { id: 'a1', tenantId: 't1' },
    });
    expect(webhookPublisher.publishArticleDeletedEvent).toHaveBeenCalledWith(
      't1',
      summary,
      prisma,
    );
  });

  it('emits nothing for an article of another tenant', async () => {
    prisma.article.findFirst.mockResolvedValue(null);

    await expect(service.remove('t1', 'a1')).rejects.toThrow(NotFoundException);
    expect(webhookPublisher.publishArticleDeletedEvent).not.toHaveBeenCalled();
  });
});

describe('ArticlesService.assertOwnCoverImage', () => {
  const prisma = { tenant: { findFirst: jest.fn() } };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    prisma.tenant.findFirst.mockResolvedValue({
      fileharborEndpoint: 'https://fileharbor.local/v2',
    });
  });

  it('accepts an image of the tenant FileHarbor and an absent cover', async () => {
    await expect(
      service.assertOwnCoverImage(
        't1',
        'https://fileharbor.local/v2/images/abc',
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertOwnCoverImage('t1', null),
    ).resolves.toBeUndefined();
  });

  it('rejects any other URL', async () => {
    await expect(
      service.assertOwnCoverImage('t1', 'https://evil.example/v2/images/abc'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a cover when the tenant has no FileHarbor configured', async () => {
    prisma.tenant.findFirst.mockResolvedValue({ fileharborEndpoint: null });
    await expect(
      service.assertOwnCoverImage(
        't1',
        'https://fileharbor.local/v2/images/abc',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ArticlesService public visibility', () => {
  const ALL_STATUSES = [
    ContentStatus.DRAFT,
    ContentStatus.PUBLISHED,
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ];
  const HIDDEN_FROM_PUBLIC = [
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ];
  // One article per status in tenant t1, plus a PUBLISHED one in t2.
  const rows = [
    ...ALL_STATUSES.map((status) => ({
      id: `a-${status}`,
      tenantId: 't1',
      status,
      slug: `slug-${status}`,
    })),
    {
      id: 'a-other',
      tenantId: 't2',
      status: ContentStatus.PUBLISHED,
      slug: 'slug-other',
    },
  ];

  // Evaluates the subset of Prisma `where` the service builds for these paths.
  const matches = (row: (typeof rows)[number], where: any) =>
    row.tenantId === where.tenantId &&
    (where.status === undefined ||
      (typeof where.status === 'string'
        ? row.status === where.status
        : where.status.in.includes(row.status))) &&
    (where.translations?.some?.slug === undefined ||
      row.slug === where.translations.some.slug);

  const prisma = {
    article: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const page = (extra: object = {}) =>
    Object.assign(new PublicArticleFiltersQueryDto(), extra);
  const statusesOf = (result: { data: any[] }) =>
    result.data.map((a) => a.status).sort();

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.article.findMany.mockImplementation(({ where }) =>
      rows.filter((r) => matches(r, where)),
    );
    prisma.article.count.mockImplementation(
      ({ where }) => rows.filter((r) => matches(r, where)).length,
    );
    prisma.article.findFirst.mockImplementation(
      ({ where }) => rows.find((r) => matches(r, where)) ?? null,
    );
    prisma.$transaction.mockImplementation((ops) => Promise.all(ops));
  });

  describe('findAllPublic', () => {
    it('defaults to PUBLISHED only', async () => {
      const result = await service.findAllPublic('t1', page());
      expect(statusesOf(result)).toEqual([ContentStatus.PUBLISHED]);
      expect(result.meta.total).toBe(1);
    });

    it('adds DRAFT only with includeDrafts', async () => {
      const result = await service.findAllPublic(
        't1',
        page({ includeDrafts: true }),
      );
      expect(statusesOf(result)).toEqual(
        [ContentStatus.DRAFT, ContentStatus.PUBLISHED].sort(),
      );
    });

    it('never returns moderated statuses, even with includeDrafts', async () => {
      for (const includeDrafts of [false, true]) {
        const result = await service.findAllPublic(
          't1',
          page({ includeDrafts }),
        );
        for (const status of HIDDEN_FROM_PUBLIC) {
          expect(statusesOf(result)).not.toContain(status);
        }
      }
    });

    it('narrows to status=DRAFT with includeDrafts', async () => {
      const result = await service.findAllPublic(
        't1',
        page({ includeDrafts: true, status: ContentStatus.DRAFT }),
      );
      expect(statusesOf(result)).toEqual([ContentStatus.DRAFT]);
    });

    it('rejects status=DRAFT without includeDrafts', async () => {
      await expect(
        service.findAllPublic('t1', page({ status: ContentStatus.DRAFT })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.article.findMany).not.toHaveBeenCalled();
    });

    it('stays scoped to the tenant', async () => {
      await service.findAllPublic('t1', page({ includeDrafts: true }));
      expect(prisma.article.findMany.mock.calls[0][0].where.tenantId).toBe(
        't1',
      );
      const result = await service.findAllPublic('t1', page());
      expect(result.data.map((a) => a.id)).not.toContain('a-other');
    });
  });

  describe('findOnePublic', () => {
    it.each(ALL_STATUSES)('%s without includeDrafts', async (status) => {
      const call = service.findOnePublic('t1', `slug-${status}`);
      if (status === ContentStatus.PUBLISHED) {
        await expect(call).resolves.toMatchObject({ status });
      } else {
        await expect(call).rejects.toThrow(NotFoundException);
      }
    });

    it.each(ALL_STATUSES)('%s with includeDrafts', async (status) => {
      const call = service.findOnePublic(
        't1',
        `slug-${status}`,
        undefined,
        true,
      );
      if (
        status === ContentStatus.PUBLISHED ||
        status === ContentStatus.DRAFT
      ) {
        await expect(call).resolves.toMatchObject({ status });
      } else {
        await expect(call).rejects.toThrow(NotFoundException);
      }
    });

    it('does not resolve another tenant slug', async () => {
      await expect(service.findOnePublic('t1', 'slug-other')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('admin paths stay unfiltered', () => {
    it('findAll returns every status', async () => {
      const query = Object.assign(new ArticleFiltersQueryDto(), {});
      const result = await service.findAll('t1', query);
      expect(statusesOf(result)).toEqual([...ALL_STATUSES].sort());
    });

    it.each(ALL_STATUSES)('findOne resolves %s', async (status) => {
      await expect(
        service.findOne('t1', `slug-${status}`),
      ).resolves.toMatchObject({ status });
    });
  });
});

describe('PublicArticleFiltersQueryDto validation', () => {
  const validate = (raw: object) =>
    validateSync(plainToInstance(PublicArticleFiltersQueryDto, raw));

  it.each([
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ])('rejects status=%s', (status) => {
    expect(validate({ status })).not.toHaveLength(0);
  });

  it.each([ContentStatus.PUBLISHED, ContentStatus.DRAFT])(
    'accepts status=%s',
    (status) => {
      expect(validate({ status })).toHaveLength(0);
    },
  );

  it('parses includeDrafts from the query string', () => {
    const dto = plainToInstance(PublicArticleFiltersQueryDto, {
      includeDrafts: 'true',
    });
    expect(dto.includeDrafts).toBe(true);
    expect(validateSync(dto)).toHaveLength(0);
  });
});

describe('ArticlesService.findAll admin search', () => {
  const prisma = {
    article: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const whereOf = async (extra: object) => {
    await service.findAll(
      't1',
      Object.assign(new ArticleFiltersQueryDto(), extra),
    );
    return prisma.article.findMany.mock.calls[0][0].where;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.article.findMany.mockResolvedValue([]);
    prisma.article.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation((ops) => Promise.all(ops));
  });

  it('matches a translation title, case-insensitive', async () => {
    expect((await whereOf({ search: 'nest' })).translations).toEqual({
      some: { title: { contains: 'nest', mode: 'insensitive' } },
    });
  });

  it('requires the title match in the filtered language', async () => {
    expect(
      (await whereOf({ search: 'nest', languageCode: 'it' })).translations,
    ).toEqual({
      some: {
        languageCode: 'it',
        title: { contains: 'nest', mode: 'insensitive' },
      },
    });
  });

  it('adds no translation filter without search or language', async () => {
    expect((await whereOf({})).translations).toBeUndefined();
  });
});

describe('adminArticleOrderBy', () => {
  it('defaults to createdAt desc with an id tiebreak', () => {
    expect(adminArticleOrderBy({})).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('puts unpublished articles last on publishedAt', () => {
    expect(
      adminArticleOrderBy({ sortBy: 'publishedAt', sortOrder: 'asc' }),
    ).toEqual([{ publishedAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]);
  });

  it('sorts by views', () => {
    expect(adminArticleOrderBy({ sortBy: 'views' })).toEqual([
      { views: 'desc' },
      { id: 'desc' },
    ]);
  });
});

describe('ArticleFiltersQueryDto validation', () => {
  const validate = (raw: object) =>
    validateSync(plainToInstance(ArticleFiltersQueryDto, raw));

  it('trims search and caps it at 100 characters', () => {
    const dto = plainToInstance(ArticleFiltersQueryDto, { search: '  nest ' });
    expect(dto.search).toBe('nest');
    expect(validate({ search: 'x'.repeat(101) })).not.toHaveLength(0);
  });

  it.each(['createdAt', 'updatedAt', 'publishedAt', 'views'])(
    'accepts sortBy=%s',
    (sortBy) => {
      expect(validate({ sortBy, sortOrder: 'asc' })).toHaveLength(0);
    },
  );

  it('rejects an unknown sort field or direction', () => {
    expect(validate({ sortBy: 'title' })).not.toHaveLength(0);
    expect(validate({ sortOrder: 'up' })).not.toHaveLength(0);
  });
});
