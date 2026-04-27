import { IsUUID } from 'class-validator';

export class ArticleParamsDto {
  @IsUUID()
  id: string;
}

