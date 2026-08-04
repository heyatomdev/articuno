import { Injectable } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) {}

    async getDashboardStats(tenantId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [dailyData, articlesPublished, totalLikes, totalComments, viewsAgg] = await Promise.all([
            this.prisma.dailyStats.findMany({
                where: { tenantId, date: { gte: startDate } },
                orderBy: { date: 'asc' },
            }),
            this.prisma.article.count({
                where: { tenantId, status: ContentStatus.PUBLISHED },
            }),
            this.prisma.like.count({ where: { tenantId } }),
            this.prisma.comment.count({
                where: { tenantId, status: ContentStatus.VISIBLE },
            }),
            this.prisma.article.aggregate({
                where: { tenantId, status: ContentStatus.PUBLISHED },
                _sum: { views: true },
            }),
        ]);

        const totalViews = viewsAgg._sum.views ?? 0;

        return {
            period: `${days} days`,
            totals: { articlesPublished, totalViews, totalLikes, totalComments },
            history: dailyData,
        };
    }
}
