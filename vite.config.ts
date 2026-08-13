import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SEO_METADATA, SITE_ORIGIN } from './src/seo/siteMetadata';

function japaneseSeoPage(englishHtml: string): string {
  const japanese = SEO_METADATA.ja;
  return englishHtml
    .replace('<html lang="en">', '<html lang="ja">')
    .replaceAll(SEO_METADATA.en.title, japanese.title)
    .replaceAll(SEO_METADATA.en.description, japanese.description)
    .replace(`<link rel="canonical" href="${SITE_ORIGIN}/" />`, `<link rel="canonical" href="${SITE_ORIGIN}${japanese.path}" />`)
    .replace(`<meta property="og:url" content="${SITE_ORIGIN}/" />`, `<meta property="og:url" content="${SITE_ORIGIN}${japanese.path}" />`)
    .replace(`"url": "${SITE_ORIGIN}/"`, `"url": "${SITE_ORIGIN}${japanese.path}"`)
    .replaceAll('en_US', japanese.ogLocale)
    .replace('"inLanguage": "en"', '"inLanguage": "ja"')
    .replace('Plan walking routes through Shinjuku Station with a 3D indoor map.', '3D屋内地図で新宿駅構内の徒歩ルートを計画できます。')
    .replace('Accessible station routes', 'バリアフリー対応の駅構内ルート')
    .replace('Search ticket gates, platforms, exits, and facilities, then choose a route that is shortest, wheelchair accessible, avoids stairs, or prefers elevators.', '改札、ホーム、出口、施設を検索し、最短、車いす対応、階段回避、エレベーター優先の経路を選べます。')
    .replace('This interactive map needs JavaScript to calculate and display routes.', '経路の検索と表示にはJavaScriptが必要です。')
    .replace(/(src|href)="\.\//g, '$1="../');
}

function localizedSeoPages() {
  let outDir = 'dist';
  return {
    name: 'localized-seo-pages',
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const englishHtml = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const japaneseDirectory = path.join(outDir, 'ja');
      mkdirSync(japaneseDirectory, { recursive: true });
      writeFileSync(path.join(japaneseDirectory, 'index.html'), japaneseSeoPage(englishHtml));
    },
  };
}

export default defineConfig({
  plugins: [react(), localizedSeoPages()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          return undefined;
        },
      },
    },
  },
});
