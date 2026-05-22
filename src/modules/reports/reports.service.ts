import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from '@/modules/reports/dto/create-report.dto';
import { UpdateReportStatusDto } from '@/modules/reports/dto/update-report.dto';
import { ContentStatus, ReportStatus, TargetType } from '@prisma/client';
import { ModerationPolicyService } from '@/modules/moderation/moderation-policy.service';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';
import { limit, PagedResponse } from '@/pagination';

/**
 * Internal extension of CreateReportDto used by the admin path only.
 * These extra fields are never exposed on the public API DTO.
 */
type CreateReportInput = CreateReportDto & {
    status?: ReportStatus;
    moderatorNote?: string;
    moderatorId?: string;
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
        return this.prisma.$transaction(async (tx) => {
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
    }

    async findAll(tenantId: string, query: ReportListQueryDto): Promise<PagedResponse<any>> {
        const where = {
            tenantId,
            ...(query.status && { status: query.status }),
        };

        const [items, totalCount] = await this.prisma.$transaction([
            this.prisma.report.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit(query),
                skip: query.offset,
            }),
            this.prisma.report.count({ where }),
        ]);

        const pageSize = query.limit ?? 20;
        const currentPage = Math.floor((query.offset ?? 0) / pageSize) + 1;

        return {
            items,
            pagination: {
                totalCount,
                currentPage,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize),
            },
        };
    }

    async findOne(id: string, tenantId: string) {
        const report = await this.prisma.report.findFirst({
            where: { id, tenantId },
        });

        if (!report) {
            throw new NotFoundException('Report non trovato');
        }

        return report;
    }

    async updateStatus(id: string, tenantId: string, dto: UpdateReportStatusDto, moderatorId?: string) {
        const report = await this.prisma.report.findFirst({
            where: { id, tenantId },
        });

        if (!report) throw new NotFoundException('Report non trovato');

        // Prefer an explicitly passed moderatorId (admin auto-populate) over the one in the DTO
        const resolvedModeratorId = moderatorId ?? dto.moderatorId;

        return this.prisma.$transaction(async (tx) => {
            const updatedReport = await tx.report.update({
                where: { id },
                data: {
                    status: dto.status,
                    moderatorNote: dto.moderatorNote,
                    moderatorId: resolvedModeratorId,
                },
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
    }
}
