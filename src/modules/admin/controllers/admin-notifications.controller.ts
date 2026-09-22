import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '@/modules/bastion/guards/admin-auth.guard';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { AdminSession } from '@/modules/bastion/bastion.types';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationListQueryDto } from '@/modules/notifications/dto/notification-list-query.dto';
import { NotificationParamsDto } from '@/modules/notifications/dto/notification-params.dto';

@ApiTags('Admin / Notifications')
@ApiCookieAuth('sessionId')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(AdminAuthGuard, AdminThrottlerGuard)
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description:
      'Returns a paginated list of all notifications for the session tenant. Supports filtering by type, sentToClient and userId.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications.' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated – missing or expired session.',
  })
  findAll(
    @GetSession() session: AdminSession,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a notification by ID',
    description:
      'Returns the full detail of a single notification identified by its internal UUID.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the notification' })
  @ApiResponse({ status: 200, description: 'Notification found.' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated – missing or expired session.',
  })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  findOne(
    @GetSession() session: AdminSession,
    @Param() params: NotificationParamsDto,
  ) {
    return this.notificationsService.findOne(session.tenantId, params.id);
  }
}
