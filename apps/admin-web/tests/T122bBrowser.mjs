import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {build} from 'vite';
import {buildWeb,launchBrowser} from '../../../scripts/browser/harness.mjs';
import {measure} from '../../../scripts/browser/harness.mjs';
const screenshots=resolve('.t122b-review/screenshots');mkdirSync(screenshots,{recursive:true});
const click=name=>p=>p.getByRole('button',{name,exact:true}).first().click();
const tab=name=>p=>p.getByRole('tab',{name,exact:true}).click();
const person='/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09';
const scenarios=[
 ['uebersicht','/uebersicht#overview','.metric-grid',0],
 ['kunden','/kunden#quota-warning','.customers-view table',1],
 ['kunde-detail','/kunden?kunde=40000000-0000-4000-8000-000000000001#quota-warning','[aria-label="Kundendetails"]',0],
 ['kunde-umbenennen','/kunden?kunde=40000000-0000-4000-8000-000000000001#quota-warning','[aria-label="Kundendetails"]',1,click('Kunde umbenennen')],
 ['kunde-loeschen','/kunden?kunde=40000000-0000-4000-8000-000000000001#quota-warning','[aria-label="Kundendetails"]',1,click('Kunde löschen')],
 ['kunde-anlegen','/kunden#customers-admin','.customers-view table',1,click('+ Kunde anlegen')],
 ['manuell','/manuell#t118-manual','.manual-steps',1,click('Zugeordnetes Projekt mit ausführlichem lesbarem Namen')],
 ['manuell-laeuft','/manuell#time-stop','.manual-steps',1],
 ['standorte','/einrichtung#setup-locations','.setup-tabs',1],
 ['standort-anlegen','/einrichtung#setup-locations','.setup-tabs',1,click('+ Standort')],
 ['standorte-mitarbeiter','/einrichtung#setup-locations','.setup-tabs',0,tab('Mitarbeiter')],
 ['kunden-projekte','/einrichtung#setup-targets-locations','.setup-tabs',1,tab('Kunden und Projekte')],
 ['projekt-anlegen','/einrichtung#setup-targets-locations','.setup-tabs',1,async p=>{await tab('Kunden und Projekte')(p);await click('+ Projekt')(p);}],
 ['karten','/einrichtung#setup-tags','.setup-tabs',0,tab('Karten')],
 ['karte-zuordnen','/einrichtung#setup-tags','.setup-tabs',0,async p=>{await tab('Karten')(p);await click('Zuordnung für Eingang ändern')(p);}],
 ['mitarbeiter','/beschaeftigte#employees','.employees-view',1],
 ['person',person+'#person','.calendar-grid',1],
 ['person-zeit-hinzufuegen',person+'#person','.calendar-grid',1,click('Zeit hinzufügen')],
 ['person-zeit-aendern',person+'#person','.calendar-grid',1,click('Ändern')],
 ['person-zeit-loeschen',person+'#person','.calendar-grid',1,click('Zeit löschen')],
 ['mitarbeiter-zugaenge','/beschaeftigte#employees','.employees-view',1,p=>p.getByRole('tab',{name:'Zugänge'}).click()],
 ['hilfe','/uebersicht#overview','.metric-grid',0,async p=>{if(await p.getByRole('button',{name:'Mehr',exact:true}).isVisible())await click('Mehr')(p);await click('So funktioniert Taptura')(p);}],
 ['zeiten-pruefen','/pruefungen#reviews','.review-case',0],
 ['pruefung-unbekannt','/pruefungen#reviews-human','.review-case table',0],
 ['pruefung-so-lassen','/pruefungen#reviews','.review-case',1,click('So lassen')],
 ['pruefung-zeit-aendern','/pruefungen#reviews','.review-case',1,click('Zeit ändern')],
 ['pruefung-ende','/pruefungen#reviews','.review-case',1,click('Ende nachtragen')],
 ['meine-zeiten','/meine-zeiten?monat=2026-09#employee-calendar','.calendar-grid',1],
 ['lohnexport','/lohnexport#payroll','.table-scroll',1],
 ['anmelden','/#login','.login-card',1],
 ['einladung','/willkommen#welcome','form',1],
 ['passwort-neu','/passwort-neu#password-reset','form',1],
];
const operatorScenarios=[['betreiber-anlegen','/#overview','table',1,click('Betrieb anlegen')],['betreiber-paket','/#overview','table',1,click('Paket ändern')],['betreiber-anmelden','/#login','.auth',1],['betreiber-fehler','/#error','.error',1],['betreiber-mfa','/#mfa-existing','.auth',1],['betreiber','/#overview','table',1],['betreiber-protokoll','/protokoll#audit','.log',0],['betreiber-zustand','/betriebszustand#health','dl',0]];
const admin=await buildWeb('admin-web',true),operator=await buildWeb('operator-web',true),browser=await launchBrowser();
const output=mkdtempSync(join(tmpdir(),'t122-landing-'));
await build({root:resolve('apps/landing-web'),envDir:false,logLevel:'warn',build:{outDir:output,emptyOutDir:true}});
const csp=readFileSync('infrastructure/caddy/Caddyfile','utf8').split('(landing_headers)')[1].match(/Content-Security-Policy "([^"]+)"/)[1];
const landing=createServer((req,res)=>{
 let path=new URL(req.url,'http://local').pathname;if(path==='/')path='/index.html';if(path==='/app'||path==='/tag')path+='.html';
 const file=join(output,path);if(!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Security-Policy',csp);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'})[extname(file)]??'text/plain');res.end(readFileSync(file));
});await new Promise(done=>landing.listen(0,'127.0.0.1',done));const landingOrigin=`http://127.0.0.1:${landing.address().port}`;
const results=[],smoke=process.env.T122B_SMOKE==='1';
try{
 // Exercise the real CSS media fallback, explicit preference, reload and storage failure.
 const p=await browser.newPage({colorScheme:'light'});await p.addInitScript(()=>{window.layoutScenario='login';});await p.goto(admin.origin+'/#login');
 await p.getByRole('button',{name:'Automatisch',exact:true}).waitFor();
 assert.equal(await p.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),'light');
 await p.emulateMedia({colorScheme:'dark'});assert.equal(await p.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),'dark');
 await p.getByRole('button',{name:'Hell',exact:true}).click();await p.reload();
 await p.getByRole('button',{name:'Hell',exact:true}).waitFor();assert.equal(await p.locator('html').getAttribute('data-theme'),'light');
 await p.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('storage unavailable');};});
 await p.getByRole('button',{name:'Dunkel',exact:true}).click();assert.equal(await p.locator('html').getAttribute('data-theme'),null);await p.close();
 for(const width of smoke?[390]:[390,1440])for(const font of smoke?[100]:[100,200])for(const theme of ['dark','light']){
  for(const [app,origin,cases] of [['admin',admin.origin,scenarios],['operator',operator.origin,operatorScenarios],['landing',landingOrigin,[['startseite','/','footer',1],['app-download','/app','main',0],['karte-info','/tag','main',0]]]])for(const [name,path,wait,expected,steps]of cases){
   if(process.env.T122B_CASES&&!process.env.T122B_CASES.split(',').includes(name))continue;
   const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});page.setDefaultTimeout(7000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():(errors.push('Unexpected external request'),route.abort()));
   await page.addInitScript(()=>{window.layoutCspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.layoutCspViolations.push(e.violatedDirective));});
   const result={name,theme,width,font,errors};
   try{
    await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'));
    await page.goto(origin+path);await page.locator(wait).first().waitFor();
    if(steps)await steps(page);
    errors.push(...await page.evaluate(()=>window.layoutCspViolations));
    // Text-only zoom doubles each computed size, including legacy px typography.
    if(font===200)await page.evaluate(()=>{const nodes=[...document.querySelectorAll('html,body *')].filter(e=>e instanceof HTMLElement);const sizes=nodes.map(e=>parseFloat(getComputedStyle(e).fontSize));nodes.forEach((e,i)=>e.style.fontSize=`${sizes[i]*2}px`);});
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    // PO: measure actual field/button centres, not the taller wrapping labels.
    // Compact layouts and doubled text may wrap as specified in README § 3.5.
    result.headerAlignment=await page.evaluate(({width,font})=>{
      const issues=[];
      if(document.querySelector('dialog:modal'))return issues;
      for(const header of document.querySelectorAll('.header-actions')){
        const fields=[...header.querySelectorAll('input,select')].filter(el=>el.checkVisibility({checkVisibilityCSS:true}));
        if(!fields.length)continue;
        for(const field of fields){
          const caption=field.closest('label')?.querySelector('.sr-only');
          if(!caption?.textContent?.trim()||caption.getBoundingClientRect().width>1||caption.getBoundingClientRect().height>1)issues.push('Header field must have a visually hidden label');
        }
        const rows=[];
        for(const child of header.children){
          const control=child.matches('button,input,select,a[href]')?child:child.querySelector('button,input,select,a[href]');
          if(!control?.checkVisibility({checkVisibilityCSS:true}))continue;
          const box=child.getBoundingClientRect(),actual=control.getBoundingClientRect();
          const middle=box.y+box.height/2;
          let row=rows.find(row=>Math.abs(row.middle-middle)<=1);
          if(!row){row={middle,centres:[]};rows.push(row);}
          row.centres.push(actual.y+actual.height/2);
        }
        if(width===1440&&font===100&&rows.length!==1)issues.push('Desktop header actions must share one row');
        for(const row of rows)if(Math.max(...row.centres)-Math.min(...row.centres)>1)issues.push(`Header action centre mismatch: ${row.centres.join(', ')}`);
      }
      return issues;
    },{width,font});
    const checks=await measure(page);Object.assign(result,checks);
    {
     const count=await page.evaluate(()=>{
       const modal=document.querySelector('dialog:modal,[role="dialog"][aria-modal="true"]');
       const probe=document.createElement('span');document.body.append(probe);
       const colors=['action','notice','error'].map(role=>{probe.style.backgroundColor=`var(--color-${role})`;return getComputedStyle(probe).backgroundColor;});probe.remove();
       return [...document.querySelectorAll('main button,main a,dialog button,[role="dialog"] button')].filter(e=>!e.closest('.theme-switch')&&e.checkVisibility({checkVisibilityCSS:true})&&(!modal||modal.contains(e))&&colors.includes(getComputedStyle(e).backgroundColor)).length;
     });
     if(count!==expected)result.primary=`expected ${expected}, got ${count}`;
    }
    await page.screenshot({path:join(screenshots,`${name}-${theme}-${width}-${font}.png`),fullPage:true});
   }catch(error){result.error=error.message;}
   finally{results.push(result);await page.close();}
  }
  console.log(`Completed ${width}px / ${font}% / ${theme}`);
 }
 writeFileSync('.t122b-review/browser-results.json',JSON.stringify(results,null,2));
 const failures=results.filter(r=>r.error||r.primary||r.errors.length||r.headerAlignment?.length||r.geometry?.length||r.axe?.length);
 console.log(JSON.stringify(failures,null,2));assert.deepEqual(failures,[]);
}finally{await browser.close();await admin.close();await operator.close();await new Promise(done=>landing.close(done));rmSync(output,{recursive:true,force:true});}
