import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { IsOptional, IsString, IsUUID } from "class-validator";
import { TenantDto } from "@/modules/tenants/dto/tenants.dto";

export class TagCountDto {
  @ApiProperty({ description: 'Number of articles associated with this tag', example: 42 })
  articles: number;
}

export class TagDto {

  @ApiProperty({
    description: 'Unique identifier for the tag',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Expose()
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Display name of the tag',
    example: 'Technology',
  })
  @Expose()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug derived from the tag name',
    example: 'technology',
  })
  @Expose()
  @IsString()
  slug: string;

  @Exclude()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    description: 'Timestamp when the tag was created',
    example: '2026-01-15T10:23:00.000Z',
  })
  @Expose()
  @IsOptional()
  createdAt?: Date;

  @ApiProperty({
    description: 'Timestamp when the tag was last updated',
    example: '2026-03-22T08:45:00.000Z',
  })
  @Expose()
  @IsOptional()
  updatedAt?: Date;

  @ApiPropertyOptional({
    description: 'Tenant this tag belongs to (only included in certain admin responses)',
    type: () => TenantDto,
  })
  @Expose()
  @IsOptional()
  tenant?: TenantDto;

  @ApiPropertyOptional({
    description: 'Aggregated counts for related resources',
    type: () => TagCountDto,
  })
  @Expose()
  @IsOptional()
  _count?: TagCountDto;

}
