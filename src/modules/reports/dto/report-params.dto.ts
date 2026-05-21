import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportParamsDto {
  @ApiProperty({
    description: 'UUID of the report',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;
}

