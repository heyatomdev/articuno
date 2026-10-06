import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { MetricsModule } from '@/modules/metrics/metrics.module';
import { WebhooksService } from './webhooks.service';
import { WebhooksJob } from './webhooks.job';

@Module({
  imports: [HttpModule, PrismaModule, MetricsModule],
  providers: [WebhooksService, WebhooksJob],
  exports: [WebhooksService],
})
export class WebhooksModule {}
