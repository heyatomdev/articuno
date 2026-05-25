import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PagedQuery } from "@/pagination";

export class TagsListQuery extends PagedQuery {
  @ApiPropertyOptional({
    description: 'Filter tags by name (case-insensitive partial match)',
    example: 'tech',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
}
