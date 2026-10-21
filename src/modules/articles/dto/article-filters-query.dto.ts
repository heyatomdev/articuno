import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, Prisma } from '@prisma/client';
import { PageParams } from '@heyatom/nest-common';

const ARTICLE_STATUSES: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.PUBLISHED,
  ContentStatus.UNDER_REVIEW,
  ContentStatus.HIDDEN,
  ContentStatus.BANNED,
];

/** Statuses the public API can ever return; moderated ones never leave /admin. */
export const PUBLIC_ARTICLE_STATUSES: ContentStatus[] = [
  ContentStatus.PUBLISHED,
  ContentStatus.DRAFT,
];

export const ARTICLE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'publishedAt',
  'views',
] as const;
export type ArticleSortField = (typeof ARTICLE_SORT_FIELDS)[number];

export const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return value;
};

class ArticleFiltersBaseQueryDto extends PageParams {
  @ApiPropertyOptional({
    description: 'Filter articles belonging to a specific category UUID.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter articles that have a specific tag UUID attached.',
    example: 'tag-uuid-1',
  })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional({
    description:
      'BCP 47 language code. Returns only articles that have a translation in this language, including only that translation.',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiPropertyOptional({
    description:
      'Filter to only featured (`true`) or non-featured (`false`) articles.',
    example: true,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;
}

/** Admin filters (/admin/articles): every status is visible and filterable. */
export class ArticleFiltersQueryDto extends ArticleFiltersBaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter articles by moderation status.',
    enum: ARTICLE_STATUSES,
    example: ContentStatus.PUBLISHED,
  })
  @IsOptional()
  @IsIn(ARTICLE_STATUSES)
  status?: ContentStatus;

  @ApiPropertyOptional({
    description:
      'Case-insensitive substring of a translation title. With `languageCode`, ' +
      'the title must match in that language.',
    maxLength: 100,
    example: 'nestjs',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Sort field. `publishedAt` puts never-published articles last. Default `createdAt`.',
    enum: ARTICLE_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(ARTICLE_SORT_FIELDS)
  sortBy?: ArticleSortField;

  @ApiPropertyOptional({
    description: 'Sort direction. Default `desc`.',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/** Admin list order: the requested field, nulls last for publishedAt, id as tiebreak. */
export function adminArticleOrderBy(
  query: Pick<ArticleFiltersQueryDto, 'sortBy' | 'sortOrder'>,
): Prisma.ArticleOrderByWithRelationInput[] {
  const sort = query.sortOrder ?? 'desc';
  const field = query.sortBy ?? 'createdAt';
  return [
    field === 'publishedAt'
      ? { publishedAt: { sort, nulls: 'last' } }
      : { [field]: sort },
    { id: sort },
  ];
}

/**
 * Public filters (/articles, X-API-Key): only PUBLISHED by default, DRAFT only
 * with `includeDrafts=true`. UNDER_REVIEW, HIDDEN and BANNED are never returned.
 */
export class PublicArticleFiltersQueryDto extends ArticleFiltersBaseQueryDto {
  @ApiPropertyOptional({
    description:
      'Narrow the result to one status. Only PUBLISHED and DRAFT are accepted; ' +
      'DRAFT requires `includeDrafts=true`.',
    enum: PUBLIC_ARTICLE_STATUSES,
    example: ContentStatus.PUBLISHED,
  })
  @IsOptional()
  @IsIn(PUBLIC_ARTICLE_STATUSES)
  status?: ContentStatus;

  @ApiPropertyOptional({
    description:
      'Also return DRAFT articles (tenant preview). Default `false`: only PUBLISHED.',
    example: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDrafts?: boolean;
}
