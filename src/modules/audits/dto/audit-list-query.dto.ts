import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditResourceType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PagedQuery } from '@/pagination';

export class AuditListQueryDto extends PagedQuery {
  @ApiProperty({
    description: 'Filter audit logs by action',
    enum: AuditAction,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiProperty({
    description: 'Filter audit logs by resource type',
    enum: AuditResourceType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuditResourceType)
  resourceType?: AuditResourceType;

  @ApiProperty({
    description: 'Filter audit logs by actor user ID (externalId)',
    required: false,
  })
  @IsOptional()
  actorUserId?: string;
}

