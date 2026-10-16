import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { WebhooksService } from './webhooks.service';
import { WebhooksJob } from './webhooks.job';
import { WebhookMetrics } from './webhook.metrics';

@Module({
  imports: [PrismaModule],
  providers: [WebhooksService, WebhooksJob, WebhookMetrics],
  exports: [WebhooksService],
})
export class WebhooksModule {}
