import { applyDecorators, Type as ClassType } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PageParams {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PageParams,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

/**
 * Swagger-decorated mirror of `PaginatedResult<T>['meta']` — for response DTOs
 * that need a real nested type (`@ApiProperty({ type: PageMetaDto })`) instead
 * of the plain `description` string most admin list endpoints use. Shape must
 * stay identical to `paginate()`'s `meta`, which is untyped by this class.
 */
export class PageMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

/**
 * Swagger 200 response for a list endpoint returning `PaginatedResult<T>`.
 * Pass the item DTO when one exists; without it `data` is documented as
 * `object[]` (still truthful, just untyped).
 */
export function ApiPaginatedResponse(
  item?: ClassType<unknown>,
  description = 'Paginated list.',
) {
  return applyDecorators(
    ApiExtraModels(PageMetaDto, ...(item ? [item] : [])),
    ApiOkResponse({
      description,
      schema: {
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            items: item ? { $ref: getSchemaPath(item) } : { type: 'object' },
          },
          meta: { $ref: getSchemaPath(PageMetaDto) },
        },
      },
    }),
  );
}
