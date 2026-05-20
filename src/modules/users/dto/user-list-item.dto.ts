import { UserRole, UserStatus } from '@prisma/client';

export class UserListItemDto {
  id!: string;
  externalId!: string;
  tenantId!: string;
  language!: string;
  username!: string | null;
  avatarUrl!: string | null;
  status!: UserStatus;
  role!: UserRole;
  createdAt!: Date;
  articlesCount!: number;
  commentsCount!: number;
}

