import { describe, expect, it } from 'vitest';
import {
  extractViteAssetMarkup,
  renderStaticSeoPage,
  type StaticSeoPageContent,
  type StaticSeoPageMetadata,
} from '../src/seo/staticPage.js';

const viteAssets = [
  '<script type="module" crossorigin src="./assets/index-hash.js"></script>',
  '<link rel="stylesheet" crossorigin href="./assets/index-hash.css">',
].join('\n');

describe('static SEO page generator', () => {
  it('renders the English and Japanese pages with locale metadata, crawlable fallback content, and relative assets', () => {
    const english = renderStaticSeoPage('en', viteAssets);
    const japanese = renderStaticSeoPage('ja', viteAssets);

    expect(english).toContain('<html lang="en">');
    expect(english).toContain('<title>Shinjuku Station Navigator</title>');
    expect(english).toContain('<meta name="description" content="Plan walking routes through Shinjuku Station with a 3D map, accessible route profiles, and searchable facilities." />');
    expect(english).toContain('<link rel="canonical" href="https://shinjuku.leotctam.com/" />');
    expect(english).toContain('<link rel="alternate" hreflang="ja" href="https://shinjuku.leotctam.com/ja/" />');
    expect(english).toContain('<meta property="og:locale" content="en_US" />');
    expect(english).toContain('"inLanguage": "en"');
    expect(english).toContain('<h1>Shinjuku Station Navigator</h1>');
    expect(english).toContain('src="./assets/index-hash.js"');
    expect(english).not.toContain('<noscript');

    expect(japanese).toContain('<html lang="ja">');
    expect(japanese).toContain('<title>新宿駅ナビゲーター</title>');
    expect(japanese).toContain('<meta name="description" content="3D地図、バリアフリー経路、施設検索で新宿駅構内の徒歩ルートを計画できます。" />');
    expect(japanese).toContain('<link rel="canonical" href="https://shinjuku.leotctam.com/ja/" />');
    expect(japanese).toContain('<link rel="alternate" hreflang="en" href="https://shinjuku.leotctam.com/" />');
    expect(japanese).toContain('<meta property="og:locale" content="ja_JP" />');
    expect(japanese).toContain('"inLanguage": "ja"');
    expect(japanese).toContain('<h1>新宿駅ナビゲーター</h1>');
    expect(japanese).toContain('src="../assets/index-hash.js"');
    expect(japanese).toContain('href="../assets/index-hash.css"');
    expect(japanese).not.toContain('<noscript');
  });

  it('escapes metadata and fallback text for HTML and JSON-LD', () => {
    const metadata: StaticSeoPageMetadata = {
      title: 'A <title> & "quotes"',
      description: 'Route > map & "details"',
      path: '/',
      ogLocale: 'en_US',
    };
    const content: StaticSeoPageContent = {
      intro: 'Use < and & safely.',
      sectionTitle: 'A "heading"',
      sectionDescription: 'Keep > content safe.',
      javascriptRequired: 'JavaScript & a <browser> are required.',
    };

    const page = renderStaticSeoPage('en', viteAssets, metadata, content);

    expect(page).toContain('<title>A &lt;title&gt; &amp; &quot;quotes&quot;</title>');
    expect(page).toContain('<p>Use &lt; and &amp; safely.</p>');
    expect(page).toContain('"name": "A \\u003ctitle\\u003e \\u0026 \\"quotes\\""');
    expect(page).toContain('"description": "Route \\u003e map \\u0026 \\"details\\""');
  });

  it('extracts Vite-built relative asset tags and rejects malformed build output', () => {
    const builtHtml = `<!doctype html><head>${viteAssets}</head>`;

    expect(extractViteAssetMarkup(builtHtml)).toBe(viteAssets);
    expect(() => extractViteAssetMarkup('<html></html>')).toThrow('Vite asset tags');
    expect(() => extractViteAssetMarkup('<script type="module" src="/src/main.tsx"></script>')).toThrow('Vite asset tags');
  });
});
