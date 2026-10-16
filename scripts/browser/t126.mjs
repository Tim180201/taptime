import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measure } from './harness.mjs';

export async function verifyT126(browser, web, artifacts) {
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const results = [];
  for (const width of [390, 1440]) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce' });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(web.origin + '/') ? route.continue()
      : (errors.push('Unexpected external request'), route.abort()));
    const capture = async (name, fullPage) => {
      await page.evaluate(() => document.fonts.ready);
      const measured = await measure(page); results.push({ width, theme, name, ...measured, errors: [...errors] });
      if (artifacts) await page.screenshot({ path: join(artifacts, `${name}-${theme}-${width}.png`), fullPage: fullPage ?? !(await page.locator('dialog:modal').count()) });
      assert.deepEqual(measured, { geometry: [], axe: [] }); assert.deepEqual(errors, []);
    };
    const nav = async name => {
      const link = page.getByRole('link', { name: new RegExp(`^${name}`) }).filter({ visible: true });
      if (!(await link.count())) await page.getByRole('button', { name: 'Mehr', exact: true }).click();
      await page.getByRole('link', { name: new RegExp(`^${name}`) }).filter({ visible: true }).click();
    };
    try {
      await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'));
      await page.addInitScript(() => { window.layoutScenario = 't126-admin'; window.t126PageToken = 'same-document'; });
      await page.goto(web.origin + '/lohnexport?monat=2026-09');
      await page.getByRole('link', { name: 'Name fehlt', exact: true }).waitFor();
      await capture('lohnexport-hinweis');
      if (width === 390) {
        await page.getByText(/Bei mindestens einer Person fehlt der Name/).evaluate(element => element.scrollIntoView({ block: 'center' }));
        await capture('lohnexport-name-fehlt', false);
        await page.getByRole('button', { name: 'Voriger Monat', exact: true }).scrollIntoViewIfNeeded();
      }
      const before = await page.getByRole('button', { name: 'Voriger Monat', exact: true }).boundingBox();
      await page.getByRole('button', { name: 'Voriger Monat', exact: true }).click();
      await page.getByRole('button', { name: 'Monat: August 2026', exact: true }).waitFor();
      const after = await page.getByRole('button', { name: 'Voriger Monat', exact: true }).boundingBox();
      assert.equal(before.x, after.x);
      await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
      await page.getByRole('link', { name: 'Name fehlt', exact: true }).click();
      await page.getByRole('button', { name: 'Name ändern', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Name ändern', exact: true });
      const input = sheet.getByRole('textbox', { name: 'Name', exact: true });
      await input.waitFor(); assert.equal(await input.inputValue(), '');
      await capture('name-leer-person');
      await input.fill('André Beispiel');
      await capture('name-aendern-person');
      await sheet.getByRole('button', { name: 'Namen speichern', exact: true }).click();
      await sheet.waitFor({ state: 'detached' });
      await page.getByRole('heading', { level: 1, name: 'André Beispiel', exact: true }).waitFor();
      assert.equal(await page.getByText(/konnten? nicht geladen werden/).count(), 0);
      assert.equal(await page.evaluate(() => window.t126PageToken), 'same-document');
      await capture('person-gespeichert');
      await page.getByRole('link', { name: '← Mitarbeiter', exact: true }).click();
      await page.getByRole('tab', { name: 'Zugänge', exact: true }).click();
      const employeeRow = page.getByRole('row').filter({ hasText: 'Clara Beispiel' });
      await employeeRow.getByRole('button', { name: 'Name ändern', exact: true }).click();
      await input.waitFor(); assert.equal(await input.inputValue(), 'Clara Beispiel');
      await capture('name-vorbelegt-zugaenge');
      await page.keyboard.press('Escape');
      await sheet.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Name ändern');
      await nav('Lohnexport');
      await page.getByRole('table', { name: 'Geladene Arbeitszeiten', exact: true }).getByText('André Beispiel', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Name fehlt', exact: true }).count(), 0);
      assert.equal(await page.getByText(/Bei mindestens einer Person fehlt der Name/).count(), 0);
      await capture('lohnexport-gespeichert');
      await nav('Zeiten prüfen');
      await page.getByRole('heading', { name: 'André Beispiel · Werkstatt', exact: true }).waitFor();
      await capture('pruefung-gespeichert');
    } finally { await page.close(); }
  }
  if (artifacts) writeFileSync(join(artifacts, 'results.json'), JSON.stringify(results, null, 2));
  return results;
}
