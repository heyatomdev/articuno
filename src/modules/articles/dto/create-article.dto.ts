import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateArticleTranslationDto } from '@/modules/articles/dto/create-article-translation.dto';
import { ContentStatus } from '@prisma/client';

const ARTICLE_STATUSES: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.UNDER_REVIEW,
  ContentStatus.HIDDEN,
  ContentStatus.BANNED,
];

export class CreateArticleDto {

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ContentStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
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

