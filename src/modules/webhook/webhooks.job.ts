import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class WebhooksJob {
    private readonly logger = new Logger(WebhooksJob.name);

    constructor(
        private prisma: PrismaService,
        private webhookService: WebhooksService,
    ) {}

    @Cron(CronExpression.EVERY_30_SECONDS)
    async processPendingWebhooks() {
        const now = new Date();

        const pending = await this.prisma.webhookEvent.findMany({
            where: {
                sentAt: null,
                OR: [
                    { nextRetryAt: null },
                    { nextRetryAt: { lte: now } },
                ],
            },
            include: { tenant: true },
            take: 20,
            orderBy: { createdAt: 'asc' },
        });

        for (const notif of pending) {
            if (!notif.tenant.webhookUrl || !notif.tenant.webhookSecret) {
                await this.prisma.webhookEvent.update({
                    where: { id: notif.id },
                    data: {
                        attempts: notif.attempts + 1,
                        lastError: 'Tenant webhook non configurato',
                        nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
                    },
                });
                continue;
            }

            const success = await this.webhookService.send(
                notif.tenant.webhookUrl,
                notif.tenant.webhookSecret,
                notif.payload,
            );

            if (success) {
                await this.prisma.webhookEvent.update({
                    where: { id: notif.id },
                    data: {
                        sentAt: new Date(),
                        lastError: null,
                    },
                });
                continue;
            }

            const nextAttempts = notif.attempts + 1;
            const backoffSeconds = Math.min(2 ** nextAttempts, 300);
            const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

            this.logger.warn(`Webhook delivery failed for event ${notif.event} (${notif.id})`);

            await this.prisma.webhookEvent.update({
                where: { id: notif.id },
                data: {
                    attempts: nextAttempts,
                    lastError: 'Webhook delivery failed',
                    nextRetryAt,
                },
            });
        }
    }
}
