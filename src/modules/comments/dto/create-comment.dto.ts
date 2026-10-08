import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const COMMENT_MAX_LENGTH = 5000;

export class CreateCommentDto {
  @ApiProperty({ description: 'UUID of the article being commented on' })
  @IsUUID()
  articleId: string;

  @ApiProperty({
    description: 'Comment text, plain text (tags are stripped)',
    maxLength: COMMENT_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_MAX_LENGTH)
  content: string;

  @ApiProperty({
    description: 'External ID of the author (from your identity provider)',
  })
  @IsString()
  @IsNotEmpty()
  authorExternalId: string;
}
