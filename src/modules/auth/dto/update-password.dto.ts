import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  newPassword: string;

  @IsString()
  @MinLength(12)
  confirmPassword: string;
}

