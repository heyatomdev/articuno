import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from '@/modules/reports/dto/create-report.dto';
import { UpdateReportStatusDto } from '@/modules/reports/dto/update-report.dto';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { UseGuards } from '@nestjs/common';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { ReportListQueryDto } from '@/modules/reports/dto/report-list-query.dto';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType, UserRole } from '@prisma/client';

@ApiTags('Reports')
@ApiSecurity('api-key')
@Controller('reports')
@UseGuards(TenantGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a report',
    description: 'Creates a new report for a user, article, or comment. When the report threshold is reached the target is auto-moderated.',
  })
  @ApiBody({ type: CreateReportDto })
  @ApiResponse({ status: 201, description: 'Report submitted successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Reported target not found.' })
  async create(@GetTenant() tenant: any, @Body() dto: CreateReportDto) {
    const report = await this.reportsService.create(tenant.id, dto);

    await this.auditLogger.log({
      tenantId: tenant.id,
      actorUserId: dto.reporterId,
      actorRole: UserRole.MEMBER,
      action: AuditAction.REPORT_CREATED,
      resourceType: AuditResourceType.REPORT,
      resourceId: report.id,
      changeSummary: `Report created for ${report.targetType} ${report.targetId}: ${report.reason}`,
    });

    return report;
  }

  @Get()
  @ApiOperation({
    summary: 'List reports',
    description: 'Returns a paginated list of reports for the current tenant. Optionally filter by status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of reports.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  findAll(@GetTenant() tenant: any, @Query() query: ReportListQueryDto) {
    return this.reportsService.findAll(tenant.id, query);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update report status',
    description: 'Updates the resolution status of a specific report (e.g. PENDING → RESOLVED or DISMISSED). Requires a moderator ID.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the report to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: UpdateReportStatusDto })
  @ApiResponse({ status: 200, description: 'Report status updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async updateStatus(
    @Param('id') id: string,
    @GetTenant() tenant: any,
    @Body() dto: UpdateReportStatusDto,
  ) {
    const before = await this.prisma.report.findFirst({
      where: { id, tenantId: tenant.id },
      select: { status: true, targetType: true, targetId: true },
    });

    const report = await this.reportsService.updateStatus(id, tenant.id, dto);

    await this.auditLogger.log({
      tenantId: tenant.id,
      actorUserId: dto.moderatorId,
      actorRole: UserRole.MODERATOR,
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
