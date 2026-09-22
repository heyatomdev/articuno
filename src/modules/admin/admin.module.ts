import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { ArticlesModule } from '@/modules/articles/articles.module';
import { ArticleTranslationsModule } from '@/modules/article-translations/article-translations.module';
import { TagsModule } from '@/modules/tags/tags.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { AuditsModule } from '@/modules/audits/audits.module';
import { UsersModule } from '@/modules/users/users.module';
import { FileHarborModule } from '@/modules/fileharbor/fileharbor.module';
import { AdminArticlesController } from '@/modules/admin/controllers/admin-articles.controller';
import { AdminTagsController } from '@/modules/admin/controllers/admin-tags.controller';
import { AdminCategoriesController } from '@/modules/admin/controllers/admin-categories.controller';
import { AdminBannedWordsController } from '@/modules/admin/controllers/admin-banned-words.controller';
import { AdminReportsController } from '@/modules/admin/controllers/admin-reports.controller';
import { AdminAuditsController } from '@/modules/admin/controllers/admin-audits.controller';
import { AdminUsersController } from '@/modules/admin/controllers/admin-users.controller';
import { AdminCommentsController } from '@/modules/admin/controllers/admin-comments.controller';
import { CommentsModule } from '@/modules/comments/comments.module';
import { WebhooksModule } from '@/modules/webhook/webhooks.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { BastionModule } from '@/modules/bastion/bastion.module';
import { AdminWebhooksController } from '@/modules/admin/controllers/admin-webhooks.controller';
import { AdminNotificationsController } from '@/modules/admin/controllers/admin-notifications.controller';
import { AdminStatsController } from '@/modules/admin/controllers/admin-stats.controller';
import { AdminThrottlerGuard } from '@/guards/admin-throttler.guard';

@Module({
  imports: [
    PrismaModule,
    ArticlesModule,
    ArticleTranslationsModule,
    TagsModule,
    CategoriesModule,
    BannedWordsModule,
    ReportsModule,
    AuditsModule,
    UsersModule,
    FileHarborModule,
    CommentsModule,
    WebhooksModule,
    NotificationsModule,
    AnalyticsModule,
    BastionModule,
  ],
  controllers: [
    AdminArticlesController,
    AdminTagsController,
    AdminCategoriesController,
    AdminBannedWordsController,
    AdminReportsController,
    AdminAuditsController,
    AdminUsersController,
    AdminCommentsController,
    AdminWebhooksController,
    AdminNotificationsController,
    AdminStatsController,
  ],
  providers: [AdminThrottlerGuard],
})
export class AdminModule {}

