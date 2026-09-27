import { ApiProperty } from '@nestjs/swagger';
import {
  ArticleBaseDto,
  ArticleTranslationDto,
} from '@/modules/articles/dto/article-response.dto';
import { CategoryDto } from '@/modules/categories/dto/category.dto';
import { TagDto } from '@/modules/tags/dto/tags.dto';

export class BookmarkToggleResultDto {
  @ApiProperty({
    description: 'Whether the article is bookmarked after the toggle',
  })
  bookmarked: boolean;
}

/** The bookmarked article: row, full category, full tags, all translations. */
export class BookmarkedArticleDto extends ArticleBaseDto {
  @ApiProperty({ type: CategoryDto }) category: CategoryDto;
  @ApiProperty({ type: [TagDto] }) tags: TagDto[];
  @ApiProperty({ type: [ArticleTranslationDto] })
  translations: ArticleTranslationDto[];
}

export class BookmarkListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() articleId: string;
  @ApiProperty({ description: 'Internal UUID of the user' }) userId: string;
  @ApiProperty() tenantId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: BookmarkedArticleDto }) article: BookmarkedArticleDto;
}
