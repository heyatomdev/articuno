import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuditsService } from '@/modules/audits/audits.service';
import { AdminAuthGuard } from '@/modules/bastion/guards/admin-auth.guard';
import { AdminSession } from '@/modules/bastion/bastion.types';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { AuditListQueryDto } from '@/modules/audits/dto/audit-list-query.dto';

@ApiTags('Admin / Audits')
@ApiCookieAuth('sessionId')
@ApiBearerAuth()
@Controller('admin/audits')
@UseGuards(AdminAuthGuard, AdminThrottlerGuard)
export class AdminAuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit logs',
    description:
      'Returns a paginated list of audit log entries for the session tenant. ' +
      'Supports optional filtering by action, resource type, and actor user ID.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of audit log entries.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(
    @GetSession() session: AdminSession,
    @Query() query: AuditListQueryDto,
  ) {
    return this.auditsService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an audit log entry by ID',
    description: 'Returns a single audit log entry identified by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the audit log entry', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Audit log entry found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Audit log entry not found.' })
  findOne(
    @GetSession() session: AdminSession,
    @Param('id') id: string,
  ) {
    return this.auditsService.findOne(id, session.tenantId);
  }
}

