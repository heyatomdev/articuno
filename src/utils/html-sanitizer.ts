import sanitizeHtml = require('sanitize-html');
import { decodeHTML } from 'entities';
/**
 * Sanitizes an HTML string by removing dangerous tags (script, iframe, object,
 * embed, form, …) and unsafe attributes (onclick, onerror, style with
 * javascript, etc.).
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      // Text formatting
      'p',
      'br',
      'strong',
      'em',
      'u',
      'b',
      'i',
      's',
      'mark',
      'small',
      // Headers
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      // Lists
      'ul',
      'ol',
      'li',
      // Other
      'blockquote',
      'code',
      'pre',
      'hr',
      // Tables
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      // Links and media (with restrictions)
      'a',
      'img',
      // Containers
      'div',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      div: ['class'],
      span: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['https', 'mailto'],
    allowedSchemesByTag: {
      img: ['https'],
    },
    // Disallow all CSS classes except specific safe ones
    allowedClasses: {
      div: ['highlight', 'note', 'warning', 'info'],
      span: ['highlight', 'emphasis'],
    },
    // Transform links to be safe
    transformTags: {
      a: (_tagName, attribs) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        };
      },
    },
    // Remove any script or event handlers
    disallowedTagsMode: 'discard',
    selfClosing: ['img', 'br', 'hr'],
    enforceHtmlBoundary: false,
  });
}

/**
 * Plain-text fields (comments, titles, meta): drops every tag and keeps the
 * text, stored as plain text (`Tom & Jerry`, not `Tom &amp; Jerry`).
 * sanitize-html HTML-escapes its output, so decode it back: anything that
 * still looks like a tag after decoding was text the user typed as text.
 * Consumers must render these fields as text (or escape them), never as raw HTML.
 */
export function stripTags(text: string): string {
  return decodeHTML(
    sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }),
  );
}

/** Title and SEO fields of a translation are plain text: strips their tags. */
export function stripTranslationText<
  T extends { title?: string; metaTitle?: string; metaDescription?: string },
>(t: T): T {
  return {
    ...t,
    ...(t.title !== undefined && { title: stripTags(t.title) }),
    ...(t.metaTitle !== undefined && { metaTitle: stripTags(t.metaTitle) }),
    ...(t.metaDescription !== undefined && {
      metaDescription: stripTags(t.metaDescription),
    }),
  };
}
