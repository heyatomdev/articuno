import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PagedQuery {
  @ApiProperty({
    description: 'Limit number of articles returned (default is 20)',
    default: 20,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
    limit = 20;

  @ApiProperty({
    description: 'Offset/skip number of articles (default is 0)',
    default: 0,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
    offset = 0;
}

export class PagedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export class Pagination {
  @IsInt()
  @Min(0)
  totalCount: number;
  @IsInt()
  @Min(0)
  currentPage: number;
  @IsInt()
  @Min(0)
  pageSize: number;
  @IsInt()
  @Min(0)
  totalPages: number;
}

/**
 * Limit the numbers of items returned in a paginated query.
 * @param query
 */
export function limit(query: PagedQuery) {
  const max = 100;
  const defaultLimit = 20;
  return Math.min(query.limit ?? defaultLimit, max);
}
