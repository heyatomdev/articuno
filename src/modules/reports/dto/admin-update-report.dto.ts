import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';

/**
 * DTO used exclusively by admin endpoints.
 * `moderatorId` and `reporterId` are NOT exposed here —
 * they are auto-populated with the session's `externalId`.
 */
export class AdminUpdateReportDto {
  @ApiProperty({
    description: 'New status to set for the report',
    enum: ReportStatus,
    example: ReportStatus.RESOLVED,
  })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({
    description: 'Optional note left by the moderator explaining the decision',
    example: 'Content removed – repeated ToS violations.',
  })
  @IsOptional()
  @IsString()
  moderatorNote?: string;
}

