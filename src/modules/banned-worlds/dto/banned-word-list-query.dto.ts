import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PagedQuery } from '@/pagination';

export class BannedWordListQueryDto extends PagedQuery {
  @ApiProperty({
    description: 'Filter the list to words containing this text (case-insensitive).',
    required: false,
    example: 'spam',
  })
  @IsOptional()
  @IsString()
    search?: string;
}
