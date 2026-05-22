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
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { CategoryParamsDto } from '@/modules/categories/dto/category-params.dto';
import { CategoryListQueryDto } from '@/modules/categories/dto/category-list-query.dto';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AuditAction, AuditResourceType } from '@prisma/client';
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Admin / Categories')
@Controller('admin/categories')
@UseGuards(SessionGuard)
export class AdminCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@GetSession() session: any, @Body() dto: CreateCategoryDto) {
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
  findAll(@GetSession() session: any, @Query() query: CategoryListQueryDto) {
    return this.categoriesService.findAll(session.tenantId, query);
  }

  @Get(':id')
  findOne(@GetSession() session: any, @Param() params: CategoryParamsDto) {
    return this.categoriesService.findOne(session.tenantId, params.id);
  }

  @Patch(':id')
  async update(
    @GetSession() session: any,
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: any, @Param() params: CategoryParamsDto) {
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
