/**
 * ModerationPolicyService
 * Centralizza la logica di moderazione comune tra articoli e commenti
 */

import { Injectable } from '@nestjs/common';
import { BannedWordsService } from '@/modules/banned-worlds/banned-words.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import {
  UserStatus,
  ContentStatus,
  AutoModerationReasonEnum,
  ModerationTransitionDto,
} from './moderation.types';

interface ModerationContext {
  tenantId: string;
  targetId: string;
  content?: string;
  authorExternalId?: string;
}

interface ModerationResult {
  finalStatus: ContentStatus;
  autoModerated: boolean;
  reason?: AutoModerationReasonEnum | string;
  shouldCreateSystemReport?: boolean;
}

interface UserModerationCheck {
  isAllowed: boolean;
  userStatus: UserStatus;
  suggestedCommentStatus?: ContentStatus;
  blockReason?: string;
}

@Injectable()
export class ModerationPolicyService {
  /**
   * Threshold commenti: se reportCount >= 5, auto-hide
   * Configurabile per tenant in futuro (per ora costante)
   */
  private readonly COMMENT_REPORT_THRESHOLD = 5;

  /**
   * Threshold articoli: se reportCount >= 10, passa a UNDER_REVIEW (già in ReportsService)
   */
  private readonly ARTICLE_REPORT_THRESHOLD = 10;

  constructor(
    private readonly bannedWordsService: BannedWordsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Controlla lo stato utente e determina se può creare contenuti
   * @returns { isAllowed, userStatus, suggestedCommentStatus, blockReason }
   */
  async checkUserModeration(
    tenantId: string,
    externalUserId: string,
  ): Promise<UserModerationCheck> {
    const user = await this.prisma.user.findFirst({
      where: {
        externalId: externalUserId,
        tenantId,
      },
      select: { status: true },
    });

    const userStatus = (user?.status as UserStatus) ?? UserStatus.ACTIVE;

    if (userStatus === UserStatus.BANNED) {
      return {
        isAllowed: false,
        userStatus,
        blockReason: 'User is banned',
      };
    }

    if (userStatus === UserStatus.SHADOW_BANNED) {
      return {
        isAllowed: true,
        userStatus,
        suggestedCommentStatus: ContentStatus.HIDDEN,
      };
    }

    return {
      isAllowed: true,
      userStatus,
    };
  }

  /**
   * Scansiona testo per banned words e applica moderazione automatica
   */
  async checkBannedWords(tenantId: string, text: string): Promise<boolean> {
    return this.bannedWordsService.checkText(tenantId, text);
  }

  /**
   * Applica policy di moderazione al momento della creazione contenuto
   * Es: check utente, banned words, shadow ban
   */
  async applyCreationPolicy(
    context: ModerationContext,
  ): Promise<ModerationResult> {
    // 1. Check stato utente
    if (context.authorExternalId) {
      const userCheck = await this.checkUserModeration(
        context.tenantId,
        context.authorExternalId,
      );

      if (!userCheck.isAllowed) {
        // Non dovrebbe arrivare qui (dovrebbe essere bloccato prima), ma per robustezza
        return {
          finalStatus: ContentStatus.VISIBLE,
          autoModerated: true,
          reason: AutoModerationReasonEnum.USER_BANNED,
        };
      }

      if (userCheck.suggestedCommentStatus === ContentStatus.HIDDEN) {
        return {
          finalStatus: ContentStatus.HIDDEN,
          autoModerated: true,
          reason: AutoModerationReasonEnum.USER_SHADOW_BANNED,
        };
      }
    }

    // 2. Check banned words
    if (context.content) {
      const hasBannedWords = await this.checkBannedWords(
        context.tenantId,
        context.content,
      );

      if (hasBannedWords) {
        return {
          finalStatus: ContentStatus.HIDDEN,
          autoModerated: true,
          reason: AutoModerationReasonEnum.BANNED_WORD_DETECTED,
          shouldCreateSystemReport: true,
        };
      }
    }

    // 3. Nessuna violazione: stato normale (VISIBLE per commenti, DRAFT per articoli)
    return {
      finalStatus: ContentStatus.VISIBLE,
      autoModerated: false,
    };
  }

  /**
   * Controlla se un commento deve essere auto-hidden in base a reportCount
   */
  isCommentThresholdReached(reportCount: number): boolean {
    return reportCount >= this.COMMENT_REPORT_THRESHOLD;
  }

  /**
   * Controlla se un articolo deve passare a UNDER_REVIEW in base a reportCount
   */
  isArticleThresholdReached(reportCount: number): boolean {
    return reportCount >= this.ARTICLE_REPORT_THRESHOLD;
  }

  /**
   * Valida una transizione di stato durante revisione umana
   * Ritorna true se la transizione è consentita
   */
  isValidModerationTransition(
    from: ContentStatus,
    to: ContentStatus,
  ): boolean {
    // Regole di transizione semplici
    const validTransitions: Record<ContentStatus, ContentStatus[]> = {
      [ContentStatus.VISIBLE]: [
        ContentStatus.HIDDEN,
        ContentStatus.BANNED,
        ContentStatus.UNDER_REVIEW,
      ],
      [ContentStatus.HIDDEN]: [
        ContentStatus.VISIBLE,
        ContentStatus.BANNED,
      ],
      [ContentStatus.BANNED]: [], // Non si torna indietro da BANNED
      [ContentStatus.UNDER_REVIEW]: [
        ContentStatus.PUBLISHED,
        ContentStatus.HIDDEN,
        ContentStatus.BANNED,
      ],
      [ContentStatus.PUBLISHED]: [
        ContentStatus.UNDER_REVIEW,
        ContentStatus.HIDDEN,
        ContentStatus.BANNED,
      ],
      [ContentStatus.DRAFT]: [
        ContentStatus.PUBLISHED,
        ContentStatus.HIDDEN,
        ContentStatus.BANNED,
      ],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Ritorna il threshold di segnalazioni per un determinato tipo di contenuto
   */
  getReportThreshold(targetType: 'ARTICLE' | 'COMMENT'): number {
    return targetType === 'ARTICLE'
      ? this.ARTICLE_REPORT_THRESHOLD
      : this.COMMENT_REPORT_THRESHOLD;
  }
}

