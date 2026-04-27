import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from './webhook.service';
import { WebhookJob } from './webhook.job';

@Module({
  imports: [HttpModule],
  providers: [WebhookService, WebhookJob],
  exports: [WebhookService],
})
export class WebhookModule {}

