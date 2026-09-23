import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from '@/modules/reports/dto/create-report.dto';
import { UpdateReportStatusDto } from '@/modules/reports/dto/update-report.dto';
import { ContentStatus, ReportStatus, TargetType, UserStatus } from '@prisma/client';
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

@Injectable()
export class ReportsService {

    constructor(
      private prisma: PrismaService,
      private moderationPolicy: ModerationPolicyService,
      private webhookPublisher: WebhookEventPublisher,
    ) {}

    async create(tenantId: string, dto: CreateReportInput) {
        // 1. Assicurati che l'utente (reporter) esista localmente (Minimal User)
        const user = await this.prisma.user.upsert({
            where: {
                externalId_tenantId: {
                    externalId: dto.reporterId,
                    tenantId,
                },
            },
            update: {},
            create: { externalId: dto.reporterId, tenantId },
        });

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

        const duplicateReport = await this.prisma.report.findFirst({
            where: {
                targetType: dto.targetType,
                targetId: dto.targetId,
                tenantId,
                reporterId: user.externalId,
                status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
            },
            select: { id: true },
        });

        if (duplicateReport) {
            throw new ConflictException('Hai gia segnalato questo contenuto');
        }

        // 2. Crea il report e applica eventuale auto-moderazione
        const created = await this.prisma.$transaction(async (tx) => {
            const report = await tx.report.create({
                data: {
                    targetType: dto.targetType,
                    targetId: dto.targetId,
                    reason: dto.reason,
                    description: dto.description,
                    reporterId: user.externalId, // Salviamo l'ID esterno per coerenza
                    tenantId: tenantId,
                    // Optional admin-supplied fields (auto-populated when coming from admin panel)
                    ...(dto.status      && { status: dto.status }),
                    ...(dto.moderatorNote && { moderatorNote: dto.moderatorNote }),
                    ...(dto.moderatorId   && { moderatorId: dto.moderatorId }),
                },
                include: reportUserIncludes,
            });

            // Incrementa reportCount sul contenuto
            if (dto.targetType === TargetType.ARTICLE) {
                const article = await tx.article.findFirst({
                    where: { id: dto.targetId, tenantId },
                    select: { id: true, status: true },
                });

                const reportsCount = await tx.report.count({
                    where: {
                        tenantId,
                        targetType: TargetType.ARTICLE,
                        targetId: dto.targetId,
                        status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
                    },
                });

                const threshold = this.moderationPolicy.getReportThreshold('ARTICLE');
                if (reportsCount >= threshold) {
                    if (article?.status === ContentStatus.PUBLISHED) {
                        await tx.article.update({
                            where: { id: article.id },
                            data: { status: ContentStatus.UNDER_REVIEW },
                        });

                        await this.webhookPublisher.publishArticleStatusChangedEvent(
                          tenantId,
                          article.id,
                          ContentStatus.PUBLISHED,
                          ContentStatus.UNDER_REVIEW,
                          'REPORT_THRESHOLD_REACHED',
                          'system',
                        );

                        await this.webhookPublisher.publishArticleFlaggedEvent(
                          tenantId,
                          article.id,
                          reportsCount,
                          threshold,
                        );
                    }
                }
            } else if (dto.targetType === TargetType.COMMENT) {
                const comment = await tx.comment.findFirst({
                    where: { id: dto.targetId, tenantId },
                    select: { id: true, status: true, reportCount: true, authorId: true },
                });

                // Incrementa reportCount
                const newReportCount = (comment?.reportCount ?? 0) + 1;
                await tx.comment.update({
                    where: { id: dto.targetId },
                    data: { reportCount: newReportCount },
                });

                const threshold = this.moderationPolicy.getReportThreshold('COMMENT');
                if (newReportCount >= threshold && comment?.status === ContentStatus.VISIBLE) {
                    // Auto-hide il commento
                    await tx.comment.update({
                        where: { id: dto.targetId },
                        data: { status: ContentStatus.HIDDEN },
                    });

                    // Recupera info per l'autore
                    const author = await tx.user.findFirst({
                        where: { id: comment?.authorId },
                        select: { externalId: true },
                    });

                    // Pubblica webhook
                    await this.webhookPublisher.publishCommentHiddenEvent(
                      tenantId,
                      comment!.id,
                      author?.externalId ?? 'unknown',
                      'REPORT_THRESHOLD_REACHED',
                      newReportCount,
                      threshold,
                    );
                }
            }

            return report;
        });

        const [withTarget] = await this.withTargets(tenantId, [created]);
        return withTarget;
    }

    /**
     * Attaches a resolved `target` to each report. Costs at most three queries
     * per page (one per target type actually present), never one per row.
     */
    private async withTargets<T extends { targetType: TargetType; targetId: string }>(
      tenantId: string,
      reports: T[],
    ): Promise<(T & { target: ReportTarget })[]> {
        const idsOf = (type: TargetType) => [
            ...new Set(reports.filter((r) => r.targetType === type).map((r) => r.targetId)),
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
                  select: { id: true, externalId: true, username: true, status: true },
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

    async findAll(tenantId: string, query: ReportListQueryDto): Promise<PaginatedResult<any>> {
        const where = {
            tenantId,
            ...(query.status     && { status: query.status }),
            ...(query.reporterId && { reporterId: query.reporterId }),
            ...(query.targetType && { targetType: query.targetType }),
            ...(query.targetId   && { targetId: query.targetId }),
            ...(query.moderatorId && { moderatorId: query.moderatorId }),
            ...(query.reason     && { reason: { contains: query.reason, mode: 'insensitive' as const } }),
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

    async updateStatus(id: string, tenantId: string, dto: UpdateReportStatusDto, moderatorId?: string) {
        const report = await this.prisma.report.findFirst({
            where: { id, tenantId },
        });

        if (!report) throw new NotFoundException('Report non trovato');

        // Prefer an explicitly passed moderatorId (admin auto-populate) over the one in the DTO
        const resolvedModeratorId = moderatorId ?? dto.moderatorId;

        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedReport = await tx.report.update({
                where: { id },
                data: {
                    status: dto.status,
                    moderatorNote: dto.moderatorNote,
                    moderatorId: resolvedModeratorId,
                },
                include: reportUserIncludes,
            });

            // Gestione cambio stato articolo quando report è DISMISSED
            if (report.targetType === TargetType.ARTICLE && dto.status === ReportStatus.DISMISSED) {
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

                if (article?.status === ContentStatus.UNDER_REVIEW && activeReportsCount === 0) {
                    await tx.article.update({
                        where: { id: article.id },
                        data: { status: ContentStatus.PUBLISHED },
                    });

                    await this.webhookPublisher.publishArticleStatusChangedEvent(
                      tenantId,
                      article.id,
                      ContentStatus.UNDER_REVIEW,
                      ContentStatus.PUBLISHED,
                      'REPORTS_DISMISSED',
                      resolvedModeratorId,
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
                      where: { id: comment.authorId },
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

                    if (comment && comment.status === ContentStatus.HIDDEN && activeReportsCount === 0) {
                        // Resetta reportCount e ripristina visibilità
                        await tx.comment.update({
                            where: { id: comment.id },
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
                         );
                    }
                }

                // Caso B: Violazione confermata - ban permanente del commento
                if (dto.status === ReportStatus.RESOLVED && comment?.status !== ContentStatus.BANNED) {
                    await tx.comment.update({
                        where: { id: comment.id },
                        data: { status: ContentStatus.BANNED },
                    });

                     await this.webhookPublisher.publishCommentModerationEvent(
                       tenantId,
                       comment.id,
                       author?.externalId ?? 'unknown',
                       ContentStatus.BANNED,
                       'REPORT_RESOLVED_VIOLATION_CONFIRMED',
                       resolvedModeratorId,
                     );
                }
            }

            return updatedReport;
        });

        const [withTarget] = await this.withTargets(tenantId, [updated]);
        return withTarget;
    }
}
