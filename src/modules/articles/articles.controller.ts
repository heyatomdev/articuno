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
import { ArticlesService } from '@/modules/articles/articles.service';
import { TenantGuard } from '@/modules/tenants/guards/tenant.guard';
import { GetTenant } from '@/modules/tenants/decorators/get-tenant.decorator';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';
import { UpdateArticleDto } from '@/modules/articles/dto/update-article.dto';
import { ArticleParamsDto } from '@/modules/articles/dto/article-params.dto';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ArticleTranslationParamsDto } from '@/modules/articles/dto/article-translation-params.dto';
import { ArticleFiltersQueryDto } from '@/modules/articles/dto/article-filters-query.dto';

@Controller('articles')
@UseGuards(TenantGuard)
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@GetTenant() tenant: any, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(tenant.id, dto);
  }

  @Get()
  findAll(@GetTenant() tenant: any, @Query() query: ArticleFiltersQueryDto) {
    return this.articlesService.findAll(tenant.id, query);
  }

  @Get(':id')
  findOne(@GetTenant() tenant: any, @Param() params: ArticleParamsDto) {
    return this.articlesService.findOne(tenant.id, params.id);
  }

  @Patch(':id')
  update(
    @GetTenant() tenant: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(tenant.id, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetTenant() tenant: any, @Param() params: ArticleParamsDto) {
    await this.articlesService.remove(tenant.id, params.id);
  }

  @Post(':id/translations')
  createTranslation(
    @GetTenant() tenant: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: CreateArticleTranslationDto,
  ) {
    return this.articlesService.createTranslation(tenant.id, params.id, dto);
  }

  @Get(':id/translations')
  findTranslations(@GetTenant() tenant: any, @Param() params: ArticleParamsDto) {
    return this.articlesService.findTranslations(tenant.id, params.id);
  }

  @Get(':id/translations/:languageCode')
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

