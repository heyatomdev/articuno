import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTagDto {
  @ApiPropertyOptional({
    description: 'New display name for the tag. The slug will be re-generated from this value.',
    example: 'Science & Technology',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
