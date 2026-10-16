/**
 * WebhookEventPublisher
 * Centralizza la creazione e il publishing di eventi webhook
 * Implementa il pattern Outbox per garantire consistenza
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { Prisma, ContentStatus, TargetType } from '@prisma/client';
import { ModerationWebhookPayloadDto } from './moderation.types';

@Injectable()
export class WebhookEventPublisher {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pubblica un evento webhook generico
   * Enqueue nell'outbox con semantica "exactly-once"
   *
   * Pass `db` (the `tx` of a `$transaction` callback) whenever the event
   * describes a change made in that transaction: the row then commits or rolls
   * back together with the change. Every publish* method takes it last.
   */
  async publishEvent(
    tenantId: string,
    event: string,
    data: Prisma.InputJsonValue,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const payload: Prisma.InputJsonObject = {
      event,
      tenantId,
      data,
    };

    const webhookEvent = await db.webhookEvent.create({
      data: {
        tenantId,
        event,
        payload,
      },
    });

    return webhookEvent.id;
  }

  /**
   * Pubblica un evento di moderazione di commento
   */
  async publishCommentModerationEvent(
    tenantId: string,
    commentId: string,
    externalAuthorId: string,
    newStatus: ContentStatus,
    reason: string,
    moderatorId?: string,
    reportCount?: number,
    threshold?: number,
    db?: Prisma.TransactionClient,
  ): Promise<string> {
    const payload: ModerationWebhookPayloadDto = {
      event: 'comment.moderated',
      tenantId,
      data: {
        targetId: commentId,
        targetType: TargetType.COMMENT,
        externalAuthorId,
        newStatus,
        reason,
        reportCount,
        threshold,
        moderatorId,
      },
    };

    return this.publishEvent(tenantId, 'comment.moderated', payload.data, db);
  }

  /**
   * Pubblica un evento di visibilità commento (es: auto-hidden per threshold)
   */
  async publishCommentHiddenEvent(
    tenantId: string,
    commentId: string,
    externalAuthorId: string,
    reason: string,
    reportCount: number,
    threshold: number,
    db?: Prisma.TransactionClient,
  ): Promise<string> {
    const payload = {
      commentId,
      externalAuthorId,
      newStatus: ContentStatus.HIDDEN,
      reason,
      reportCount,
      threshold,
    };

    return this.publishEvent(tenantId, 'comment.hidden', payload, db);
  }

  /**
   * Pubblica un evento di cambio stato articolo, più l'evento di ciclo di vita
   * (`article.published` / `article.unpublished`) che ne deriva.
   * Returns the article's `publishedAt` after the change.
   */
  async publishArticleStatusChangedEvent(
    tenantId: string,
    articleId: string,
    oldStatus: ContentStatus,
    newStatus: ContentStatus,
    reason?: string,
    moderatorId?: string,
    db?: Prisma.TransactionClient,
  ): Promise<Date | null> {
    const payload = {
      articleId,
      oldStatus,
      newStatus,
      reason: reason ?? null,
      moderatorId: moderatorId ?? null,
    };

    await this.publishEvent(tenantId, 'article.status_changed', payload, db);
    return this.publishArticleLifecycleEvent(
      tenantId,
      articleId,
      oldStatus,
      newStatus,
      db,
    );
  }

  /**
   * Entering PUBLISHED → `article.published`; the first time it also sets
   * `publishedAt` (`firstPublication: true`). Leaving PUBLISHED →
   * `article.unpublished`. Call after the status write, in the same `db`: the
   * conditional update waits on that row lock, so concurrent publishes see
   * exactly one first publication. Returns `publishedAt`.
   */
  async publishArticleLifecycleEvent(
    tenantId: string,
    articleId: string,
    oldStatus: ContentStatus | null,
    newStatus: ContentStatus,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Date | null> {
    if (newStatus === ContentStatus.PUBLISHED) {
      const now = new Date();
      const { count } = await db.article.updateMany({
        where: { id: articleId, tenantId, publishedAt: null },
        data: { publishedAt: now },
      });
      const article = await this.articleSummary(db, tenantId, articleId);
      await this.publishEvent(
        tenantId,
        'article.published',
        {
          articleId,
          publishedAt: article.publishedAt.toISOString(),
          firstPublication: count === 1,
          translations: article.translations,
        },
        db,
      );
      return article.publishedAt;
    }

    const article = await this.articleSummary(db, tenantId, articleId);
    // publishedAt null: never actually published (e.g. created PUBLISHED but
    // auto-hidden by a banned word in the same request).
    if (oldStatus === ContentStatus.PUBLISHED && article.publishedAt) {
      await this.publishEvent(
        tenantId,
        'article.unpublished',
        { articleId, newStatus, translations: article.translations },
        db,
      );
    }
    return article.publishedAt;
  }

  /** `article.deleted`; call with the summary read before the delete. */
  async publishArticleDeletedEvent(
    tenantId: string,
    article: Awaited<ReturnType<WebhookEventPublisher['articleSummary']>>,
    db?: Prisma.TransactionClient,
  ): Promise<string> {
    return this.publishEvent(
      tenantId,
      'article.deleted',
      {
        articleId: article.id,
        status: article.status,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        translations: article.translations,
      },
      db,
    );
  }

  /** What a receiver needs to link or purge the article: slug and title per language. */
  articleSummary(
    db: Prisma.TransactionClient,
    tenantId: string,
    articleId: string,
  ) {
    return db.article.findFirstOrThrow({
      where: { id: articleId, tenantId },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        translations: {
          select: { languageCode: true, slug: true, title: true },
          orderBy: { languageCode: 'asc' },
        },
      },
    });
  }

  /**
   * Pubblica un evento di flag articolo (segnalazioni raggiunto threshold)
   */
  async publishArticleFlaggedEvent(
    tenantId: string,
    articleId: string,
    reportsCount: number,
    threshold: number,
    db?: Prisma.TransactionClient,
  ): Promise<string> {
    const payload = {
      articleId,
      reportsCount,
      threshold,
    };

    return this.publishEvent(tenantId, 'article.flagged', payload, db);
  }
}
