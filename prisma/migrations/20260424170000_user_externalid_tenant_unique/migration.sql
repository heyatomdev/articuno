-- Replace non-unique index with a unique constraint so user sync can safely upsert
DROP INDEX "users_externalId_tenantId_idx";

CREATE UNIQUE INDEX "users_externalId_tenantId_key" ON "users"("externalId", "tenantId");

