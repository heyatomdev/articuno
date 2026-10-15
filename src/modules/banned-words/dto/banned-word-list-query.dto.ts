import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PageParams } from '@heyatom/nest-common';

export class BannedWordListQueryDto extends PageParams {
  @ApiProperty({
    description:
      'Filter the list to words containing this text (case-insensitive).',
    required: false,
    example: 'spam',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
