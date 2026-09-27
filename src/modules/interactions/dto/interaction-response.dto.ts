import { ApiProperty } from '@nestjs/swagger';

export class LikeToggleResultDto {
  @ApiProperty({
    description: 'Whether the user likes the article after the toggle',
  })
  liked: boolean;
}

export class ArticleInteractionStatusDto {
  @ApiProperty() liked: boolean;
  @ApiProperty() bookmarked: boolean;
}
