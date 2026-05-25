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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({
    description: 'URL of the article cover image. When creating via multipart/form-data, upload the file in the `coverImage` field instead.',
    example: 'https://cdn.example.com/articles/my-article-cover.jpg',
  })
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({
    description: 'Initial moderation status of the article. Defaults to DRAFT when omitted.',
    enum: ARTICLE_STATUSES,
    example: ContentStatus.DRAFT,
  })
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ContentStatus;

  @ApiPropertyOptional({
    description: 'Whether the article should appear in featured/highlighted sections.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description: 'UUID of the user (author) to associate with the article. Defaults to the authenticated user when omitted.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  authorId?: string;

  @ApiProperty({
    description: 'UUID of the category the article belongs to.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    description: 'List of tag UUIDs to attach to the article.',
    type: [String],
    example: ['tag-uuid-1', 'tag-uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: 'One or more translation objects to create alongside the article. At least one translation (with the default language) is recommended.',
    type: [CreateArticleTranslationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateArticleTranslationDto)
  translations?: CreateArticleTranslationDto[];
}
