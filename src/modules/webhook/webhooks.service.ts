import {BadRequestException, Injectable, Logger, NotFoundException} from '@nestjs/common';
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

    /**
     * Ripristina un singolo evento webhook fallito (o in dead-letter) azzerando i tentativi
     * in modo che il cron lo possa riprendere al prossimo ciclo.
     */
    async resendOne(tenantId: string, id: string): Promise<WebhookEvent> {
        const event = await this.findOne(tenantId, id);

        if (event.sentAt) {
            throw new BadRequestException('Il webhook è già stato consegnato con successo e non può essere re-inviato');
        }

        return this.prisma.webhookEvent.update({
            where: { id },
            data: { attempts: 0, nextRetryAt: null, lastError: null },
        });
    }

    /**
     * Ripristina a 0 i tentativi di tutti gli eventi non ancora consegnati del tenant.
     * Utilizzare in caso di down temporaneo del sistema ricevente.
     */
    async resendAllFailed(tenantId: string): Promise<{ reset: number }> {
        const result = await this.prisma.webhookEvent.updateMany({
            where: { tenantId, sentAt: null },
            data: { attempts: 0, nextRetryAt: null, lastError: null },
        });

        return { reset: result.count };
    }

    private generateSignature(secret: string, payload: Prisma.JsonValue): string {
        return createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }
}
