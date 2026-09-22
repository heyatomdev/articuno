import { Injectable } from '@nestjs/common';
import { ContentStatus, ReportStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { APP_VERSION } from '@/common/version';

/** Rows a `groupBy(['status'])` returns, collapsed into a plain lookup. */
type StatusCount<T extends string> = { status: T; _count: { _all: number } };

function tally<T extends string>(rows: StatusCount<T>[]): Record<string, number> {
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

/** Stale = still a draft after this many days without an edit. */
const STALE_DRAFT_DAYS = 30;

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) {}

    /**
     * Console dashboard payload.
     *
     * Only `history` honours `days`: every counter below is an all-time figure
     * recomputed on each call, which is why the console labels the tiles
     * "All time". `newArticles` is the one exception and says so in its name.
     */
    async getDashboardStats(tenantId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const staleBefore = new Date();
        staleBefore.setDate(staleBefore.getDate() - STALE_DRAFT_DAYS);

        const [
            dailyData,
            articleRows,
            commentRows,
            reportRows,
            userRows,
            viewsAgg,
            totalLikes,
            totalBookmarks,
            featured,
            newArticles,
            staleDrafts,
            categories,
            tags,
            bannedWords,
            languageRows,
            topArticles,
        ] = await Promise.all([
            this.prisma.dailyStats.findMany({
                where: { tenantId, date: { gte: startDate } },
                orderBy: { date: 'asc' },
            }),
            this.prisma.article.groupBy({
                by: ['status'],
                where: { tenantId },
                _count: { _all: true },
            }),
            this.prisma.comment.groupBy({
                by: ['status'],
                where: { tenantId },
                _count: { _all: true },
            }),
            this.prisma.report.groupBy({
                by: ['status'],
                where: { tenantId },
                _count: { _all: true },
            }),
            this.prisma.user.groupBy({
                by: ['status'],
                where: { tenantId },
                _count: { _all: true },
            }),
            // Views accrue on published articles only — a draft nobody can read
            // would otherwise inflate the figure with its preview hits.
            this.prisma.article.aggregate({
                where: { tenantId, status: ContentStatus.PUBLISHED },
                _sum: { views: true },
            }),
            this.prisma.like.count({ where: { tenantId } }),
            this.prisma.bookmark.count({ where: { tenantId } }),
            this.prisma.article.count({ where: { tenantId, featured: true } }),
            this.prisma.article.count({ where: { tenantId, createdAt: { gte: startDate } } }),
            this.prisma.article.count({
                where: {
                    tenantId,
                    status: ContentStatus.DRAFT,
                    updatedAt: { lt: staleBefore },
                },
            }),
            this.prisma.category.count({ where: { tenantId } }),
            this.prisma.tag.count({ where: { tenantId } }),
            this.prisma.bannedWord.count({ where: { tenantId } }),
            this.prisma.articleTranslation.groupBy({
                by: ['languageCode'],
                where: { tenantId },
                _count: { _all: true },
            }),
            this.prisma.article.findMany({
                where: { tenantId, status: ContentStatus.PUBLISHED },
                orderBy: { views: 'desc' },
                take: 5,
                select: {
                    id: true,
                    views: true,
                    likesCount: true,
                    commentsCount: true,
                    // Ordered by language and capped at one so title, slug and
                    // language agree with the article list, which addresses a
                    // record by its first translation's slug.
                    translations: {
                        select: { title: true, languageCode: true, slug: true },
                        orderBy: { languageCode: 'asc' },
                        take: 1,
                    },
                },
            }),
        ]);

        const byArticle = tally(articleRows);
        const byComment = tally(commentRows);
        const byReport = tally(reportRows);
        const byUser = tally(userRows);

        const articlesPublished = byArticle[ContentStatus.PUBLISHED] ?? 0;
        const totalComments = byComment[ContentStatus.VISIBLE] ?? 0;
        const totalViews = viewsAgg._sum.views ?? 0;

        return {
            version: APP_VERSION,
            period: `${days} days`,
            periodDays: days,
            // Kept flat and unchanged: these four are what the service card on
            // the console dashboard reads.
            totals: {
                articlesPublished,
                totalViews,
                totalLikes,
                totalComments,
                totalBookmarks,
            },
            articles: {
                total: articleRows.reduce((sum, r) => sum + r._count._all, 0),
                published: articlesPublished,
                draft: byArticle[ContentStatus.DRAFT] ?? 0,
                underReview: byArticle[ContentStatus.UNDER_REVIEW] ?? 0,
                hidden: byArticle[ContentStatus.HIDDEN] ?? 0,
                banned: byArticle[ContentStatus.BANNED] ?? 0,
                featured,
                newInPeriod: newArticles,
                staleDrafts,
            },
            comments: {
                total: commentRows.reduce((sum, r) => sum + r._count._all, 0),
                visible: totalComments,
                underReview: byComment[ContentStatus.UNDER_REVIEW] ?? 0,
                hidden: byComment[ContentStatus.HIDDEN] ?? 0,
                banned: byComment[ContentStatus.BANNED] ?? 0,
            },
            reports: {
                total: reportRows.reduce((sum, r) => sum + r._count._all, 0),
                pending: byReport[ReportStatus.PENDING] ?? 0,
                reviewed: byReport[ReportStatus.REVIEWED] ?? 0,
                resolved: byReport[ReportStatus.RESOLVED] ?? 0,
                dismissed: byReport[ReportStatus.DISMISSED] ?? 0,
            },
            users: {
                total: userRows.reduce((sum, r) => sum + r._count._all, 0),
                active: byUser[UserStatus.ACTIVE] ?? 0,
                banned: byUser[UserStatus.BANNED] ?? 0,
                shadowBanned: byUser[UserStatus.SHADOW_BANNED] ?? 0,
            },
            taxonomy: { categories, tags, bannedWords },
            // One row per language with at least one translation, busiest first.
            // An article counts once per language it is translated into, so the
            // total across rows exceeds `articles.total` on a bilingual tenant.
            languages: languageRows
                .map((r) => ({ code: r.languageCode, translations: r._count._all }))
                .sort((a, b) => b.translations - a.translations),
            topArticles: topArticles.map((a) => ({
                id: a.id,
                title: a.translations[0]?.title ?? null,
                slug: a.translations[0]?.slug ?? null,
                languageCode: a.translations[0]?.languageCode ?? null,
                views: a.views,
                likesCount: a.likesCount,
                commentsCount: a.commentsCount,
            })),
            history: dailyData,
        };
    }
}
