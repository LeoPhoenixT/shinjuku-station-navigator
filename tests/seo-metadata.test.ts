import { beforeEach, describe, expect, it } from 'vitest';
import { applyDocumentMetadata } from '../src/seo/metadata.js';

describe('document SEO metadata', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta property="og:locale" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
    `;
  });

  it('updates browser metadata when Japanese is selected', () => {
    applyDocumentMetadata('ja');

    expect(document.title).toBe('新宿駅ナビゲーター');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('新宿駅構内');
    expect(document.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('ja_JP');
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe('新宿駅ナビゲーター');
  });
});
