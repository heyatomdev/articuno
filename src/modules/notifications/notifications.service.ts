import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { PaginatedResult, paginate } from '@/common/pagination';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';
import { Notification } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: NotificationListQueryDto,
  ): Promise<PaginatedResult<Notification>> {
    const where = {
      tenantId,
      ...(query.type !== undefined && { type: query.type }),
      ...(query.sentToClient !== undefined && { sentToClient: query.sentToClient }),
      ...(query.userId !== undefined && { userId: query.userId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.skip,
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

    return paginate(items, total, query);
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

