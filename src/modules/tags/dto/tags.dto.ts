import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {Exclude, Expose, Type} from 'class-transformer';
import {IsNotEmpty, IsOptional, IsString, IsUUID} from "class-validator";
import { TenantDto } from "@/modules/tenants/dto/tenants.dto";

export class TagDto {

  @ApiProperty({
    description: 'Unique identifier for the tag',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Name of the tag',
    example: 'Technology',
  })
  @Expose()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Slug for the tag, used in URLs',
    example: 'technology',
  })
  @Expose()
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Tenant ID the tag belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @Exclude()
  tenantId?: string;

  @Expose()
  @IsOptional()
  createdAt?: Date;

  @Expose()
  @IsOptional()
  updatedAt?: Date;

  @Expose()
  @IsOptional()
  tenant?: TenantDto;

  @Expose()
  @IsOptional()
  _count?: {
    articles: number;
  };

}
