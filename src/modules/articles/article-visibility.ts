import { ContentStatus } from '@prisma/client';

/**
 * Article statuses the public API (X-API-Key) may read: PUBLISHED, plus DRAFT
 * when the tenant asks for a preview. UNDER_REVIEW, HIDDEN and BANNED never.
 */
export function publicArticleStatuses(
  includeDrafts?: boolean,
): ContentStatus[] {
  return includeDrafts
    ? [ContentStatus.PUBLISHED, ContentStatus.DRAFT]
    : [ContentStatus.PUBLISHED];
}
