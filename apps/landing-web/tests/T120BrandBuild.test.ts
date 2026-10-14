// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';
import mark from '../../../shared/brand/mark.json';

const repository = resolve(import.meta.dirname, '../../..');
it.each(['admin-web', 'operator-web', 'landing-web'])('T120 %s ships linked source favicons and no inline image copies', async app => {
  const output = mkdtempSync(join(tmpdir(), 't120-brand-'));
  try {
    await build({ root: resolve(repository, 'apps', app), envDir: false, logLevel: 'silent', base: '/releases/abcdef0/', build: { outDir: output, emptyOutDir: true } });
    for (const page of app === 'landing-web' ? ['index.html', 'app.html', 'tag.html'] : ['index.html']) {
      const document = new DOMParser().parseFromString(readFileSync(join(output, page), 'utf8'), 'text/html');
      const icons = [...document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')];
      expect(icons.map(icon => icon.getAttribute('href')).sort()).toEqual(['/releases/abcdef0/favicon.svg', '/releases/abcdef0/favicon.ico', '/releases/abcdef0/apple-touch-icon.png'].sort());
      for (const icon of icons) {
        const file = icon.getAttribute('href')!.split('/').pop()!;
        expect(readFileSync(join(output, file))).toEqual(readFileSync(join(repository, 'shared/brand/web', file)));
      }
      if (app === 'landing-web' && page !== 'index.html') {
        const tile = document.querySelector('main img');
        expect(tile?.getAttribute('src')).toBe('/releases/abcdef0/brand/app-icon.png');
        expect(tile?.getAttribute('alt')).toBe('');
        expect(readFileSync(join(output, 'brand/app-icon.png'))).toEqual(readFileSync(join(repository, 'shared/brand/app/icon.png')));
      }
      if (app === 'landing-web' && page === 'index.html') {
        const svg = document.querySelector('.brand svg')!;
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect([...svg.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(mark.compact.paths.map(path => path.d));
      }
    }
  } finally { rmSync(output, { recursive: true, force: true }); }
}, 30000);
