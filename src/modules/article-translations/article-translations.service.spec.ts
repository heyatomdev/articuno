import { NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { ArticleTranslationsService } from './article-translations.service';
import { publicArticleStatuses } from '@/modules/articles/article-visibility';

describe('ArticleTranslationsService public visibility', () => {
  const STATUSES = [
    ContentStatus.DRAFT,
    ContentStatus.PUBLISHED,
    ContentStatus.UNDER_REVIEW,
    ContentStatus.HIDDEN,
    ContentStatus.BANNED,
  ];
  // One article per status in t1; each has an 'en' translation.
  const articles = STATUSES.map((status) => ({
    id: `a-${status}`,
    tenantId: 't1',
    status,
  }));
  const statusOk = (status: ContentStatus, filter?: { in: ContentStatus[] }) =>
    !filter || filter.in.includes(status);

  const prisma = {
    article: { findFirst: jest.fn() },
    articleTranslation: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const service = new ArticleTranslationsService(
    prisma as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.article.findFirst.mockImplementation(
      ({ where }) =>
        articles.find(
          (a) =>
            a.id === where.id &&
            a.tenantId === where.tenantId &&
            statusOk(a.status, where.status),
        ) ?? null,
    );
    prisma.articleTranslation.findMany.mockImplementation(({ where }) => [
      { articleId: where.articleId, languageCode: 'en' },
    ]);
    prisma.articleTranslation.findFirst.mockImplementation(({ where }) => {
      const article = articles.find(
        (a) => a.id === where.articleId && a.tenantId === where.tenantId,
      );
      return article &&
        where.languageCode === 'en' &&
        (!where.article ||
          (where.article.tenantId === where.tenantId &&
            statusOk(article.status, where.article.status)))
        ? { articleId: article.id, languageCode: 'en' }
        : null;
    });
  });

  const visible = (status: ContentStatus, includeDrafts: boolean) =>
    status === ContentStatus.PUBLISHED ||
    (includeDrafts && status === ContentStatus.DRAFT);

  describe.each([false, true])('includeDrafts=%s', (includeDrafts) => {
    const statuses = publicArticleStatuses(includeDrafts);

    it.each(STATUSES)('findAll on a %s article', async (status) => {
      const call = service.findAll('t1', `a-${status}`, statuses);
      if (visible(status, includeDrafts)) {
        await expect(call).resolves.toHaveLength(1);
      } else {
        await expect(call).rejects.toThrow(NotFoundException);
        expect(prisma.articleTranslation.findMany).not.toHaveBeenCalled();
      }
    });

    it.each(STATUSES)('findOne on a %s article', async (status) => {
      const call = service.findOne('t1', `a-${status}`, 'en', statuses);
      if (visible(status, includeDrafts)) {
        await expect(call).resolves.toMatchObject({ languageCode: 'en' });
      } else {
        await expect(call).rejects.toThrow(NotFoundException);
      }
    });
  });

  describe('admin callers (no status filter)', () => {
    it.each(STATUSES)('findAll and findOne on a %s article', async (status) => {
      await expect(service.findAll('t1', `a-${status}`)).resolves.toHaveLength(
        1,
      );
      await expect(
        service.findOne('t1', `a-${status}`, 'en'),
      ).resolves.toMatchObject({ languageCode: 'en' });
    });
  });

  it('does not resolve another tenant article', async () => {
    await expect(
      service.findAll('t2', `a-${ContentStatus.PUBLISHED}`, ['PUBLISHED']),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.findOne('t2', `a-${ContentStatus.PUBLISHED}`, 'en', [
        'PUBLISHED',
      ]),
    ).rejects.toThrow(NotFoundException);
  });
});
