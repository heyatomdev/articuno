import { Module } from '@nestjs/common';
import { ArticlesController } from '@/modules/articles/articles.controller';
import { ArticlesService } from '@/modules/articles/articles.service';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';

@Module({
  imports: [BannedWordsModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}

