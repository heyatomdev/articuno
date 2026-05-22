import { Module } from '@nestjs/common';
import { ArticleTranslationsController } from '@/modules/article-translations/article-translations.controller';
import { ArticleTranslationsService } from '@/modules/article-translations/article-translations.service';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';

@Module({
  imports: [BannedWordsModule],
  controllers: [ArticleTranslationsController],
  providers: [ArticleTranslationsService],
  exports: [ArticleTranslationsService],
})
export class ArticleTranslationsModule {}

