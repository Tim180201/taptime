import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import axe from 'axe-core';
export async function launchBrowser() {
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  return chromium.launch({ executablePath: process.env.CHROME_BIN ?? (existsSync(mac) ? mac : '/usr/bin/google-chrome'), headless: true, args: ['--no-sandbox'] });
}
export async function buildWeb(app, fixture = false, storageProbe = false) {
  const root = realpathSync(resolve(process.env.TAPTIME_LAYOUT_SOURCE ?? '.', 'apps', app)), output = mkdtempSync(join(tmpdir(), 'taptime-layout-'));
  const plugins = [react()];
  if (!fixture) plugins.push({ name: 'no-production-test-fixtures', generateBundle() {
    if ([...this.getModuleIds()].some(id => id.includes('/tests/'))) throw new Error('Test module reached the production bundle');
  } });
  if (fixture) plugins.unshift({ name: 'layout-test-entry', enforce: 'pre', transform(code, id) {
    if (id === join(root, 'src/main.tsx')) return `import ${JSON.stringify(join(root, 'tests/layoutFixture.tsx'))};`;
  } });
  // Explicitly disable .env discovery. These bundles use no configured account or server.
  await build({ root, configFile: false, envDir: false, plugins, logLevel: 'warn',
    define: {
      'import.meta.env.VITE_TAPTIME_SUPABASE_URL': JSON.stringify(storageProbe ? 'https://synthetic.supabase.co' : ''),
      'import.meta.env.VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(storageProbe ? 'sb_publishable_SYNTHETICEXAMPLEONLY0000000000' : ''),
    },
    build: { outDir: output, emptyOutDir: true } });
  const caddy = readFileSync(resolve('infrastructure/caddy/Caddyfile'), 'utf8');
  const section = app === 'admin-web' ? '\nadmin.tb-infra.de {' : '\nbetreiber.tb-infra.de {';
  const csp = caddy.split(section)[1].match(/Content-Security-Policy "([^"]+)"/)[1];
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://local').pathname;
    let file = join(output, path);
    if (!existsSync(file) || !extname(path)) file = join(output, 'index.html');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.ttf':'font/ttf', '.woff2':'font/woff2' })[extname(file)] ?? 'text/plain');
    res.end(readFileSync(file));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: async () => {
    await new Promise(done => server.close(done)); rmSync(output, { recursive: true, force: true });
  } };
}
export async function measure(page) {
  const geometry = await page.evaluate(() => {
    const issues = [];
    const visible = el => {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || el.closest('[inert], .sr-only')) return false;
      for (let parent = el; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).clipPath === 'inset(50%)') return false;
      }
      // Native modal dialogs make the rest of the document inert without an attribute.
      const modal = document.querySelector('dialog:modal');
      return !modal || modal.contains(el);
    };
    const name = el => `${el.tagName.toLowerCase()}${el.id ? '#'+el.id : '.'+String(el.className).split(' ').join('.')}`;
    if (document.documentElement.scrollWidth > innerWidth) issues.push(`page width ${document.documentElement.scrollWidth} > ${innerWidth}`);
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const desktopTable = innerWidth >= 1024 && el.closest('.table-scroll,.tablewrap');
      if (!desktopTable && (r.left < -1 || r.right > innerWidth+1)) issues.push(`${name(el)} outside viewport (${Math.round(r.left)}..${Math.round(r.right)})`);
      const style = getComputedStyle(el);
      if (innerWidth < 1024 && ['auto','scroll'].includes(style.overflowX) && el.scrollWidth > el.clientWidth+1) issues.push(`${name(el)} horizontal scrolling`);
      if (el.matches('button, input, select, textarea, a[href], summary')) {
        const hit = el.matches('input[type="radio"],input[type="checkbox"]') ? el.closest('label') ?? el : el;
        if (hit.getBoundingClientRect().height < 43.9) issues.push(`${name(el)} hit height ${hit.getBoundingClientRect().height.toFixed(1)}`);
      }
      if (el.matches('input,select,textarea') && parseFloat(style.fontSize) < 16) issues.push(`${name(el)} font ${style.fontSize}`);
    }
    return [...new Set(issues)];
  });
  await page.evaluate(axe.source);
  const result = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }));
  return { geometry, axe: result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) };
}
