import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {CreateReportDto} from "@/modules/reports/dto/create-report.dto";
import {UpdateReportStatusDto} from "@/modules/reports/dto/update-report.dto";
import {TenantGuard} from "@/modules/tenants/guards/tenant.guard";
import {UseGuards} from '@nestjs/common';
import {GetTenant} from "@/modules/tenants/decorators/get-tenant.decorator";
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';

@Controller('reports')
@UseGuards(TenantGuard)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Post()
    create(@GetTenant() tenant: any, @Body() dto: CreateReportDto) {
        return this.reportsService.create(tenant.id, dto);
    }

    @Get()
    findAll(@GetTenant() tenant: any, @Query() query: ReportListQueryDto) {
        return this.reportsService.findAll(tenant.id, query);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @GetTenant() tenant: any,
        @Body() dto: UpdateReportStatusDto,
    ) {
        return this.reportsService.updateStatus(id, tenant.id, dto);
    }
}
