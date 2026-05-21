import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ReportsService } from '@/modules/reports/reports.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateReportDto } from '@/modules/reports/dto/create-report.dto';
import { UpdateReportStatusDto } from '@/modules/reports/dto/update-report.dto';
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';
import { ReportParamsDto } from '@/modules/reports/dto/report-params.dto';

@ApiTags('Admin / Reports')
@ApiCookieAuth('sessionId')
@Controller('admin/reports')
@UseGuards(SessionGuard)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a report (admin)',
    description: 'Creates a new report for a user, article, or comment from within the admin panel.',
  })
  @ApiBody({ type: CreateReportDto })
  @ApiResponse({ status: 201, description: 'Report submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Reported target not found.' })
  create(@GetSession() session: any, @Body() dto: CreateReportDto) {
    return this.reportsService.create(session.tenantId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List reports (admin)',
    description: 'Returns a paginated list of all reports for the session tenant. Optionally filter by status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of reports.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(@GetSession() session: any, @Query() query: ReportListQueryDto) {
    return this.reportsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a report by ID',
    description: 'Returns the full details of a single report identified by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the report', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Report found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  findOne(@GetSession() session: any, @Param() params: ReportParamsDto) {
    return this.reportsService.findOne(params.id, session.tenantId);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update report status (admin)',
    description: 'Updates the resolution status of a report. Valid transitions: PENDING → RESOLVED or DISMISSED.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the report to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: UpdateReportStatusDto })
  @ApiResponse({ status: 200, description: 'Report status updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  updateStatus(
    @Param('id') id: string,
    @GetSession() session: any,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, session.tenantId, dto);
  }
}

