import { IsUUID } from 'class-validator';

export class ArticleInteractionParamsDto {
  @IsUUID()
  articleId: string;
}

