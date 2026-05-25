import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from '@/modules/users/users.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { UserListQueryDto } from '@/modules/users/dto/user-list-query.dto';
import { UserListItemDto } from '@/modules/users/dto/user-list-item.dto';
import { UserParamsDto } from '@/modules/users/dto/user-params.dto';
import { UpdateUserStatusDto } from '@/modules/users/dto/update-user-status.dto';
import { UpdateUserRoleDto } from '@/modules/users/dto/update-user-role.dto';
import { PagedResponse } from '@/pagination';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { AuditAction, AuditResourceType } from '@prisma/client';

@ApiTags('Admin / Users')
@ApiCookieAuth('sessionId')
@Controller('admin/users')
@UseGuards(SessionGuard)
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List users',
    description: 'Returns a paginated list of all users belonging to the session tenant.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of users.', type: UserListItemDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(
    @GetSession() session: any,
    @Query() query: UserListQueryDto,
  ): Promise<PagedResponse<UserListItemDto>> {
    return this.usersService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user by ID',
    description: 'Returns the full profile of a single user identified by their internal UUID.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the user', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'User found.', type: UserListItemDto })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(
    @GetSession() session: any,
    @Param() params: UserParamsDto,
  ): Promise<UserListItemDto> {
    return this.usersService.findOne(session.tenantId, params.id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update user status',
    description: 'Changes the moderation status of a user (ACTIVE, BANNED, SHADOW_BANNED).',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the user' })
  @ApiResponse({ status: 200, description: 'User status updated.', type: UserListItemDto })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updateStatus(
    @GetSession() session: any,
    @Param() params: UserParamsDto,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserListItemDto> {
    const before = await this.usersService.findOne(session.tenantId, params.id);
    const updated = await this.usersService.updateStatus(session.tenantId, params.id, dto.status);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.USER_STATUS_CHANGED,
      resourceType: AuditResourceType.USER,
      resourceId: updated.id,
      resourceName: updated.username ?? updated.externalId,
      changesBefore: { status: before.status },
      changesAfter: { status: updated.status },
      changeSummary: `User status changed: ${before.status} → ${updated.status}`,
    });

    return updated;
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Update user role',
    description: 'Assigns a new role to a user within the tenant.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the user' })
  @ApiResponse({ status: 200, description: 'User role updated.', type: UserListItemDto })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updateRole(
    @GetSession() session: any,
    @Param() params: UserParamsDto,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserListItemDto> {
    const before = await this.usersService.findOne(session.tenantId, params.id);
    const updated = await this.usersService.updateRole(session.tenantId, params.id, dto.role);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.USER_UPDATED_ROLE,
      resourceType: AuditResourceType.USER,
      resourceId: updated.id,
      resourceName: updated.username ?? updated.externalId,
      changesBefore: { role: before.role },
      changesAfter: { role: updated.role },
      changeSummary: `User role changed: ${before.role} → ${updated.role}`,
    });

    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently deletes a user and all their associated data from the tenant.',
  })
  @ApiParam({ name: 'id', description: 'Internal UUID of the user' })
  @ApiResponse({ status: 204, description: 'User deleted.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(
    @GetSession() session: any,
    @Param() params: UserParamsDto,
  ): Promise<void> {
    const user = await this.usersService.findOne(session.tenantId, params.id);
    await this.usersService.deleteById(session.tenantId, params.id);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.USER_DELETED,
      resourceType: AuditResourceType.USER,
      resourceId: params.id,
      resourceName: user.username ?? user.externalId,
      changeSummary: `User deleted: ${user.username ?? user.externalId}`,
    });
  }
}
