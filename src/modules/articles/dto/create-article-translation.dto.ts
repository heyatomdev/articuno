import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleTranslationDto {
  @ApiProperty({
    description: 'BCP 47 language code for this translation (e.g. "en", "it", "fr").',
    example: 'en',
  })
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @ApiProperty({
    description: 'Localized title of the article.',
    example: 'Getting Started with NestJS',
  })
  @IsString()
  @IsNotEmpty()
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
  metaTitle?: string;

  @ApiPropertyOptional({
    description: 'SEO meta description shown in search engine result pages.',
    example: 'Learn how to set up your first NestJS project from scratch.',
  })
  @IsOptional()
  @IsString()
  metaDescription?: string;
}
