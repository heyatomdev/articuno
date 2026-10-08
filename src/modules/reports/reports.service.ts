import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from '@/modules/reports/dto/create-report.dto';
import { UpdateReportStatusDto } from '@/modules/reports/dto/update-report.dto';
import {
  ContentStatus,
  Prisma,
  ReportStatus,
  TargetType,
  UserStatus,
} from '@prisma/client';
import { ModerationPolicyService } from '@/modules/moderation/moderation-policy.service';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';
import { PaginatedResult, paginate } from '@/common/pagination';

/**
 * Internal extension of CreateReportDto used by the admin path only.
 * These extra fields are never exposed on the public API DTO.
 */
type CreateReportInput = CreateReportDto & {
  status?: ReportStatus;
  moderatorNote?: string;
  moderatorId?: string;
};

/** Shared include clause that enriches Report queries with reporter/moderator user data. */
const reportUserIncludes = {
  reporter: {
    select: {
      externalId: true,
      username: true,
      avatarUrl: true,
      role: true,
      status: true,
    },
  },
  moderator: {
    select: {
      externalId: true,
      username: true,
      avatarUrl: true,
      role: true,
      status: true,
    },
  },
} as const;

/**
 * A report's target is polymorphic (`targetType` + `targetId`, no FK), so the
 * label a moderator needs — an article's title, a comment's text, a username —
 * lives in a different table per type and has to be resolved separately.
 */
export type ReportTarget = {
  id: string;
  label: string;
  status: ContentStatus | UserStatus | null;
  /** Only for COMMENT: the article the comment hangs off. */
  articleId?: string;
  /** True when the id resolved to nothing — a deleted or bogus target. */
  missing?: boolean;
};

/** Comment bodies are free text; the label is a one-line preview of one. */
const COMMENT_LABEL_MAX = 120;

/**
 * `reports_open_reporter_target_key` allows one open (PENDING/REVIEWED) report
 * per reporter and target — on insert, and on an update that reopens one.
 */
const conflictOnOpenDuplicate =
  (message: string) =>
  (error: { code?: string }): never => {
    if (error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  };

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private moderationPolicy: ModerationPolicyService,
    private webhookPublisher: WebhookEventPublisher,
  ) {}

  async create(tenantId: string, dto: CreateReportInput) {
    // 1. Assicurati che l'utente (reporter) esista localmente (Minimal User)
    const user = await this.prisma.ensureUser(tenantId, dto.reporterId);

    if (dto.targetType === TargetType.ARTICLE) {
      const article = await this.prisma.article.findFirst({
        where: { id: dto.targetId, tenantId },
        select: { id: true },
      });

      if (!article) {
        throw new NotFoundException('Articolo non trovato');
      }
    }

    if (dto.targetType === TargetType.COMMENT) {
      const comment = await this.prisma.comment.findFirst({
        where: { id: dto.targetId, tenantId },
        select: { id: true },
      });

      if (!comment) {
        throw new NotFoundException('Commento non trovato');
      }
    }

    // 2. Crea il report e applica eventuale auto-moderazione.
    // Duplicates (same reporter, same target, report still open) are refused
    // by the partial unique index `reports_open_reporter_target_key`.
    const created = await this.prisma
      .$transaction(async (tx) => {
        // Lock the article before counting: otherwise two concurrent
        // reports can both count threshold-1 and neither flips the status.
        const [lockedArticle] =
          dto.targetType === TargetType.ARTICLE
            ? await tx.$queryRaw<{ id: string; status: ContentStatus }[]>`
                    SELECT "id", "status" FROM "articles"
                    WHERE "id" = ${dto.targetId} AND "tenantId" = ${tenantId}
                    FOR UPDATE`
            : [];

        const report = await tx.report.create({
          data: {
            targetType: dto.targetType,
            targetId: dto.targetId,
            reason: dto.reason,
            description: dto.description,
            reporterId: user.externalId, // Salviamo l'ID esterno per coerenza
            tenantId: tenantId,
            // Optional admin-supplied fields (auto-populated when coming from admin panel)
            ...(dto.status && { status: dto.status }),
            ...(dto.moderatorNote && { moderatorNote: dto.moderatorNote }),
            ...(dto.moderatorId && { moderatorId: dto.moderatorId }),
          },
          include: reportUserIncludes,
        });

        if (dto.targetType === TargetType.ARTICLE) {
          await this.applyArticleThreshold(tx, tenantId, lockedArticle);
        } else if (dto.targetType === TargetType.COMMENT) {
          await this.applyCommentThreshold(tx, tenantId, dto.targetId);
        }

        return report;
      })
      .catch(conflictOnOpenDuplicate('Hai gia segnalato questo contenuto'));

    const [withTarget] = await this.withTargets(tenantId, [created]);
    return withTarget;
  }

  /** Article ≥ threshold open reports → PUBLISHED becomes UNDER_REVIEW. Caller holds the row lock. */
  private async applyArticleThreshold(
    tx: Prisma.TransactionClient,
    tenantId: string,
    article: { id: string; status: ContentStatus } | undefined,
  ) {
    if (article?.status !== ContentStatus.PUBLISHED) return;

    const reportsCount = await tx.report.count({
      where: {
        tenantId,
        targetType: TargetType.ARTICLE,
        targetId: article.id,
        status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
      },
    });

    const threshold = this.moderationPolicy.getReportThreshold('ARTICLE');
    if (reportsCount < threshold) return;

    await tx.article.update({
      where: { id: article.id, tenantId },
      data: { status: ContentStatus.UNDER_REVIEW },
    });

    await this.webhookPublisher.publishArticleStatusChangedEvent(
      tenantId,
      article.id,
      ContentStatus.PUBLISHED,
      ContentStatus.UNDER_REVIEW,
      'REPORT_THRESHOLD_REACHED',
      'system',
      tx,
    );

    await this.webhookPublisher.publishArticleFlaggedEvent(
      tenantId,
      article.id,
      reportsCount,
      threshold,
      tx,
    );
  }

  /**
   * Bumps `reportCount` atomically; at ≥ threshold a VISIBLE comment becomes
   * HIDDEN. The status filter on the hide makes only one report fire the event.
   */
  private async applyCommentThreshold(
    tx: Prisma.TransactionClient,
    tenantId: string,
    commentId: string,
  ) {
    const { reportCount, authorId } = await tx.comment.update({
      where: { id: commentId, tenantId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true, authorId: true },
    });

    const threshold = this.moderationPolicy.getReportThreshold('COMMENT');
    if (reportCount < threshold) return;

    const { count: hidden } = await tx.comment.updateMany({
      where: { id: commentId, tenantId, status: ContentStatus.VISIBLE },
      data: { status: ContentStatus.HIDDEN },
    });
    if (hidden === 0) return;

    const author = await tx.user.findFirst({
      where: { id: authorId, tenantId },
      select: { externalId: true },
    });

    await this.webhookPublisher.publishCommentHiddenEvent(
      tenantId,
      commentId,
      author?.externalId ?? 'unknown',
      'REPORT_THRESHOLD_REACHED',
      reportCount,
      threshold,
      tx,
    );
  }

  /**
   * Attaches a resolved `target` to each report. Costs at most three queries
   * per page (one per target type actually present), never one per row.
   */
  private async withTargets<
    T extends { targetType: TargetType; targetId: string },
  >(tenantId: string, reports: T[]): Promise<(T & { target: ReportTarget })[]> {
    const idsOf = (type: TargetType) => [
      ...new Set(
        reports.filter((r) => r.targetType === type).map((r) => r.targetId),
      ),
    ];

    const articleIds = idsOf(TargetType.ARTICLE);
    const commentIds = idsOf(TargetType.COMMENT);
    const userIds = idsOf(TargetType.USER);

    const [articles, comments, users] = await Promise.all([
      articleIds.length
        ? this.prisma.article.findMany({
            where: { id: { in: articleIds }, tenantId },
            select: {
              id: true,
              status: true,
              // `Article` carries no title of its own: the canonical one is
              // the first translation by language code.
              translations: {
                select: { title: true },
                orderBy: { languageCode: 'asc' },
                take: 1,
              },
            },
          })
        : [],
      commentIds.length
        ? this.prisma.comment.findMany({
            where: { id: { in: commentIds }, tenantId },
            select: { id: true, status: true, content: true, articleId: true },
          })
        : [],
      // A USER target is never validated on create, so its id may be either
      // the internal uuid or the external one — match both in one query.
      userIds.length
        ? this.prisma.user.findMany({
            where: {
              tenantId,
              OR: [{ id: { in: userIds } }, { externalId: { in: userIds } }],
            },
            select: {
              id: true,
              externalId: true,
              username: true,
              status: true,
            },
          })
        : [],
    ]);

    const byId = new Map<string, ReportTarget>();

    for (const a of articles) {
      byId.set(`ARTICLE:${a.id}`, {
        id: a.id,
        label: a.translations[0]?.title ?? 'Articolo senza traduzioni',
        status: a.status,
      });
    }

    for (const c of comments) {
      const oneLine = c.content.replace(/\s+/g, ' ').trim();
      byId.set(`COMMENT:${c.id}`, {
        id: c.id,
        label:
          oneLine.length > COMMENT_LABEL_MAX
            ? `${oneLine.slice(0, COMMENT_LABEL_MAX)}…`
            : oneLine,
        status: c.status,
        articleId: c.articleId,
      });
    }

    for (const u of users) {
      const target: ReportTarget = {
        id: u.id,
        label: u.username ?? u.externalId,
        status: u.status,
      };
      byId.set(`USER:${u.id}`, target);
      byId.set(`USER:${u.externalId}`, target);
    }

    return reports.map((r) => ({
      ...r,
      target: byId.get(`${r.targetType}:${r.targetId}`) ?? {
        id: r.targetId,
        label: r.targetId,
        status: null,
        missing: true,
      },
    }));
  }

  async findAll(
    tenantId: string,
    query: ReportListQueryDto,
  ): Promise<PaginatedResult<any>> {
    const where = {
      tenantId,
      ...(query.status && { status: query.status }),
      ...(query.reporterId && { reporterId: query.reporterId }),
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
      ...(query.moderatorId && { moderatorId: query.moderatorId }),
      ...(query.reason && {
        reason: { contains: query.reason, mode: 'insensitive' as const },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.skip,
        include: reportUserIncludes,
      }),
      this.prisma.report.count({ where }),
    ]);

    return paginate(await this.withTargets(tenantId, items), total, query);
  }

  async findOne(id: string, tenantId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, tenantId },
      include: reportUserIncludes,
    });

    if (!report) {
      throw new NotFoundException('Report non trovato');
    }

    const [withTarget] = await this.withTargets(tenantId, [report]);
    return withTarget;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateReportStatusDto,
    moderatorId?: string,
  ) {
    const report = await this.prisma.report.findFirst({
      where: { id, tenantId },
    });

    if (!report) throw new NotFoundException('Report non trovato');

    // Prefer an explicitly passed moderatorId (admin auto-populate) over the one in the DTO
    const resolvedModeratorId = moderatorId ?? dto.moderatorId;

    const updated = await this.prisma
      .$transaction(async (tx) => {
        const updatedReport = await tx.report.update({
          where: { id, tenantId },
          data: {
            status: dto.status,
            moderatorNote: dto.moderatorNote,
            moderatorId: resolvedModeratorId,
          },
          include: reportUserIncludes,
        });

        // Gestione cambio stato articolo quando report è DISMISSED
        if (
          report.targetType === TargetType.ARTICLE &&
          dto.status === ReportStatus.DISMISSED
        ) {
          const article = await tx.article.findFirst({
            where: { id: report.targetId, tenantId },
            select: { id: true, status: true },
          });

          const activeReportsCount = await tx.report.count({
            where: {
              tenantId,
              targetType: TargetType.ARTICLE,
              targetId: report.targetId,
              status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
            },
          });

          if (
            article?.status === ContentStatus.UNDER_REVIEW &&
            activeReportsCount === 0
          ) {
            await tx.article.update({
              where: { id: article.id, tenantId },
              data: { status: ContentStatus.PUBLISHED },
            });

            await this.webhookPublisher.publishArticleStatusChangedEvent(
              tenantId,
              article.id,
              ContentStatus.UNDER_REVIEW,
              ContentStatus.PUBLISHED,
              'REPORTS_DISMISSED',
              resolvedModeratorId,
              tx,
            );
          }
        }

        // Gestione revisione umana per commenti
        if (report.targetType === TargetType.COMMENT) {
          const comment = await tx.comment.findFirst({
            where: { id: report.targetId, tenantId },
            select: { id: true, status: true, authorId: true },
          });

          const author = comment?.authorId
            ? await tx.user.findFirst({
                where: { id: comment.authorId, tenantId },
                select: { externalId: true },
              })
            : null;

          // Caso A: Falso positivo - approva report, ripristina visibilità
          if (dto.status === ReportStatus.DISMISSED) {
            const activeReportsCount = await tx.report.count({
              where: {
                tenantId,
                targetType: TargetType.COMMENT,
                targetId: report.targetId,
                status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
              },
            });

            if (
              comment &&
              comment.status === ContentStatus.HIDDEN &&
              activeReportsCount === 0
            ) {
              // Resetta reportCount e ripristina visibilità
              await tx.comment.update({
                where: { id: comment.id, tenantId },
                data: {
                  status: ContentStatus.VISIBLE,
                  reportCount: 0,
                },
              });

              await this.webhookPublisher.publishCommentModerationEvent(
                tenantId,
                comment.id,
                author?.externalId ?? 'unknown',
                ContentStatus.VISIBLE,
                'REPORT_DISMISSED_FALSE_POSITIVE',
                resolvedModeratorId,
                undefined,
                undefined,
                tx,
              );
            }
          }

          // Caso B: Violazione confermata - ban permanente del commento
          // (`comment` is null when the target was deleted: nothing to ban)
          if (
            dto.status === ReportStatus.RESOLVED &&
            comment &&
            comment.status !== ContentStatus.BANNED
          ) {
            await tx.comment.update({
              where: { id: comment.id, tenantId },
              data: { status: ContentStatus.BANNED },
            });

            await this.webhookPublisher.publishCommentModerationEvent(
              tenantId,
              comment.id,
              author?.externalId ?? 'unknown',
              ContentStatus.BANNED,
              'REPORT_RESOLVED_VIOLATION_CONFIRMED',
              resolvedModeratorId,
              undefined,
              undefined,
              tx,
            );
          }
        }

        return updatedReport;
      })
      .catch(
        conflictOnOpenDuplicate(
          'Il segnalatore ha gia un altro report aperto su questo contenuto',
        ),
      );

    const [withTarget] = await this.withTargets(tenantId, [updated]);
    return withTarget;
  }
}
