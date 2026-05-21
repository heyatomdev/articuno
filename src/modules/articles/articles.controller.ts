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
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ArticleTranslationParamsDto } from '@/modules/articles/dto/article-translation-params.dto';
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

  @Post(':id/translations')
  @ApiOperation({
    summary: 'Add a translation',
    description: 'Creates a new translation for an existing article. Each language code must be unique per article.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({ type: CreateArticleTranslationDto })
  @ApiResponse({ status: 201, description: 'Translation created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  @ApiResponse({ status: 409, description: 'A translation for this language code already exists.' })
  createTranslation(
    @GetTenant() tenant: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: CreateArticleTranslationDto,
  ) {
    return this.articlesService.createTranslation(tenant.id, params.id, dto);
  }

  @Get(':id/translations')
  @ApiOperation({
    summary: 'List translations',
    description: 'Returns all translations for an article, ordered by language code.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'List of translations.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  findTranslations(@GetTenant() tenant: any, @Param() params: ArticleParamsDto) {
    return this.articlesService.findTranslations(tenant.id, params.id);
  }

  @Get(':id/translations/:languageCode')
  @ApiOperation({
    summary: 'Get a translation by language',
    description: 'Returns a single translation for the given article and BCP 47 language code.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiParam({ name: 'languageCode', description: 'BCP 47 language code', example: 'en' })
  @ApiResponse({ status: 200, description: 'Translation found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Translation not found.' })
  findTranslation(
    @GetTenant() tenant: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    return this.articlesService.findTranslation(
      tenant.id,
      params.id,
      params.languageCode,
    );
  }

  @Patch(':id/translations/:languageCode')
  @ApiOperation({
    summary: 'Update a translation',
    description: 'Partially updates an existing article translation. Only provided fields are changed.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiParam({ name: 'languageCode', description: 'BCP 47 language code of the translation to update', example: 'en' })
  @ApiBody({ type: UpdateArticleTranslationDto })
  @ApiResponse({ status: 200, description: 'Translation updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article or translation not found.' })
  updateTranslation(
    @GetTenant() tenant: any,
    @Param() params: ArticleTranslationParamsDto,
    @Body() dto: UpdateArticleTranslationDto,
  ) {
    return this.articlesService.updateTranslation(
      tenant.id,
      params.id,
      params.languageCode,
      dto,
    );
  }

  @Delete(':id/translations/:languageCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a translation',
    description: 'Permanently removes a single language translation from an article.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiParam({ name: 'languageCode', description: 'BCP 47 language code of the translation to delete', example: 'en' })
  @ApiResponse({ status: 204, description: 'Translation deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article or translation not found.' })
  async removeTranslation(
    @GetTenant() tenant: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    await this.articlesService.removeTranslation(
      tenant.id,
      params.id,
      params.languageCode,
    );
  }
}
