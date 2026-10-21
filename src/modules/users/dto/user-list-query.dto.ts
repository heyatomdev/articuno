import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { PageParams } from '@heyatom/nest-common';

export class UserListQueryDto extends PageParams {
  @ApiPropertyOptional({
    description: 'Filter by username (case-insensitive partial match)',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description:
      'Exact external id (Bastion `sub`): resolves an id from the audit log, ' +
      'e.g. `actorUserId`, to its user.',
    example: '5f0c2a7e-1b2c-4d3e-8f90-123456789abc',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;

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
