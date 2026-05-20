-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CATEGORY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CATEGORY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'TAG_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TAG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'TAG_DELETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditResourceType" ADD VALUE 'TAG';
ALTER TYPE "AuditResourceType" ADD VALUE 'CATEGORY';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_MODERATOR';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "fileharborApiKey" TEXT,
ADD COLUMN     "fileharborEndpoint" TEXT;
