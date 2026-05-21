import { ApiProperty } from '@nestjs/swagger';

export class BannedWordDto {
  @ApiProperty({ description: 'Unique identifier of the banned word entry', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'The banned word', example: 'spam' })
  word: string;

  @ApiProperty({ description: 'Tenant that owns this banned word', example: '123e4567-e89b-12d3-a456-426614174000' })
  tenantId: string;
}

