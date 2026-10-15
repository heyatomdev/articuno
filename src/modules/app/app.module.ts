import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import type { Request } from 'express';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import config from '../../configs/config.schema';
import { configValidationSchema } from '@/configs/config.validation';
import { MetricsModule } from '@heyatom/nest-common/metrics';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { ReportsModule } from '@/modules/reports/reports.module';
import { UsersModule } from '@/modules/users/users.module';
import { TenantModule } from '@/modules/tenants/tenant.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TagsModule } from '@/modules/tags/tags.module';
import { ArticlesModule } from '@/modules/articles/articles.module';
import { ArticleTranslationsModule } from '@/modules/article-translations/article-translations.module';
import { InteractionsModule } from '@/modules/interactions/interactions.module';
import { BookmarksModule } from '@/modules/bookmarks/bookmarks.module';
import { CommentsModule } from '@/modules/comments/comments.module';
import { BannedWordsModule } from '@/modules/banned-words/banned-words.module';
import { WebhooksModule } from '@/modules/webhook/webhooks.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { HealthModule } from '@/modules/health/health.module';
import { BastionModule } from '@heyatom/bastion-client/nest';
import {
  AllExceptionsFilter,
  loggerParams,
  minimalRequestSerializer,
} from '@heyatom/nest-common';

/** Comma-separated env list → array; undefined keeps the package default. */
const splitList = (raw?: string): string[] | undefined =>
  raw === undefined
    ? undefined
    : raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      load: [config],
      isGlobal: true,
      cache: true,
      validationSchema: configValidationSchema,
    }),

    // One JSON line per request (pino-pretty single-line in development),
    // server-generated X-Request-Id, sensitive headers redacted.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        loggerParams({
          service: 'articuno',
          level: config.getOrThrow<string>('LOG_LEVEL'),
          pretty: config.get('NODE_ENV') !== 'production',
          serializers: {
            // `ip` honours TRUST_PROXY_HOPS (`trust proxy`); `remoteAddress`
            // is the socket peer, i.e. nginx behind the proxy.
            req: (
              req: Parameters<typeof minimalRequestSerializer>[0] & {
                raw: Request;
              },
            ) => ({ ...minimalRequestSerializer(req), ip: req.raw.ip }),
          },
        }),
    }),

    // Prometheus metrics, served on METRICS_PORT — not on the API port.
    // Also applies the http_request_duration_seconds middleware to every route.
    MetricsModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        app: 'articuno',
        port: config.getOrThrow<number>('METRICS_PORT'),
        host: config.get<string>('METRICS_HOST'),
      }),
    }),

    // Rate limiting (admin routes only, see AdminThrottlerGuard)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        // admin routes (AdminThrottlerGuard), per Bastion user
        {
          ttl: configService.get('throttle.ttl') * 1000,
          limit: configService.get('throttle.limit'),
        },
      ],
      inject: [ConfigService],
    }),

    // Scheduling for jobs
    ScheduleModule.forRoot(),

    // Core modules
    ArticlesModule,
    ArticleTranslationsModule,
    BannedWordsModule,
    BookmarksModule,
    CategoriesModule,
    CommentsModule,
    InteractionsModule,
    BastionModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow<string>('BASTION_URL'),
        serviceSlug: config.getOrThrow<string>('BASTION_APP_SLUG'),
        jwksTtlMs: config.get<number>('BASTION_JWKS_TTL_MS'),
        acceptedAppSlugs: splitList(
          config.get<string>('ADMIN_ACCEPTED_APP_SLUGS'),
        ),
        acceptedRoles: splitList(config.get<string>('ADMIN_ACCEPTED_ROLES')),
      }),
    }),
    PrismaModule,
    ReportsModule,
    TagsModule,
    TenantModule,
    UsersModule,
    HealthModule,

    // Admin only module
    AdminModule,
    AnalyticsModule,
    WebhooksModule,
  ],
  // No TransformInterceptor: the public contract returns raw resources until
  // the coordinated envelope migration (api standards plan, phase 3).
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
