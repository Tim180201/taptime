import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measure } from './harness.mjs';
const former = '70000000-0000-4000-8000-000000000003';
const deleted = '40000000-0000-4000-8000-000000000002';
export async function verifyT127b(browser, web, artifacts) {
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const results = [];
  try {
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (const role of ['admin', 'manager']) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, colorScheme: theme, reducedMotion: 'reduce' });
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url().startsWith(web.origin + '/') ? route.continue() : (errors.push('Unexpected external request'), route.abort()));
      const capture = async name => {
        await page.evaluate(() => document.fonts.ready);
        const measured = await measure(page);
        const csp = await page.evaluate(() => window.layoutCspViolations);
        const result = { width, theme, role, name, ...measured, errors: [...errors, ...csp] }; results.push(result);
        if (artifacts) await page.screenshot({ path: join(artifacts, `${name}-${role}-${theme}-${width}.png`), fullPage: !(await page.locator('dialog:modal').count()) });
        assert.deepEqual(measured, { geometry: [], axe: [] }, `${name}/${role}/${theme}/${width}`);
        assert.deepEqual(result.errors, []);
      };
      const go = path => page.goto(web.origin + path);
      try {
        await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
        await page.addInitScript(role => {
          window.layoutScenario = `t127-${role}`; window.layoutCspViolations = [];
          document.addEventListener('securitypolicyviolation', event => window.layoutCspViolations.push(event.violatedDirective));
        }, role);
        await go('/archiv');
        const people = page.getByRole('table', { name: 'Ehemalige Mitarbeiter', exact: true });
        await people.getByText('Erika Ehemalig', { exact: true }).waitFor();
        assert.deepEqual(await people.getByRole('row').filter({ hasText: 'Erika Ehemalig' }).getByRole('cell').evaluateAll(cells => cells.map(cell => cell.dataset.label)),
          ['Person', 'Standort', 'Ausgeschieden', 'Letzte Zeit', 'Zeiten']);
        assert.equal(await page.locator('.primary-action').count(), 0);
        if (role === 'manager') assert.equal(await people.getByText('Frieda Süd', { exact: true }).count(), 0);
        await capture('archiv-mitarbeiter');
        if (role === 'admin') {
          await page.getByRole('button', { name: 'Weitere laden', exact: true }).click();
          await people.getByText('Zara Ohne Zeiten', { exact: true }).waitFor();
          await capture('archiv-weitere');
        }
        await page.getByLabel('Suchen', { exact: true }).fill('Erika');
        await page.getByText('1 Treffer', { exact: true }).waitFor();
        await capture('archiv-mitarbeiter-suche');
        await page.getByLabel('Suchen', { exact: true }).fill('Nichtvorhanden');
        await page.getByText('Keine Treffer für „Nichtvorhanden“', { exact: true }).waitFor();
        await capture('archiv-keine-treffer');
        await page.getByRole('button', { name: 'Suche löschen', exact: true }).click();
        await people.getByText('Erika Ehemalig', { exact: true }).waitFor();
        await people.getByRole('row').filter({ hasText: 'Erika Ehemalig' }).getByRole('link', { name: 'Zeiten ansehen ›' }).click();
        await page.getByText('Diese Zeiten können nur noch angesehen werden.', { exact: true }).waitFor();
        assert.ok(page.url().includes('monat=2026-07'));
        for (const name of ['Zeit hinzufügen', 'Ändern', 'Zeit löschen', 'Einladung erneut senden', 'Kunden und Projekte zuordnen']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0);
        await page.getByRole('button', { name: /^20\.07\.2026,/ }).click();
        await capture('person-nur-lesend');
        await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
        await page.getByRole('button', { name: 'Monat: August 2026', exact: true }).waitFor();
        await page.getByText('Diese Zeiten können nur noch angesehen werden.', { exact: true }).waitFor();
        await capture('person-anderer-monat');
        await go('/archiv?bereich=ziele');
        const targets = page.getByRole('table', { name: 'Gelöschte Kunden und Projekte', exact: true });
        await targets.getByText('Projekt Sommer', { exact: true }).waitFor();
        assert.equal(await targets.getByRole('link').count(), 1);
        await capture('archiv-ziele');
        await page.getByLabel('Suchen', { exact: true }).fill('Werkstatt');
        await page.getByText('1 Treffer', { exact: true }).waitFor();
        await capture('archiv-ziele-suche');
        await targets.getByRole('link', { name: 'Zeiten ansehen ›' }).click();
        assert.ok(page.url().includes(`kunde=${deleted}`) && page.url().includes('monat=2026-07'));
        await page.getByText('ehemalig', { exact: true }).waitFor();
        await capture('kundendetail-markierungen');
        assert.equal(await page.getByRole('button', { name: 'Kunde löschen', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Ändern', exact: true }).count(), 0);
        await go('/kunden?monat=2026-07');
        await page.getByRole('heading', { name: 'Gelöschte Kunden · Zeiten in diesem Monat', exact: true }).waitFor();
        assert.equal(await page.getByRole('table', { name: 'Kunden', exact: true }).getByText('Alte Werkstatt').count(), 0);
        await capture('kunden-geloeschte');
        await go('/uebersicht');
        const live = page.getByRole('table', { name: 'Laufende Zeiten', exact: true });
        await live.getByText('Clara Aktiv', { exact: true }).waitFor();
        assert.equal(await live.getByText('Erika Ehemalig', { exact: true }).count(), 0);
        assert.ok(await page.evaluate(() => window.t127Requests.some(r => r.path === '/v2/administration/managed-active-summary' && r.body.isRunning === true)));
        await capture('uebersicht-aktive');
        await go('/beschaeftigte?monat=2026-07');
        await page.getByRole('heading', { name: 'Ehemalige · Zeiten in diesem Monat', exact: true }).waitFor();
        await capture('mitarbeiter-monat');
        await page.getByRole('tab', { name: 'Zugänge', exact: true }).click();
        const access = page.getByRole('table', { name: 'Zugänge', exact: true });
        await access.getByText('Clara Aktiv', { exact: true }).waitFor();
        assert.equal(await page.getByRole('group', { name: 'Zugangsfilter' }).count(), 0);
        assert.equal(await access.getByText('Erika Ehemalig', { exact: true }).count(), 0);
        await capture('zugaenge-ohne-filter');
        await access.getByRole('row').filter({ hasText: 'Clara Aktiv' }).getByRole('button', { name: 'Zugang entziehen', exact: true }).click();
        const confirm = page.getByRole('alertdialog');
        await confirm.getByText('Danach steht Clara Aktiv im Archiv. Die Zeiten bleiben im Lohnexport und bei den Kundenzeiten. Das lässt sich nicht rückgängig machen.', { exact: true }).waitFor();
        await confirm.getByRole('button', { name: 'Zugang entziehen', exact: true }).waitFor();
        await capture('entzug-rueckfrage');
        await confirm.getByRole('button', { name: 'Abbrechen', exact: true }).click();
        await go('/pruefungen');
        await page.getByText('ehemalig', { exact: true }).waitFor();
        await page.getByText('gelöscht', { exact: true }).waitFor();
        await capture('pruefungen-markierungen');
        if (role === 'admin') {
          await go('/lohnexport?monat=2026-07');
          await page.getByText('ehemalig', { exact: true }).waitFor();
          await page.getByText('gelöscht', { exact: true }).waitFor();
          await capture('lohnexport-markierungen');
        }
        await go('/einrichtung');
        await page.getByRole('tab', { name: 'Kunden und Projekte', exact: true }).click();
        await page.getByText('Projekt Herbst', { exact: true }).waitFor();
        assert.equal(await page.getByRole('table', { name: 'Kunden und Projekte', exact: true }).getByText('Projekt Sommer').count(), 0);
        await capture('einrichtung-aktive-projekte');
        await page.getByRole('button', { name: 'Projekt löschen', exact: true }).click();
        await page.getByRole('alertdialog').waitFor();
        await capture('projekt-loeschen-rueckfrage');
        await page.keyboard.press('Escape');
        await page.addInitScript(role => { window.layoutScenario = `t127-${role}-empty`; }, role);
        await go('/archiv');
        await page.getByText('Noch niemand im Archiv.', { exact: true }).waitFor();
        await capture('archiv-mitarbeiter-leer');
        await page.getByRole('tab', { name: 'Gelöschte Kunden und Projekte', exact: true }).click();
        await page.getByText('Noch nichts gelöscht.', { exact: true }).waitFor();
        await capture('archiv-ziele-leer');
      } finally { await page.close(); }
      console.log(`T127b ${role} ${theme} ${width}px complete`);
    }
  } finally { if (artifacts) writeFileSync(join(artifacts, 'results.json'), JSON.stringify(results, null, 2)); }
  return results;
}
