import { UserRole, UserStatus } from '@prisma/client';

export class MeResponseDto {
  id!: string;
  tenantId!: string;
  externalId!: string;
  email!: string;
  role!: UserRole;
  status!: UserStatus;
  language!: string;
  username!: string | null;
  avatarUrl!: string | null;
  session!: {
    id: string;
    expiresAt: Date;
  };
}

