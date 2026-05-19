import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from '@/modules/reports/reports.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateReportDto } from '@/modules/reports/dto/create-report.dto';
import { UpdateReportStatusDto } from '@/modules/reports/dto/update-report.dto';
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';
import { ReportParamsDto } from '@/modules/reports/dto/report-params.dto';

@Controller('admin/reports')
@UseGuards(SessionGuard)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@GetSession() session: any, @Body() dto: CreateReportDto) {
    return this.reportsService.create(session.tenantId, dto);
  }

  @Get()
  findAll(@GetSession() session: any, @Query() query: ReportListQueryDto) {
    return this.reportsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  findOne(@GetSession() session: any, @Param() params: ReportParamsDto) {
    return this.reportsService.findOne(params.id, session.tenantId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @GetSession() session: any,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, session.tenantId, dto);
  }
}

