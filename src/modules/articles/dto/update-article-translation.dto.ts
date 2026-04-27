import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateArticleTranslationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  excerpt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;
}
