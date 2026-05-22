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
import { NotificationsService } from './notifications.service';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import { NotificationParamsDto } from './dto/notification-params.dto';

@ApiTags('Admin / Notifications')
@ApiCookieAuth('sessionId')
@Controller('admin/notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List notifications',
    description:
      'Returns a paginated list of all notifications for the session tenant. Supports filtering by type, sentToClient and userId.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of notifications.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(
    @GetSession() session: SessionStorage,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a notification by ID',
    description: 'Returns the full detail of a single notification identified by its internal UUID.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the notification' })
  @ApiResponse({ status: 200, description: 'Notification found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  findOne(
    @GetSession() session: SessionStorage,
    @Param() params: NotificationParamsDto,
  ) {
    return this.notificationsService.findOne(session.tenantId, params.id);
  }
}

