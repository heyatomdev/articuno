import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteUserParamsDto {
  @ApiProperty({
    description: 'External ID of the user to delete',
    example: 'user_abc123',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;
}

