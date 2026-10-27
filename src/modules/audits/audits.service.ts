import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditListQueryDto } from '@/modules/audits/dto/audit-list-query.dto';
import { PaginatedResult, paginate } from '@heyatom/nest-common';

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

    return paginate(await this.withActorNames(tenantId, items), total, query);
  }

  async findOne(id: string, tenantId: string) {
    const auditLog = await this.prisma.auditLog.findFirst({
      where: { id, tenantId },
    });

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    const [named] = await this.withActorNames(tenantId, [auditLog]);
    return named;
  }

  /**
   * `actorUserId` is an externalId, not a relation: one lookup per page adds
   * the actor's `username` (null when the user is gone or has none), so the
   * console does not show a bare id.
   */
  private async withActorNames<T extends { actorUserId: string }>(
    tenantId: string,
    rows: T[],
  ): Promise<(T & { actorUsername: string | null })[]> {
    const ids = [...new Set(rows.map((r) => r.actorUserId))];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { tenantId, externalId: { in: ids } },
          select: { externalId: true, username: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.externalId, u.username]));
    return rows.map((r) => ({
      ...r,
      actorUsername: names.get(r.actorUserId) ?? null,
    }));
  }
}
