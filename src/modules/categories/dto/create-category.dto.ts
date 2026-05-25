import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Display name of the category. The slug will be auto-generated from this value.',
    example: 'Science',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable description of the category.',
    example: 'Articles about science and research.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional hex colour associated with the category for UI display.',
    example: '#3B82F6',
  })
  @IsOptional()
  @IsString()
  color?: string;
}

