import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';

export enum TargetType {
    ARTICLE = 'ARTICLE',
    COMMENT = 'COMMENT',
    USER = 'USER',
}

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
