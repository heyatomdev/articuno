import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { AuditsModule } from '@/modules/audits/audits.module';

@Module({
  imports: [ModerationModule, AuditsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
