import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ArticleTranslationParamsDto {
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;
}

