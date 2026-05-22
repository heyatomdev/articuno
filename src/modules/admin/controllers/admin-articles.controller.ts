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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
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
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';
import { AuditAction, AuditResourceType } from '@prisma/client';

@ApiTags('Admin / Articles')
@ApiCookieAuth('sessionId')
@Controller('admin/articles')
@UseGuards(SessionGuard)
export class AdminArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly fileHarborService: FileHarborService,
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
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
  @ApiOperation({
    summary: 'Create an article',
    description:
      'Creates a new article for the session tenant. ' +
      'Accepts either `application/json` (plain body) or `multipart/form-data` (JSON in the `data` field + optional `coverImage` file). ' +
      'Uploaded images are stored in the tenant\'s FileHarbor instance (JPEG/PNG/GIF/WebP, max 10 MB).',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    description: 'Article data. When using multipart/form-data, serialize the article JSON in the `data` field and optionally attach a `coverImage` file.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'JSON-serialized CreateArticleDto', example: '{"categoryId":"uuid","translations":[{"languageCode":"en","title":"Hello","content":"...","excerpt":"..."}]}' },
        coverImage: { type: 'string', format: 'binary', description: 'Cover image file (JPEG/PNG/GIF/WebP, max 10 MB)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Article created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error, invalid JSON in `data` field, or FileHarbor not configured.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  async create(
    @GetSession() session: any,
    @Body('data') rawData: string,
    @Body() rawBody: object,
    @UploadedFile() file?: Express.Multer.File,
  ) {
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

    const article = await this.articlesService.create(session.tenantId, dto);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.ARTICLE_CREATED,
      resourceType: AuditResourceType.ARTICLE,
      resourceId: article.id,
      resourceName: article.translations?.[0]?.title,
      changeSummary: `Article created with status: ${article.status}`,
    });

    return article;
  }

  @Get()
  @ApiOperation({
    summary: 'List articles',
    description: 'Returns a paginated list of articles for the session tenant. Supports filtering by status, category, tag, and featured flag.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of articles.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  findAll(@GetSession() session: any, @Query() query: ArticleFiltersQueryDto) {
    return this.articlesService.findAll(session.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an article by ID',
    description: 'Returns a single article identified by its UUID, including all translations.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Article found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
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
  @ApiOperation({
    summary: 'Update an article',
    description:
      'Partially updates an article. ' +
      'Accepts either `application/json` or `multipart/form-data` (JSON in `data` field + optional `coverImage`). ' +
      'When a new image is uploaded the previous cover is automatically deleted from FileHarbor.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiParam({ name: 'id', description: 'UUID of the article to update', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiBody({
    description: 'Updated article data. When using multipart/form-data, serialize the update JSON in the `data` field and optionally attach a new `coverImage` file.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'JSON-serialized UpdateArticleDto', example: '{"status":"PUBLISHED","featured":true}' },
        coverImage: { type: 'string', format: 'binary', description: 'New cover image file (JPEG/PNG/GIF/WebP, max 10 MB)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Article updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error, invalid JSON in `data` field, or invalid status transition.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  async update(
    @GetSession() session: any,
    @Param() params: ArticleParamsDto,
    @Body('data') rawData: string,
    @Body() rawBody: object,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const payload = rawData ?? (typeof rawBody === 'object' ? JSON.stringify(rawBody) : undefined);
    const dto = await this.parseAndValidateDto(UpdateArticleDto, payload);

    // Fetch current state before update for audit comparison
    const before = await this.prisma.article.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      select: { status: true, coverImage: true, featured: true },
    });

    if (file) {
      const config = await this.getFileHarborConfig(session.tenantId);

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

    const article = await this.articlesService.update(session.tenantId, params.id, dto);

    const statusChanged = dto.status && before?.status && dto.status !== before.status;

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: statusChanged ? AuditAction.ARTICLE_STATUS_CHANGED : AuditAction.ARTICLE_UPDATED,
      resourceType: AuditResourceType.ARTICLE,
      resourceId: article.id,
      resourceName: article.translations?.[0]?.title,
      changesBefore: before ?? undefined,
      changesAfter: { status: article.status, featured: article.featured },
      changeSummary: statusChanged
        ? `Status: ${before.status} → ${article.status}`
        : 'Article updated',
    });

    return article;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an article',
    description: 'Permanently deletes an article and all its translations. The cover image is also removed from FileHarbor if present.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article to delete', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 204, description: 'Article deleted successfully – no content returned.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  async remove(@GetSession() session: any, @Param() params: ArticleParamsDto) {
    const existing = await this.prisma.article.findFirst({
      where: { id: params.id, tenantId: session.tenantId },
      select: {
        coverImage: true,
        status: true,
        translations: { select: { title: true }, orderBy: { languageCode: 'asc' as const } },
      },
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

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.ARTICLE_DELETED,
      resourceType: AuditResourceType.ARTICLE,
      resourceId: params.id,
      resourceName: existing?.translations?.[0]?.title,
      changeSummary: `Article deleted (was ${existing?.status ?? 'unknown'})`,
    });
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
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  @ApiResponse({ status: 409, description: 'A translation for this language code already exists.' })
  async createTranslation(
    @GetSession() session: any,
    @Param() params: ArticleParamsDto,
    @Body() dto: CreateArticleTranslationDto,
  ) {
    const translation = await this.articlesService.createTranslation(session.tenantId, params.id, dto);

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.ARTICLE_UPDATED,
      resourceType: AuditResourceType.ARTICLE,
      resourceId: params.id,
      resourceName: translation.title,
      changeSummary: `Translation added: ${translation.languageCode}`,
    });

    return translation;
  }

  @Get(':id/translations')
  @ApiOperation({
    summary: 'List translations',
    description: 'Returns all translations for an article, ordered by language code.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'List of translations.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  findTranslations(@GetSession() session: any, @Param() params: ArticleParamsDto) {
    return this.articlesService.findTranslations(session.tenantId, params.id);
  }

  @Get(':id/translations/:languageCode')
  @ApiOperation({
    summary: 'Get a translation by language',
    description: 'Returns a single translation for the given article and BCP 47 language code.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiParam({ name: 'languageCode', description: 'BCP 47 language code', example: 'en' })
  @ApiResponse({ status: 200, description: 'Translation found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Translation not found.' })
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
  @ApiOperation({
    summary: 'Update a translation',
    description: 'Partially updates an existing article translation. Only provided fields are changed.',
  })
  @ApiParam({ name: 'id', description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiParam({ name: 'languageCode', description: 'BCP 47 language code of the translation to update', example: 'en' })
  @ApiBody({ type: UpdateArticleTranslationDto })
  @ApiResponse({ status: 200, description: 'Translation updated successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error – invalid request body.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article or translation not found.' })
  async updateTranslation(
    @GetSession() session: any,
    @Param() params: ArticleTranslationParamsDto,
    @Body() dto: UpdateArticleTranslationDto,
  ) {
    const translation = await this.articlesService.updateTranslation(
      session.tenantId,
      params.id,
      params.languageCode,
      dto,
    );

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.ARTICLE_UPDATED,
      resourceType: AuditResourceType.ARTICLE,
      resourceId: params.id,
      resourceName: translation.title,
      changeSummary: `Translation updated: ${params.languageCode}`,
    });

    return translation;
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
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  @ApiResponse({ status: 404, description: 'Article or translation not found.' })
  async removeTranslation(
    @GetSession() session: any,
    @Param() params: ArticleTranslationParamsDto,
  ) {
    await this.articlesService.removeTranslation(
      session.tenantId,
      params.id,
      params.languageCode,
    );

    await this.auditLogger.log({
      tenantId: session.tenantId,
      actorUserId: session.externalId,
      actorRole: session.userRole,
      action: AuditAction.ARTICLE_UPDATED,
      resourceType: AuditResourceType.ARTICLE,
      resourceId: params.id,
      changeSummary: `Translation removed: ${params.languageCode}`,
    });
  }
}
