import { Controller, Get, Query, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {TenantGuard} from "@/modules/tenants/guards/tenant.guard";
import {UseGuards} from '@nestjs/common';
import {GetTenant} from "@/modules/tenants/decorators/get-tenant.decorator";

@Controller('stats')
@UseGuards(TenantGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}

    @Get('dashboard')
    getDashboard(@GetTenant() tenant: any, @Query('days') days?: string) {
        const period = days ? parseInt(days, 10) : 30;
        return this.analyticsService.getDashboardStats(tenant.id, period);
    }
}
