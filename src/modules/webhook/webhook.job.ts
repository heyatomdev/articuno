import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookService } from './webhook.service';

@Injectable()
export class WebhookJob {
    constructor(
        private prisma: PrismaService,
        private webhookService: WebhookService,
    ) {}

    @Cron(CronExpression.EVERY_30_SECONDS)
    async processPendingWebhooks() {
        const pending = await this.prisma.notification.findMany({
            where: { sentToClient: false },
            include: { tenant: true },
            take: 20,
        });

        for (const notif of pending) {
            if (!notif.tenant.webhookUrl || !notif.tenant.webhookSecret) continue;

            const success = await this.webhookService.send(
                notif.tenant.webhookUrl,
                notif.tenant.webhookSecret,
                notif.type,
                notif
            );

            if (success) {
                await this.prisma.notification.update({
                    where: { id: notif.id },
                    data: { sentToClient: true }
                });
            }
        }
    }
}
