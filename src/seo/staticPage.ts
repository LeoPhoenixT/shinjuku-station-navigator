import type { Locale } from '../i18n/types.js';
import {
  SEO_FALLBACK_CONTENT,
  SEO_METADATA,
  SITE_ORIGIN,
  type SeoFallbackContent,
  type SeoMetadata,
} from './siteMetadata.js';

export type StaticSeoPageMetadata = SeoMetadata;
export type StaticSeoPageContent = SeoFallbackContent;

const VITE_ASSET_TAG = /<(?:script\b[^>]*\bsrc="\.\/assets\/[^"\n]+"[^>]*>\s*<\/script>|link\b[^>]*\bhref="\.\/assets\/[^"\n]+"[^>]*>)/g;

export function extractViteAssetMarkup(builtHtml: string): string {
  const assets = builtHtml.match(VITE_ASSET_TAG) ?? [];
  if (!assets.some((asset) => asset.startsWith('<script'))) {
    throw new Error('Vite asset tags are missing the built application script.');
  }

  return assets.join('\n');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function jsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[<>&\u2028\u2029]/g, (character) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  })[character] ?? character);
}

function localizedAssetMarkup(locale: Locale, assetMarkup: string): string {
  return locale === 'ja' ? assetMarkup.replaceAll('="./', '="../') : assetMarkup;
}

function assetPrefix(locale: Locale): string {
  return locale === 'ja' ? '../' : './';
}

export function renderStaticSeoPage(
  locale: Locale,
  assetMarkup: string,
  metadata: StaticSeoPageMetadata = SEO_METADATA[locale],
  content: StaticSeoPageContent = SEO_FALLBACK_CONTENT[locale],
): string {
  const canonicalUrl = `${SITE_ORIGIN}${metadata.path}`;
  const prefix = assetPrefix(locale);
  const jsonLd = jsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: metadata.title,
    applicationCategory: 'NavigationApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    url: canonicalUrl,
    description: metadata.description,
  });

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(metadata.description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${SEO_METADATA.en.path}" />
    <link rel="alternate" hreflang="ja" href="${SITE_ORIGIN}${SEO_METADATA.ja.path}" />
    <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${SEO_METADATA.en.path}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(metadata.title)}" />
    <meta property="og:title" content="${escapeHtml(metadata.title)}" />
    <meta property="og:description" content="${escapeHtml(metadata.description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="${escapeHtml(metadata.ogLocale)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />
    <link rel="icon" href="${prefix}favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" href="${prefix}favicon-32x32.png" sizes="32x32" />
    <link rel="apple-touch-icon" href="${prefix}apple-touch-icon.png" sizes="180x180" />
    <title>${escapeHtml(metadata.title)}</title>
    <script type="application/ld+json">
${jsonLd.split('\n').map((line) => `      ${line}`).join('\n')}
    </script>
${localizedAssetMarkup(locale, assetMarkup).split('\n').map((line) => `    ${line}`).join('\n')}
  </head>
  <body>
    <div id="root">
      <main>
        <h1>${escapeHtml(metadata.title)}</h1>
        <p>${escapeHtml(content.intro)}</p>
        <section>
          <h2>${escapeHtml(content.sectionTitle)}</h2>
          <p>${escapeHtml(content.sectionDescription)}</p>
        </section>
        <p>${escapeHtml(content.javascriptRequired)}</p>
      </main>
    </div>
  </body>
</html>
`;
}
