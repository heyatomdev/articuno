import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ContentStatus } from '@prisma/client';

const ARTICLE_STATUSES: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.UNDER_REVIEW,
  ContentStatus.HIDDEN,
  ContentStatus.BANNED,
];

export class UpdateArticleDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  coverImage?: string | null;

  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ContentStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  authorId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  moderationReason?: string;

  @IsOptional()
  @IsString()
  moderatorId?: string;
}
