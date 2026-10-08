import { Module } from '@nestjs/common';
import { ArticlesController } from '@/modules/articles/articles.controller';
import { ArticlesService } from '@/modules/articles/articles.service';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { FileHarborModule } from '@/modules/fileharbor/fileharbor.module';

@Module({
  imports: [BannedWordsModule, FileHarborModule, ModerationModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}

