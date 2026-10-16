import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { BannedWordsService } from '@/modules/banned-words/banned-words.service';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ContentStatus } from '@prisma/client';
import { sanitizeContent, stripTranslationText } from '@/utils/html-sanitizer';
import { computeReadingTime } from '@/utils/reading-time';
import { nextFreeSlug, slugify } from '@/utils/slugify';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';

@Injectable()
export class ArticleTranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bannedWordsService: BannedWordsService,
    private readonly webhookPublisher: WebhookEventPublisher,
  ) {}

  private static readonly AUTO_MODERATION_REASON = 'BANNED_WORD_DETECTED';

  private async ensureArticleExists(
    tenantId: string,
    articleId: string,
    statuses?: ContentStatus[],
  ) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        tenantId,
        ...(statuses ? { status: { in: statuses } } : {}),
      },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    return article;
  }

  private async hideArticleForBannedContent(
    tenantId: string,
    articleId: string,
  ) {
    const article = await this.ensureArticleExists(tenantId, articleId);

    if (
      article.status === ContentStatus.HIDDEN ||
      article.status === ContentStatus.BANNED
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.article.update({
        where: { id: article.id, tenantId },
        data: { status: ContentStatus.HIDDEN },
      });

      await this.webhookPublisher.publishArticleStatusChangedEvent(
        tenantId,
        article.id,
        article.status,
        ContentStatus.HIDDEN,
        ArticleTranslationsService.AUTO_MODERATION_REASON,
        'system',
        tx,
      );
    });
  }

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

  async create(
    tenantId: string,
    articleId: string,
    dto: CreateArticleTranslationDto,
  ) {
    await this.ensureArticleExists(tenantId, articleId);

    const hasBannedWords = await this.bannedWordsService.checkText(
      tenantId,
      `${dto.title}\n${dto.content}`,
    );

    const sanitizedDto = this.sanitizeTranslation(dto);
    const base = slugify(sanitizedDto.title);
    const taken = await this.prisma.articleTranslation.findMany({
      where: { tenantId, slug: { startsWith: base } },
      select: { slug: true },
    });

    try {
      const translation = await this.prisma.articleTranslation.create({
        data: {
          ...sanitizedDto,
          slug: nextFreeSlug(
            base,
            taken.map((t) => t.slug),
          ),
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
        throw new ConflictException({
          code: 'TRANSLATION_EXISTS',
          message: 'Traduzione gia esistente o slug duplicato',
        });
      }
      throw error;
    }
  }

  /**
   * `statuses` restricts the parent article's status (public API: see
   * `publicArticleStatuses`); admin callers omit it and see every status.
   */
  async findAll(
    tenantId: string,
    articleId: string,
    statuses?: ContentStatus[],
  ) {
    await this.ensureArticleExists(tenantId, articleId, statuses);

    return this.prisma.articleTranslation.findMany({
      where: { articleId, tenantId },
      select: {
        id: true,
        title: true,
        slug: true,
        languageCode: true,
        excerpt: true,
        readingTime: true,
      },
      orderBy: { languageCode: 'asc' },
    });
  }

  async findOne(
    tenantId: string,
    articleId: string,
    languageCode: string,
    statuses?: ContentStatus[],
  ) {
    const translation = await this.prisma.articleTranslation.findFirst({
      where: {
        articleId,
        tenantId,
        languageCode,
        ...(statuses
          ? { article: { tenantId, status: { in: statuses } } }
          : {}),
      },
    });

    if (!translation) {
      throw new NotFoundException('Traduzione non trovata');
    }

    return translation;
  }

  async update(
    tenantId: string,
    articleId: string,
    languageCode: string,
    dto: UpdateArticleTranslationDto & { slug?: string },
  ) {
    const translation = await this.findOne(tenantId, articleId, languageCode);

    const textToCheck = [dto.title, dto.content].filter(Boolean).join('\n');
    const hasBannedWords = textToCheck
      ? await this.bannedWordsService.checkText(tenantId, textToCheck)
      : false;

    // The slug never follows `title`: it changes only when `slug` is passed (admin).
    const sanitizedDto: UpdateArticleTranslationDto & {
      slug?: string;
      readingTime?: number;
    } = {
      ...stripTranslationText(dto),
      ...(dto.content !== undefined
        ? { content: sanitizeContent(dto.content) }
        : {}),
      ...(dto.content !== undefined
        ? { readingTime: computeReadingTime(dto.content) }
        : {}),
      ...(dto.excerpt !== undefined
        ? { excerpt: sanitizeContent(dto.excerpt) }
        : {}),
    };

    try {
      const updatedTranslation = await this.prisma.articleTranslation.update({
        where: { id: translation.id },
        data: sanitizedDto,
      });

      if (hasBannedWords) {
        await this.hideArticleForBannedContent(tenantId, articleId);
      }

      return updatedTranslation;
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

  async remove(
    tenantId: string,
    articleId: string,
    languageCode: string,
  ): Promise<void> {
    const result = await this.prisma.articleTranslation.deleteMany({
      where: { articleId, tenantId, languageCode },
    });

    if (result.count === 0) {
      throw new NotFoundException('Traduzione non trovata');
    }
  }
}
