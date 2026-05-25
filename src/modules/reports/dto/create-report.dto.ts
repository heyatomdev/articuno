import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TargetType } from '@prisma/client';

export class CreateReportDto {
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

    @ApiProperty({
      description: 'External ID of the user submitting the report',
      example: 'user_abc123',
    })
    @IsString()
    reporterId: string; // ID esterno dell'utente
}
