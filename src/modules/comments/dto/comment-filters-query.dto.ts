import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { PageParams } from '@/common/pagination';

/** Comment statuses the public API (X-API-Key) may list or read. */
export const PUBLIC_COMMENT_STATUSES: ContentStatus[] = [
  ContentStatus.VISIBLE,
  ContentStatus.UNDER_REVIEW,
];

class CommentFiltersBaseQueryDto extends PageParams {
  @ApiProperty({
    description: 'Filter comments by article id',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  articleId?: string;
}

/** Admin filters (/admin/comments): every status is visible and filterable. */
export class CommentFiltersQueryDto extends CommentFiltersBaseQueryDto {
  @ApiProperty({
    description: 'Filter comments by moderation status',
    required: false,
    enum: ContentStatus,
  })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

/**
 * Public filters (/comments, X-API-Key): VISIBLE and UNDER_REVIEW comments of
 * PUBLISHED articles only. HIDDEN and BANNED comments never leave /admin.
 */
export class PublicCommentFiltersQueryDto extends CommentFiltersBaseQueryDto {
  @ApiProperty({
    description:
      'Narrow the result to one moderation status. Only VISIBLE and ' +
      'UNDER_REVIEW are accepted; without it both are returned.',
    required: false,
    enum: PUBLIC_COMMENT_STATUSES,
  })
  @IsOptional()
  @IsIn(PUBLIC_COMMENT_STATUSES)
  status?: ContentStatus;
}
