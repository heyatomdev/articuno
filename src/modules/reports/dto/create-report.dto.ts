import { IsEnum, IsString, IsOptional } from 'class-validator';
import { TargetType } from '@prisma/client';

export class CreateReportDto {
    @IsEnum(TargetType)
    targetType: TargetType;

    @IsString()
    targetId: string;

    @IsString()
    reason: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    reporterId: string; // ID esterno dell'utente
}
