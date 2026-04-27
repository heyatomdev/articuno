import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureArticleExists(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        tenantId,
      },
      select: {
        id: true,
      },
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
      select: {
        id: true,
      },
    });
  }

  async toggleLikeArticle(tenantId: string, articleId: string, externalUserId: string) {
    await this.ensureArticleExists(tenantId, articleId);
    const user = await this.ensureUser(tenantId, externalUserId);

    const existingLike = await this.prisma.like.findFirst({
      where: {
        articleId,
        userId: user.id,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (existingLike) {
      await this.prisma.$transaction([
        this.prisma.like.delete({
          where: {
            id: existingLike.id,
          },
        }),
        this.prisma.article.update({
          where: { id: articleId },
          data: { likesCount: { decrement: 1 } },
          select: { id: true },
        }),
      ]);

      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.like.create({
        data: {
          articleId,
          userId: user.id,
          tenantId,
        },
      }),
      this.prisma.article.update({
        where: { id: articleId },
        data: { likesCount: { increment: 1 } },
        select: { id: true },
      }),
    ]);

    return { liked: true };
  }

  async toggleBookmarkArticle(tenantId: string, articleId: string, externalUserId: string) {
    await this.ensureArticleExists(tenantId, articleId);
    const user = await this.ensureUser(tenantId, externalUserId);

    const existingBookmark = await this.prisma.bookmark.findFirst({
      where: {
        articleId,
        userId: user.id,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (existingBookmark) {
      await this.prisma.bookmark.delete({
        where: {
          id: existingBookmark.id,
        },
      });

      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({
      data: {
        articleId,
        userId: user.id,
        tenantId,
      },
    });

    return { bookmarked: true };
  }

  async getArticleStatus(tenantId: string, articleId: string, externalUserId: string) {
    await this.ensureArticleExists(tenantId, articleId);

    const user = await this.prisma.user.findFirst({
      where: {
        externalId: externalUserId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return {
        liked: false,
        bookmarked: false,
      };
    }

    const [likesCount, bookmarksCount] = await this.prisma.$transaction([
      this.prisma.like.count({
        where: {
          articleId,
          userId: user.id,
        },
      }),
      this.prisma.bookmark.count({
        where: {
          articleId,
          userId: user.id,
        },
      }),
    ]);

    return {
      liked: likesCount > 0,
      bookmarked: bookmarksCount > 0,
    };
  }

  async getMyBookmarks(tenantId: string, externalUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        externalId: externalUserId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return [];
    }

    return this.prisma.bookmark.findMany({
      where: {
        userId: user.id,
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    });
  }
}

