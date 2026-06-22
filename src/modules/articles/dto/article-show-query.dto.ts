import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ArticleShowQueryDto {
  @ApiPropertyOptional({
    description: 'BCP 47 language code. Returns only that translation instead of all translations.',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  languageCode?: string;
}
