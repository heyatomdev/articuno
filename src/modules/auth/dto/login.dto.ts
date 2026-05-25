import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Admin email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssw0rd!', minLength: 8, description: 'Admin password (min 8 characters)' })
  @IsString()
  @MinLength(8)
  password: string;
}

