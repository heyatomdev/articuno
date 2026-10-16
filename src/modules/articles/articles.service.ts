import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { BannedWordsService } from '@/modules/banned-words/banned-words.service';
import { FileHarborService } from '@/modules/fileharbor/fileharbor.service';
import { CreateArticleDto } from '@/modules/articles/dto/create-article.dto';
import { UpdateArticleDto } from '@/modules/articles/dto/update-article.dto';
import {
  ArticleFiltersQueryDto,
  PublicArticleFiltersQueryDto,
} from '@/modules/articles/dto/article-filters-query.dto';
import { ContentStatus, Prisma } from '@prisma/client';
import { publicArticleStatuses } from '@/modules/articles/article-visibility';
import { sanitizeContent, stripTranslationText } from '@/utils/html-sanitizer';
import { computeReadingTime } from '@/utils/reading-time';
import { nextFreeSlug, slugify } from '@/utils/slugify';
import { generateRandomName } from '@/utils/random-name';
import { PaginatedResult, paginate } from '@heyatom/nest-common';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';
import { isValidModerationTransition } from '@/modules/moderation/moderation-policy.service';
import { AutoModerationReasonEnum } from '@/modules/moderation/moderation.types';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bannedWordsService: BannedWordsService,
    private readonly fileHarborService: FileHarborService,
    private readonly webhookPublisher: WebhookEventPublisher,
  ) {}

  private readonly articleIncludes = {
    category: {
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
      },
    },
    author: {
      select: {
        id: true,
        username: true,
        externalId: true,
        status: true,
        role: true,
      },
    },
    tags: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
    translations: {
      orderBy: { languageCode: 'asc' as const },
    },
    _count: {
      select: {
        commentsList: true as const,
      },
    },
  };

  private readonly articleListIncludes = {
    ...this.articleIncludes,
    translations: {
      select: {
        id: true,
        title: true,
        slug: true,
        languageCode: true,
        excerpt: true,
        readingTime: true,
      },
      orderBy: { languageCode: 'asc' as const },
    },
  };

  private sanitizeTranslation<
    T extends { title: string; content: string; excerpt?: string },
  >(translation: T): T & { readingTime: number } {
    translation = stripTranslationText(translation);
    return {
      ...translation,
      content: sanitizeContent(translation.content),
      readingTime: computeReadingTime(translation.content),
      ...(translation.excerpt !== undefined
        ? { excerpt: sanitizeContent(translation.excerpt) }
        : {}),
    };
  }

  private async hasBannedWordsInTranslations(
    tenantId: string,
    translations?: Array<{ title: string; content: string }>,
  ) {
    if (!translations?.length) {
      return false;
    }

    const textToCheck = translations
      .map((t) => `${t.title}\n${t.content}`)
      .join('\n');
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

  /**
   * A client-supplied coverImage must be an image of the tenant's own
   * FileHarbor: it is later deleted from there by id (cover replace/delete).
   * Not for URLs FileHarbor just returned from an upload.
   */
  async assertOwnCoverImage(
    tenantId: string,
    url?: string | null,
  ): Promise<void> {
    if (!url) return;
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { fileharborEndpoint: true },
    });
    if (
      !tenant?.fileharborEndpoint ||
      !FileHarborService.isUnderEndpoint(url, tenant.fileharborEndpoint)
    ) {
      throw new BadRequestException({
        code: 'INVALID_COVER_IMAGE',
        message: "coverImage deve essere un'immagine del FileHarbor del tenant",
      });
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

    // Se nessuna traduzione è fornita, genera una traduzione italiana di default
    // con un titolo casuale in stile Docker (es. "brillante_turing")
    const translationsInput =
      dto.translations && dto.translations.length > 0
        ? dto.translations
        : [
            {
              languageCode: 'it',
              title: generateRandomName(),
              content: '',
              excerpt: '',
            },
          ];

    const hasBannedWords = await this.hasBannedWordsInTranslations(
      tenantId,
      translationsInput,
    );
    // A banned word hides the article; BANNED is terminal and stays as is.
    const autoHidden =
      hasBannedWords &&
      requestedStatus !== ContentStatus.HIDDEN &&
      requestedStatus !== ContentStatus.BANNED;
    const finalStatus = autoHidden ? ContentStatus.HIDDEN : requestedStatus;

    const sanitizedTranslations = translationsInput.map((t) =>
      this.sanitizeTranslation(t),
    );
    const bases = sanitizedTranslations.map((t) => slugify(t.title));
    const taken = (
      await this.prisma.articleTranslation.findMany({
        where: {
          tenantId,
          OR: bases.map((base) => ({ slug: { startsWith: base } })),
        },
        select: { slug: true },
      })
    ).map((t) => t.slug);
    // Same title in two languages → "titolo", "titolo-2".
    const slugs = bases.map((base) => {
      const slug = nextFreeSlug(base, taken);
      taken.push(slug);
      return slug;
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const article = await tx.article.create({
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
            translations: {
              create: sanitizedTranslations.map((translation, i) => ({
                ...translation,
                slug: slugs[i],
                tenantId,
              })),
            },
          },
          include: this.articleIncludes,
        });

        // Same event the translation path emits when a banned word hides an
        // existing article. Outbox row in the same tx: delivery is async
        // (WebhooksJob), the request never waits on the tenant endpoint.
        if (autoHidden) {
          await this.webhookPublisher.publishArticleStatusChangedEvent(
            tenantId,
            article.id,
            requestedStatus,
            ContentStatus.HIDDEN,
            AutoModerationReasonEnum.BANNED_WORD_DETECTED,
            'system',
            tx,
          );
        } else if (finalStatus === ContentStatus.PUBLISHED) {
          article.publishedAt =
            await this.webhookPublisher.publishArticleLifecycleEvent(
              tenantId,
              article.id,
              null,
              ContentStatus.PUBLISHED,
              tx,
            );
        }

        return article;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: 'Slug traduzione gia esistente',
        });
      }
      throw error;
    }
  }

  /**
   * Public listing (X-API-Key): PUBLISHED only, plus DRAFT with `includeDrafts`.
   * UNDER_REVIEW, HIDDEN and BANNED are never returned here.
   */
  async findAllPublic(
    tenantId: string,
    query: PublicArticleFiltersQueryDto,
  ): Promise<PaginatedResult<any>> {
    const visible = publicArticleStatuses(query.includeDrafts);

    if (query.status && !visible.includes(query.status)) {
      throw new BadRequestException({
        code: 'DRAFTS_NOT_INCLUDED',
        message: 'status=DRAFT richiede includeDrafts=true',
      });
    }

    // statusFilter overrides query.status: the public caller never picks a
    // status outside `visible`.
    // Newest publication first; drafts (no publishedAt) after, newest first.
    return this.findAll(
      tenantId,
      query,
      { in: query.status ? [query.status] : visible },
      [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    );
  }

  async findAll(
    tenantId: string,
    query: ArticleFiltersQueryDto,
    statusFilter?: { in: ContentStatus[] },
    orderBy: Prisma.ArticleOrderByWithRelationInput[] = [{ createdAt: 'desc' }],
  ): Promise<PaginatedResult<any>> {
    const where: any = {
      tenantId,
      ...(statusFilter
        ? { status: statusFilter }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
      ...(query.tagId
        ? {
            tags: {
              some: {
                id: query.tagId,
                tenantId,
              },
            },
          }
        : {}),
      ...(query.languageCode
        ? {
            translations: {
              some: { languageCode: query.languageCode },
            },
          }
        : {}),
    };

    const listIncludes = query.languageCode
      ? {
          ...this.articleListIncludes,
          translations: {
            select: {
              id: true,
              title: true,
              slug: true,
              languageCode: true,
              excerpt: true,
              readingTime: true,
            },
            where: { languageCode: query.languageCode },
          },
        }
      : this.articleListIncludes;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        orderBy,
        take: query.limit,
        skip: query.skip,
        include: listIncludes,
      }),
      this.prisma.article.count({ where }),
    ]);

    return paginate(items, total, query);
  }

  /**
   * Public detail by slug (X-API-Key): PUBLISHED only, plus DRAFT with
   * `includeDrafts`. Any other status answers 404, same as a missing slug.
   */
  findOnePublic(
    tenantId: string,
    slug: string,
    languageCode?: string,
    includeDrafts?: boolean,
  ) {
    return this.findOne(
      tenantId,
      slug,
      languageCode,
      publicArticleStatuses(includeDrafts),
    );
  }

  async findOne(
    tenantId: string,
    slug: string,
    languageCode?: string,
    statuses?: ContentStatus[],
  ) {
    const articleIncludes = languageCode
      ? {
          ...this.articleIncludes,
          translations: {
            where: { languageCode },
          },
        }
      : this.articleIncludes;

    const article = await this.prisma.article.findFirst({
      where: {
        tenantId,
        ...(statuses ? { status: { in: statuses } } : {}),
        translations: {
          some: {
            tenantId,
            slug,
          },
        },
      },
      include: articleIncludes,
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    return article;
  }

  async findOneById(tenantId: string, id: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        tenantId,
        id,
      },
      include: this.articleIncludes,
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    return article;
  }

  async update(tenantId: string, id: string, dto: UpdateArticleDto) {
    const currentArticle = await this.ensureArticleExists(tenantId, id);

    if (
      dto.status &&
      !isValidModerationTransition(currentArticle.status, dto.status)
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Transizione di stato non consentita: ${currentArticle.status} → ${dto.status}`,
      });
    }

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
      return await this.prisma.$transaction(async (tx) => {
        const updatedArticle = await tx.article.update({
          where: { id, tenantId },
          data,
          include: this.articleIncludes,
        });

        if (dto.status && dto.status !== currentArticle.status) {
          updatedArticle.publishedAt =
            await this.webhookPublisher.publishArticleStatusChangedEvent(
              tenantId,
              updatedArticle.id,
              currentArticle.status,
              updatedArticle.status,
              dto.moderationReason,
              dto.moderatorId,
              tx,
            );
        }

        return updatedArticle;
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: 'Slug traduzione gia esistente',
        });
      }
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const article = await this.prisma.article.findFirst({
      where: { id, tenantId },
      select: { id: true, coverImage: true },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    await this.prisma.$transaction(async (tx) => {
      // Slugs and titles are gone after the delete: read them first.
      const summary = await this.webhookPublisher.articleSummary(
        tx,
        tenantId,
        id,
      );
      await tx.article.delete({ where: { id, tenantId } });
      await this.webhookPublisher.publishArticleDeletedEvent(
        tenantId,
        summary,
        tx,
      );
    });

    if (article.coverImage) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { fileharborEndpoint: true, fileharborApiKey: true },
      });

      if (tenant?.fileharborEndpoint && tenant?.fileharborApiKey) {
        await this.fileHarborService.deleteImageSafely(
          article.coverImage,
          {
            endpoint: tenant.fileharborEndpoint,
            apiKey: tenant.fileharborApiKey,
          },
          { loggerContext: 'ArticleDelete' },
        );
      }
    }
  }
}
