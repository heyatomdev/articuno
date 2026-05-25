import { Controller, Get, Query, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { UseGuards } from '@nestjs/common';
import { SessionGuard } from "@/modules/auth/guards/session.guard";
import { GetSession } from "@/modules/auth/decorators/get-session.decorator";
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Admin / Analytics')
@Controller('admin/stats')
@UseGuards(SessionGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}

    @Get('dashboard')
    getDashboard(@GetSession() session: any, @Query('days') days?: string) {
        const period = days ? parseInt(days, 10) : 30;
        return this.analyticsService.getDashboardStats(session.tenantId, period);
    }
}
