import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';

const ARTICLE_STATUSES: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.UNDER_REVIEW,
  ContentStatus.HIDDEN,
  ContentStatus.BANNED,
];

export class UpdateArticleDto {
  @ApiPropertyOptional({
    description: 'URL of the article cover image. Pass `null` to remove the existing cover.',
    example: 'https://cdn.example.com/articles/updated-cover.jpg',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  coverImage?: string | null;

  @ApiPropertyOptional({
    description: 'New moderation status. Must be a valid transition from the current status.',
    enum: ARTICLE_STATUSES,
    example: ContentStatus.PUBLISHED,
  })
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ContentStatus;

  @ApiPropertyOptional({
    description: 'Set to `true` to feature the article, `false` to unfeature it.',
    example: true,
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
    description: 'UUID of the author user. Pass `null` to remove the author association.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  authorId?: string | null;

  @ApiPropertyOptional({
    description: 'UUID of the category to reassign the article to.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Replacement list of tag UUIDs. Replaces all existing tag associations.',
    type: [String],
    example: ['tag-uuid-1', 'tag-uuid-3'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: 'Human-readable reason for a moderation action (e.g. why the article was hidden or banned).',
    example: 'Contains prohibited content.',
  })
  @IsOptional()
  @IsString()
  moderationReason?: string;

  @ApiPropertyOptional({
    description: 'External ID of the moderator performing the action.',
    example: 'mod_user_abc123',
  })
  @IsOptional()
  @IsString()
  moderatorId?: string;
}
