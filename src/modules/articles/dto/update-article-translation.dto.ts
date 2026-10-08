import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  META_DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from './create-article-translation.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateArticleTranslationDto {
  @ApiPropertyOptional({
    description: 'Updated localized title of the article.',
    example: 'Getting Started with NestJS – Revised',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated full HTML/Markdown body of the article.',
    example: '<p>NestJS is a progressive Node.js framework...</p>',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated short plain-text summary shown in listing pages.',
    example: 'An updated guide to building your first NestJS application.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  excerpt?: string;

  @ApiPropertyOptional({
    description: 'Updated SEO meta title.',
    example: 'NestJS Guide – Revised | My Blog',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX_LENGTH)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'Updated SEO meta description.',
    example: 'Learn NestJS from scratch with this revised step-by-step tutorial.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(META_DESCRIPTION_MAX_LENGTH)
  metaDescription?: string;
}
