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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CategoriesService } from '@/modules/categories/categories.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateCategoryDto } from '@/modules/categories/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/categories/dto/update-category.dto';
import { CategoryParamsDto } from '@/modules/categories/dto/category-params.dto';
import { CategorySlugParamsDto } from '@/modules/categories/dto/category-slug-params.dto';
import { CategoryListQueryDto } from '@/modules/categories/dto/category-list-query.dto';
import { CategoryDto, CategoryListItemDto } from '@/modules/categories/dto/category.dto';

@ApiTags('Categories')
@ApiSecurity('x-api-key')
@Controller('categories')
@UseGuards(TenantGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a category',
    description: 'Creates a new category for the current tenant. The slug is auto-generated from the name.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: 'Category created successfully.', type: CategoryDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 409, description: 'A category with this slug already exists for the tenant.' })
  create(@GetTenant() tenant: any, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(tenant.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List categories',
    description: 'Returns a paginated list of categories belonging to the current tenant. Each item includes the article count.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of categories.', type: CategoryListItemDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  findAll(@GetTenant() tenant: any, @Query() query: CategoryListQueryDto) {
    return this.categoriesService.findAll(tenant.id, query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get a category by slug',
    description: 'Returns a single category identified by its URL-friendly slug.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly slug of the category (e.g. "science")', example: 'science' })
  @ApiResponse({ status: 200, description: 'Category found.', type: CategoryDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  findOne(@GetTenant() tenant: any, @Param() params: CategorySlugParamsDto) {
    return this.categoriesService.findOneBySlug(tenant.id, params.slug);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a category',
    description: 'Updates the name, description, or colour of an existing category. The slug is re-generated when the name changes.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the category to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, description: 'Category updated successfully.', type: CategoryDto })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  @ApiResponse({ status: 409, description: 'A category with the new slug already exists for the tenant.' })
  update(
    @GetTenant() tenant: any,
    @Param() params: CategoryParamsDto,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a category',
    description: 'Permanently deletes a category and removes its associations with existing articles.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the category to delete', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Category deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Category not found.' })
  async remove(@GetTenant() tenant: any, @Param() params: CategoryParamsDto) {
    await this.categoriesService.remove(tenant.id, params.id);
  }
}

