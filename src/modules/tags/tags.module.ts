import { Module } from '@nestjs/common';
import { TagsController } from '@/modules/tags/tags.controller';
import { TagsService } from '@/modules/tags/tags.service';

@Module({
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}

