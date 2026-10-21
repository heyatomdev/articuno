import { DEAD_LETTER_DATE, toWebhookEventView } from './webhook.constants';

describe('toWebhookEventView', () => {
  const base = { id: 'w1', sentAt: null, nextRetryAt: null as Date | null };

  it('hides the dead-letter sentinel and flags the row', () => {
    const view = toWebhookEventView({
      ...base,
      nextRetryAt: new Date(DEAD_LETTER_DATE),
    });
    expect(view.nextRetryAt).toBeNull();
    expect(view.deadLettered).toBe(true);
  });

  it('keeps a real retry date', () => {
    const next = new Date('2026-10-21T10:00:00Z');
    const view = toWebhookEventView({ ...base, nextRetryAt: next });
    expect(view.nextRetryAt).toBe(next);
    expect(view.deadLettered).toBe(false);
  });

  it('is not dead-lettered once sent', () => {
    const view = toWebhookEventView({
      ...base,
      sentAt: new Date(),
      nextRetryAt: null,
    });
    expect(view.deadLettered).toBe(false);
  });
});
