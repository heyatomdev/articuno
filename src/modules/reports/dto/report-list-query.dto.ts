import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
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
}

