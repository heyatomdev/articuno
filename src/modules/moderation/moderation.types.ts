/**
 * Enumerazioni e tipi centralizzati per moderazione
 * Riusi enum Prisma per evitare duplicazione
 */

import { ContentStatus, UserStatus, TargetType, ReportStatus } from '@prisma/client';

/**
 * Ragioni automatiche di moderazione
 */
export enum AutoModerationReasonEnum {
  BANNED_WORD_DETECTED = 'BANNED_WORD_DETECTED',
  REPORT_THRESHOLD_REACHED = 'REPORT_THRESHOLD_REACHED',
  USER_SHADOW_BANNED = 'USER_SHADOW_BANNED',
  USER_BANNED = 'USER_BANNED',
}

/**
 * DTO condiviso per transizioni di stato
 */
export class ModerationTransitionDto {
  fromStatus: ContentStatus;
  toStatus: ContentStatus;
  reason: AutoModerationReasonEnum | string;
  moderatorId?: string; // Se null, è transizione automatica (system)
  moderatorNote?: string;
}

/**
 * DTO condiviso per webhook moderazione
 */
export class ModerationWebhookPayloadDto {
  event: string; // es: 'comment.moderated', 'article.flagged'
  tenantId: string;
  data: {
    targetId: string;
    targetType: TargetType;
    externalAuthorId?: string;
    oldStatus?: ContentStatus;
    newStatus: ContentStatus;
    reason: string;
    reportCount?: number;
    threshold?: number;
    moderatorId?: string;
  };
}

// Re-export Prisma enum per comodità
export { ContentStatus, UserStatus, TargetType, ReportStatus };

