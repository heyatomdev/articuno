import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditListQueryDto } from '@/modules/audits/dto/audit-list-query.dto';
import { limit, PagedResponse } from '@/pagination';

@Injectable()
export class AuditsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: AuditListQueryDto,
  ): Promise<PagedResponse<any>> {
    const where = {
      tenantId,
      ...(query.action && { action: query.action }),
      ...(query.resourceType && { resourceType: query.resourceType }),
      ...(query.actorUserId && { actorUserId: query.actorUserId }),
    };

    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit(query),
        skip: query.offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const pageSize = query.limit ?? 20;
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

  async findOne(id: string, tenantId: string) {
    const auditLog = await this.prisma.auditLog.findFirst({
      where: { id, tenantId },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    return auditLog;
  }
}

