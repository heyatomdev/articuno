import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { PageParams, PaginatedResult, paginate } from '@/common/pagination';
import { ContentStatus } from '@prisma/client';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureArticleExists(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: { id: articleId, tenantId },
      select: { id: true },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }
  }

  async toggle(tenantId: string, articleId: string, externalUserId: string) {
    await this.ensureArticleExists(tenantId, articleId);
    const user = await this.prisma.ensureUser(tenantId, externalUserId);

    // Delete-first, then create: a concurrent double click that loses the
    // insert race hits the unique (articleId, userId) key — already bookmarked.
    const { count } = await this.prisma.bookmark.deleteMany({
      where: { articleId, userId: user.id, tenantId },
    });

    if (count) {
      return { bookmarked: false };
    }

    try {
      await this.prisma.bookmark.create({
        data: { articleId, userId: user.id, tenantId },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }

    return { bookmarked: true };
  }

  async findAll(
    tenantId: string,
    externalUserId: string,
    query: PageParams,
  ): Promise<PaginatedResult<unknown>> {
    const user = await this.prisma.user.findFirst({
      where: { externalId: externalUserId, tenantId },
      select: { id: true },
    });

    if (!user) {
      return paginate([], 0, query);
    }

    // A bookmark outlives its article's publication; hidden/banned/draft
    // articles must not leak through the public bookmark list.
    const where = {
      userId: user.id,
      tenantId,
      article: { status: ContentStatus.PUBLISHED },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.bookmark.count({ where }),
      this.prisma.bookmark.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          article: {
            include: {
              category: {
                select: { id: true, name: true, slug: true, description: true, color: true },
              },
              tags: { select: { id: true, name: true, slug: true } },
              // List shape: no `content` body, same fields as the article list.
              translations: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  languageCode: true,
                  excerpt: true,
                  readingTime: true,
                },
                orderBy: { languageCode: 'asc' },
              },
            },
          },
        },
      }),
    ]);

    return paginate(items, total, query);
  }
}

