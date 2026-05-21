import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: 'New display name for the category. The slug will be re-generated from this value.',
    example: 'Science & Technology',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description of the category.',
    example: 'Articles covering science, technology and research.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated hex colour for the category.',
    example: '#10B981',
  })
  @IsOptional()
  @IsString()
  color?: string;
}
