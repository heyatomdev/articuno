-- Deleting a user (or a whole tenant) must not trip the foreign keys.

-- comments.authorId: RESTRICT → NO ACTION. RESTRICT is checked per row, so a
-- tenant cascade fails when it reaches users before their comments; NO ACTION
-- waits for the end of the statement. Single users are deleted by UsersService,
-- which reassigns their comments to the per-tenant placeholder first.
ALTER TABLE "comments" DROP CONSTRAINT "comments_authorId_fkey";
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id")
  ON DELETE NO ACTION ON UPDATE CASCADE;

-- reports.moderatorId: a bare SET NULL on the composite key also nulls the
-- NOT NULL "tenantId", so deleting an admin who moderated a report failed.
-- Null only "moderatorId" (column list: Postgres ≥ 15; Prisma can't express it).
ALTER TABLE "reports" DROP CONSTRAINT "reports_moderatorId_tenantId_fkey";
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderatorId_tenantId_fkey"
  FOREIGN KEY ("moderatorId", "tenantId")
  REFERENCES "users"("externalId", "tenantId")
  ON DELETE SET NULL ("moderatorId") ON UPDATE CASCADE;

-- reports / banned_words → tenants: RESTRICT → CASCADE, like every other
-- tenant-owned table.
ALTER TABLE "reports" DROP CONSTRAINT "reports_tenantId_fkey";
ALTER TABLE "reports" ADD CONSTRAINT "reports_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "banned_words" DROP CONSTRAINT "banned_words_tenantId_fkey";
ALTER TABLE "banned_words" ADD CONSTRAINT "banned_words_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
