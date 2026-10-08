import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';

const COMMENT_STATUSES: ContentStatus[] = [
  ContentStatus.VISIBLE,
  ContentStatus.UNDER_REVIEW,
  ContentStatus.HIDDEN,
  ContentStatus.BANNED,
];

export class UpdateCommentDto {
  @ApiPropertyOptional({ description: 'Updated comment content' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional({
    enum: COMMENT_STATUSES,
    description:
      'New status for the comment (admin only). Must be a valid transition from the current status.',
  })
  @IsOptional()
  @IsIn(COMMENT_STATUSES)
  status?: ContentStatus;
}

/** Public API (`PATCH /comments/:id`): status is a moderation decision, admin only. */
export class PublicUpdateCommentDto extends OmitType(UpdateCommentDto, [
  'status',
] as const) {}
