import { ApiProperty } from '@nestjs/swagger';
import {
  ArticleBaseDto,
  ArticleCategorySummaryDto,
  ArticleTagSummaryDto,
  ArticleTranslationSummaryDto,
} from '@/modules/articles/dto/article-response.dto';

export class BookmarkToggleResultDto {
  @ApiProperty({
    description: 'Whether the article is bookmarked after the toggle',
  })
  bookmarked: boolean;
}

/** The bookmarked (PUBLISHED) article: row, category, tags, translation summaries (no body). */
export class BookmarkedArticleDto extends ArticleBaseDto {
  @ApiProperty({ type: ArticleCategorySummaryDto })
  category: ArticleCategorySummaryDto;
  @ApiProperty({ type: [ArticleTagSummaryDto] }) tags: ArticleTagSummaryDto[];
  @ApiProperty({ type: [ArticleTranslationSummaryDto] })
  translations: ArticleTranslationSummaryDto[];
}

export class BookmarkListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() articleId: string;
  @ApiProperty({ description: 'Internal UUID of the user' }) userId: string;
  @ApiProperty() tenantId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: BookmarkedArticleDto }) article: BookmarkedArticleDto;
}
