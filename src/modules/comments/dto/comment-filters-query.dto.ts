import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PagedQuery } from '@/pagination';

export class CommentFiltersQueryDto extends PagedQuery {
  @ApiProperty({
    description: 'Filter comments by article id',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  articleId?: string;
}

