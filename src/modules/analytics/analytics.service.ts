import { Injectable } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) {}

    async getDashboardStats(tenantId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [dailyData, articlesPublished, totalLikes, totalComments] = await Promise.all([
            this.prisma.dailyStats.findMany({
                where: { tenantId, date: { gte: startDate } },
                orderBy: { date: 'asc' },
            }),
            // Real-time total: all-time published articles for this tenant
            this.prisma.article.count({
                where: { tenantId, status: ContentStatus.PUBLISHED },
            }),
            // Real-time total: all-time likes for this tenant
            this.prisma.like.count({ where: { tenantId } }),
            // Real-time total: all-time visible comments for this tenant
            this.prisma.comment.count({
                where: { tenantId, status: ContentStatus.VISIBLE },
            }),
        ]);

        // Views still come from DailyStats (no real-time view tracking)
        const totalViews = dailyData.reduce((acc, curr) => acc + curr.totalViews, 0);

        return {
            period: `${days} days`,
            totals: { articlesPublished, totalViews, totalLikes, totalComments },
            history: dailyData,
        };
    }
}
