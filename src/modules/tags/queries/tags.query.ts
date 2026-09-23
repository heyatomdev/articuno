import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageParams } from "@/common/pagination";

export class TagsListQuery extends PageParams {
  @ApiPropertyOptional({
    description: 'Filter tags by name (case-insensitive partial match)',
    example: 'tech',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
}
