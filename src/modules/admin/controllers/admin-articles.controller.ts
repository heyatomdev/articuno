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
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';
import { UpdateArticleDto } from '@/modules/articles/dto/update-article.dto';
import { ArticleParamsDto } from '@/modules/articles/dto/article-params.dto';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ArticleTranslationParamsDto } from '@/modules/articles/dto/article-translation-params.dto';
import { ArticleFiltersQueryDto } from '@/modules/articles/dto/article-filters-query.dto';

@Controller('admin/articles')
@UseGuards(SessionGuard)
export class AdminArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@GetSession() session: any, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(session.tenantId, dto);
  }

  @Get()
  findAll(@GetSession() session: any, @Query() query: ArticleFiltersQueryDto) {
    return this.articlesService.findAll(session.tenantId, query);
  }

  @Get(':id')
  findOne(@GetSession() session: any, @Param() params: ArticleParamsDto) {
    return this.articlesService.findOneById(session.tenantId, params.id);
  }

  @Patch(':id')
  update(
    @GetSession() session: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(session.tenantId, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: any, @Param() params: ArticleParamsDto) {
    await this.articlesService.remove(session.tenantId, params.id);
  }

  @Post(':id/translations')
  createTranslation(
    @GetSession() session: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: CreateArticleTranslationDto,
  ) {
    return this.articlesService.createTranslation(session.tenantId, params.id, dto);
  }

  @Get(':id/translations')
  findTranslations(@GetSession() session: any, @Param() params: ArticleParamsDto) {
    return this.articlesService.findTranslations(session.tenantId, params.id);
  }

  @Get(':id/translations/:languageCode')
  findTranslation(
    @GetSession() session: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    return this.articlesService.findTranslation(
      session.tenantId,
      params.id,
      params.languageCode,
    );
  }

  @Patch(':id/translations/:languageCode')
  updateTranslation(
    @GetSession() session: any,
    @Param() params: ArticleTranslationParamsDto,
    @Body() dto: UpdateArticleTranslationDto,
  ) {
    return this.articlesService.updateTranslation(
      session.tenantId,
      params.id,
      params.languageCode,
      dto,
    );
  }

  @Delete(':id/translations/:languageCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTranslation(
    @GetSession() session: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    await this.articlesService.removeTranslation(
      session.tenantId,
      params.id,
      params.languageCode,
    );
  }
}
