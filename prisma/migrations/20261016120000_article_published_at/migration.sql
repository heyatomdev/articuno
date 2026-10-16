-- AlterTable
ALTER TABLE "articles" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Backfill: articles already published (or under review, reachable only from
-- PUBLISHED) count as published at creation, so a later re-publish is not a
-- first publication.
UPDATE "articles" SET "publishedAt" = "createdAt"
WHERE "status" IN ('PUBLISHED', 'UNDER_REVIEW');

-- CreateIndex
CREATE INDEX "articles_tenantId_status_publishedAt_idx" ON "articles"("tenantId", "status", "publishedAt");
