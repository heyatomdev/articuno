import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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
import { FileHarborService } from '@/modules/fileharbor/fileharbor.service';
import { FileHarborConfig } from '@/modules/fileharbor/interfaces/fileharbor-config.interface';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Controller('admin/articles')
@UseGuards(SessionGuard)
export class AdminArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly fileHarborService: FileHarborService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Recupera la configurazione FileHarbor del tenant.
   * Lancia BadRequestException se non configurata.
   */
  private async getFileHarborConfig(tenantId: string): Promise<FileHarborConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { fileharborEndpoint: true, fileharborApiKey: true },
    });

    if (!tenant?.fileharborEndpoint || !tenant?.fileharborApiKey) {
      throw new BadRequestException('FileHarbor non configurato per questo tenant');
    }

    return { endpoint: tenant.fileharborEndpoint, apiKey: tenant.fileharborApiKey };
  }

  /**
   * Deserializza e valida il campo `data` (JSON stringa) contro un DTO class-validator.
   */
  private async parseAndValidateDto<T extends object>(
    cls: new () => T,
    rawData: string | undefined,
  ): Promise<T> {
    let parsed: object;
    try {
      parsed = JSON.parse(rawData || '{}');
    } catch {
      throw new BadRequestException('Il campo "data" non è un JSON valido');
    }

    const dto = plainToInstance(cls, parsed);
    const errors = await validate(dto as object, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      const messages = errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('; ');
      throw new BadRequestException(messages);
    }
    return dto;
  }

  /**
   * Crea un articolo.
   * Accetta multipart/form-data con:
   *   - `data`        JSON stringa con i campi dell'articolo (CreateArticleDto)
   *   - `coverImage`  file immagine opzionale (jpeg/png/webp/gif, max 10 MB)
   */
  @Post()
  @UseInterceptors(FileInterceptor('coverImage', { storage: memoryStorage() }))
  async create(
    @GetSession() session: any,
    @Body('data') rawData: string,
    @Body() rawBody: object,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Support both multipart/form-data (data field as JSON string) and application/json
    const payload = rawData ?? (typeof rawBody === 'object' ? JSON.stringify(rawBody) : undefined);
    const dto = await this.parseAndValidateDto(CreateArticleDto, payload);

    if (file) {
      const config = await this.getFileHarborConfig(session.tenantId);
      const imageUrl = await this.fileHarborService.uploadImageIfProvided(
        file,
        'article',
        session.tenantId,
        config,
      );
      if (imageUrl) dto.coverImage = imageUrl;
    }

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

  /**
   * Aggiorna un articolo.
   * Accetta multipart/form-data con:
   *   - `data`        JSON stringa con i campi da aggiornare (UpdateArticleDto)
   *   - `coverImage`  file immagine opzionale; se fornito, sostituisce la cover esistente
   *                   (la vecchia immagine viene cancellata da FileHarbor)
   */
  @Patch(':id')
  @UseInterceptors(FileInterceptor('coverImage', { storage: memoryStorage() }))
  async update(
    @GetSession() session: any,
    @Param() params: ArticleParamsDto,
    @Body('data') rawData: string,
    @Body() rawBody: object,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Support both multipart/form-data (data field as JSON string) and application/json
    const payload = rawData ?? (typeof rawBody === 'object' ? JSON.stringify(rawBody) : undefined);
    const dto = await this.parseAndValidateDto(UpdateArticleDto, payload);

    if (file) {
      const config = await this.getFileHarborConfig(session.tenantId);

      // Recupera l'immagine corrente per eliminarla dopo l'upload
      const existing = await this.prisma.article.findFirst({
        where: { id: params.id, tenantId: session.tenantId },
        select: { coverImage: true },
      });

      const imageUrl = await this.fileHarborService.uploadImageIfProvided(
        file,
        'article',
        session.tenantId,
        config,
        existing?.coverImage ?? undefined,
      );
      if (imageUrl) dto.coverImage = imageUrl;
    }

    return this.articlesService.update(session.tenantId, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@GetSession() session: any, @Param() params: ArticleParamsDto) {
    const existing = await this.prisma.article.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      select: { coverImage: true },
    });

    if (existing?.coverImage) {
      try {
        const config = await this.getFileHarborConfig(session.tenantId);
        await this.fileHarborService.deleteImageSafely(existing.coverImage, config);
      } catch {
        // FileHarbor non configurato o cancellazione fallita: si procede comunque
      }
    }

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
