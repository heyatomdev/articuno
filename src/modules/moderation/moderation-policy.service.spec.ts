import { ContentStatus } from '@prisma/client';
import { isValidModerationTransition } from './moderation-policy.service';

const { DRAFT, PUBLISHED, UNDER_REVIEW, HIDDEN, BANNED, VISIBLE } =
  ContentStatus;

describe('isValidModerationTransition', () => {
  it.each([
    [DRAFT, PUBLISHED],
    [PUBLISHED, DRAFT],
    [PUBLISHED, HIDDEN],
    [UNDER_REVIEW, PUBLISHED],
    [HIDDEN, PUBLISHED],
    [VISIBLE, HIDDEN],
    [HIDDEN, VISIBLE],
    [UNDER_REVIEW, VISIBLE],
  ])('allows %s → %s', (from, to) => {
    expect(isValidModerationTransition(from, to)).toBe(true);
  });

  it.each([
    [BANNED, PUBLISHED],
    [BANNED, VISIBLE],
    [BANNED, DRAFT],
    [VISIBLE, PUBLISHED],
    [DRAFT, VISIBLE],
  ])('rejects %s → %s', (from, to) => {
    expect(isValidModerationTransition(from, to)).toBe(false);
  });

  it('treats the same status as a no-op, even BANNED', () => {
    expect(isValidModerationTransition(BANNED, BANNED)).toBe(true);
  });
});
