import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryDto {
  @ApiProperty({
    description: 'Unique identifier of the category',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Display name of the category',
    example: 'Science',
  })
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug derived from the name',
    example: 'science',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Optional description of the category',
    example: 'Articles about science and research.',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Optional hex colour associated with the category',
    example: '#3B82F6',
  })
  color?: string;

  @ApiProperty({
    description: 'Timestamp when the category was created',
    example: '2026-01-15T10:23:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the category was last updated',
    example: '2026-03-22T08:45:00.000Z',
  })
  updatedAt: Date;
}

export class CategoryListItemDto extends CategoryDto {
  @ApiProperty({
    description: 'Number of articles associated with this category',
    example: 14,
  })
  articlesCount: number;
}

