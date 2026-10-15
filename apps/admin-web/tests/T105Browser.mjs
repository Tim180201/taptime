import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildWeb, launchBrowser, measure } from '../../../scripts/browser/harness.mjs';

const output = resolve('.t105-review');
const screenshots = join(output, 'screenshots');
mkdirSync(screenshots, { recursive: true });
const access = p => p.getByRole('tab', { name: 'Zugänge', exact: true }).click();
const click = name => p => p.getByRole('button', { name, exact: true }).first().click();
const cases = [
  ['zeiten', 't105-admin', 1],
  ['zugaenge', 't105-admin', 1, access],
  ['zugaenge-aktiv', 't105-admin', 1, async p => { await access(p); await click('Aktiv')(p); }],
  ['zugaenge-entzogen', 't105-admin', 1, async p => { await access(p); await click('Entzogen')(p); }],
  ['rolle', 't105-admin', 1, async p => {
    await access(p);
    await p.getByRole('row').filter({ hasText: 'Claudia Standortleitung' }).getByRole('button', { name: 'Rolle ändern' }).click();
  }],
  ['entzug', 't105-admin', 1, async p => { await access(p); await click('Zugang entziehen')(p); }],
  ['einladung', 't105-admin', 1, click('+ Mitarbeiter einladen')],
  ['leitung-zeiten', 't105-manager', 0],
  ['leitung-zugaenge', 't105-manager', 0, access],
];
const web = await buildWeb('admin-web', true);
const browser = await launchBrowser();
const results = [];
try {
  for (const width of [390, 1440]) for (const font of [100, 200]) for (const theme of ['dark', 'light']) {
    for (const [name, variant, expectedPrimary, steps] of cases) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      page.setDefaultTimeout(7000);
      const result = { name, theme, width, font, errors: [] };
      page.on('pageerror', e => result.errors.push(e.message));
      await page.route('**/*', route => route.request().url().startsWith(web.origin + '/') ? route.continue()
        : (result.errors.push('Unexpected external request'), route.abort()));
      try {
        await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'));
        await page.addInitScript(variant => {
          window.layoutScenario = variant;
          window.layoutCspViolations = [];
          document.addEventListener('securitypolicyviolation', e => window.layoutCspViolations.push(e.violatedDirective));
        }, variant);
        await page.goto(web.origin + '/beschaeftigte');
        await page.locator('.employees-view').waitFor();
        if (steps) await steps(page);
        if (name === 'zugaenge-entzogen') {
          const table = page.getByRole('table', { name: 'Zugänge', exact: true });
          await table.getByText('Erika Ausgeschieden').waitFor();
          assert.equal(await table.getByRole('button').count(), 0);
        }
        if (name === 'zugaenge') await page.getByText('noch nicht angemeldet', { exact: true }).waitFor();
        // Text-only zoom: snapshot sizes first, avoiding cascaded multiplication.
        if (font === 200) await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('html,body *')].filter(e => e instanceof HTMLElement);
          const sizes = nodes.map(e => parseFloat(getComputedStyle(e).fontSize));
          nodes.forEach((e, i) => { e.style.fontSize = `${sizes[i] * 2}px`; });
        });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        result.errors.push(...await page.evaluate(() => window.layoutCspViolations));
        Object.assign(result, await measure(page));
        const primary = await page.evaluate(() => {
          const modal = document.querySelector('dialog:modal');
          const probe = document.createElement('span'); document.body.append(probe);
          const colors = ['action', 'notice', 'error'].map(role => {
            probe.style.backgroundColor = `var(--color-${role})`; return getComputedStyle(probe).backgroundColor;
          }); probe.remove();
          return [...document.querySelectorAll('main button,main a,dialog button')].filter(e =>
            !e.closest('.theme-switch') && e.checkVisibility({ checkVisibilityCSS: true })
            && (!modal || modal.contains(e)) && colors.includes(getComputedStyle(e).backgroundColor)).length;
        });
        if (primary !== expectedPrimary) result.primary = `expected ${expectedPrimary}, got ${primary}`;
        const sheet = page.locator('dialog:modal');
        await page.screenshot({ path: join(screenshots, `${name}-${theme}-${width}-${font}.png`), fullPage: !(await sheet.count()) });
        if (await sheet.count() && await sheet.evaluate(el => el.scrollHeight > el.clientHeight + 1)) {
          await sheet.evaluate(el => { el.scrollTop = el.scrollHeight; });
          await page.screenshot({ path: join(screenshots, `${name}-unten-${theme}-${width}-${font}.png`) });
        }
        // The role sheet preserves the opener's focus when dismissed with Escape.
        if (name === 'rolle') {
          await page.keyboard.press('Escape');
          assert.equal(await page.getByRole('dialog').count(), 0);
          assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Rolle ändern');
        }
      } catch (error) { result.error = error.message; }
      finally { results.push(result); await page.close(); }
    }
    console.log(`Completed ${width}px / ${font}% / ${theme}`);
  }
  writeFileSync(join(output, 'browser-results.json'), JSON.stringify(results, null, 2));
  const failures = results.filter(r => r.error || r.primary || r.errors.length || r.geometry?.length || r.axe?.length);
  console.log(JSON.stringify(failures, null, 2));
  assert.deepEqual(failures, []);
} finally { await browser.close(); await web.close(); }
