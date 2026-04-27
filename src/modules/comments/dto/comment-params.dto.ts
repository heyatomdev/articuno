import { IsUUID } from 'class-validator';

export class CommentParamsDto {
  @IsUUID()
  id: string;
}

