import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { UpsertUserDto } from '@/modules/users/dto/upsert-user.dto';
import { PaginatedResult, paginate } from '@/common/pagination';
import { UserListQueryDto } from '@/modules/users/dto/user-list-query.dto';
import { UserListItemDto } from '@/modules/users/dto/user-list-item.dto';
import { ReportStatus, TargetType, UserStatus } from '@prisma/client';
import {
  DELETED_USER_ID,
  SYSTEM_EXTERNAL_IDS,
} from '@/modules/users/users.constants';

/** System users are internal: not listed, not editable, not deletable. */
const NOT_SYSTEM = { externalId: { notIn: SYSTEM_EXTERNAL_IDS } };
function assertNotSystem(externalId: string): void {
  if (SYSTEM_EXTERNAL_IDS.includes(externalId)) {
    throw new BadRequestException({
      code: 'RESERVED_EXTERNAL_ID',
      message: `externalId riservato: ${externalId}`,
    });
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userListSelect = {
    id: true,
    externalId: true,
    tenantId: true,
    language: true,
    username: true,
    avatarUrl: true,
    status: true,
    role: true,
    createdAt: true,
    _count: {
      select: {
        articles: true,
        comments: true,
      },
    },
  } as const;

  private mapUserListItem({
    _count,
    ...user
  }: {
    id: string;
    externalId: string;
    tenantId: string;
    language: string;
    username: string | null;
    avatarUrl: string | null;
    status: UserListItemDto['status'];
    role: UserListItemDto['role'];
    createdAt: Date;
    _count: {
      articles: number;
      comments: number;
    };
  }): UserListItemDto {
    return {
      ...user,
      articlesCount: _count.articles,
      commentsCount: _count.comments,
    };
  }

  async findAll(
    tenantId: string,
    query: UserListQueryDto,
  ): Promise<PaginatedResult<UserListItemDto>> {
    const where: Parameters<typeof this.prisma.user.findMany>[0]['where'] = {
      tenantId,
      ...NOT_SYSTEM,
      ...(query.username
        ? { username: { contains: query.username, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.skip,
        select: this.userListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(
      items.map((user) => this.mapUserListItem(user)),
      total,
      query,
    );
  }

  async findOne(tenantId: string, id: string): Promise<UserListItemDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, ...NOT_SYSTEM },
      select: this.userListSelect,
    });

    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    return this.mapUserListItem(user);
  }

  async upsert(tenantId: string, dto: UpsertUserDto) {
    assertNotSystem(dto.externalId);
    const updateData: {
      username?: string;
      language?: string;
      avatarUrl?: string;
    } = {};

    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    return this.prisma.user.upsert({
      where: {
        externalId_tenantId: {
          externalId: dto.externalId,
          tenantId,
        },
      },
      update: updateData,
      create: {
        externalId: dto.externalId,
        tenantId,
        username: dto.username,
        language: dto.language,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: UserStatus,
  ): Promise<UserListItemDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, ...NOT_SYSTEM },
    });
    if (!user) throw new NotFoundException('Utente non trovato');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: this.userListSelect,
    });

    return this.mapUserListItem(updated);
  }

  async deleteById(tenantId: string, id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, ...NOT_SYSTEM },
    });
    if (!user) throw new NotFoundException('Utente non trovato');

    await this.deleteUser(tenantId, user);
  }

  async deleteByExternalId(
    tenantId: string,
    externalId: string,
  ): Promise<void> {
    assertNotSystem(externalId);
    const user = await this.prisma.user.findFirst({
      where: { tenantId, externalId },
      select: { id: true, externalId: true },
    });
    if (!user) throw new NotFoundException('Utente non trovato');

    await this.deleteUser(tenantId, user);
  }

  /**
   * Comments are anonymised, not deleted: they move to the per-tenant
   * DELETED_USER_ID placeholder (`comments.authorId` is NO ACTION). Likes and
   * the user's own reports cascade, so the counters they fed are decremented
   * here; moderated reports keep the decision with `moderatorId` set to NULL
   * by the FK.
   */
  private async deleteUser(
    tenantId: string,
    user: { id: string; externalId: string },
  ): Promise<void> {
    const placeholder = await this.prisma.ensureUser(
      tenantId,
      DELETED_USER_ID,
      'Utente eliminato',
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.updateMany({
        where: { authorId: user.id, tenantId },
        data: { authorId: placeholder.id },
      });

      // (articleId, userId) is unique: one like per article, decrement by 1.
      const likes = await tx.like.findMany({
        where: { userId: user.id, tenantId },
        select: { articleId: true },
      });
      if (likes.length) {
        const articleIds = likes.map((l) => l.articleId);
        await tx.like.deleteMany({
          where: { userId: user.id, tenantId, articleId: { in: articleIds } },
        });
        await tx.article.updateMany({
          where: { id: { in: articleIds }, tenantId },
          data: { likesCount: { decrement: 1 } },
        });
      }

      // `reportCount` resets only once a comment has no open report, so every
      // open report is still counted in it.
      const openReports = await tx.report.groupBy({
        by: ['targetId'],
        where: {
          tenantId,
          reporterId: user.externalId,
          targetType: TargetType.COMMENT,
          status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWED] },
        },
        _count: { _all: true },
      });
      for (const { targetId, _count } of openReports) {
        await tx.comment.updateMany({
          where: { id: targetId, tenantId, reportCount: { gte: _count._all } },
          data: { reportCount: { decrement: _count._all } },
        });
      }

      await tx.user.deleteMany({ where: { id: user.id, tenantId } });
    });
  }
}
