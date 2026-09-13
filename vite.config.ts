import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { extractViteAssetMarkup, renderStaticSeoPage } from './src/seo/staticPage';

function localizedSeoPages() {
  let outDir = 'dist';
  return {
    name: 'localized-seo-pages',
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const builtHtml = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const assetMarkup = extractViteAssetMarkup(builtHtml);
      const japaneseDirectory = path.join(outDir, 'ja');
      mkdirSync(japaneseDirectory, { recursive: true });
      writeFileSync(path.join(outDir, 'index.html'), renderStaticSeoPage('en', assetMarkup));
      writeFileSync(path.join(japaneseDirectory, 'index.html'), renderStaticSeoPage('ja', assetMarkup));
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
