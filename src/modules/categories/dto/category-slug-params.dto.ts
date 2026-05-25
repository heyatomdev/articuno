import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CategorySlugParamsDto {
  @ApiProperty({
    description: 'URL-friendly slug of the category (lowercase alphanumeric words separated by hyphens)',
    example: 'science-and-technology',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be a valid slug (lowercase alphanumeric with hyphens)',
  })
  slug: string;
}

