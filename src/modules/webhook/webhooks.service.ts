import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  checkWebhookUrl,
  isWebhookTargetBlocked,
  postWebhook,
  signStandardWebhook,
  WebhookUrlError,
  type WebhookUrlPolicy,
} from '@heyatom/nest-common/webhooks';
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

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Development only (refused with NODE_ENV=production by the config
    // schema): private targets and http:// admitted.
    this.urlPolicy = {
      allowPrivate: config.get<boolean>('WEBHOOK_ALLOW_PRIVATE_TARGETS'),
    };
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
   * Sends the canonical payload stored in the outbox to the tenant, signed
   * with Standard Webhooks headers (`webhook-id` = the outbox row id, stable
   * across retries so receivers deduplicate on it; `webhook-timestamp` = send
   * time).
   *
   * The tenant `webhookUrl` is tenant-controlled, so every send goes through
   * the SSRF guard: a textual check first (literal IPs never reach `lookup`),
   * then a `lookup` that refuses non-public addresses at connect time (no
   * DNS-rebinding window), no redirects. `blocked` is terminal: retrying a
   * refused target is the scan itself.
   */
  async send(
    url: string,
    secret: string,
    id: string,
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

    // The signature covers these exact bytes: serialize once.
    const body = JSON.stringify(payload);
    const headers = signStandardWebhook({
      id,
      timestamp: Math.floor(Date.now() / 1000),
      body,
      secrets: [secret],
    });

    try {
      const { status } = await postWebhook(
        url,
        body,
        {
          ...headers,
          'Content-Type': 'application/json',
          'User-Agent': 'Articuno-Webhook/1.0',
        },
        { timeoutMs: 5000, policy: this.urlPolicy },
      );
      if (status >= 200 && status < 300) return 'sent';
      this.logger.error(`Webhook fallito verso ${host}: HTTP ${status}`);
      return 'failed';
    } catch (error) {
      if (isWebhookTargetBlocked(error)) {
        const cause = (error as { cause?: unknown }).cause;
        const reason =
          error instanceof WebhookUrlError
            ? error.reason
            : cause instanceof WebhookUrlError
              ? cause.reason
              : '';
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
}
