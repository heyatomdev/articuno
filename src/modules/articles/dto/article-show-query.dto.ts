import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { toBoolean } from '@/modules/articles/dto/article-filters-query.dto';

export class ArticleShowQueryDto {
  @ApiPropertyOptional({
    description:
      'BCP 47 language code. Returns only that translation instead of all translations.',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  languageCode?: string;

  @ApiPropertyOptional({
    description:
      'Also resolve a DRAFT article (tenant preview). Default `false`: only PUBLISHED; ' +
      'any other status answers 404.',
    example: false,
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDrafts?: boolean;
}
