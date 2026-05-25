import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'New moderation status for the user',
    enum: UserStatus,
    example: UserStatus.BANNED,
  })
  @IsEnum(UserStatus)
  status: UserStatus;
}

