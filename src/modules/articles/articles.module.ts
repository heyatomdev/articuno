import { Module } from '@nestjs/common';
import { ArticlesController } from '@/modules/articles/articles.controller';
import { ArticlesService } from '@/modules/articles/articles.service';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}

