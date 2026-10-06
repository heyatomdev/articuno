import { UserRole, UserStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

/** A `User` row as Prisma returns it (no relations, no counts). */
export class UserDto {
  @ApiProperty({ description: 'Internal UUID of the user' })
  id: string;

  @ApiProperty({ description: 'External ID from the identity provider' })
  externalId: string;

  @ApiProperty({ description: 'UUID of the tenant this user belongs to' })
  tenantId: string;

  @ApiProperty({
    description: 'Preferred language code (BCP 47)',
    example: 'it',
  })
  language: string;

  @ApiProperty({ type: String, nullable: true })
  username: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  @ApiProperty()
  createdAt: Date;
}
