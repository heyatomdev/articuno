import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateArticleTranslationDto)
  translations?: CreateArticleTranslationDto[];
}

