import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthJob {
    private readonly logger = new Logger(AuthJob.name);

    constructor(private prisma: PrismaService) {}

    /**
     * Elimina le sessioni scadute ogni ora
     * Questo previene l'accumulo di sessioni non più valide nel database
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupExpiredSessions() {
        this.logger.log('Inizio cleanup sessioni scadute...');

        try {
            const now = new Date();

            // Elimina tutte le sessioni con expiresAt < now
            const result = await this.prisma.sessionStorage.deleteMany({
                where: {
                    expiresAt: {
                        lt: now,
                    },
                },
            });

            this.logger.log(
                `Cleanup completato: ${result.count} sessioni scadute eliminate.`,
            );
        } catch (error) {
            this.logger.error(
                'Errore durante il cleanup delle sessioni scadute:',
                error,
            );
        }
    }

    /**
     * Elimina le sessioni inattive (non accedute da più di 30 giorni)
     * Eseguito ogni giorno alle 3:00 AM
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async cleanupInactiveSessions() {
        this.logger.log('Inizio cleanup sessioni inattive...');

        try {
            // Calcola la soglia di 30 giorni fa
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Elimina sessioni non accedute da più di 30 giorni
            const result = await this.prisma.sessionStorage.deleteMany({
                where: {
                    lastAccessedAt: {
                        lt: thirtyDaysAgo,
                    },
                },
            });

            this.logger.log(
                `Cleanup completato: ${result.count} sessioni inattive eliminate.`,
            );
        } catch (error) {
            this.logger.error(
                'Errore durante il cleanup delle sessioni inattive:',
                error,
            );
        }
    }
}

