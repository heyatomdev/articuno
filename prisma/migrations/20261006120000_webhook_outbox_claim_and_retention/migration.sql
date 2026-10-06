-- Lease owned by the worker that claimed the row (see WebhooksJob.claimDue).
ALTER TABLE "webhook_events" ADD COLUMN "claimedUntil" TIMESTAMP(3);

-- Serves the global due-rows predicate of the claim query
-- ("sentAt" IS NULL AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= now())).
-- Partial, so delivered rows (the bulk of the table) never enter it.
-- Hand-written: Prisma cannot express partial indexes.
CREATE INDEX "webhook_events_due_idx"
ON "webhook_events"("nextRetryAt")
WHERE "sentAt" IS NULL;
