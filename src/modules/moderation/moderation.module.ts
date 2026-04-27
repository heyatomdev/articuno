import { Module } from '@nestjs/common';
import { ModerationPolicyService } from './moderation-policy.service';
import { WebhookEventPublisher } from './webhook-event-publisher.service';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';

@Module({
  imports: [PrismaModule, BannedWordsModule],
  providers: [ModerationPolicyService, WebhookEventPublisher],
  exports: [ModerationPolicyService, WebhookEventPublisher],
})
export class ModerationModule {}

