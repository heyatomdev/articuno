import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateArticleTranslationDto {
  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  excerpt: string;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsString()
  @IsNotEmpty()
  slug: string;
}

