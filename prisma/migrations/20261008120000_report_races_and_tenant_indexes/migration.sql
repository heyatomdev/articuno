-- Category / Tag slugs are unique per tenant, not globally: two tenants may
-- both own a "news" category.
CREATE UNIQUE INDEX "categories_tenantId_slug_key" ON "categories"("tenantId", "slug");
DROP INDEX "categories_slug_key";

CREATE UNIQUE INDEX "tags_tenantId_slug_key" ON "tags"("tenantId", "slug");
DROP INDEX "tags_slug_key";

-- Tenant-first indexes for the list/filter/sort paths.
CREATE INDEX "articles_tenantId_status_createdAt_idx" ON "articles"("tenantId", "status", "createdAt");
CREATE INDEX "articles_tenantId_createdAt_idx" ON "articles"("tenantId", "createdAt");
CREATE INDEX "comments_tenantId_articleId_createdAt_idx" ON "comments"("tenantId", "articleId", "createdAt");
CREATE INDEX "comments_tenantId_status_createdAt_idx" ON "comments"("tenantId", "status", "createdAt");
CREATE INDEX "reports_tenantId_targetType_targetId_status_idx" ON "reports"("tenantId", "targetType", "targetId", "status");
CREATE INDEX "users_tenantId_createdAt_idx" ON "users"("tenantId", "createdAt");

-- [tenantId, createdAt] serves every query [tenantId] did.
CREATE INDEX "likes_tenantId_createdAt_idx" ON "likes"("tenantId", "createdAt");
DROP INDEX "likes_tenantId_idx";

-- Redundant: prefix of every other audit_logs (tenantId, …) index.
DROP INDEX "audit_logs_tenantId_idx";

-- One open report per reporter and target. The old check-then-insert in
-- ReportsService let concurrent requests through; close any duplicates that
-- slipped in (keep the oldest open one) before enforcing it.
UPDATE "reports" r
SET "status" = 'DISMISSED',
    "moderatorNote" = COALESCE(r."moderatorNote" || E'\n', '') || 'Duplicate report closed by migration 20261008120000.'
FROM (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "tenantId", "targetType", "targetId", "reporterId"
           ORDER BY "createdAt", "id"
         ) AS rn
  FROM "reports"
  WHERE "status" IN ('PENDING', 'REVIEWED')
) d
WHERE r."id" = d."id" AND d.rn > 1;

-- Hand-written: Prisma cannot express partial unique indexes. A violation
-- surfaces as P2002, mapped to 409 by ReportsService.create.
CREATE UNIQUE INDEX "reports_open_reporter_target_key"
ON "reports"("tenantId", "targetType", "targetId", "reporterId")
WHERE "status" IN ('PENDING', 'REVIEWED');
