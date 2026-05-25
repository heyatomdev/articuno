import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { limit, PagedResponse } from '@/pagination';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import { Notification } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: NotificationListQueryDto,
  ): Promise<PagedResponse<Notification>> {
    const pageSize = limit(query);

    const where = {
      tenantId,
      ...(query.type !== undefined && { type: query.type }),
      ...(query.sentToClient !== undefined && { sentToClient: query.sentToClient }),
      ...(query.userId !== undefined && { userId: query.userId }),
    };

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: query.offset,
        include: {
          user: {
            select: {
              id: true,
              externalId: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const currentPage = Math.floor((query.offset ?? 0) / pageSize) + 1;

    return {
      items,
      pagination: {
        totalCount,
        currentPage,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            externalId: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notifica non trovata');
    }

    return notification;
  }
}

