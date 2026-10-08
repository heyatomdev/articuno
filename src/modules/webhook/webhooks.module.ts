import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { MetricsModule } from '@/modules/metrics/metrics.module';
import { WebhooksService } from './webhooks.service';
import { WebhooksJob } from './webhooks.job';

// Tenant webhook URLs are tenant-controlled: no redirects (SSRF pivot), short
// timeout, and the response body is never needed, so cap it hard.
export const WEBHOOK_HTTP_OPTIONS = {
  timeout: 5_000,
  maxRedirects: 0,
  maxContentLength: 64 * 1024,
  maxBodyLength: 1024 * 1024,
};

@Module({
  imports: [
    HttpModule.register(WEBHOOK_HTTP_OPTIONS),
    PrismaModule,
    MetricsModule,
  ],
  providers: [WebhooksService, WebhooksJob],
  exports: [WebhooksService],
})
export class WebhooksModule {}
