/**
 * WebhookEventPublisher
 * Centralizza la creazione e il publishing di eventi webhook
 * Implementa il pattern Outbox per garantire consistenza
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { Prisma, ContentStatus, TargetType } from '@prisma/client';
import {
  ModerationWebhookPayloadDto,
} from './moderation.types';

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
   * Pubblica un evento di cambio stato articolo
   */
  async publishArticleStatusChangedEvent(
    tenantId: string,
    articleId: string,
    oldStatus: ContentStatus,
    newStatus: ContentStatus,
    reason?: string,
    moderatorId?: string,
    db?: Prisma.TransactionClient,
  ): Promise<string> {
    const payload = {
      articleId,
      oldStatus,
      newStatus,
      reason: reason ?? null,
      moderatorId: moderatorId ?? null,
    };

    return this.publishEvent(tenantId, 'article.status_changed', payload, db);
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

