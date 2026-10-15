import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import {
  checkWebhookUrl,
  isWebhookTargetBlocked,
  webhookAgent,
  webhookLookup,
  WebhookUrlError,
  type WebhookUrlPolicy,
} from '@heyatom/nest-common/webhooks';
import { createHmac } from 'crypto';
import { lastValueFrom } from 'rxjs';
import { Prisma, WebhookEvent } from '@prisma/client';
import { WebhookEventListQueryDto } from '@/modules/webhook/dto/webhook-event-list-query.dto';
import { PaginatedResult, paginate } from '@heyatom/nest-common';
import { PrismaService } from '@/modules/prisma/prisma.service';

/** `blocked` = refused by the SSRF guard: terminal, never retried. */
export type WebhookSendResult = 'sent' | 'failed' | 'blocked';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  private readonly urlPolicy: WebhookUrlPolicy;
  private readonly httpsAgent: HttpsAgent;
  /** Only reachable with WEBHOOK_ALLOW_PRIVATE_TARGETS (http:// refused otherwise). */
  private readonly httpAgent?: HttpAgent;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.urlPolicy = {
      allowPrivate: config.get<boolean>('WEBHOOK_ALLOW_PRIVATE_TARGETS'),
    };
    if (this.urlPolicy.allowPrivate) {
      // Development only (refused with NODE_ENV=production by the config
      // schema): private targets and http:// admitted.
      const lookup = webhookLookup(this.urlPolicy);
      this.httpsAgent = new HttpsAgent({ lookup });
      this.httpAgent = new HttpAgent({ lookup });
    } else {
      this.httpsAgent = webhookAgent;
    }
  }

  async findAll(
    tenantId: string,
    query: WebhookEventListQueryDto,
  ): Promise<PaginatedResult<WebhookEvent>> {
    const where = {
      tenantId,
      ...(query.event !== undefined && { event: query.event }),
      ...(query.sent === true && { sentAt: { not: null } }),
      ...(query.sent === false && { sentAt: null }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.skip,
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return paginate(items, total, query);
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

  /**
   * Sends the canonical payload stored in the outbox to the tenant.
   *
   * The tenant `webhookUrl` is tenant-controlled, so every send goes through
   * the SSRF guard: a textual check first (literal IPs never reach `lookup`),
   * then an agent whose `lookup` refuses non-public addresses at connect time
   * (no DNS-rebinding window). `blocked` is terminal: retrying a refused
   * target is the scan itself.
   */
  async send(
    url: string,
    secret: string,
    payload: Prisma.JsonValue,
  ): Promise<WebhookSendResult> {
    let host: string;
    try {
      host = checkWebhookUrl(url, this.urlPolicy).host;
    } catch (error) {
      if (!(error instanceof WebhookUrlError)) throw error;
      this.logger.warn(`Webhook target refused: ${error.reason}`);
      return 'blocked';
    }

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
          maxRedirects: 0,
          httpsAgent: this.httpsAgent,
          httpAgent: this.httpAgent,
        }),
      );
      return 'sent';
    } catch (error) {
      if (isWebhookTargetBlocked(error)) {
        const cause = (error as { cause?: unknown }).cause;
        const reason = cause instanceof WebhookUrlError ? cause.reason : '';
        this.logger.warn(`Webhook target refused ${host}: ${reason}`);
        return 'blocked';
      }
      // Host only: the tenant URL may carry a token in its path or query.
      const message =
        error instanceof Error ? error.message : 'Errore sconosciuto';
      this.logger.error(`Webhook fallito verso ${host}: ${message}`);
      return 'failed';
    }
  }

  /**
   * Ripristina un singolo evento webhook fallito (o in dead-letter) azzerando i tentativi
   * in modo che il cron lo possa riprendere al prossimo ciclo.
   */
  async resendOne(tenantId: string, id: string): Promise<WebhookEvent> {
    const event = await this.findOne(tenantId, id);

    if (event.sentAt) {
      throw new BadRequestException({
        code: 'WEBHOOK_ALREADY_DELIVERED',
        message:
          'Il webhook è già stato consegnato con successo e non può essere re-inviato',
      });
    }

    // Clearing nextRetryAt on a row a worker currently owns would make it
    // due again mid-delivery and let a second worker send it twice. The
    // lease check is in the UPDATE itself so a claim landing between the
    // read above and this write cannot slip through.
    const now = new Date();
    const { count } = await this.prisma.webhookEvent.updateMany({
      where: {
        id,
        tenantId,
        sentAt: null,
        OR: [{ claimedUntil: null }, { claimedUntil: { lte: now } }],
      },
      data: { attempts: 0, nextRetryAt: null, lastError: null },
    });

    if (count === 0) {
      throw new ConflictException({
        code: 'WEBHOOK_IN_DELIVERY',
        message:
          'Il webhook è in consegna in questo momento, riprovare tra qualche minuto',
      });
    }

    return this.findOne(tenantId, id);
  }

  /**
   * Ripristina a 0 i tentativi di tutti gli eventi non ancora consegnati del tenant.
   * Utilizzare in caso di down temporaneo del sistema ricevente.
   */
  async resendAllFailed(tenantId: string): Promise<{ reset: number }> {
    const result = await this.prisma.webhookEvent.updateMany({
      where: {
        tenantId,
        sentAt: null,
        // Skip rows a worker currently owns — see resendOne.
        OR: [{ claimedUntil: null }, { claimedUntil: { lte: new Date() } }],
      },
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
