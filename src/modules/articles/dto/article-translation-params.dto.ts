import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ArticleTranslationParamsDto {
  @ApiProperty({ description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'BCP 47 language code of the translation (e.g. "en", "it", "fr")', example: 'en' })
  @IsString()
  @IsNotEmpty()
  languageCode: string;
}
