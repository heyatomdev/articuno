import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class UpdateReportStatusDto {
    @IsEnum(ReportStatus)
    status: ReportStatus;

    @IsOptional()
    @IsString()
    moderatorNote?: string;

    @IsString()
    moderatorId: string; // ID esterno dello staff
}
