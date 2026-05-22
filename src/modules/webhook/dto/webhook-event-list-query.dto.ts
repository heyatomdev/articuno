import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PagedQuery } from '@/pagination';

export class WebhookEventListQueryDto extends PagedQuery {
  @ApiPropertyOptional({
    description: 'Filter by event type (e.g. comment.moderated, article.flagged)',
    example: 'comment.moderated',
  })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({
    description: 'If true, return only unsent events (sentAt is null). If false, return only sent events.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  sent?: boolean;
}

