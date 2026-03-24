import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Render markdown to sanitized HTML, safe for v-html */
export function renderMarkdownSafe(content: string, options?: { breaks?: boolean }): string {
  const raw = marked.parse(content, { breaks: options?.breaks ?? true }) as string;
  return DOMPurify.sanitize(raw);
}
