import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { PagedQuery } from '@/pagination';

export class CommentFiltersQueryDto extends PagedQuery {
  @ApiProperty({
    description: 'Filter comments by article id',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  articleId?: string;

  @ApiProperty({
    description: 'Filter comments by moderation status',
    required: false,
    enum: ContentStatus,
  })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

