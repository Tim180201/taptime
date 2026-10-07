import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { productHtml } from '../../shared/productHtml';
import links from './src/appLinks.json';
import { validateAppLinks } from './src/appDownload';

validateAppLinks(links);
export default defineConfig({
  plugins: [productHtml()],
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        tag: fileURLToPath(new URL('./tag.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
      },
      output: {
        entryFileNames: chunk => `${chunk.name === 'app' ? 'app-assets' : 'assets'}/[name]-[hash].js`,
        assetFileNames: asset => `${asset.names?.includes('app.css') ? 'app-assets' : 'assets'}/[name]-[hash][extname]`,
      },
    },
  },
});
