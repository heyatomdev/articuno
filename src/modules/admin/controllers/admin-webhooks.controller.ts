import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BastionUserGuard } from '@/modules/bastion/guards/bastion-user.guard';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';
import {
  SUPER_ADMIN_ROLES,
  Roles,
} from '@/modules/bastion/decorators/roles.decorator';
import { GetSession } from '@/modules/bastion/decorators/get-session.decorator';
import { AdminSession } from '@/modules/bastion/bastion.types';
import { WebhookEventListQueryDto } from '@/modules/webhook/dto/webhook-event-list-query.dto';
import { WebhookEventParamsDto } from '@/modules/webhook/dto/webhook-event-params.dto';
import { WebhooksService } from '@/modules/webhook/webhooks.service';
import { toWebhookEventView } from '@/modules/webhook/webhook.constants';
import {
  ApiPaginatedResponse,
  ApiOkData,
  markPaginated,
} from '@heyatom/nest-common';
import {
  WebhookEventDto,
  WebhookResendAllResultDto,
} from '@/modules/webhook/dto/webhook-event.dto';

@ApiTags('Admin / Webhooks')
@ApiBearerAuth()
@Controller('admin/webhooks')
@UseGuards(BastionUserGuard, AdminThrottlerGuard)
@Roles(SUPER_ADMIN_ROLES)
export class AdminWebhooksController {
  constructor(private readonly webhookEventsService: WebhooksService) {}

  @Get()
  @ApiOperation({
    summary: 'List webhook events',
    description:
      'Returns a paginated list of all webhook events (outbox) for the session tenant. Supports filtering by event type and delivery status.',
  })
  @ApiPaginatedResponse(WebhookEventDto, 'Paginated list of webhook events.')
  @ApiResponse({
    status: 401,
    description: 'Not authenticated – missing or expired session.',
  })
  async findAll(
    @GetSession() session: AdminSession,
    @Query() query: WebhookEventListQueryDto,
  ) {
    const page = await this.webhookEventsService.findAll(
      session.tenantId,
      query,
    );
    // markPaginated: the spread drops paginate()'s marker, and TransformInterceptor would
    // wrap the page again.
    return markPaginated({ ...page, data: page.data.map(toWebhookEventView) });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a webhook event by ID',
    description:
      'Returns the full detail of a single webhook event (payload, attempts, sentAt, lastError, nextRetryAt).',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the webhook event' })
  @ApiOkData(WebhookEventDto, 'Webhook event found.')
  @ApiResponse({
    status: 401,
    description: 'Not authenticated – missing or expired session.',
  })
  @ApiResponse({ status: 404, description: 'Webhook event not found.' })
  async findOne(
    @GetSession() session: AdminSession,
    @Param() params: WebhookEventParamsDto,
  ) {
    return toWebhookEventView(
      await this.webhookEventsService.findOne(session.tenantId, params.id),
    );
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend a single failed webhook event',
    description:
      'Resets attempts to 0 and clears nextRetryAt / lastError for the given event so that the delivery cron picks it up on the next cycle. Returns 400 if the event was already delivered successfully.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the webhook event' })
  @ApiOkData(WebhookEventDto, 'Webhook event reset — will be retried shortly.')
  @ApiResponse({
    status: 400,
    description: 'Event already delivered — resend not needed.',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated – missing or expired session.',
  })
  @ApiResponse({ status: 404, description: 'Webhook event not found.' })
  @ApiResponse({
    status: 409,
    description: 'Event is being delivered right now — retry in a few minutes.',
  })
  async resendOne(
    @GetSession() session: AdminSession,
    @Param() params: WebhookEventParamsDto,
  ) {
    return toWebhookEventView(
      await this.webhookEventsService.resendOne(session.tenantId, params.id),
    );
  }

  @Post('resend-all-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset all failed webhook events for the tenant',
    description:
      'Resets attempts, nextRetryAt and lastError to 0 / null for every undelivered event belonging to the current tenant, except events a worker is delivering right now. Use this after a temporary outage of the receiving system to trigger re-delivery of the entire backlog.',
  })
  @ApiOkData(WebhookResendAllResultDto, 'Number of events reset.')
  @ApiResponse({
    status: 401,
    description: 'Not authenticated – missing or expired session.',
  })
  resendAllFailed(@GetSession() session: AdminSession) {
    return this.webhookEventsService.resendAllFailed(session.tenantId);
  }
}
