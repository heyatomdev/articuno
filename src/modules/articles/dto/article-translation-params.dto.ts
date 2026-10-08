import { IsString, IsUUID, Matches } from 'class-validator';
import { LANGUAGE_CODE_PATTERN } from './create-article-translation.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ArticleTranslationParamsDto {
  @ApiProperty({
    description: 'UUID of the article',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description:
      'BCP 47 language code of the translation (e.g. "en", "it", "fr")',
    example: 'en',
  })
  @IsString()
  @Matches(LANGUAGE_CODE_PATTERN)
  languageCode: string;
}
