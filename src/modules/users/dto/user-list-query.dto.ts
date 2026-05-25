import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { PagedQuery } from '@/pagination';

export class UserListQueryDto extends PagedQuery {
  @ApiPropertyOptional({
    description: 'Filter by username (case-insensitive partial match)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Filter by user status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Filter by user role',
    enum: UserRole,
    example: UserRole.MEMBER,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
