/**
 * Dead-letter sentinel for `WebhookEvent.nextRetryAt`: the outbox job never
 * picks the row up again. Own file so `MetricsService` can bind it without
 * importing `WebhooksJob`, which itself depends on `MetricsService`.
 */
export const DEAD_LETTER_DATE = new Date('9999-12-31T23:59:59.000Z');
