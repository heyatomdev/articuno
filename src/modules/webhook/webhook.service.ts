import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';
import { lastValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(private readonly httpService: HttpService) {}

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
