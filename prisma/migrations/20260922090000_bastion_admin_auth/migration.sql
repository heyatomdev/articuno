-- AlterTable: Bastion tenant uuid on Articuno tenants.
-- Nullable on purpose: the backfill is per-environment (the Bastion tenant uuid
-- differs between local and production) and is run by hand after deploy, e.g.
--   UPDATE "tenants" SET "bastionTenantId" = '<uuid of bastion tenant dbd>' WHERE "slug" = 'default';
-- Until it is set, that tenant is not reachable through BastionUserGuard.
ALTER TABLE "tenants" ADD COLUMN "bastionTenantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_bastionTenantId_key" ON "tenants"("bastionTenantId");

-- AlterTable: audit_logs.actorRole from the Articuno "UserRole" enum to plain text.
-- Bastion roles (SUPER_ADMIN, ADMIN, MODERATOR, AUTHOR) are not a subset of the
-- Articuno enum and vice versa; mapping them would write a false role into the
-- trail. Existing rows keep their enum label verbatim.
ALTER TABLE "audit_logs" ALTER COLUMN "actorRole" TYPE TEXT USING "actorRole"::TEXT;

-- NOTE: the "UserRole" enum type is intentionally left in place — "users"."role"
-- still uses it. It is dropped in a later phase together with that column.
