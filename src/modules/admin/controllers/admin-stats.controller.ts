import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { UseGuards } from '@nestjs/common';
import { BastionUserGuard } from '@/modules/bastion/guards/bastion-user.guard';
import { AdminSession } from '@/modules/bastion/bastion.types';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';
import {
  CONTENT_ROLES,
  Roles,
} from '@/modules/bastion/decorators/roles.decorator';
import { GetSession } from '@/modules/bastion/decorators/get-session.decorator';
import { ApiTags, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { DashboardStatsDto } from '@/modules/analytics/dto/dashboard-stats.dto';

@ApiTags('Admin / Analytics')
@ApiBearerAuth()
@Controller('admin/stats')
@UseGuards(BastionUserGuard, AdminThrottlerGuard)
@Roles(CONTENT_ROLES)
export class AdminStatsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOkResponse({ type: DashboardStatsDto })
  getDashboard(
    @GetSession() session: AdminSession,
    @Query('days') days?: string,
  ) {
    const period = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getDashboardStats(session.tenantId, period);
  }
}
