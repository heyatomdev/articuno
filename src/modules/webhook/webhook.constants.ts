/**
 * Dead-letter sentinel for `WebhookEvent.nextRetryAt`: the outbox job never
 * picks the row up again. Own file so `WebhookMetrics` can bind it without
 * importing `WebhooksJob`, which itself depends on `WebhookMetrics`.
 */
export const DEAD_LETTER_DATE = new Date('9999-12-31T23:59:59.000Z');

/**
 * Admin view of an outbox row: the sentinel is scheduling plumbing, not a
 * date. A dead-lettered row reads `nextRetryAt: null` + `deadLettered: true`
 * instead of leaking 9999-12-31 (which a UTC+ console printed as 01/01/10000).
 */
export function toWebhookEventView<
  T extends { nextRetryAt: Date | null; sentAt: Date | null },
>(row: T): T & { deadLettered: boolean } {
  const deadLettered =
    row.sentAt === null &&
    row.nextRetryAt?.getTime() === DEAD_LETTER_DATE.getTime();
  return {
    ...row,
    nextRetryAt: deadLettered ? null : row.nextRetryAt,
    deadLettered,
  };
}
