import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'OldP@ssw0rd!', minLength: 8, description: 'Current password' })
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({ example: 'NewStr0ngP@ss!', minLength: 12, description: 'New password (min 12 characters)' })
  @IsString()
  @MinLength(12)
  newPassword: string;

  @ApiProperty({ example: 'NewStr0ngP@ss!', minLength: 12, description: 'Confirm new password – must match newPassword' })
  @IsString()
  @MinLength(12)
  confirmPassword: string;
}

