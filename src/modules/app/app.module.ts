import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import config from '../../configs/config.schema';
import { configValidationSchema } from '@/configs/config.validation';
import { MetricsModule } from '@/modules/metrics/metrics.module';
import { MetricsMiddleware } from '@/modules/metrics/metrics.middleware';
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
import { APP_GUARD } from '@nestjs/core';
import { ApiThrottlerGuard } from '@/guards/api-throttler.guard';
import { PUBLIC_THROTTLER } from '@/guards/throttler.constants';

/** Comma-separated env list → array; undefined keeps the package default. */
const splitList = (raw?: string): string[] | undefined =>
  raw === undefined
    ? undefined
    : raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

@Module({
  providers: [{ provide: APP_GUARD, useClass: ApiThrottlerGuard }],
  imports: [
    // Configuration
    ConfigModule.forRoot({
      load: [config],
      isGlobal: true,
      cache: true,
      validationSchema: configValidationSchema,
    }),

    // Same pino setup as Bastion: one JSON line per request in production,
    // pino-pretty single-line in development.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const production = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level:
              config.get<string>('LOG_LEVEL') ??
              (production ? 'info' : 'debug'),
            transport: production
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, colorize: true },
                },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'res.headers["set-cookie"]',
              ],
              remove: true,
            },
            genReqId: () => randomUUID(),
            serializers: {
              // `raw.ip` honours TRUST_PROXY (`trust proxy` in main.ts).
              req: (req: {
                id: string;
                method: string;
                url: string;
                raw: Request;
              }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                ip: req.raw.ip,
              }),
              res: (res: { statusCode: number }) => ({
                statusCode: res.statusCode,
              }),
            },
            customProps: () => ({ service: 'articuno' }),
            autoLogging: {
              ignore: (req) => (req.url ?? '').startsWith('/health'),
            },
          },
        };
      },
    }),

    // Prometheus metrics, served on METRICS_PORT — not on the API port
    MetricsModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        // admin routes (AdminThrottlerGuard), per Bastion user
        {
          ttl: configService.get('throttle.ttl') * 1000,
          limit: configService.get('throttle.limit'),
        },
        // public API (ApiThrottlerGuard), per tenant + IP
        {
          name: PUBLIC_THROTTLER,
          ttl: configService.get('throttle.ttl') * 1000,
          limit: configService.get('throttle.publicLimit'),
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
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // MetricsMiddleware is a middleware and not an APP_INTERCEPTOR on purpose:
    // interceptors run after guards and TenantMiddleware, so 401s and 429s
    // would never be counted.
    consumer
      .apply(MetricsMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
