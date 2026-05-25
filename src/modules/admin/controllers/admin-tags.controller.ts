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
  ValidationPipe,
} from '@nestjs/common';
import { TagsService } from '@/modules/tags/tags.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateTagDto } from '@/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@/modules/tags/dto/update-tag.dto';
import { TagParamsDto } from '@/modules/tags/dto/tag-params.dto';
import { TagsListQuery } from '@/modules/tags/queries/tags.query';
import { PagedResponse } from '@/pagination';
import { TagDto } from '@/modules/tags/dto/tags.dto';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType } from '@prisma/client';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Admin / Tags')
@Controller('admin/tags')
@UseGuards(SessionGuard)
export class AdminTagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@GetSession() session: any, @Body() dto: CreateTagDto) {
    const tag = await this.tagsService.create(session.tenantId, dto);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.TAG_CREATED,
      resourceType: AuditResourceType.TAG,
      resourceId: tag.id,
      resourceName: tag.name,
      changeSummary: `Tag created: ${tag.name}`,
    });

    return tag;
  }

  @Get()
  findAll(
    @GetSession() session: any,
    @Query(new ValidationPipe({ transform: true })) filters: TagsListQuery,
  ): Promise<PagedResponse<TagDto>> {
    return this.tagsService.findAll(session.tenantId, filters);
  }

  @Get(':id')
  findOne(@GetSession() session: any, @Param() params: TagParamsDto) {
    return this.tagsService.findOne(session.tenantId, params.id);
  }

  @Patch(':id')
  async update(
    @GetSession() session: any,
    @Param() params: TagParamsDto,
    @Body() dto: UpdateTagDto,
  ) {
    const tag = await this.tagsService.update(session.tenantId, params.id, dto);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.TAG_UPDATED,
      resourceType: AuditResourceType.TAG,
      resourceId: tag.id,
      resourceName: tag.name,
      changeSummary: `Tag updated: ${tag.name}`,
    });

    return tag;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: any, @Param() params: TagParamsDto) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      select: { name: true },
    });

    await this.tagsService.remove(session.tenantId, params.id);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.TAG_DELETED,
      resourceType: AuditResourceType.TAG,
      resourceId: params.id,
      resourceName: tag?.name,
      changeSummary: `Tag deleted: ${tag?.name ?? params.id}`,
    });
  }
}
