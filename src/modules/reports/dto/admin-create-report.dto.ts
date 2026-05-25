import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus, TargetType } from '@prisma/client';

/**
 * DTO used exclusively by admin endpoints to file a report.
 * `reporterId` and `moderatorId` are NOT exposed here — they are auto-populated from the session's `externalId`.
 */
export class AdminCreateReportDto {
  @ApiProperty({
    description: 'Type of the reported target',
    enum: TargetType,
    example: TargetType.COMMENT,
  })
  @IsEnum(TargetType)
  targetType: TargetType;

  @ApiProperty({
    description: 'UUID of the reported target (article, comment or user)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  targetId: string;

  @ApiProperty({
    description: 'Short reason for the report',
    example: 'Spam',
  })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Optional additional details about the report',
    example: 'This comment contains repeated promotional links.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Initial status for the report. Defaults to PENDING if omitted.',
    enum: ReportStatus,
    example: ReportStatus.RESOLVED,
  })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({
    description: 'Optional moderator note recorded at creation time',
    example: 'Content removed immediately – clear ToS violation.',
  })
  @IsOptional()
  @IsString()
  moderatorNote?: string;
}
