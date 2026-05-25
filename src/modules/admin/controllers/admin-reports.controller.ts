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
import { AdminCreateReportDto } from '@/modules/reports/dto/admin-create-report.dto';
import { AdminUpdateReportDto } from '@/modules/reports/dto/admin-update-report.dto';
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';
import { ReportParamsDto } from '@/modules/reports/dto/report-params.dto';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType } from '@prisma/client';

@ApiTags('Admin / Reports')
@ApiCookieAuth('sessionId')
@Controller('admin/reports')
@UseGuards(SessionGuard)
export class AdminReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a report (admin)',
    description:
      'Creates a new report for a user, article, or comment from within the admin panel. ' +
      '`reporterId` is automatically set to the session user\'s external ID.',
  })
  @ApiBody({ type: AdminCreateReportDto })
  @ApiResponse({ status: 201, description: 'Report submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Reported target not found.' })
  async create(@GetSession() session: any, @Body() dto: AdminCreateReportDto) {
    const report = await this.reportsService.create(session.tenantId, {
      ...dto,
      reporterId: session.externalId,
      moderatorId: session.externalId,
    });

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.REPORT_CREATED,
      resourceType: AuditResourceType.REPORT,
      resourceId: report.id,
      changeSummary: `Report created for ${report.targetType} ${report.targetId}: ${report.reason}`,
    });

    return report;
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
  @ApiBody({ type: AdminUpdateReportDto })
  @ApiResponse({ status: 200, description: 'Report status updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async updateStatus(
    @Param('id') id: string,
    @GetSession() session: any,
    @Body() dto: AdminUpdateReportDto,
  ) {
    const before = await this.prisma.report.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { status: true, targetType: true, targetId: true },
    });

    const report = await this.reportsService.updateStatus(id, session.tenantId, dto as any, session.externalId);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.REPORT_STATUS_CHANGED,
      resourceType: AuditResourceType.REPORT,
      resourceId: report.id,
      changesBefore: before ? { status: before.status } : undefined,
      changesAfter: { status: report.status },
      changeSummary: `Status: ${before?.status ?? 'unknown'} → ${report.status}`,
    });

    return report;
  }
}
