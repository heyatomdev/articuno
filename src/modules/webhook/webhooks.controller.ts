import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { SessionStorage } from '@prisma/client';
import { WebhookEventListQueryDto } from './dto/webhook-event-list-query.dto';
import { WebhookEventParamsDto } from './dto/webhook-event-params.dto';
import {WebhooksService} from "@/modules/webhook/webhooks.service";

@ApiTags('Admin / Webhooks')
@ApiCookieAuth('sessionId')
@Controller('admin/webhooks')
@UseGuards(SessionGuard)
export class WebhooksController {
  constructor(private readonly webhookEventsService: WebhooksService) {}

  @Get()
  @ApiOperation({
    summary: 'List webhook events',
    description:
      'Returns a paginated list of all webhook events (outbox) for the session tenant. Supports filtering by event type and delivery status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of webhook events.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(
    @GetSession() session: SessionStorage,
    @Query() query: WebhookEventListQueryDto,
  ) {
    return this.webhookEventsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a webhook event by ID',
    description:
      'Returns the full detail of a single webhook event (payload, attempts, sentAt, lastError, nextRetryAt).',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the webhook event' })
  @ApiResponse({ status: 200, description: 'Webhook event found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Webhook event not found.' })
  findOne(
    @GetSession() session: SessionStorage,
    @Param() params: WebhookEventParamsDto,
  ) {
    return this.webhookEventsService.findOne(session.tenantId, params.id);
  }
}

