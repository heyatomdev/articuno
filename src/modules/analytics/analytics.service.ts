import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DashboardTotals = {
    articlesPublished: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
};

@Injectable()
export class AnalyticsService {
    constructor(private prisma: PrismaService) {}

    async getDashboardStats(tenantId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Recuperiamo le statistiche giornaliere
        const dailyData = await this.prisma.dailyStats.findMany({
            where: {
                tenantId,
                date: { gte: startDate },
            },
            orderBy: { date: 'asc' },
        });

        // Aggreghiamo i totali per una panoramica rapida
        const totals = dailyData.reduce<DashboardTotals>((acc, curr) => ({
            articlesPublished: acc.articlesPublished + curr.articlesPublished,
            totalViews: acc.totalViews + curr.totalViews,
            totalLikes: acc.totalLikes + curr.totalLikes,
            totalComments: acc.totalComments + curr.totalComments,
        }), { articlesPublished: 0, totalViews: 0, totalLikes: 0, totalComments: 0 });

        return {
            period: `${days} days`,
            totals,
            history: dailyData,
        };
    }
}
