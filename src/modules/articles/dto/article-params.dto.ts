import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ArticleParamsDto {
  @ApiProperty({ description: 'UUID of the article', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  id: string;
}

export class ArticleSlugParamsDto {
  @ApiProperty({ description: 'URL-friendly slug of the article (e.g. "getting-started-with-nestjs")', example: 'getting-started-with-nestjs' })
  @IsString()
  @IsNotEmpty()
  slug: string;
}
