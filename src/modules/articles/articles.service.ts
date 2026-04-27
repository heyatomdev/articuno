import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';
import { UpdateArticleDto } from '@/modules/articles/dto/update-article.dto';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ArticleFiltersQueryDto } from '@/modules/articles/dto/article-filters-query.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly articleIncludes = {
    category: true,
    author: true,
    tags: true,
    translations: {
      orderBy: { languageCode: 'asc' as const },
    },
  };

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

    try {
      return await this.prisma.article.create({
        data: {
          slug: dto.slug,
          coverImage: dto.coverImage,
          status: dto.status,
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
        throw new ConflictException('Slug articolo o traduzione gia esistente');
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
    await this.ensureArticleExists(tenantId, id);

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
      slug: dto.slug,
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
      return await this.prisma.article.update({
        where: { id },
        data,
        include: this.articleIncludes,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug articolo gia esistente');
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

    try {
      return await this.prisma.articleTranslation.create({
        data: {
          ...dto,
          articleId,
          tenantId,
        },
      });
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

    try {
      return await this.prisma.articleTranslation.update({
        where: { id: translation.id },
        data: dto,
      });
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

