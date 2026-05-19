import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { UpsertUserDto } from '@/modules/users/dto/upsert-user.dto';
import { limit, PagedResponse } from '@/pagination';
import { UserListQueryDto } from '@/modules/users/dto/user-list-query.dto';
import { UserListItemDto } from '@/modules/users/dto/user-list-item.dto';

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
  ): Promise<PagedResponse<UserListItemDto>> {
    const where = { tenantId };
    const pageSize = limit(query);

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: query.offset,
        select: this.userListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    const currentPage = Math.floor((query.offset ?? 0) / pageSize) + 1;

    return {
      items: items.map((user) => this.mapUserListItem(user)),
      pagination: {
        totalCount,
        currentPage,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<UserListItemDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: this.userListSelect,
    });

    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    return this.mapUserListItem(user);
  }

  async upsert(tenantId: string, dto: UpsertUserDto) {
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

  async deleteByExternalId(tenantId: string, externalId: string): Promise<void> {
    const result = await this.prisma.user.deleteMany({
      where: {
        tenantId,
        externalId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Utente non trovato');
    }
  }
}

