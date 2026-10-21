import { AuditAction, AuditResourceType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

/** An `AuditLog` row. */
export class AuditLogDto {
  @ApiProperty() id: string;
  @ApiProperty() timestamp: Date;
  @ApiProperty() tenantId: string;
  @ApiProperty({ description: 'External ID of the actor' }) actorUserId: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Username of the actor, null when unknown',
  })
  actorUsername: string | null;
  @ApiProperty({ description: 'Role of the actor at the time of the action' })
  actorRole: string;
  @ApiProperty({ enum: AuditAction, enumName: 'AuditAction' })
  action: AuditAction;
  @ApiProperty({ enum: AuditResourceType, enumName: 'AuditResourceType' })
  resourceType: AuditResourceType;
  @ApiProperty() resourceId: string;
  @ApiProperty({ type: String, nullable: true }) resourceName: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  changesBefore: Record<string, unknown> | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  changesAfter: Record<string, unknown> | null;
  @ApiProperty({ type: String, nullable: true }) changeSummary: string | null;
}
