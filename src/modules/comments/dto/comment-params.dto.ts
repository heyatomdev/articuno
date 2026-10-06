import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CommentParamsDto {
  @ApiProperty({ description: 'UUID of the comment', format: 'uuid' })
  @IsUUID()
  id: string;
}
