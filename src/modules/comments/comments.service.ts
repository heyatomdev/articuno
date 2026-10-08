import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';
import {
  isValidModerationTransition,
  ModerationPolicyService,
} from '@/modules/moderation/moderation-policy.service';
import { AutoModerationReasonEnum } from '@/modules/moderation/moderation.types';
import { stripTags } from '@/utils/html-sanitizer';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';
import { ContentStatus, Prisma, TargetType } from '@prisma/client';
import { PaginatedResult, paginate } from '@/common/pagination';
import { SYSTEM_REPORTER_ID } from '@/modules/users/users.constants';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationPolicy: ModerationPolicyService,
    private readonly webhookPublisher: WebhookEventPublisher,
  ) {}

  private async ensureArticleExists(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }
  }

  /** Comments are plain text: no tags, and not empty once they are gone. */
  private cleanContent(raw: string): string {
    const content = stripTags(raw).trim();
    if (!content) {
      throw new BadRequestException('Il commento è vuoto');
    }
    return content;
  }

  /**
   * Report automatico di sistema per banned words, nella transazione del
   * commento. `Report.reporterId` è una FK su users(externalId, tenantId):
   * il reporter di sistema è un User per tenant, creato al primo uso.
   */
  private async createSystemReport(
    tx: Prisma.TransactionClient,
    tenantId: string,
    commentId: string,
    reason: string,
  ): Promise<void> {
    await tx.user.upsert({
      where: {
        externalId_tenantId: { externalId: SYSTEM_REPORTER_ID, tenantId },
      },
      update: {},
      create: {
        externalId: SYSTEM_REPORTER_ID,
        tenantId,
        username: 'Articuno (sistema)',
      },
      select: { id: true },
    });
    await tx.report.create({
      data: {
        targetType: TargetType.COMMENT,
        targetId: commentId,
        reason: reason || AutoModerationReasonEnum.BANNED_WORD_DETECTED,
        description: 'Sistema automatico',
        reporterId: SYSTEM_REPORTER_ID,
        tenantId,
      },
    });
  }

  async create(tenantId: string, dto: CreateCommentDto) {
    const content = this.cleanContent(dto.content);
    await this.ensureArticleExists(tenantId, dto.articleId);
    const user = await this.prisma.ensureUser(tenantId, dto.authorExternalId);

    // 1. Check stato utente (BANNED -> 403, SHADOW_BANNED -> auto-hide)
    const userCheck = await this.moderationPolicy.checkUserModeration(
      tenantId,
      dto.authorExternalId,
    );

    if (!userCheck.isAllowed) {
      throw new ForbiddenException('User is banned from this tenant');
    }

    // 2. Applica policy di moderazione (banned words check, user status)
    const modPolicy = await this.moderationPolicy.applyCreationPolicy({
      tenantId,
      targetId: '', // Non necessar io qui, usato per audit
      content,
      authorExternalId: dto.authorExternalId,
    });

    // 3. Crea commento con status determinato dalla policy e, se banned words,
    // il report di sistema che punta al commento appena creato
    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          tenantId,
          articleId: dto.articleId,
          authorId: user.id,
          content,
          status: modPolicy.finalStatus,
          reportCount: 0,
        },
        include: {
          author: true,
        },
      });
      if (modPolicy.shouldCreateSystemReport) {
        await this.createSystemReport(
          tx,
          tenantId,
          created.id,
          modPolicy.reason,
        );
      }
      return created;
    });

    // 4. Se auto-moderato, pubblica webhook
    if (modPolicy.autoModerated) {
      await this.webhookPublisher.publishCommentModerationEvent(
        tenantId,
        comment.id,
        user.externalId,
        modPolicy.finalStatus,
        modPolicy.reason || 'UNKNOWN',
      );
    }

    return comment;
  }

  /**
   * Strips the `content` field from comments that are not yet publicly visible,
   * so the API caller can render a meaningful placeholder without leaking
   * moderated text.
   */
  private sanitizeForPublicApi(comment: any): any {
    if (comment.status !== ContentStatus.VISIBLE) {
      return { ...comment, content: null };
    }
    return comment;
  }

  async findAll(
    tenantId: string,
    query: CommentFiltersQueryDto,
    statusFilter?: ContentStatus | ContentStatus[],
    skipSanitize = false,
  ): Promise<PaginatedResult<any>> {
    const statusCondition = statusFilter
      ? Array.isArray(statusFilter)
        ? { in: statusFilter }
        : statusFilter
      : undefined;

    const where = {
      tenantId,
      ...(query.articleId && { articleId: query.articleId }),
      ...(statusCondition && { status: statusCondition }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.skip,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          author: {
            select: {
              id: true,
              status: true,
              role: true,
              createdAt: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return paginate(
      items.map((c) => (skipSanitize ? c : this.sanitizeForPublicApi(c))),
      total,
      query,
    );
  }

  async findOne(
    tenantId: string,
    id: string,
    statusFilter?: ContentStatus | ContentStatus[],
    skipSanitize = false,
  ) {
    const statusCondition = statusFilter
      ? Array.isArray(statusFilter)
        ? { in: statusFilter }
        : statusFilter
      : undefined;

    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        tenantId,
        ...(statusCondition && { status: statusCondition }),
      },
      include: {
        author: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Commento non trovato');
    }

    return skipSanitize ? comment : this.sanitizeForPublicApi(comment);
  }

  async update(tenantId: string, id: string, dto: UpdateCommentDto) {
    const current = await this.prisma.comment.findFirst({
      where: { id, tenantId },
      select: { status: true, author: { select: { externalId: true } } },
    });
    if (!current) {
      throw new NotFoundException('Commento non trovato');
    }

    if (
      dto.status &&
      !isValidModerationTransition(current.status, dto.status)
    ) {
      throw new BadRequestException(
        `Transizione di stato non consentita: ${current.status} → ${dto.status}`,
      );
    }

    const data: Prisma.CommentUpdateInput = { status: dto.status };
    let autoHidden = false;

    if (dto.content !== undefined) {
      const content = this.cleanContent(dto.content);
      data.content = content;
      // Same rule as creation: banned words hide the comment, unless a
      // moderator is setting the status explicitly in this same request.
      if (
        !dto.status &&
        current.status !== ContentStatus.HIDDEN &&
        isValidModerationTransition(current.status, ContentStatus.HIDDEN) &&
        (await this.moderationPolicy.checkBannedWords(tenantId, content))
      ) {
        data.status = ContentStatus.HIDDEN;
        autoHidden = true;
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.comment.update({
        where: { id, tenantId },
        data,
        include: {
          author: true,
        },
      });
      if (autoHidden) {
        await this.createSystemReport(
          tx,
          tenantId,
          updated.id,
          AutoModerationReasonEnum.BANNED_WORD_DETECTED,
        );
      }
      return updated;
    });

    if (autoHidden) {
      await this.webhookPublisher.publishCommentModerationEvent(
        tenantId,
        comment.id,
        current.author.externalId,
        ContentStatus.HIDDEN,
        AutoModerationReasonEnum.BANNED_WORD_DETECTED,
      );
    }

    return comment;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.comment.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Commento non trovato');
    }
  }
}
