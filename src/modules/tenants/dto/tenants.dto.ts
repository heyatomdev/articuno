import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from "class-validator";

export class TenantDto {

  @ApiProperty({
    description: 'Unique identifier for the tenant',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Name of the tenant',
    example: 'Kaish DBD',
  })
  @Expose()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Slug for the tenant, used in URLs',
    example: 'kaish-dbd',
  })
  @Expose()
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Tenant description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Tenant domain, used for routing and identification',
    example: 'kaish-dbd.it',
  })
  @Expose()
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({
    description: 'Tenant default language',
    example: 'it'
  })
  @Expose()
  @IsString()
  @IsOptional()
  defaultLanguage?: string;

  @Expose()
  @IsOptional()
  createdAt?: Date;

  @Expose()
  @IsOptional()
  updatedAt?: Date;

}
