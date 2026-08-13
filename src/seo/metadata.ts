import type { Locale } from '../i18n/types.js';
import { SEO_METADATA } from './siteMetadata.js';

export function applyDocumentMetadata(locale: Locale): void {
  const metadata = SEO_METADATA[locale];
  document.title = metadata.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', metadata.description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', metadata.title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', metadata.description);
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', metadata.ogLocale);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', metadata.title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', metadata.description);
}
