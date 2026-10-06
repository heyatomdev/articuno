import { ContentStatus, UserRole, UserStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

// Response shapes of ArticlesService / ArticleTranslationsService, mirroring
// their Prisma `include` / `select` clauses. Documentation only.

export class ArticleTranslationDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'en' }) languageCode: string;
  @ApiProperty() title: string;
  @ApiProperty() content: string;
  @ApiProperty() excerpt: string;
  @ApiProperty() slug: string;
  @ApiProperty({ type: String, nullable: true }) metaTitle: string | null;
  @ApiProperty({ type: String, nullable: true }) metaDescription: string | null;
  @ApiProperty({ description: 'Estimated reading time in minutes' })
  readingTime: number;
  @ApiProperty() articleId: string;
  @ApiProperty() tenantId: string;
}

/** Translation without `content`, as article lists and `GET …/translations` select it. */
export class ArticleTranslationSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiProperty({ example: 'en' }) languageCode: string;
  @ApiProperty() excerpt: string;
  @ApiProperty() readingTime: number;
}

export class ArticleCategorySummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ type: String, nullable: true }) color: string | null;
}

export class ArticleAuthorSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) username: string | null;
  @ApiProperty() externalId: string;
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' }) status: UserStatus;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role: UserRole;
}

export class ArticleTagSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
}

export class ArticleCommentCountDto {
  @ApiProperty() commentsList: number;
}

/** `Article` row columns. */
export class ArticleBaseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true, description: 'Cover image URL' })
  coverImage: string | null;
  @ApiProperty() featured: boolean;
  @ApiProperty() views: number;
  @ApiProperty() likesCount: number;
  @ApiProperty() commentsCount: number;
  @ApiProperty({ enum: ContentStatus, enumName: 'ContentStatus' })
  status: ContentStatus;
  @ApiProperty({ type: String, nullable: true }) authorId: string | null;
  @ApiProperty() categoryId: string;
  @ApiProperty() tenantId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ArticleWithRelationsDto extends ArticleBaseDto {
  @ApiProperty({ type: ArticleCategorySummaryDto })
  category: ArticleCategorySummaryDto;
  @ApiProperty({ type: ArticleAuthorSummaryDto, nullable: true })
  author: ArticleAuthorSummaryDto | null;
  @ApiProperty({ type: [ArticleTagSummaryDto] }) tags: ArticleTagSummaryDto[];
  @ApiProperty({ type: ArticleCommentCountDto }) _count: ArticleCommentCountDto;
}

/** A single article: every translation in full (only `languageCode`'s when that filter is set). */
export class ArticleDto extends ArticleWithRelationsDto {
  @ApiProperty({ type: [ArticleTranslationDto] })
  translations: ArticleTranslationDto[];
}

/** An article in a list: translations without `content`. */
export class ArticleListItemDto extends ArticleWithRelationsDto {
  @ApiProperty({ type: [ArticleTranslationSummaryDto] })
  translations: ArticleTranslationSummaryDto[];
}
