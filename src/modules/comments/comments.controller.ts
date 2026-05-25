import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from '@/modules/comments/comments.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentParamsDto } from '@/modules/comments/dto/comment-params.dto';
import { CommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';
import { ContentStatus, UserRole } from '@prisma/client';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType } from '@prisma/client';

@Controller('comments')
@UseGuards(TenantGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@GetTenant() tenant: any, @Body() dto: CreateCommentDto) {
    const comment = await this.commentsService.create(tenant.id, dto);

    await this.auditLogger.log({
      tenantId: tenant.id,
      actorUserId: dto.authorExternalId,
      actorRole: UserRole.MEMBER,
      action: AuditAction.COMMENT_CREATED,
      resourceType: AuditResourceType.COMMENT,
      resourceId: comment.id,
      changeSummary: `Comment created with status: ${comment.status}`,
    });

    return comment;
  }

  @Get()
  findAll(@GetTenant() tenant: any, @Query() query: CommentFiltersQueryDto) {
    return this.commentsService.findAll(tenant.id, query, [
      ContentStatus.VISIBLE,
      ContentStatus.UNDER_REVIEW,
    ]);
  }

  @Get(':id')
  findOne(@GetTenant() tenant: any, @Param() params: CommentParamsDto) {
    return this.commentsService.findOne(tenant.id, params.id, [
      ContentStatus.VISIBLE,
      ContentStatus.UNDER_REVIEW,
    ]);
  }

  @Patch(':id')
  async update(
    @GetTenant() tenant: any,
    @Param() params: CommentParamsDto,
    @Body() dto: UpdateCommentDto,
  ) {
    const before = await this.prisma.comment.findFirst({
      where: { id: params.id, tenantId: tenant.id },
      select: {
        status: true,
        author: { select: { externalId: true } },
      },
    });

    const comment = await this.commentsService.update(tenant.id, params.id, dto);

    const statusChanged = dto.status && before?.status && dto.status !== before.status;

    await this.auditLogger.log({
      tenantId: tenant.id,
      actorUserId: before?.author?.externalId ?? 'unknown',
      actorRole: UserRole.MEMBER,
      action: statusChanged ? AuditAction.COMMENT_STATUS_CHANGED : AuditAction.COMMENT_UPDATED,
      resourceType: AuditResourceType.COMMENT,
      resourceId: comment.id,
      changesBefore: before ? { status: before.status } : undefined,
      changesAfter: { status: comment.status },
      changeSummary: statusChanged
        ? `Status: ${before.status} → ${comment.status}`
        : 'Comment updated',
    });

    return comment;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetTenant() tenant: any, @Param() params: CommentParamsDto) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: params.id, tenantId: tenant.id },
      select: {
        status: true,
        author: { select: { externalId: true } },
      },
    });

    await this.commentsService.remove(tenant.id, params.id);

    await this.auditLogger.log({
      tenantId: tenant.id,
      actorUserId: comment?.author?.externalId ?? 'unknown',
      actorRole: UserRole.MEMBER,
      action: AuditAction.COMMENT_DELETED,
      resourceType: AuditResourceType.COMMENT,
      resourceId: params.id,
      changeSummary: `Comment deleted (was ${comment?.status ?? 'unknown'})`,
    });
  }
}
