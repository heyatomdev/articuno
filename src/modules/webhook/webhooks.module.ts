import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { WebhooksService } from './webhooks.service';
import { WebhooksJob } from './webhooks.job';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [HttpModule, PrismaModule, AuthModule],
  providers: [WebhooksService, WebhooksJob],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}

