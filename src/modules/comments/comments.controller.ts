import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { PublicUpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentParamsDto } from '@/modules/comments/dto/comment-params.dto';
import { PublicCommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';
import { UserRole } from '@prisma/client';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType } from '@prisma/client';
import {
  ApiPaginatedResponse,
  ApiCreatedData,
  ApiOkData,
} from '@heyatom/nest-common';
import { ApiHeader, ApiNotFoundResponse } from '@nestjs/swagger';
import {
  CommentDto,
  CommentListItemDto,
} from '@/modules/comments/dto/comment-response.dto';

@Controller('comments')
@UseGuards(TenantGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiCreatedData(CommentDto)
  @ApiNotFoundResponse({ description: 'Article not found or not PUBLISHED.' })
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
  @ApiPaginatedResponse(
    CommentListItemDto,
    'Paginated list of VISIBLE and UNDER_REVIEW comments of PUBLISHED articles.',
  )
  findAll(
    @GetTenant() tenant: any,
    @Query() query: PublicCommentFiltersQueryDto,
  ) {
    return this.commentsService.findAllPublic(tenant.id, query);
  }

  @Get(':id')
  @ApiOkData(CommentDto, 'content is null while the comment is not VISIBLE')
  @ApiHeader({
    name: 'X-User-Id',
    required: false,
    description:
      "External id of the end user. When it is the comment's author, the " +
      'comment is returned whatever its status or its article status, with content.',
  })
  @ApiNotFoundResponse({
    description:
      'Comment not found, HIDDEN/BANNED, or its article is not PUBLISHED ' +
      '(unless X-User-Id is the author).',
  })
  findOne(
    @GetTenant() tenant: any,
    @Param() params: CommentParamsDto,
    @Headers('x-user-id') externalUserId?: string,
  ) {
    return this.commentsService.findOnePublic(
      tenant.id,
      params.id,
      externalUserId,
    );
  }

  @Patch(':id')
  @ApiOkData(CommentDto)
  async update(
    @GetTenant() tenant: any,
    @Param() params: CommentParamsDto,
    @Body() dto: PublicUpdateCommentDto,
  ) {
    const before = await this.prisma.comment.findFirst({
      where: { id: params.id, tenantId: tenant.id },
      select: {
        status: true,
        author: { select: { externalId: true } },
      },
    });

    const comment = await this.commentsService.update(
      tenant.id,
      params.id,
      dto,
    );

    // only banned-word auto-hide can change it here
    const statusChanged = before?.status && comment.status !== before.status;

    await this.auditLogger.log({
      tenantId: tenant.id,
      actorUserId: before?.author?.externalId ?? 'unknown',
      actorRole: UserRole.MEMBER,
      action: statusChanged
        ? AuditAction.COMMENT_STATUS_CHANGED
        : AuditAction.COMMENT_UPDATED,
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
