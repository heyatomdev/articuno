import {Injectable, Logger, NotFoundException} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';
import { lastValueFrom } from 'rxjs';
import {Prisma, WebhookEvent} from '@prisma/client';
import {WebhookEventListQueryDto} from "@/modules/webhook/dto/webhook-event-list-query.dto";
import {limit, PagedResponse} from "@/pagination";
import {PrismaService} from "@/modules/prisma/prisma.service";

@Injectable()
export class WebhooksService {
    private readonly logger = new Logger(WebhooksService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly prisma: PrismaService
    ) {}

    async findAll(
        tenantId: string,
        query: WebhookEventListQueryDto,
    ): Promise<PagedResponse<WebhookEvent>> {
        const pageSize = limit(query);

        const where = {
            tenantId,
            ...(query.event !== undefined && { event: query.event }),
            ...(query.sent === true && { sentAt: { not: null } }),
            ...(query.sent === false && { sentAt: null }),
        };

        const [items, totalCount] = await this.prisma.$transaction([
            this.prisma.webhookEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: pageSize,
                skip: query.offset,
            }),
            this.prisma.webhookEvent.count({ where }),
        ]);

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

    async findOne(tenantId: string, id: string): Promise<WebhookEvent> {
        const event = await this.prisma.webhookEvent.findFirst({
            where: { id, tenantId },
        });

        if (!event) {
            throw new NotFoundException('Webhook event non trovato');
        }

        return event;
    }

    // Invia al tenant il payload canonico già salvato in outbox.
    async send(url: string, secret: string, payload: Prisma.JsonValue) {

        // Creiamo una firma HMAC per permettere al client di verificare l'origine
        const signature = this.generateSignature(secret, payload);

        try {
            await lastValueFrom(
                this.httpService.post(url, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-webhook-signature': signature,
                        'User-Agent': 'Articuno-Webhook/1.0',
                    },
                    timeout: 5000,
                }),
            );
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Errore sconosciuto';
            this.logger.error(`Webhook fallito verso ${url}: ${message}`);
            return false;
        }
    }

    private generateSignature(secret: string, payload: Prisma.JsonValue): string {
        return createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }
}
