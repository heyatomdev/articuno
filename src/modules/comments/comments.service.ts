import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { CreateCommentDto } from '@/modules/comments/dto/create-comment.dto';
import { UpdateCommentDto } from '@/modules/comments/dto/update-comment.dto';
import { CommentFiltersQueryDto } from '@/modules/comments/dto/comment-filters-query.dto';

@Injectable()
export class CommentsService {
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

  async create(tenantId: string, dto: CreateCommentDto) {
    await this.ensureArticleExists(tenantId, dto.articleId);
    const user = await this.ensureUser(tenantId, dto.authorExternalId);

    return this.prisma.comment.create({
      data: {
        tenantId,
        articleId: dto.articleId,
        authorId: user.id,
        content: dto.content,
      },
      include: {
        author: true,
      },
    });
  }

  async findAll(tenantId: string, query: CommentFiltersQueryDto) {
    return this.prisma.comment.findMany({
      where: {
        tenantId,
        ...(query.articleId && { articleId: query.articleId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        author: true,
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        author: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Commento non trovato');
    }

    return comment;
  }

  async update(tenantId: string, id: string, dto: UpdateCommentDto) {
    await this.findOne(tenantId, id);

    return this.prisma.comment.update({
      where: {
        id,
      },
      data: dto,
      include: {
        author: true,
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.comment.deleteMany({
      where: {
        id,
        tenantId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Commento non trovato');
    }
  }
}

