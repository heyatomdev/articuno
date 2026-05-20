import { UserRole, UserStatus } from '@prisma/client';

export class MeResponseDto {
  id!: string;
  tenantId!: string;
  externalId!: string;
  email!: string; // masked email: first letter + ***@domain
  role!: UserRole;
  status!: UserStatus;
  language!: string;
  username!: string | null;
  avatarUrl!: string | null;
  totpEnabled!: boolean;
  lastLoginAt!: Date | null;
  lastPasswordChangeAt!: Date | null;
  credentialsCreatedAt!: Date;
  credentialsUpdatedAt!: Date;
  session!: {
    id: string;
    expiresAt: Date;
  };
}

