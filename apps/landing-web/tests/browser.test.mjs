import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { launchBrowser, measure } from '../../../scripts/browser/harness.mjs';
import { build } from 'vite';
import axe from 'axe-core';

const root = resolve(import.meta.dirname, '..');
const output = mkdtempSync(join(tmpdir(), 't031-browser-'));
const actualLinks = JSON.parse(readFileSync(join(root, 'src/appLinks.json'), 'utf8'));
const screenshots = process.env.TAPTIME_SCREENSHOTS;
const caddy = readFileSync(resolve(root, '../../infrastructure/caddy/Caddyfile'), 'utf8');
const csp = caddy.split('(landing_headers)')[1].match(/Content-Security-Policy "([^"]+)"/)[1];
let browser, server, origin;
before(async () => {
  await build({ root, envDir: false, logLevel: 'warn', plugins: [{ name: 'test-empty-app-links', enforce: 'pre', transform(_code, id) {
    if (id === join(root, 'src/appLinks.json')) return JSON.stringify({ ios: '', android: '' });
  } }], build: { emptyOutDir:true, outDir: join(output, 'empty') } });
  await build({ root, envDir: false, logLevel: 'warn', plugins: [{ name: 'test-contact-configuration', enforce: 'pre', transform(code, id) {
    if (id === join(root, 'src/config.ts')) return code.replace("contactEmail = ''", "contactEmail = 'pilot@example.invalid'");
    if (id === join(root, 'src/appLinks.json')) return JSON.stringify({ ios: 'https://testflight.apple.com/join/Synthetic', android: 'https://play.google.com/apps/testing/com.example.synthetic' });
  } }], build: { emptyOutDir:true, outDir: join(output, 'set') } });
  await build({ root, envDir: false, logLevel: 'warn', build: { emptyOutDir:true, outDir: join(output, 'actual') } });
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    const prefix = ['/configured', '/actual'].find(prefix => url.pathname.startsWith(prefix + '/'));
    const variant = prefix === '/configured' ? 'set' : prefix === '/actual' ? 'actual' : 'empty';
    let path = prefix ? url.pathname.slice(prefix.length) : url.pathname;
    if (path === '/') path = '/index.html';
    if (path === '/tag') path = '/tag.html';
    if (path === '/app') path = '/app.html';
    // Assets have content-derived names; locate them across all fixture builds.
    let file = join(output, variant, path);
    if (!existsSync(file) && /^\/(assets|app-assets)\//.test(path)) {
      file = ['empty', 'set', 'actual'].map(variant => join(output, variant, path)).find(existsSync) ?? file;
    }
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf' })[extname(file)] ?? 'text/plain');
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await launchBrowser();
});
after(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); rmSync(output, { recursive:true,force:true }); });
for (const width of [320,360,390,1440]) for (const route of ['/', '/tag', '/app', '/configured/app']) test(`${route} at ${width}px: axe, overflow, same-origin resources, strict markup`, async () => {
  const page = await browser.newPage({ viewport: { width, height:900 } });
  const foreign = [], errors = [];
  page.on('request', request => { if (!request.url().startsWith(origin + '/')) foreign.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + route); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('[style], style, script:not([src])').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(axe.source);
  const results = await page.evaluate(() => axe.run(document, { runOnly: {type:'tag',values:['wcag2a','wcag2aa','wcag21aa']} }));
  assert.deepEqual(results.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)})), []);
  assert.deepEqual(foreign, []); assert.deepEqual(errors, []);
  if (route === '/tag') {
    assert.equal(await page.locator('script, a').count(), 0);
    const before = await page.locator('main').innerText();
    await page.goto(origin+'/tag?tag=must-not-be-read#private');
    assert.equal(await page.locator('main').innerText(), before);
  } else if (route === '/') assert.equal(await page.locator('#contact a').count(), 0);
  else {
    assert.deepEqual((await measure(page)).geometry, []);
    if (route === '/app') {
      assert.equal(await page.locator('#app-download a').count(), 0);
      assert.match(await page.locator('#app-download').innerText(), /Die App erhalten Sie von Ihrer Verwaltung/);
    } else {
      assert.equal(await page.getByRole('link', {name:'App Store'}).getAttribute('href'), 'https://testflight.apple.com/join/Synthetic');
      assert.equal(await page.getByRole('link', {name:'Google Play'}).getAttribute('href'), 'https://play.google.com/apps/testing/com.example.synthetic');
    }
  }
  if (screenshots && width !== 320) {
    mkdirSync(screenshots, {recursive:true});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.screenshot({ path: join(screenshots, `${route==='/'?'landing':route.slice(1).replaceAll('/','-')}-${width}.png`), fullPage:true });
  }
  await page.close();
});
test('the built page redirects only to the file-configured destinations under strict CSP', async () => {
  for (const [userAgent, target] of [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'https://testflight.apple.com/join/Synthetic'],
    ['Mozilla/5.0 (Linux; Android 15)', 'https://play.google.com/apps/testing/com.example.synthetic'],
  ]) {
    const page = await browser.newPage({ userAgent });
    const external = [];
    await page.route('**/*', route => {
      if (route.request().url().startsWith(origin + '/')) return route.continue();
      external.push(route.request().url());
      return route.fulfill({ body: 'Synthetic store destination' });
    });
    await page.goto(origin + '/configured/app?redirect=https://foreign.invalid#ios=https://foreign.invalid');
    await page.waitForURL(target);
    assert.deepEqual(external, [target]);
    await page.goto(origin + '/app?redirect=https://foreign.invalid');
    await page.getByText('Die App erhalten Sie von Ihrer Verwaltung.').waitFor();
    assert.deepEqual(external, [target]);
    await page.close();
  }
});
test('the real configuration renders its available desktop destinations and redirects each device only when configured', async () => {
  const desktop = await browser.newPage();
  await desktop.goto(origin + '/actual/app');
  await desktop.locator('.app-actions').waitFor({ state: 'attached' });
  const expectedLinks = [actualLinks.ios, actualLinks.android].filter(Boolean);
  assert.deepEqual(await desktop.locator('#app-download a').evaluateAll(links => links.map(link => link.getAttribute('href'))), expectedLinks);
  assert.equal(await desktop.getByText('Die App erhalten Sie von Ihrer Verwaltung.').count(), expectedLinks.length < 2 ? 1 : 0);
  await desktop.close();
  for (const [userAgent, target] of [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', actualLinks.ios],
    ['Mozilla/5.0 (Linux; Android 15)', actualLinks.android],
  ]) {
    const page = await browser.newPage({ userAgent });
    const external = [];
    await page.route('**/*', route => {
      if (route.request().url().startsWith(origin + '/')) return route.continue();
      external.push(route.request().url());
      return route.fulfill({ body: 'Intercepted configured destination' });
    });
    await page.goto(origin + '/actual/app?redirect=https://foreign.invalid');
    if (target) await page.waitForURL(target);
    else await page.getByText('Die App erhalten Sie von Ihrer Verwaltung.').waitFor();
    assert.deepEqual(external, target ? [target] : []);
    await page.close();
  }
});
test('pause cancels motion, resumes once, and reduced motion responds dynamically', async () => {
  const page = await browser.newPage(); await page.goto(origin);
  const pause = page.locator('#pauseBtn');
  assert.equal(await pause.getAttribute('aria-label'), 'Animation anhalten');
  await pause.click();
  assert.equal(await pause.getAttribute('aria-pressed'), 'true');
  const still = await page.locator('.hero .phone').evaluate(el=>getComputedStyle(el).transform);
  await page.waitForTimeout(180);
  assert.equal(await page.locator('.hero .phone').evaluate(el=>getComputedStyle(el).transform), still);
  assert.ok(await page.locator('.headline .l2').evaluate(el=>getComputedStyle(el).animationPlayState.split(',').every(state=>state.trim()==='paused')));
  await pause.click();
  assert.equal(await pause.getAttribute('aria-pressed'), 'false');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await pause.isVisible(), false);
  assert.equal(await page.locator('.hero .phone').evaluate(el=>getComputedStyle(el).animationName), 'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await pause.isVisible(), true);
  await page.locator('#sicherheit').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[style]').count(), 0);
  await page.close();
});
test('a configured build renders the mailto button and purpose sentence', async () => {
  const page=await browser.newPage(); await page.goto(origin+'/configured/');
  assert.equal(await page.locator('#contact a').getAttribute('href'),'mailto:pilot@example.invalid');
  assert.match(await page.locator('#contact').innerText(),/Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu beantworten\./);
  await page.close();
});
