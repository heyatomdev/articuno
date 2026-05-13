import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ArticleParamsDto {
  @IsUUID()
  id: string;
}

export class ArticleSlugParamsDto {
  @IsString()
  @IsNotEmpty()
  slug: string;
}

