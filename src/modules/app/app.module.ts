import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "@/modules/prisma/prisma.module";
import config from '../../configs/config.schema';
import { configValidationSchema } from '@/configs/config.validation';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import {AnalyticsModule} from "@/modules/analytics/analytics.module";
import {ReportsModule} from "@/modules/reports/reports.module";
import { UsersModule } from '@/modules/users/users.module';
import { TenantModule } from '@/modules/tenants/tenant.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TagsModule } from '@/modules/tags/tags.module';
import { ArticlesModule } from '@/modules/articles/articles.module';
import { InteractionsModule } from '@/modules/interactions/interactions.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';
import { WebhooksModule } from '@/modules/webhook/webhooks.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AdminModule } from '@/modules/admin/admin.module';

@Module({
    controllers: [StatusController],
    imports: [
        // Configuration
        ConfigModule.forRoot({
            load: [config],
            isGlobal: true,
            cache: true,
            validationSchema: configValidationSchema,
        }),

        // Prometheus configuration
        PrometheusModule.register({
            defaultLabels: {
                app: 'articuno',
            },
        }),

        // Rate limiting
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => [{
                ttl: configService.get('throttle.ttl') * 1000,
                limit: configService.get('throttle.limit'),
            }],
            inject: [ConfigService],
        }),

        // Scheduling for jobs
        ScheduleModule.forRoot(),

        // Core modules
        ArticlesModule,
        BannedWordsModule,
        CategoriesModule,
        CommentsModule,
        InteractionsModule,
        PrismaModule,
        ReportsModule,
        TagsModule,
        TenantModule,
        UsersModule,

        // Admin only module
        AuthModule,
        AdminModule,
        AnalyticsModule,
        WebhooksModule,
    ],
})
export class AppModule {}
