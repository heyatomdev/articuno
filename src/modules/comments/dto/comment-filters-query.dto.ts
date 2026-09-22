import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContentStatus } from '@prisma/client';
import { PageParams } from '@/common/pagination';

export class CommentFiltersQueryDto extends PageParams {
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

