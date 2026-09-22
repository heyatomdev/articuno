-- Drop the `api_keys` table.
--
-- Created by 20260506110254_admin_access and never wired to anything: no
-- `prisma.apiKey` call anywhere in `src/`, and 0 rows in every environment.
-- It declared keyId/secret/scopes/expiresAt/lastUsedAt — a scoped key system
-- that was sketched and never built. Public-API credentials are `Tenant.apiKey`
-- (SHA-256) and, since this branch, Bastion service-client tokens.
DROP TABLE "api_keys";
