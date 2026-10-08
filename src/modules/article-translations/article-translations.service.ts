import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { BannedWordsService } from '@/modules/banned-worlds/banned-words.service';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { UpdateArticleTranslationDto } from '@/modules/articles/dto/update-article-translation.dto';
import { ContentStatus } from '@prisma/client';
import { sanitizeContent, stripTranslationText } from '@/utils/html-sanitizer';
import { computeReadingTime } from '@/utils/reading-time';
import { slugifySafe } from '@/utils/slugify';
import { WebhookEventPublisher } from '@/modules/moderation/webhook-event-publisher.service';

@Injectable()
export class ArticleTranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bannedWordsService: BannedWordsService,
    private readonly webhookPublisher: WebhookEventPublisher,
  ) {}

  private static readonly AUTO_MODERATION_REASON = 'BANNED_WORD_DETECTED';

  private async ensureArticleExists(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }

    return article;
  }

  private async hideArticleForBannedContent(tenantId: string, articleId: string) {
    const article = await this.ensureArticleExists(tenantId, articleId);

    if (article.status === ContentStatus.HIDDEN || article.status === ContentStatus.BANNED) {
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

  private sanitizeTranslation<T extends { title: string; content: string; excerpt?: string }>(
    translation: T,
  ): T & { slug: string; readingTime: number } {
    translation = stripTranslationText(translation);
    return {
      ...translation,
      slug: slugifySafe(translation.title),
      content: sanitizeContent(translation.content),
      readingTime: computeReadingTime(translation.content),
      ...(translation.excerpt !== undefined ? { excerpt: sanitizeContent(translation.excerpt) } : {}),
    };
  }

  async create(tenantId: string, articleId: string, dto: CreateArticleTranslationDto) {
    await this.ensureArticleExists(tenantId, articleId);

    const hasBannedWords = await this.bannedWordsService.checkText(
      tenantId,
      `${dto.title}\n${dto.content}`,
    );

    const sanitizedDto = this.sanitizeTranslation(dto);

    try {
      const translation = await this.prisma.articleTranslation.create({
        data: {
          ...sanitizedDto,
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

  async findAll(tenantId: string, articleId: string) {
    await this.ensureArticleExists(tenantId, articleId);

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

  async findOne(tenantId: string, articleId: string, languageCode: string) {
    const translation = await this.prisma.articleTranslation.findFirst({
      where: { articleId, tenantId, languageCode },
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
    dto: UpdateArticleTranslationDto,
  ) {
    const translation = await this.findOne(tenantId, articleId, languageCode);

    const textToCheck = [dto.title, dto.content].filter(Boolean).join('\n');
    const hasBannedWords = textToCheck
      ? await this.bannedWordsService.checkText(tenantId, textToCheck)
      : false;

    const sanitizedDto: UpdateArticleTranslationDto & {
      slug?: string;
      readingTime?: number;
    } = {
      ...stripTranslationText(dto),
      ...(dto.content !== undefined ? { content: sanitizeContent(dto.content) } : {}),
      ...(dto.content !== undefined
        ? { readingTime: computeReadingTime(dto.content) }
        : {}),
      ...(dto.excerpt !== undefined ? { excerpt: sanitizeContent(dto.excerpt) } : {}),
    };

    if (dto.title !== undefined && dto.title !== translation.title) {
      sanitizedDto.slug = slugifySafe(sanitizedDto.title);
    }

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
        throw new ConflictException('Slug traduzione gia esistente');
      }
      throw error;
    }
  }

  async remove(tenantId: string, articleId: string, languageCode: string): Promise<void> {
    const result = await this.prisma.articleTranslation.deleteMany({
      where: { articleId, tenantId, languageCode },
    });

    if (result.count === 0) {
      throw new NotFoundException('Traduzione non trovata');
    }
  }
}

