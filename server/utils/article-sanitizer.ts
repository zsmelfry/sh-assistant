import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize article HTML content with a whitelist of safe tags.
 * Strips scripts, styles, iframes and other dangerous elements.
 * Forces external links to open in new tab with noopener.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u', 's', 'del',
      'figure', 'figcaption',
      'div', 'span', 'sub', 'sup',
    ],
    allowedAttributes: {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'width', 'height'],
      'td': ['colspan', 'rowspan'],
      'th': ['colspan', 'rowspan'],
      'code': ['class'],
      'pre': ['class'],
    },
    transformTags: {
      'a': (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
    allowedSchemes: ['http', 'https'],
  });
}

/**
 * Strip all HTML tags and return plain text.
 * Used for LLM prompts where HTML is not needed.
 */
export function stripHtmlTags(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\s+/g, ' ').trim();
}
