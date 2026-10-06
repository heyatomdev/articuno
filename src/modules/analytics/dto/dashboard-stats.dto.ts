import { ApiProperty } from '@nestjs/swagger';

// Response of AnalyticsService.getDashboardStats. Only `history` is scoped to
// `days`; every other counter is all-time (`articles.newInPeriod` excepted).

export class DashboardTotalsDto {
  @ApiProperty() articlesPublished: number;
  @ApiProperty() totalViews: number;
  @ApiProperty() totalLikes: number;
  @ApiProperty() totalComments: number;
  @ApiProperty() totalBookmarks: number;
}

export class DashboardArticlesDto {
  @ApiProperty() total: number;
  @ApiProperty() published: number;
  @ApiProperty() draft: number;
  @ApiProperty() underReview: number;
  @ApiProperty() hidden: number;
  @ApiProperty() banned: number;
  @ApiProperty() featured: number;
  @ApiProperty({ description: 'Articles created within `days`' })
  newInPeriod: number;
  @ApiProperty({ description: 'Drafts untouched for 30+ days' })
  staleDrafts: number;
}

export class DashboardCommentsDto {
  @ApiProperty() total: number;
  @ApiProperty() visible: number;
  @ApiProperty() underReview: number;
  @ApiProperty() hidden: number;
  @ApiProperty() banned: number;
}

export class DashboardReportsDto {
  @ApiProperty() total: number;
  @ApiProperty() pending: number;
  @ApiProperty() reviewed: number;
  @ApiProperty() resolved: number;
  @ApiProperty() dismissed: number;
}

export class DashboardUsersDto {
  @ApiProperty() total: number;
  @ApiProperty() active: number;
  @ApiProperty() banned: number;
  @ApiProperty() shadowBanned: number;
}

export class DashboardTaxonomyDto {
  @ApiProperty() categories: number;
  @ApiProperty() tags: number;
  @ApiProperty() bannedWords: number;
}

export class DashboardLanguageDto {
  @ApiProperty({ example: 'en' }) code: string;
  @ApiProperty() translations: number;
}

export class DashboardTopArticleDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) title: string | null;
  @ApiProperty({ type: String, nullable: true }) slug: string | null;
  @ApiProperty({ type: String, nullable: true }) languageCode: string | null;
  @ApiProperty() views: number;
  @ApiProperty() likesCount: number;
  @ApiProperty() commentsCount: number;
}

/** A `DailyStats` row. */
export class DailyStatsDto {
  @ApiProperty() id: string;
  @ApiProperty() date: Date;
  @ApiProperty() articlesPublished: number;
  @ApiProperty() totalViews: number;
  @ApiProperty() totalLikes: number;
  @ApiProperty() totalComments: number;
  @ApiProperty() totalBookmarks: number;
  @ApiProperty() tenantId: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class DashboardStatsDto {
  @ApiProperty({ description: 'Articuno version' }) version: string;
  @ApiProperty({ example: '30 days' }) period: string;
  @ApiProperty() periodDays: number;
  @ApiProperty({ type: DashboardTotalsDto }) totals: DashboardTotalsDto;
  @ApiProperty({ type: DashboardArticlesDto }) articles: DashboardArticlesDto;
  @ApiProperty({ type: DashboardCommentsDto }) comments: DashboardCommentsDto;
  @ApiProperty({ type: DashboardReportsDto }) reports: DashboardReportsDto;
  @ApiProperty({ type: DashboardUsersDto }) users: DashboardUsersDto;
  @ApiProperty({ type: DashboardTaxonomyDto }) taxonomy: DashboardTaxonomyDto;
  @ApiProperty({ type: [DashboardLanguageDto] })
  languages: DashboardLanguageDto[];
  @ApiProperty({ type: [DashboardTopArticleDto] })
  topArticles: DashboardTopArticleDto[];
  @ApiProperty({
    type: [DailyStatsDto],
    description: 'One row per day within `days`',
  })
  history: DailyStatsDto[];
}
