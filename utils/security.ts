import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const markdown = new Marked({ gfm: true, breaks: true });
const SAFE_PROTOCOLS = new Set(['https:']);

export function safeExternalUrl(value?: string | null): string {
  if (!value?.trim()) return '';

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://samyao.me';
    const url = new URL(value.trim(), base);

    if (SAFE_PROTOCOLS.has(url.protocol)) return url.href;

    if (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
    ) {
      return url.href;
    }

    return '';
  } catch {
    return '';
  }
}

export function sanitizeUntrustedHtml(html: string): string {
  return DOMPurify.sanitize(html || '', {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['srcdoc']
  }) as string;
}

export function renderSafeMarkdown(source: string): string {
  const html = markdown.parse(source || '') as string;
  return sanitizeUntrustedHtml(html);
}

export function sanitizeEditorHtml(html: string): string {
  const clean = DOMPurify.sanitize(html || '', {
    ADD_TAGS: ['iframe', 'code-block'],
    ADD_ATTR: [
      'allow',
      'allowfullscreen',
      'frameborder',
      'sandbox',
      'referrerpolicy',
      'spellcheck'
    ],
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['srcdoc']
  }) as string;

  const doc = new DOMParser().parseFromString(clean, 'text/html');

  doc.querySelectorAll('iframe').forEach((frame) => {
    const src = safeExternalUrl(frame.getAttribute('src'));
    if (!src) {
      frame.remove();
      return;
    }

    frame.setAttribute('src', src);
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  });

  doc.querySelectorAll('a').forEach((link) => {
    const href = safeExternalUrl(link.getAttribute('href'));
    if (!href) {
      link.removeAttribute('href');
      link.removeAttribute('target');
      return;
    }

    link.setAttribute('href', href);
    if (link.getAttribute('target') === '_blank') {
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return doc.body.innerHTML;
}
