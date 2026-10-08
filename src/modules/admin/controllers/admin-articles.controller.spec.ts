import { ContentStatus } from '@prisma/client';
import { canSetArticleStatus } from './admin-articles.controller';

const { DRAFT, PUBLISHED, UNDER_REVIEW, HIDDEN, BANNED } = ContentStatus;

describe('canSetArticleStatus', () => {
  it('lets an AUTHOR publish and unpublish', () => {
    expect(canSetArticleStatus('AUTHOR', PUBLISHED, DRAFT)).toBe(true);
    expect(canSetArticleStatus('AUTHOR', DRAFT, PUBLISHED)).toBe(true);
    expect(canSetArticleStatus('AUTHOR', PUBLISHED)).toBe(true);
  });

  it('keeps an AUTHOR from setting a moderation status', () => {
    expect(canSetArticleStatus('AUTHOR', HIDDEN, PUBLISHED)).toBe(false);
    expect(canSetArticleStatus('AUTHOR', UNDER_REVIEW)).toBe(false);
  });

  it('keeps an AUTHOR from moving an article out of moderation', () => {
    expect(canSetArticleStatus('AUTHOR', PUBLISHED, UNDER_REVIEW)).toBe(false);
    expect(canSetArticleStatus('AUTHOR', DRAFT, HIDDEN)).toBe(false);
  });

  it('allows no-op status and edits without status', () => {
    expect(canSetArticleStatus('AUTHOR', HIDDEN, HIDDEN)).toBe(true);
    expect(canSetArticleStatus('AUTHOR', undefined, BANNED)).toBe(true);
  });

  it('lets a MODERATOR do all of it', () => {
    expect(canSetArticleStatus('MODERATOR', PUBLISHED, HIDDEN)).toBe(true);
    expect(canSetArticleStatus('MODERATOR', BANNED, PUBLISHED)).toBe(true);
  });
});
