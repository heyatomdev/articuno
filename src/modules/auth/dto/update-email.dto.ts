import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEmailDto {
  @ApiProperty({ example: 'new-admin@example.com', description: 'New email address' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ example: 'P@ssw0rd!', minLength: 8, description: 'Current password for confirmation' })
  @IsString()
  @MinLength(8)
  password: string;
}

