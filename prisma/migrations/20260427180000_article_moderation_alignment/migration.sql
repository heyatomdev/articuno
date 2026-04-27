-- Add new moderation status for articles
ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';

-- Backfill legacy article statuses created with the old default
UPDATE "articles"
SET "status" = 'DRAFT'
WHERE "status" = 'VISIBLE';

-- Dedicated outbox table for tenant webhooks
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_events_tenantId_sentAt_nextRetryAt_idx"
ON "webhook_events"("tenantId", "sentAt", "nextRetryAt");

ALTER TABLE "webhook_events"
ADD CONSTRAINT "webhook_events_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

