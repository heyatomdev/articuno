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
import { ArticleTranslationsService } from '@/modules/article-translations/article-translations.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ArticleParamsDto } from '@/modules/articles/dto/article-params.dto';
import { ArticleTranslationParamsDto } from '@/modules/articles/dto/article-translation-params.dto';

@ApiTags('Article Translations')
@ApiSecurity('x-api-key')
@Controller('articles/:id/translations')
@UseGuards(TenantGuard)
export class ArticleTranslationsController {
  constructor(private readonly translationsService: ArticleTranslationsService) {}

  @Post()
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
  create(
    @GetTenant() tenant: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: CreateArticleTranslationDto,
  ) {
    return this.translationsService.create(tenant.id, params.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List translations',
    description: 'Returns all translations for an article, ordered by language code.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'List of translations.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  findAll(@GetTenant() tenant: any, @Param() params: ArticleParamsDto) {
    return this.translationsService.findAll(tenant.id, params.id);
  }

  @Get(':languageCode')
  @ApiOperation({
    summary: 'Get a translation by language',
    description: 'Returns a single translation for the given article and BCP 47 language code.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiParam({ name: 'languageCode', description: 'BCP 47 language code', example: 'en' })
  @ApiResponse({ status: 200, description: 'Translation found.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key.' })
  @ApiResponse({ status: 404, description: 'Translation not found.' })
  findOne(
    @GetTenant() tenant: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    return this.translationsService.findOne(tenant.id, params.id, params.languageCode);
  }

  @Patch(':languageCode')
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
  update(
    @GetTenant() tenant: any,
    @Param() params: ArticleTranslationParamsDto,
    @Body() dto: UpdateArticleTranslationDto,
  ) {
    return this.translationsService.update(tenant.id, params.id, params.languageCode, dto);
  }

  @Delete(':languageCode')
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
  async remove(
    @GetTenant() tenant: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    await this.translationsService.remove(tenant.id, params.id, params.languageCode);
  }
}

