import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { PageParams, PaginatedResult, paginate } from '@/common/pagination';

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

  private async ensureUser(tenantId: string, externalUserId: string) {
    return this.prisma.user.upsert({
      where: {
        externalId_tenantId: {
          externalId: externalUserId,
          tenantId,
        },
      },
      update: {},
      create: {
        externalId: externalUserId,
        tenantId,
      },
      select: { id: true },
    });
  }

  async toggle(tenantId: string, articleId: string, externalUserId: string) {
    await this.ensureArticleExists(tenantId, articleId);
    const user = await this.ensureUser(tenantId, externalUserId);

    const existingBookmark = await this.prisma.bookmark.findFirst({
      where: { articleId, userId: user.id, tenantId },
      select: { id: true },
    });

    if (existingBookmark) {
      await this.prisma.bookmark.delete({
        where: { id: existingBookmark.id },
      });

      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({
      data: { articleId, userId: user.id, tenantId },
    });

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

    const where = { userId: user.id, tenantId };

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
              category: true,
              tags: true,
              translations: {
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

