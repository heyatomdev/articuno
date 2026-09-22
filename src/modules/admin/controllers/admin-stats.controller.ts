import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '@/modules/bastion/guards/admin-auth.guard';
import { AdminSession } from '@/modules/bastion/bastion.types';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Admin / Analytics')
@ApiBearerAuth()
@Controller('admin/stats')
@UseGuards(AdminAuthGuard, AdminThrottlerGuard)
export class AdminStatsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(
    @GetSession() session: AdminSession,
    @Query('days') days?: string,
  ) {
    const period = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getDashboardStats(session.tenantId, period);
  }
}
