import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { BannedWordsService } from '@/modules/banned-worlds/banned-words.service';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';
import { UpdateArticleDto } from '@/modules/articles/dto/update-article.dto';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ArticleFiltersQueryDto } from '@/modules/articles/dto/article-filters-query.dto';
import { ContentStatus, Prisma } from '@prisma/client';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bannedWordsService: BannedWordsService,
  ) {}

  private static readonly AUTO_MODERATION_REASON = 'BANNED_WORD_DETECTED';

  private readonly articleIncludes = {
    category: true,
    author: true,
    tags: true,
    translations: {
      orderBy: { languageCode: 'asc' as const },
    },
  };

  private async enqueueWebhookEvent(
    tenantId: string,
    event: string,
    data: Prisma.InputJsonValue,
  ) {
    const payload: Prisma.InputJsonObject = {
      event,
      tenantId,
      data,
    };

    await this.prisma.webhookEvent.create({
      data: {
        tenantId,
        event,
        payload,
      },
    });
  }

  private async hideArticleForBannedContent(tenantId: string, articleId: string) {
    const article = await this.ensureArticleExists(tenantId, articleId);

    if (article.status === ContentStatus.HIDDEN || article.status === ContentStatus.BANNED) {
      return;
    }

    await this.prisma.article.update({
      where: { id: article.id },
      data: { status: ContentStatus.HIDDEN },
    });

    await this.enqueueWebhookEvent(tenantId, 'article.status_changed', {
      articleId: article.id,
      oldStatus: article.status,
      newStatus: ContentStatus.HIDDEN,
      reason: ArticlesService.AUTO_MODERATION_REASON,
      moderatorId: 'system',
    });
  }

  private async hasBannedWordsInTranslations(
    tenantId: string,
    translations?: Array<{ title: string; content: string }>,
  ) {
    if (!translations?.length) {
      return false;
    }

    const textToCheck = translations.map((t) => `${t.title}\n${t.content}`).join('\n');
    return this.bannedWordsService.checkText(tenantId, textToCheck);
  }

  private async ensureArticleExists(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        tenantId,
      },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    return article;
  }

  private async ensureCategoryExists(tenantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId,
      },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Categoria non trovata');
    }
  }

  private async ensureAuthorExists(tenantId: string, authorId: string) {
    const author = await this.prisma.user.findFirst({
      where: {
        id: authorId,
        tenantId,
      },
      select: { id: true },
    });

    if (!author) {
      throw new NotFoundException('Autore non trovato');
    }
  }

  private async ensureTagsExist(tenantId: string, tagIds: string[]) {
    if (!tagIds.length) {
      return;
    }

    const tagsCount = await this.prisma.tag.count({
      where: {
        id: { in: tagIds },
        tenantId,
      },
    });

    if (tagsCount !== tagIds.length) {
      throw new NotFoundException('Uno o piu tag non trovati');
    }
  }

  async create(tenantId: string, dto: CreateArticleDto) {
    await this.ensureCategoryExists(tenantId, dto.categoryId);

    if (dto.authorId) {
      await this.ensureAuthorExists(tenantId, dto.authorId);
    }

    if (dto.tagIds) {
      await this.ensureTagsExist(tenantId, dto.tagIds);
    }

    const requestedStatus = dto.status ?? ContentStatus.DRAFT;
    const hasBannedWords = await this.hasBannedWordsInTranslations(tenantId, dto.translations);
    const finalStatus = hasBannedWords ? ContentStatus.HIDDEN : requestedStatus;

    try {
      return await this.prisma.article.create({
        data: {
          coverImage: dto.coverImage,
          status: finalStatus,
          featured: dto.featured,
          categoryId: dto.categoryId,
          authorId: dto.authorId,
          tenantId,
          tags: dto.tagIds
            ? {
                connect: dto.tagIds.map((id) => ({ id })),
              }
            : undefined,
          translations: dto.translations
            ? {
                create: dto.translations.map((translation) => ({
                  ...translation,
                  tenantId,
                })),
              }
            : undefined,
        },
        include: this.articleIncludes,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug traduzione gia esistente');
      }
      throw error;
    }
  }

  async findAll(tenantId: string, query?: ArticleFiltersQueryDto) {
    const where: any = {
      tenantId,
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query?.featured !== undefined ? { featured: query.featured } : {}),
      ...(query?.tagId
        ? {
            tags: {
              some: {
                id: query.tagId,
                tenantId,
              },
            },
          }
        : {}),
    };

    return this.prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.articleIncludes,
    });
  }

  async findOne(tenantId: string, id: string) {
    const article = await this.prisma.article.findFirst({
      where: { id, tenantId },
      include: this.articleIncludes,
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    return article;
  }

  async update(tenantId: string, id: string, dto: UpdateArticleDto) {
    const currentArticle = await this.ensureArticleExists(tenantId, id);

    if (dto.categoryId) {
      await this.ensureCategoryExists(tenantId, dto.categoryId);
    }

    if (dto.authorId !== undefined && dto.authorId !== null) {
      await this.ensureAuthorExists(tenantId, dto.authorId);
    }

    if (dto.tagIds) {
      await this.ensureTagsExist(tenantId, dto.tagIds);
    }

    const data: any = {
      coverImage: dto.coverImage,
      status: dto.status,
      featured: dto.featured,
      categoryId: dto.categoryId,
      authorId: dto.authorId,
    };

    if (dto.tagIds) {
      data.tags = {
        set: dto.tagIds.map((tagId) => ({ id: tagId })),
      };
    }

    try {
      const updatedArticle = await this.prisma.article.update({
        where: { id },
        data,
        include: this.articleIncludes,
      });

      if (dto.status && dto.status !== currentArticle.status) {
        await this.enqueueWebhookEvent(tenantId, 'article.status_changed', {
          articleId: updatedArticle.id,
          oldStatus: currentArticle.status,
          newStatus: updatedArticle.status,
          reason: dto.moderationReason ?? null,
          moderatorId: dto.moderatorId ?? null,
        });
      }

      return updatedArticle;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug traduzione gia esistente');
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.article.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Articolo non trovato');
    }
  }

  async createTranslation(
    tenantId: string,
    articleId: string,
    dto: CreateArticleTranslationDto,
  ) {
    await this.ensureArticleExists(tenantId, articleId);

    const hasBannedWords = await this.bannedWordsService.checkText(
      tenantId,
      `${dto.title}\n${dto.content}`,
    );

    try {
      const translation = await this.prisma.articleTranslation.create({
        data: {
          ...dto,
          articleId,
          tenantId,
        },
      });

      if (hasBannedWords) {
        await this.hideArticleForBannedContent(tenantId, articleId);
      }

      return translation;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Traduzione gia esistente o slug duplicato');
      }
      throw error;
    }
  }

  async findTranslations(tenantId: string, articleId: string) {
    await this.ensureArticleExists(tenantId, articleId);

    return this.prisma.articleTranslation.findMany({
      where: {
        articleId,
        tenantId,
      },
      orderBy: { languageCode: 'asc' },
    });
  }

  async findTranslation(tenantId: string, articleId: string, languageCode: string) {
    const translation = await this.prisma.articleTranslation.findFirst({
      where: {
        articleId,
        tenantId,
        languageCode,
      },
    });

    if (!translation) {
      throw new NotFoundException('Traduzione non trovata');
    }

    return translation;
  }

  async updateTranslation(
    tenantId: string,
    articleId: string,
    languageCode: string,
    dto: UpdateArticleTranslationDto,
  ) {
    const translation = await this.findTranslation(tenantId, articleId, languageCode);

    const textToCheck = [dto.title, dto.content].filter(Boolean).join('\n');
    const hasBannedWords = textToCheck
      ? await this.bannedWordsService.checkText(tenantId, textToCheck)
      : false;

    try {
      const updatedTranslation = await this.prisma.articleTranslation.update({
        where: { id: translation.id },
        data: dto,
      });

      if (hasBannedWords) {
        await this.hideArticleForBannedContent(tenantId, articleId);
      }

      return updatedTranslation;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug traduzione gia esistente');
      }
      throw error;
    }
  }

  async removeTranslation(
    tenantId: string,
    articleId: string,
    languageCode: string,
  ): Promise<void> {
    const result = await this.prisma.articleTranslation.deleteMany({
      where: {
        articleId,
        tenantId,
        languageCode,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Traduzione non trovata');
    }
  }
}

