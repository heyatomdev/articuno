import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { ArticlesModule } from '@/modules/articles/articles.module';
import { TagsModule } from '@/modules/tags/tags.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuditsModule } from '@/modules/audits/audits.module';
import { AdminArticlesController } from '@/modules/admin/controllers/admin-articles.controller';
import { AdminTagsController } from '@/modules/admin/controllers/admin-tags.controller';
import { AdminCategoriesController } from '@/modules/admin/controllers/admin-categories.controller';
import { AdminBannedWordsController } from '@/modules/admin/controllers/admin-banned-words.controller';
import { AdminReportsController } from '@/modules/admin/controllers/admin-reports.controller';
import { AdminStatsController } from '@/modules/admin/controllers/admin-stats.controller';
import { AdminAuditsController } from '@/modules/admin/controllers/admin-audits.controller';

@Module({
  imports: [
    PrismaModule,
    ArticlesModule,
    TagsModule,
    CategoriesModule,
    BannedWordsModule,
    ReportsModule,
    AnalyticsModule,
    AuthModule,
    AuditsModule,
  ],
  controllers: [
    AdminArticlesController,
    AdminTagsController,
    AdminCategoriesController,
    AdminBannedWordsController,
    AdminReportsController,
    AdminStatsController,
    AdminAuditsController,
  ],
})
export class AdminModule {}

