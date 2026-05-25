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
import { ArticlesService } from '@/modules/articles/articles.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';
import { UpdateArticleDto } from '@/modules/articles/dto/update-article.dto';
import { ArticleParamsDto, ArticleSlugParamsDto } from '@/modules/articles/dto/article-params.dto';
import { ArticleFiltersQueryDto } from '@/modules/articles/dto/article-filters-query.dto';

@ApiTags('Articles')
@ApiSecurity('x-api-key')
@Controller('articles')
@UseGuards(TenantGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an article',
    description:
      'Creates a new article for the current tenant. You may optionally include translations inline. ' +
      'Content is automatically checked for banned words; matching content will be created with a HIDDEN status.',
  })
  @ApiBody({ type: CreateArticleDto })
  @ApiResponse({ status: 201, description: 'Article created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  create(@GetTenant() tenant: any, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(tenant.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List articles',
    description:
      'Returns a paginated list of articles belonging to the current tenant. ' +
      'Supports optional filtering by status, category, tag, and featured flag.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of articles.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  findAll(@GetTenant() tenant: any, @Query() query: ArticleFiltersQueryDto) {
    return this.articlesService.findAll(tenant.id, query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get an article by slug',
    description: 'Returns a single article identified by its URL-friendly slug, including all translations.',
  })
  @ApiParam({
    name: 'slug',
    description: 'URL-friendly slug of the article',
    example: 'getting-started-with-nestjs',
  })
  @ApiResponse({ status: 200, description: 'Article found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  findOne(@GetTenant() tenant: any, @Param() params: ArticleSlugParamsDto) {
    return this.articlesService.findOne(tenant.id, params.slug);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an article',
    description:
      'Partially updates an article. Only provided fields are changed. ' +
      'Status changes are validated against the content status state machine.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: UpdateArticleDto })
  @ApiResponse({ status: 200, description: 'Article updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid status transition.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  update(
    @GetTenant() tenant: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an article',
    description: 'Permanently deletes an article and all its translations.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article to delete', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Article deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  async remove(@GetTenant() tenant: any, @Param() params: ArticleParamsDto) {
    await this.articlesService.remove(tenant.id, params.id);
  }

}
