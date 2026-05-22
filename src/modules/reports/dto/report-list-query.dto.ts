import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus, TargetType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PagedQuery } from '@/pagination';

export class ReportListQueryDto extends PagedQuery {
  @ApiProperty({
    description: 'Filter reports by status',
    enum: ReportStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiProperty({
    description: 'Filter by the external ID of the user who submitted the report',
    required: false,
    example: 'user_abc123',
  })
  @IsOptional()
  @IsString()
  reporterId?: string;

  @ApiProperty({
    description: 'Filter by target type (ARTICLE, COMMENT, USER)',
    enum: TargetType,
    required: false,
  })
  @IsOptional()
  @IsEnum(TargetType)
  targetType?: TargetType;

  @ApiProperty({
    description: 'Filter by the ID of the reported entity',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiProperty({
    description: 'Filter by the external ID of the moderator who handled the report',
    required: false,
    example: 'mod_xyz789',
  })
  @IsOptional()
  @IsString()
  moderatorId?: string;

  @ApiProperty({
    description: 'Filter by report reason (case-insensitive partial match)',
    required: false,
    example: 'SPAM',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

