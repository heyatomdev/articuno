import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';

export class UpdateReportStatusDto {
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

    @ApiProperty({
      description: 'External ID of the staff member resolving the report',
      example: 'mod_xyz789',
    })
    @IsString()
    moderatorId: string; // ID esterno dello staff
}
