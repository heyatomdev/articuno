import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';
import { ModerationPolicyService } from '@/modules/moderation/moderation-policy.service';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';
import { ContentStatus, TargetType } from '@prisma/client';

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

  private async ensureUser(tenantId: string, externalUserId: string) {
    return this.prisma.user.upsert({
      where: {
        externalId_tenantId: {
          externalId: externalUserId,
          tenantId,
        },
      },
      update: {},
      create: {
        externalId: externalUserId,
        tenantId,
      },
      select: {
        id: true,
        externalId: true,
      },
    });
  }

  /**
   * Crea un report automatico di sistema per banned words
   */
  private async createSystemReport(
    tenantId: string,
    commentId: string,
    authorExternalId: string,
    reason: string,
  ): Promise<string> {
    const report = await this.prisma.report.create({
      data: {
        targetType: TargetType.COMMENT,
        targetId: commentId,
        reason: reason || 'BANNED_WORD_DETECTED',
        description: 'Sistema automatico',
        reporterId: 'system', // Reporter di sistema
        tenantId,
      },
    });
    return report.id;
  }

  async create(tenantId: string, dto: CreateCommentDto) {
    await this.ensureArticleExists(tenantId, dto.articleId);
    const user = await this.ensureUser(tenantId, dto.authorExternalId);

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
      content: dto.content,
      authorExternalId: dto.authorExternalId,
    });

    // Se banned words rilevati, crea un report automatico di sistema
    let systemReportId: string | null = null;
    if (modPolicy.shouldCreateSystemReport) {
      systemReportId = await this.createSystemReport(
        tenantId,
        dto.articleId,
        dto.authorExternalId,
        modPolicy.reason,
      );
    }

    // 3. Crea commento con status determinato dalla policy
    const comment = await this.prisma.comment.create({
      data: {
        tenantId,
        articleId: dto.articleId,
        authorId: user.id,
        content: dto.content,
        status: modPolicy.finalStatus,
        reportCount: 0,
      },
      include: {
        author: true,
      },
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

  async findAll(tenantId: string, query: CommentFiltersQueryDto) {
    // Per query pubbliche: mostra solo commenti VISIBLE
    // Se in futuro serve distinguere query private, aggiungere parametro nella DTO
    return this.prisma.comment.findMany({
      where: {
        tenantId,
        ...(query.articleId && { articleId: query.articleId }),
        // Filtra solo commenti visibili pubblicamente
        status: ContentStatus.VISIBLE,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        author: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        author: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Commento non trovato');
    }

    return comment;
  }

  async update(tenantId: string, id: string, dto: UpdateCommentDto) {
    await this.findOne(tenantId, id);

    return this.prisma.comment.update({
      where: {
        id,
      },
      data: dto,
      include: {
        author: true,
      },
    });
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

