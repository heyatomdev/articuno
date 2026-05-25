import { UserRole, UserStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserListItemDto {
  @ApiProperty({ description: 'Internal UUID of the user', example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ description: 'External ID from the identity provider', example: 'user_abc123' })
  externalId!: string;

  @ApiProperty({ description: 'UUID of the tenant this user belongs to', example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiProperty({ description: 'Preferred language code (BCP 47)', example: 'it' })
  language!: string;

  @ApiPropertyOptional({ description: 'Display name / username', example: 'johndoe', nullable: true })
  username!: string | null;

  @ApiPropertyOptional({ description: 'URL to the user\'s avatar image', example: 'https://cdn.example.com/avatars/user_abc123.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Current moderation status of the user', enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ description: 'Role of the user within the tenant', enum: UserRole, example: UserRole.MEMBER })
  role!: UserRole;

  @ApiProperty({ description: 'Timestamp when the user was created', example: '2026-01-15T10:23:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ description: 'Total number of articles authored by the user', example: 12 })
  articlesCount!: number;

  @ApiProperty({ description: 'Total number of comments authored by the user', example: 47 })
  commentsCount!: number;
}

