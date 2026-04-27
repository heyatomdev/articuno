import { IsOptional, IsUUID } from 'class-validator';

export class CommentFiltersQueryDto {
  @IsOptional()
  @IsUUID()
  articleId?: string;
}

