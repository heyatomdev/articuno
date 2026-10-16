import { SLUG_PATTERN } from '@/utils/slugify';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTagDto {
  @ApiPropertyOptional({
    description: 'New display name for the tag. The slug does not change.',
    example: 'Science & Technology',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

/** Admin only: the public API never sets slugs. */
export class AdminUpdateTagDto extends UpdateTagDto {
  @ApiPropertyOptional({
    description:
      'New URL slug (lowercase alphanumeric words separated by hyphens). Old links stop working: change it only on purpose.',
    example: 'science-and-technology',
    pattern: SLUG_PATTERN.source,
  })
  @IsOptional()
  @Matches(SLUG_PATTERN, {
    message: 'slug must be a valid slug (lowercase alphanumeric with hyphens)',
  })
  @MaxLength(200)
  slug?: string;
}
