import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { ContentStatus } from '@prisma/client';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Likes and status only on PUBLISHED articles: a draft or moderated article
  // must not be reachable (or confirmed to exist) from the public API.
  private async ensureArticleExists(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        tenantId,
        status: ContentStatus.PUBLISHED,
      },
      select: {
        id: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Articolo non trovato');
    }
  }

  /**
   * One atomic increment, PUBLISHED only. Raw SQL so a view does not bump
   * `updatedAt` (Prisma sets `@updatedAt` on every update).
   */
  async countView(tenantId: string, articleId: string): Promise<void> {
    const count = await this.prisma.$executeRaw`
      UPDATE "articles" SET "views" = "views" + 1
      WHERE "id" = ${articleId} AND "tenantId" = ${tenantId}
        AND "status" = 'PUBLISHED'`;

    if (count === 0) {
      throw new NotFoundException('Articolo non trovato');
    }
  }

  async toggleLikeArticle(
    tenantId: string,
    articleId: string,
    externalUserId: string,
  ) {
    await this.ensureArticleExists(tenantId, articleId);
    const user = await this.prisma.ensureUser(tenantId, externalUserId);

    // Delete-first instead of find-then-act: a double click can't both see "no
    // like" and insert twice. The loser of a concurrent insert hits the unique
    // (articleId, userId) key; the like exists either way, so report liked.
    const liked = await this.prisma
      .$transaction(async (tx) => {
        const { count } = await tx.like.deleteMany({
          where: { articleId, userId: user.id, tenantId },
        });

        await tx.article.update({
          where: { id: articleId, tenantId },
          data: { likesCount: count ? { decrement: count } : { increment: 1 } },
          select: { id: true },
        });

        if (count) return false;

        await tx.like.create({
          data: { articleId, userId: user.id, tenantId },
        });
        return true;
      })
      .catch((error) => {
        if (error.code === 'P2002') return true;
        throw error;
      });

    return { liked };
  }

  async getArticleStatus(
    tenantId: string,
    articleId: string,
    externalUserId: string,
  ) {
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
          tenantId,
        },
      }),
      this.prisma.bookmark.count({
        where: {
          articleId,
          userId: user.id,
          tenantId,
        },
      }),
    ]);

    return {
      liked: likesCount > 0,
      bookmarked: bookmarksCount > 0,
    };
  }
}
