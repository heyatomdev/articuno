import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'UUID of the article being commented on' })
  @IsUUID()
  articleId: string;

  @ApiProperty({ description: 'Comment text' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'External ID of the author (from your identity provider)',
  })
  @IsString()
  @IsNotEmpty()
  authorExternalId: string;
}
