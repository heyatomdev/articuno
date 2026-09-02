import sanitizeHtml = require('sanitize-html');

const WORDS_PER_MINUTE = 200;

/**
 * Estimated reading time in minutes for an article body.
 *
 * Strips markup with sanitize-html (`allowedTags: []`) rather than a regex —
 * a `<[^>]*>` pattern breaks on attribute values containing `>`. Non-text tags
 * (script/style/noscript) have their content dropped, not counted.
 *
 * Rounded up, floored at 1: a two-line article reads as "1 min", never "0 min".
 */
export function computeReadingTime(html: string): number {
  const text = sanitizeHtml(html ?? '', {
    allowedTags: [],
    allowedAttributes: {},
  });
  const words = text.split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
