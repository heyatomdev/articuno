import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({
    description: 'Display name of the tag. The slug will be auto-generated from this value.',
    example: 'Technology',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
