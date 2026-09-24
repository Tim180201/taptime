import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, after, test } from 'node:test';
import { launchBrowser, buildWeb, measure } from './harness.mjs';
import { adminScenarios, operatorScenarios } from './scenarios.mjs';
const apps = { 'admin-web': adminScenarios, 'operator-web': operatorScenarios };
const artifacts = process.env.TAPTIME_LAYOUT_ARTIFACTS;
const results = [];
let browser;
const webs = {};
before(async () => {
  for (const app of Object.keys(apps)) webs[app] = await buildWeb(app, true);
  // Build the genuine entries as well: configuration/storage fallbacks and fixture exclusion.
  for (const app of Object.keys(apps)) webs[app+'-configuration'] = await buildWeb(app);
  webs['operator-web-storage-error'] = await buildWeb('operator-web', false, true);
  browser = await launchBrowser();
});
after(async () => {
  if (artifacts) { mkdirSync(artifacts,{recursive:true}); writeFileSync(join(artifacts,'results.json'),JSON.stringify(results,null,2)); }
  await browser?.close();
  for (const web of Object.values(webs)) await web.close();
});
for (const [app, scenarios] of Object.entries(apps)) for (const [width,height] of [[360,900],[390,900],[768,900],[1440,900],[768,390]]) for (const s of scenarios) {
  if (s.mobileOnly && width >= 1024) continue;
  if (process.env.TAPTIME_LAYOUT_SOURCE && s.mobileOnly) continue;
  if (process.env.TAPTIME_LAYOUT_FILTER && !`${app}/${s.id}/${width}`.includes(process.env.TAPTIME_LAYOUT_FILTER)) continue;
  test(`${app}/${s.id}/${width}x${height}`, async () => {
    const page = await browser.newPage({ viewport: {width,height} });
    page.setDefaultTimeout(5000);
    const errors = [];
    const web = webs[s.production ? app+'-'+s.id : app];
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('**/*', route => {
      if (route.request().url().startsWith(web.origin+'/')) return route.continue();
      errors.push('Unexpected external request'); return route.abort();
    });
    try {
      await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'));
      await page.addInitScript(variant => {
        window.layoutScenario = variant; window.layoutCspViolations = [];
        document.addEventListener('securitypolicyviolation', event => window.layoutCspViolations.push(event.violatedDirective));
      },s.variant);
      if (s.id === 'storage-error') await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new DOMException('Synthetic storage policy', 'SecurityError'); };
      });
      await page.goto(web.origin+s.path);
      await page.locator(s.wait).first().waitFor();
      for (const step of s.steps) await step(page);
      await page.evaluate(()=>document.fonts.ready);
      // All lazy chunks and React updates settle before measuring or capturing.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      errors.push(...await page.evaluate(() => window.layoutCspViolations));
      const markup = await page.locator('style,[style],script:not([src])').count();
      const measured = await measure(page);
      if (artifacts && [360,390,1440].includes(width) && height === 900) {
        mkdirSync(artifacts,{recursive:true});
        await page.screenshot({path:join(artifacts,`${app}-${s.id}-${width}.png`),fullPage:!(await page.locator('dialog:modal,.overlay').count())});
      }
      const result = { app,scenario:s.id,width,height,...measured,errors,inlineMarkup:markup };
      results.push(result);
      if (process.env.TAPTIME_LAYOUT_INVENTORY !== '1') assert.deepEqual({ ...measured, errors, inlineMarkup: markup }, { geometry:[],axe:[],errors:[],inlineMarkup:0 });
    } finally { await page.close(); }
  });
}
// Interaction checks use the same built fixture: opening UI must not create new authority.
test('mobile navigation, sheet focus, Escape, and responsive resize', { skip: !!process.env.TAPTIME_LAYOUT_SOURCE }, async () => {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(5000);
  try {
    for (const [variant, path, direct, remaining] of [
      ['overview','/uebersicht',4,3], ['five-areas','/uebersicht',5,0],
      ['employee-calendar','/meine-zeiten?monat=2026-09',2,0], ['manager','/beschaeftigte',4,0],
    ]) {
      await page.goto('about:blank');
      await page.goto(webs['admin-web'].origin+path+'#'+variant);
      const nav = page.locator('.mobile-navigation');
      await nav.waitFor();
      assert.equal(await nav.getByRole('link').count(), direct);
      const more = page.getByRole('button',{name:'Mehr',exact:true});
      await more.click();
      const sheet = page.getByRole('dialog',{name:'Mehr',exact:true});
      await sheet.waitFor();
      assert.equal(await sheet.getByRole('link').count(),remaining);
      assert.equal(await sheet.getByRole('button',{name:'Abmelden',exact:true}).isVisible(),true);
      assert.match(await sheet.innerText(),/Europe\/Berlin/);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await sheet.evaluate(el=>el.contains(document.activeElement)),true);
      await page.keyboard.press('Escape');
      assert.equal(await sheet.count(),0);
      assert.equal(await more.evaluate(el=>el===document.activeElement),true);
    }
    await page.goto(webs['admin-web'].origin+'/beschaeftigte#employees');
    await page.getByRole('button',{name:'Mitarbeiter hinzufügen',exact:true}).click();
    const invitation = page.getByRole('dialog');
    await page.getByLabel('Name',{exact:true}).fill('Unverändert Beispiel');
    await page.setViewportSize({width:1440,height:900});
    assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Unverändert Beispiel');
    await page.setViewportSize({width:390,height:400});
    assert.deepEqual((await measure(page)).geometry,[]);
    await page.keyboard.press('Escape');
    assert.equal(await invitation.count(),0);
    assert.equal(await page.getByRole('button',{name:'Mitarbeiter hinzufügen',exact:true}).evaluate(el=>el===document.activeElement),true);
  } finally {await page.close();}
});
