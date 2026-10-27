import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measure } from './harness.mjs';

const customer='40000000-0000-4000-8000-000000000001';
export async function verifyT138(browser,web,artifacts) {
  if(artifacts)mkdirSync(artifacts,{recursive:true});
  const results=[];
  try {
    for(const width of [390,1440])for(const theme of ['light','dark']) {
      const page=await browser.newPage({viewport:{width,height:844},colorScheme:theme,reducedMotion:'reduce'});
      page.setDefaultTimeout(7000);
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>route.request().url().startsWith(web.origin+'/')?route.continue():route.abort());
      await page.addInitScript(()=>{window.layoutCspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.layoutCspViolations.push(e.violatedDirective));});
      const go=async path=>{await page.goto('about:blank');await page.goto(web.origin+path);};
      const capture=async name=>{
        await page.evaluate(()=>document.fonts.ready);
        const measured=await measure(page);
        results.push({name,width,theme,...measured,errors:[...errors,...await page.evaluate(()=>window.layoutCspViolations)]});
        if(artifacts)await page.screenshot({path:join(artifacts,`${name}-${theme}-${width}.png`),fullPage:!(await page.locator('dialog:modal').count())});
        assert.deepEqual(results.at(-1),{name,width,theme,geometry:[],axe:[],errors:[]});
      };
      const safeDialog=async(trigger,confirmLabel,name)=>{
        await trigger.scrollIntoViewIfNeeded();
        if(!await trigger.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}))
          await trigger.evaluate(el=>el.scrollIntoView({block:'center'}));
        const box=await trigger.boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
        await page.mouse.click(point.x,point.y);
        const dialog=page.getByRole('alertdialog'),confirm=dialog.getByRole('button',{name:confirmLabel,exact:true});
        await confirm.waitFor();
        const cancel=dialog.getByRole('button',{name:'Abbrechen',exact:true});
        assert.equal(await cancel.evaluate(el=>el===document.activeElement),true,'Cancellation receives initial focus');
        assert.equal(await confirm.getAttribute('autofocus'),null);
        const end=await confirm.boundingBox();
        assert.ok(!(point.x>=end.x&&point.x<=end.x+end.width&&point.y>=end.y&&point.y<=end.y+end.height),'Confirmation must not cover opening tap');
        await page.mouse.click(point.x,point.y);
        assert.equal(await dialog.count(),1,'Repeated tap cannot confirm');
        assert.equal(await page.evaluate(()=>window.t138Mutations??0),0);
        await capture(name);
        await page.keyboard.press('Escape');
        await dialog.waitFor({state:'detached'});
        assert.equal(await trigger.evaluate(el=>el===document.activeElement),true,'Focus returns to trigger');
      };
      try {
        await page.clock.setFixedTime(new Date('2026-10-27T12:00:00Z'));
        await page.goto(`${web.origin}/kunden?monat=2026-09&kunde=${customer}#t138`);
        const deleteButton=page.getByRole('button',{name:'Kunde löschen',exact:true});
        await deleteButton.waitFor();
        const separation=await deleteButton.evaluate(el=>{
          const rows=document.querySelector('table[aria-label="Stunden je Person"]');
          return rows?el.getBoundingClientRect().top-rows.getBoundingClientRect().bottom:0;
        });
        assert.ok(separation>=24,`Delete follows the customer content with space: ${separation}`);
        await capture('kunde');
        await safeDialog(deleteButton,'Löschen bestätigen','kunde-loeschen');
        await page.getByRole('button',{name:/Tage von Alex Beispiel/}).click();
        await page.getByRole('heading',{name:'Alex Beispiel · Werkstatt am Park · September 2026',exact:true}).waitFor();
        await page.getByRole('row',{name:'23.09.2026, 24:00 Stunden, läuft',exact:true}).waitFor();
        await capture('person-tage');
        await page.getByRole('button',{name:'Nächster Monat',exact:true}).click();
        await page.getByText('In diesem Monat noch keine Stunden.',{exact:true}).waitFor();
        assert.ok(page.url().includes('person=70000000-0000-4000-8000-000000000001'));
        await capture('person-leerer-monat');
        await page.getByRole('button',{name:'Zurück zum Kunden',exact:true}).click();
        await deleteButton.waitFor();
        assert.ok(!page.url().includes('person='));
        // The existing fixtures exercise all other destructive call sites.
        await go('/einrichtung#t127-admin');
        await page.getByRole('tab',{name:'Kunden und Projekte',exact:true}).click();
        await safeDialog(page.getByRole('button',{name:'Projekt löschen',exact:true}),'Projekt löschen','projekt-loeschen');
        await go('/einrichtung#tag-removal');
        await page.getByRole('tab',{name:'Karten',exact:true}).click();
        await safeDialog(page.getByRole('button',{name:/^Karte .+ entfernen$/}).first(),'Entfernen bestätigen','karte-entfernen');
        await go('/beschaeftigte#t127-admin');
        await page.getByRole('tab',{name:'Zugänge',exact:true}).click();
        await safeDialog(page.getByRole('button',{name:'Zugang entziehen',exact:true}).first(),'Zugang entziehen','zugang-entziehen');
        await go('/meine-zeiten?monat=2026-09#employee-void');
        await safeDialog(page.getByRole('button',{name:'Zeit löschen',exact:true}),'Löschen','zeit-loeschen');
      } finally {await page.close();}
    }
  } finally {if(artifacts)writeFileSync(join(artifacts,'results.json'),JSON.stringify(results,null,2));}
}
