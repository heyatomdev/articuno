import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDay, subDays, endOfDay } from 'date-fns';

@Injectable()
export class AnalyticsJob {
    private readonly logger = new Logger(AnalyticsJob.name);

    constructor(private prisma: PrismaService) {}

    // Esegue il job ogni notte a mezzanotte
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyStats() {
        this.logger.log('Inizio generazione statistiche giornaliere...');

        // Calcoliamo il range temporale di "ieri"
        const yesterday = subDays(new Date(), 1);
        const startDate = startOfDay(yesterday);
        const endDate = endOfDay(yesterday);

        try {
            // 1. Recuperiamo tutti i tenant attivi
            const tenants = await this.prisma.tenant.findMany({
                select: { id: true }
            });

            for (const tenant of tenants) {
                const tenantId = tenant.id;

                // 2. Eseguiamo i conteggi in parallelo per questo tenant
                const [
                    articlesCount,
                    commentsCount,
                    likesCount
                ] = await Promise.all([
                    this.prisma.article.count({
                        where: { tenantId, createdAt: { gte: startDate, lte: endDate } }
                    }),
                    this.prisma.comment.count({
                        where: { tenantId, createdAt: { gte: startDate, lte: endDate } }
                    }),
                    this.prisma.like.count({
                        where: { tenantId, createdAt: { gte: startDate, lte: endDate } }
                    })
                ]);

                // 3. Salvataggio (Upsert) nella tabella DailyStats
                await this.prisma.dailyStats.upsert({
                    where: {
                        date_tenantId: {
                            date: startDate,
                            tenantId: tenantId
                        }
                    },
                    update: {
                        articlesPublished: articlesCount,
                        totalComments: commentsCount,
                        totalLikes: likesCount,
                        // totalViews lo aggiorneresti qui se avessi un sistema di tracking views
                    },
                    create: {
                        date: startDate,
                        tenantId: tenantId,
                        articlesPublished: articlesCount,
                        totalComments: commentsCount,
                        totalLikes: likesCount,
                    }
                });
            }

            this.logger.log(`Statistiche completate per ${tenants.length} tenant.`);
        } catch (error) {
            this.logger.error('Errore durante l’esecuzione del cron job:', error);
        }
    }
}
