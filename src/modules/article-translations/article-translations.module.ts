import { Module } from '@nestjs/common';
import { ArticleTranslationsController } from '@/modules/article-translations/article-translations.controller';
import { ArticleTranslationsService } from '@/modules/article-translations/article-translations.service';
import { BannedWordsModule } from '@/modules/banned-words/banned-words.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';

@Module({
  imports: [BannedWordsModule, ModerationModule],
  controllers: [ArticleTranslationsController],
  providers: [ArticleTranslationsService],
  exports: [ArticleTranslationsService],
})
export class ArticleTranslationsModule {}

