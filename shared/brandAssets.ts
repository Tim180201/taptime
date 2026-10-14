import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import mark from './brand/mark.json' with { type: 'json' };

// Emit byte-for-byte copies at build time; the supplied brand directory stays the only source.
const files = {
  'favicon.svg': ['web/favicon.svg', 'image/svg+xml'],
  'favicon.ico': ['web/favicon.ico', 'image/x-icon'],
  'apple-touch-icon.png': ['web/apple-touch-icon.png', 'image/png'],
  'brand/app-icon.png': ['app/icon.png', 'image/png'],
} as const;
const bytes = (source: string) => readFileSync(new URL(`./brand/${source}`, import.meta.url));

export function brandAssets(): Plugin {
  let base = '/';
  return {
    name: 'shared-brand-assets',
    configResolved(config) { base = config.base; },
    generateBundle() {
      for (const [fileName, [source]] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source: bytes(source) });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        const name = path.startsWith(base) ? path.slice(base.length) : '';
        if (!Object.hasOwn(files, name)) return next();
        const [source, type] = files[name as keyof typeof files];
        response.setHeader('Content-Type', type);
        response.end(bytes(source));
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // The landing page is static and works without JavaScript.
        const geometry = mark.compact;
        const color = (key: string) => mark.colors[key as keyof typeof mark.colors];
        const svg = `<svg class="brand-mark" width="32" height="32" viewBox="${geometry.viewBox}" fill="none" aria-hidden="true" focusable="false">${geometry.paths.map(path => `<path d="${path.d}" stroke="${color(path.color)}" stroke-width="${path.width}" opacity="${path.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}<circle cx="${geometry.dot.cx}" cy="${geometry.dot.cy}" r="${geometry.dot.r}" fill="${color(geometry.dot.color)}"/></svg>`;
        return {
          html: html.replaceAll('%BRAND_MARK%', svg).replaceAll('%BRAND_APP_ICON%', `${base}brand/app-icon.png`),
          tags: [
            { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }, injectTo: 'head' },
            { tag: 'link', attrs: { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: `${base}favicon.ico` }, injectTo: 'head' },
            { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: `${base}apple-touch-icon.png` }, injectTo: 'head' },
          ],
        };
      },
    },
  };
}
