import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildWeb, launchBrowser, measure } from './harness.mjs';

export async function verifyT122c(browser, web, artifacts) {
  const results = [];
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const photo = async (page, name) => { if (artifacts) await page.screenshot({ path: join(artifacts, `${name}.png`) }); };
  async function open(path, width, theme = 'automatic', system = 'light', now = '2026-10-15T12:00:00Z') {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: system, locale: 'de-DE', reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const errors = [], diagnostics = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
    await page.route('**/*', route => route.request().url().startsWith(web.origin + '/') ? route.continue() : (errors.push('Unexpected external request'), route.abort()));
    await page.addInitScript(theme => {
      if (theme === 'automatic') localStorage.removeItem('taptime-theme'); else localStorage.setItem('taptime-theme', theme);
      window.t122cCsp = [];
      document.addEventListener('securitypolicyviolation', event => window.t122cCsp.push(event.violatedDirective));
    }, theme);
    await page.clock.setFixedTime(new Date(now));
    await page.goto(web.origin + path);
    return { page, errors, diagnostics };
  }
  async function check(page, name, errors) {
    await page.evaluate(() => document.fonts.ready);
    const measured = await measure(page);
    const csp = await page.evaluate(() => window.t122cCsp);
    results.push({ name, ...measured, errors: [...errors, ...csp] });
    assert.deepEqual({ ...measured, errors: [...errors, ...csp] }, { geometry: [], axe: [], errors: [] }, name);
  }
  try {
    for (const width of [1024, 1440]) {
      let reference;
      for (const theme of ['light', 'dark', 'automatic']) for (const system of ['light', 'dark']) {
        const { page, errors } = await open('/beschaeftigte#t122c-long', width, theme, system);
        const name = `shell-${theme}-system-${system}-${width}`;
        try {
          await page.locator('.employees-view table').first().waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.equal(await page.locator('.sidebar .brand,.sidebar-account,.sidebar-signout').count(), 0);
          const boxes = await page.locator('.top-band,.top-band .brand-mark,.band-organization,.band-account,.top-band button').evaluateAll(nodes => nodes.map(node => {
            const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
          }));
          assert.equal(boxes[0].height, 56);
          reference ??= boxes;
          for (let i = 0; i < boxes.length; i++) for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(boxes[i][key] - reference[i][key]) <= 1, `${name}/${i}/${key}`);
          for (const selector of ['.band-organization', '.band-account']) assert.equal(await page.locator(selector).evaluate(el => el.title === el.textContent && getComputedStyle(el).textOverflow === 'ellipsis'), true);
          assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollPaddingTop), '56px');
          await check(page, name, errors);
          if (width === 1440 && theme !== 'automatic' && theme === system) await photo(page, `header-${theme}-1440-top`);
          await page.evaluate(() => window.scrollTo(0, 800));
          await page.waitForFunction(() => window.scrollY >= 800);
          assert.deepEqual(await page.evaluate(() => {
            const band = document.querySelector('.top-band'), sidebar = document.querySelector('.sidebar');
            const b = band.getBoundingClientRect(), s = sidebar.getBoundingClientRect();
            return { top: b.top, gap: Math.abs(s.top - b.bottom) <= .5,
              points: [1, .2, .5, .8, innerWidth - 2].map(x => band.contains(document.elementFromPoint(x < 1 ? innerWidth * x : x, 28))),
              below: sidebar.contains(document.elementFromPoint(10, b.bottom + 4)) };
          }), { top: 0, gap: true, points: [true, true, true, true, true], below: true });
          if (width === 1440 && theme !== 'automatic' && theme === system) await photo(page, `header-${theme}-1440-scrolled`);
          await page.getByRole('button', { name: '+ Mitarbeiter einladen', exact: true }).click();
          await page.getByRole('dialog').waitFor();
          assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.elementFromPoint(innerWidth - 20, 28))), true);
          await page.keyboard.press('Escape');
          await page.emulateMedia({ media: 'print' });
          assert.equal(await page.locator('.top-band').isVisible(), false);
          assert.equal(await page.locator('.organization-eyebrow').isVisible(), true);
        } finally { await page.close(); }
      }
    }
    const person = '/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09#person';
    const cases = [
      ['employees', '/beschaeftigte#employees', '.employees-view table'],
      ['customers', '/kunden#customers-admin', '.customers-view table'],
      ['customer-detail', '/kunden?kunde=40000000-0000-4000-8000-000000000001#customers-admin', '[aria-label="Kundendetails"]'],
      ['person', person, '.calendar-grid'],
      ['own-time', '/meine-zeiten?monat=2026-09#t122c-own', '.calendar-grid'],
      ['payroll', '/lohnexport#payroll', '.table-scroll'],
      ['reviews', '/pruefungen#reviews', '.review-case', async p => p.getByRole('button', { name: 'Zeit ändern', exact: true }).click()],
    ];
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) for (const font of [100, 200]) {
      for (const [name, path, wait, prepare] of cases) {
        const { page, errors } = await open(path, width, theme, theme);
        try {
          await page.locator(wait).first().waitFor();
          if (prepare) await prepare(page);
          if (name === 'reviews') await page.getByRole('button', { name: 'Monat der Arbeitszeit: Juli 2026', exact: true }).waitFor();
          assert.equal(await page.locator('input[type="month"],select.month-select').count(), 0);
          if (font === 200) await page.evaluate(() => {
            const nodes = [...document.querySelectorAll('html,body *')].filter(e => e instanceof HTMLElement);
            const sizes = nodes.map(e => parseFloat(getComputedStyle(e).fontSize));
            nodes.forEach((e, i) => e.style.fontSize = `${sizes[i] * 2}px`);
          });
          await check(page, `${name}-${theme}-${width}-${font}`, errors);
          if (font === 100 && name === 'employees') await photo(page, `header-${theme}-${width}-normal`);
          const trigger = page.getByRole('button', { name: /^(Monat|Monat der Arbeitszeit): / });
          const label = await trigger.innerText();
          await trigger.click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          assert.equal(await dialog.locator('button[aria-pressed="true"]').evaluate(el => document.activeElement === el), true);
          assert.equal(await dialog.locator('.month-grid button').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth)), true);
          await check(page, `${name}-picker-${theme}-${width}-${font}`, errors);
          if(name==='payroll'&&font===200)await photo(page, `month-overview-${theme}-${width}-200`);
          await page.keyboard.press('Escape');
          assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
          assert.equal(await trigger.innerText(),label);
        } catch (error) {
          // Report context even for an assertion before the normal screenshot.
          await photo(page, `failure-${name}-${theme}-${width}-${font}`);
          throw error;
        } finally { await page.close(); }
      }
    }
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      const { page, errors } = await open('/lohnexport#t122c-month-race', width, theme, theme);
      try {
        const trigger = page.getByRole('button', { name: 'Monat: September 2026', exact: true });
        await trigger.waitFor();
        await page.getByRole('cell', { name: /Arbeitszeit 2026-09$/ }).waitFor();
        assert.match(await page.locator('.page-subtitle').innerText(), /September 2026 · abgeschlossen/);
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'Monat wählen' });
        assert.equal(await dialog.getByRole('button', { name: 'September 2026', exact: true }).evaluate(el => el === document.activeElement), true);
        assert.equal(await dialog.getByRole('button', { name: 'November 2026', exact: true }).isDisabled(), true);
        assert.equal(await dialog.getByRole('button', { name: 'Oktober 2026 · läuft noch', exact: true }).isEnabled(), true);
        await check(page, `month-overview-${theme}-${width}`, errors);
        await photo(page, `month-overview-${theme}-${width}`);
        if (width === 390) assert.ok(Math.abs((await dialog.boundingBox()).y + (await dialog.boundingBox()).height - 900) <= 1);
        await page.keyboard.press('Escape');
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
        await trigger.click();
        await page.mouse.click(2, 2);
        assert.equal(await dialog.count(), 0);
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
        // Separate browser clicks start overlapping real coordinator reads.
        for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Voriger Monat', exact: true }).click({ delay: 0 });
        await page.getByRole('cell', { name: /Arbeitszeit 2026-04$/ }).waitFor();
        await page.waitForFunction(() => window.t122cReads.every(read => read.finished));
        assert.equal(new URL(page.url()).searchParams.get('monat'), '2026-04');
        assert.match(await page.locator('.page-subtitle').innerText(), /April 2026 · abgeschlossen/);
        assert.equal(await page.getByRole('cell', { name: /Arbeitszeit 2026-04$/ }).count(), 1);
        const reads = await page.evaluate(() => window.t122cReads.map(read => read.month));
        for (const month of ['2026-08', '2026-07', '2026-06', '2026-05', '2026-04']) assert.ok(reads.includes(month));
        await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get('monat'), '2026-05');
        await check(page, `month-race-${theme}-${width}`, errors);
      } finally { await page.close(); }
    }
    for (const [path, expected] of [
      ['/lohnexport?monat=2026-10#payroll', 'Oktober 2026'],
      ['/lohnexport?monat=0002-10#payroll', 'September 2026'],
      ['/beschaeftigte?monat=2020-07#employees', 'Juli 2020'],
      ['/kunden?monat=2020-07#customers-admin', 'Juli 2020'],
    ]) {
      const { page, errors } = await open(path, 1440);
      try {
        await page.getByRole('button', { name: `Monat: ${expected}`, exact: true }).waitFor();
        if (expected === 'Oktober 2026') {
          assert.equal(await page.getByRole('button', { name: 'Nächster Monat', exact: true }).isDisabled(), true);
          assert.match(await page.locator('.page-subtitle').innerText(), /läuft noch/);
        }
        await check(page, `linked-${path}`, errors);
      } finally { await page.close(); }
    }
    {
      const { page, errors } = await open('/meine-zeiten#t122c-own', 390, 'dark', 'dark', '2026-09-23T12:00:00Z');
      try {
        await page.getByRole('button', { name: 'Monat: September 2026', exact: true }).click();
        const dialog = page.getByRole('dialog');
        assert.equal(await dialog.getByRole('button', { name: 'Juli 2026', exact: true }).isDisabled(), true);
        assert.equal(await dialog.getByRole('button', { name: 'August 2026', exact: true }).isEnabled(), true);
        assert.equal(await dialog.getByRole('button', { name: 'September 2026 · läuft noch', exact: true }).isEnabled(), true);
        assert.equal(await dialog.getByRole('button', { name: 'Oktober 2026', exact: true }).isDisabled(), true);
        await dialog.getByRole('button', { name: 'August 2026', exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get('monat'), '2026-08');
        assert.equal(await page.getByRole('button', { name: 'Voriger Monat', exact: true }).isDisabled(), true);
        await check(page, 'own-time-server-window', errors);
      } finally { await page.close(); }
    }
    {
      const { page, errors } = await open('/pruefungen#t122c-old-review', 390);
      try {
        await page.getByRole('button', { name: 'Zeit ändern', exact: true }).click();
        await page.getByRole('button', { name: 'Monat der Arbeitszeit: Juli 2020', exact: true }).click();
        const dialog = page.getByRole('dialog');
        assert.equal(await dialog.getByRole('button', { name: 'Juli 2020', exact: true }).count(), 0);
        assert.equal(await dialog.getByRole('button', { name: 'Oktober 2024', exact: true }).evaluate(el => document.activeElement === el), true);
        await check(page, 'old-review-month-not-offered', errors);
      } finally { await page.close(); }
    }
    const { page, errors, diagnostics } = await open('/lohnexport#t122c-render-error', 1440);
    try {
      await page.getByRole('heading', { name: 'Diese Seite konnte nicht angezeigt werden.', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Neu laden', exact: true }).isEnabled(), true);
      assert.equal(await page.locator('.top-band').isVisible(), true);
      assert.ok(diagnostics.some(message => message.includes('Administration render failed')));
      await photo(page, 'render-error-contained');
      await page.locator('.sidebar').getByRole('link', { name: 'Mitarbeiter', exact: true }).click();
      await page.locator('.employees-view').waitFor();
      assert.equal(await page.getByText('Diese Seite konnte nicht angezeigt werden.', { exact: true }).count(), 0);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  } finally {
    if (artifacts) writeFileSync(join(artifacts, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const web = await buildWeb('admin-web', true), browser = await launchBrowser();
  try { await verifyT122c(browser, web, resolve('.t122c-review/screenshots')); console.log('T-122c browser checks passed'); }
  finally { await browser.close(); await web.close(); }
}
