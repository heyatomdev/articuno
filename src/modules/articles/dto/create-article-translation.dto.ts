import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** BCP 47-ish: `it`, `en-US`, `zh-Hant-TW`. Also keeps the code safe in URLs. */
export const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export const TITLE_MAX_LENGTH = 200;
export const META_DESCRIPTION_MAX_LENGTH = 500;

export class CreateArticleTranslationDto {
  @ApiProperty({
    description: 'BCP 47 language code for this translation (e.g. "en", "it", "fr").',
    example: 'en',
  })
  @IsString()
  @Matches(LANGUAGE_CODE_PATTERN, { message: 'languageCode must be a BCP 47 language code' })
  @MaxLength(35)
  languageCode: string;

  @ApiProperty({
    description: 'Localized title of the article.',
    example: 'Getting Started with NestJS',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty({
    description: 'Full HTML/Markdown body of the article.',
    example: '<p>NestJS is a progressive Node.js framework...</p>',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Short plain-text summary shown in listing pages and previews.',
    example: 'A step-by-step guide to building your first NestJS application.',
  })
  @IsString()
  @IsNotEmpty()
  excerpt: string;

  @ApiPropertyOptional({
    description: 'SEO meta title. Defaults to the article title when omitted.',
    example: 'Getting Started with NestJS | My Blog',
  })
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description shown in search engine result pages.',
    example: 'Learn how to set up your first NestJS project from scratch.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(META_DESCRIPTION_MAX_LENGTH)
  metaDescription?: string;
}
