import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(private readonly httpService: HttpService) {}

    /**
     * Invia un evento al tenant
     */
    async send(url: string, secret: string, event: string, data: any) {
        const payload = {
            event,
            timestamp: new Date().toISOString(),
            data,
        };

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
            this.logger.error(`Webhook fallito verso ${url}: ${error.message}`);
            return false;
        }
    }

    private generateSignature(secret: string, payload: any): string {
        return createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }
}
