import { ContentStatus } from '@prisma/client';
import { WebhookEventPublisher } from './webhook-event-publisher.service';

describe('WebhookEventPublisher article lifecycle', () => {
  const translations = [
    { languageCode: 'it', slug: 'titolo', title: 'Titolo' },
  ];
  const db = {
    article: { updateMany: jest.fn(), findFirstOrThrow: jest.fn() },
    webhookEvent: { create: jest.fn() },
  };
  const publisher = new WebhookEventPublisher(db as any);
  const events = () =>
    db.webhookEvent.create.mock.calls.map(([{ data }]) => [
      data.event,
      data.payload.data,
    ]);

  beforeEach(() => {
    jest.resetAllMocks();
    db.webhookEvent.create.mockResolvedValue({ id: 'e1' });
  });

  it('first publication sets publishedAt and says so', async () => {
    const publishedAt = new Date('2026-10-16T10:00:00Z');
    db.article.updateMany.mockResolvedValue({ count: 1 });
    db.article.findFirstOrThrow.mockResolvedValue({
      id: 'a1',
      publishedAt,
      translations,
    });

    const result = await publisher.publishArticleStatusChangedEvent(
      't1',
      'a1',
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      undefined,
      undefined,
      db as any,
    );

    expect(db.article.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', tenantId: 't1', publishedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
    expect(events()).toEqual([
      ['article.status_changed', expect.anything()],
      [
        'article.published',
        {
          articleId: 'a1',
          publishedAt: publishedAt.toISOString(),
          firstPublication: true,
          translations,
        },
      ],
    ]);
    expect(result).toBe(publishedAt);
  });

  it('a re-publish keeps publishedAt and is not a first publication', async () => {
    db.article.updateMany.mockResolvedValue({ count: 0 });
    db.article.findFirstOrThrow.mockResolvedValue({
      id: 'a1',
      publishedAt: new Date(),
      translations,
    });

    await publisher.publishArticleLifecycleEvent(
      't1',
      'a1',
      ContentStatus.HIDDEN,
      ContentStatus.PUBLISHED,
      db as any,
    );

    expect(events()[0][0]).toBe('article.published');
    expect(events()[0][1].firstPublication).toBe(false);
  });

  it('leaving PUBLISHED emits article.unpublished', async () => {
    db.article.findFirstOrThrow.mockResolvedValue({
      id: 'a1',
      publishedAt: new Date(),
      translations,
    });

    await publisher.publishArticleLifecycleEvent(
      't1',
      'a1',
      ContentStatus.PUBLISHED,
      ContentStatus.UNDER_REVIEW,
      db as any,
    );

    expect(db.article.updateMany).not.toHaveBeenCalled();
    expect(events()).toEqual([
      [
        'article.unpublished',
        {
          articleId: 'a1',
          newStatus: ContentStatus.UNDER_REVIEW,
          translations,
        },
      ],
    ]);
  });

  it('never-published article auto-hidden at creation emits no unpublished', async () => {
    db.article.findFirstOrThrow.mockResolvedValue({
      id: 'a1',
      publishedAt: null,
      translations,
    });

    await publisher.publishArticleLifecycleEvent(
      't1',
      'a1',
      ContentStatus.PUBLISHED,
      ContentStatus.HIDDEN,
      db as any,
    );

    expect(events()).toEqual([]);
  });

  it('other transitions emit nothing', async () => {
    db.article.findFirstOrThrow.mockResolvedValue({
      id: 'a1',
      publishedAt: null,
      translations,
    });

    await publisher.publishArticleLifecycleEvent(
      't1',
      'a1',
      ContentStatus.DRAFT,
      ContentStatus.HIDDEN,
      db as any,
    );

    expect(events()).toEqual([]);
  });

  it('article.deleted carries the summary read before the delete', async () => {
    await publisher.publishArticleDeletedEvent(
      't1',
      {
        id: 'a1',
        status: ContentStatus.PUBLISHED,
        publishedAt: null,
        translations,
      },
      db as any,
    );

    expect(events()).toEqual([
      [
        'article.deleted',
        {
          articleId: 'a1',
          status: ContentStatus.PUBLISHED,
          publishedAt: null,
          translations,
        },
      ],
    ]);
  });

  it('reads the summary scoped to the tenant', async () => {
    db.article.findFirstOrThrow.mockResolvedValue({});
    await publisher.articleSummary(db as any, 't1', 'a1');
    expect(db.article.findFirstOrThrow.mock.calls[0][0].where).toEqual({
      id: 'a1',
      tenantId: 't1',
    });
  });
});
