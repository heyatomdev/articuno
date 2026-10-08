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
import { CategoriesService } from '@/modules/categories/categories.service';
import { BastionUserGuard } from '@/modules/bastion/guards/bastion-user.guard';
import { AdminSession } from '@/modules/bastion/bastion.types';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';
import {
  CONTENT_ROLES,
  MODERATION_ROLES,
  Roles,
} from '@/modules/bastion/decorators/roles.decorator';
import { GetSession } from '@/modules/bastion/decorators/get-session.decorator';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { CategoryParamsDto } from '@/modules/categories/dto/category-params.dto';
import { CategoryListQueryDto } from '@/modules/categories/dto/category-list-query.dto';
import {
  CategoryDto,
  CategoryListItemDto,
} from '@/modules/categories/dto/category.dto';
import { ApiPaginatedResponse } from '@/common/pagination';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Admin / Categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(BastionUserGuard, AdminThrottlerGuard)
@Roles(CONTENT_ROLES)
export class AdminCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: CategoryDto })
  async create(@GetSession() session: AdminSession, @Body() dto: CreateCategoryDto) {
    const category = await this.categoriesService.create(session.tenantId, dto);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.CATEGORY_CREATED,
      resourceType: AuditResourceType.CATEGORY,
      resourceId: category.id,
      resourceName: category.name,
      changeSummary: `Category created: ${category.name}`,
    });

    return category;
  }

  @Get()
  @ApiPaginatedResponse(CategoryListItemDto, 'Paginated list of categories.')
  findAll(@GetSession() session: AdminSession, @Query() query: CategoryListQueryDto) {
    return this.categoriesService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CategoryDto })
  findOne(@GetSession() session: AdminSession, @Param() params: CategoryParamsDto) {
    return this.categoriesService.findOne(session.tenantId, params.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CategoryDto })
  async update(
    @GetSession() session: AdminSession,
    @Param() params: CategoryParamsDto,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.categoriesService.update(session.tenantId, params.id, dto);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.CATEGORY_UPDATED,
      resourceType: AuditResourceType.CATEGORY,
      resourceId: category.id,
      resourceName: category.name,
      changeSummary: `Category updated: ${category.name}`,
    });

    return category;
  }

  @Delete(':id')
  @Roles(MODERATION_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: AdminSession, @Param() params: CategoryParamsDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      select: { name: true },
    });

    await this.categoriesService.remove(session.tenantId, params.id);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.CATEGORY_DELETED,
      resourceType: AuditResourceType.CATEGORY,
      resourceId: params.id,
      resourceName: category?.name,
      changeSummary: `Category deleted: ${category?.name ?? params.id}`,
    });
  }
}
