-- Drops the local admin IdP now that `/admin/*` is Bastion-only (phase F7).
--
-- No rows are deleted by hand: the two tables carry nothing but the session auth
-- that no longer exists, so the DROP takes their contents with them. The seeded
-- `users` row (`externalId` = 'tenant-admin') is deliberately left in place — it
-- can be the foreign key of existing content, and removing it is not this phase.

-- DropTable: admin email + bcrypt password + TOTP secret. Admins live in Bastion.
DROP TABLE "admin_credentials";

-- DropTable: the DB-backed `sessionId` cookie store. The Bastion RS256 token is
-- stateless, so there is nothing left to persist or to expire (AuthJob is gone too).
DROP TABLE "sessions";

-- NOTE: the "UserRole" enum and "users"."role" are intentionally left in place.
-- "sessions"."userRole" was the last use of the enum outside "users"."role", but
-- Meridian still reads the column; dropping both is a separate, two-repo change.
