import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, AuditResourceType, UserRole, Prisma } from '@prisma/client';
import { PrismaService } from '@/modules/prisma/prisma.service';

export interface AuditLogEntry {
  tenantId: string;
  actorUserId: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  resourceName?: string;
  changesBefore?: Record<string, unknown>;
  changesAfter?: Record<string, unknown>;
  changeSummary?: string;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry. Fire-and-forget: errors are logged but never
   * bubbled up so that a failed audit write never breaks the main flow.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorUserId: entry.actorUserId,
          actorRole: entry.actorRole,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          resourceName: entry.resourceName,
          changesBefore: entry.changesBefore
            ? (entry.changesBefore as Prisma.InputJsonValue)
            : undefined,
          changesAfter: entry.changesAfter
            ? (entry.changesAfter as Prisma.InputJsonValue)
            : undefined,
          changeSummary: entry.changeSummary,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}

