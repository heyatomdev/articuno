import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditListQueryDto } from '@/modules/audits/dto/audit-list-query.dto';
import { PaginatedResult, paginate } from '@/common/pagination';

@Injectable()
export class AuditsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: AuditListQueryDto,
  ): Promise<PaginatedResult<any>> {
    const where = {
      tenantId,
      ...(query.action && { action: query.action }),
      ...(query.resourceType && { resourceType: query.resourceType }),
      ...(query.actorUserId && { actorUserId: query.actorUserId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit,
        skip: query.skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(items, total, query);
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

