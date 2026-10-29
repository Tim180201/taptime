import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measure } from './harness.mjs';

export async function verifyT123(browser, web, artifacts) {
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const results = [];
  for (const width of [390, 1440]) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce' });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(web.origin + '/') ? route.continue() : (errors.push('Unexpected external request'), route.abort()));
    const capture = async name => {
      await page.evaluate(() => document.fonts.ready);
      const measured = await measure(page); results.push({ width, theme, name, ...measured, errors: [...errors] });
      if (artifacts) await page.screenshot({ path: join(artifacts, `${name}-${theme}-${width}.png`), fullPage: !(await page.locator('dialog:modal').count()) });
      assert.deepEqual(measured, { geometry: [], axe: [] }); assert.deepEqual(errors, []);
    };
    try {
      await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'));
      await page.addInitScript(() => { window.layoutScenario = 't123-admin'; });
      await page.goto(web.origin + '/lohnexport?monat=2026-09');
      await page.getByText(/1 Person ohne Personalnummer/).waitFor();
      assert.equal(await page.getByRole('combobox', { name: 'Datei' }).inputValue(), '5');
      const notice = await page.getByText(/1 Person ohne Personalnummer/).boundingBox();
      const selection = await page.getByRole('combobox', { name: 'Datei' }).boundingBox();
      assert.ok(notice.y < selection.y);
      await capture('monatsuebersicht');
      await page.getByRole('button', { name: 'Lohnart pflegen', exact: true }).click();
      const wage = page.getByRole('textbox', { name: 'Lohnart für Arbeitsstunden', exact: true });
      await wage.waitFor(); await wage.fill('A');
      await page.getByRole('button', { name: 'Lohnart speichern', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '1 bis 6 Ziffern' }).waitFor();
      await capture('lohnart-fehler');
      await wage.fill('001'); await capture('lohnart');
      await page.getByRole('button', { name: 'Lohnart speichern', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.getByText('001', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Name fehlt', exact: true }).click();
      await page.getByRole('button', { name: 'Personalnummer pflegen', exact: true }).click();
      const number = page.getByRole('textbox', { name: 'Personalnummer', exact: true });
      await number.waitFor(); assert.equal(await number.inputValue(), '');
      await number.fill('0001-A'); await capture('personalnummer-person');
      await page.getByRole('button', { name: 'Personalnummer speichern', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.getByRole('link', { name: '← Mitarbeiter', exact: true }).click();
      await page.getByRole('tab', { name: 'Zugänge', exact: true }).click();
      const row = page.getByRole('row').filter({ hasText: 'Clara Beispiel' });
      await row.getByRole('button', { name: 'Personalnummer pflegen', exact: true }).click();
      await number.waitFor(); assert.equal(await number.inputValue(), '0002');
      await capture('personalnummer-zugaenge');
      await number.fill(''); await capture('personalnummer-entfernen');
      await page.getByRole('button', { name: 'Personalnummer speichern', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await row.getByRole('button', { name: 'Personalnummer pflegen', exact: true }).click();
      await number.waitFor(); assert.equal(await number.inputValue(), '');
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Personalnummer pflegen');
    } finally { await page.close(); }
  }
  if (artifacts) writeFileSync(join(artifacts, 'results.json'), JSON.stringify(results, null, 2));
  return results;
}
