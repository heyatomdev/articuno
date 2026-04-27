import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';

export enum ReportStatus {
    PENDING = 'PENDING',
    REVIEWED = 'REVIEWED',
    RESOLVED = 'RESOLVED',
    DISMISSED = 'DISMISSED',
}

export class UpdateReportStatusDto {
    @IsEnum(ReportStatus)
    status: ReportStatus;

    @IsOptional()
    @IsString()
    moderatorNote?: string;

    @IsString()
    moderatorId: string; // ID esterno dello staff
}
