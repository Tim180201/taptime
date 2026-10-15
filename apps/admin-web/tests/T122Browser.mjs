import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {build} from 'vite';
import {buildWeb,launchBrowser} from '../../../scripts/browser/harness.mjs';
import {measure} from '../../../scripts/browser/harness.mjs';
const screenshots=resolve('.t122-review/screenshots');mkdirSync(screenshots,{recursive:true});
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
 ['mitarbeiter','/beschaeftigte#employees','.membership-tools',1],
 ['person',person+'#person','.calendar-grid',1],
 ['mitarbeiter-zugaenge','/beschaeftigte#employees','.membership-tools',1,p=>p.locator('.membership-tools summary').click()],
 ['hilfe','/uebersicht#overview','.metric-grid',0,async p=>{if(await p.getByRole('button',{name:'Mehr',exact:true}).isVisible())await click('Mehr')(p);await click('So funktioniert Taptura')(p);}],
 ['zeiten-pruefen','/pruefungen#reviews','.review-case',0],
 ['meine-zeiten','/meine-zeiten?monat=2026-09#employee-calendar','.calendar-grid',1],
 ['lohnexport','/lohnexport#payroll','.table-scroll',1],
 ['anmelden','/#login','.login-card',1],
 ['einladung','/willkommen#welcome','form',1],
 ['passwort-neu','/passwort-neu#password-reset','form',1],
];
const operatorScenarios=[['betreiber-anmelden','/#login','.auth'],['betreiber-fehler','/#error','.error'],['betreiber-mfa','/#mfa-existing','.auth'],['betreiber','/#overview','table'],['betreiber-protokoll','/protokoll#audit','.log'],['betreiber-zustand','/betriebszustand#health','dl']];
const admin=await buildWeb('admin-web',true),operator=await buildWeb('operator-web',true),browser=await launchBrowser();
const output=mkdtempSync(join(tmpdir(),'t122-landing-'));
await build({root:resolve('apps/landing-web'),envDir:false,logLevel:'warn',build:{outDir:output,emptyOutDir:true}});
const csp=readFileSync('infrastructure/caddy/Caddyfile','utf8').split('(landing_headers)')[1].match(/Content-Security-Policy "([^"]+)"/)[1];
const landing=createServer((req,res)=>{
 let path=new URL(req.url,'http://local').pathname;if(path==='/')path='/index.html';if(path==='/app'||path==='/tag')path+='.html';
 const file=join(output,path);if(!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Security-Policy',csp);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml','.ico':'image/x-icon','.png':'image/png'})[extname(file)]??'text/plain');res.end(readFileSync(file));
});await new Promise(done=>landing.listen(0,'127.0.0.1',done));const landingOrigin=`http://127.0.0.1:${landing.address().port}`;
const results=[],smoke=process.env.T122_SMOKE==='1';
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
  for(const [app,origin,cases] of [['admin',admin.origin,scenarios],['operator',operator.origin,operatorScenarios],['landing',landingOrigin,[['startseite','/','footer'],['app-download','/app','main'],['karte-info','/tag','main']]]])for(const [name,path,wait,expected,steps]of cases){
   if(process.env.T122_CASES&&!process.env.T122_CASES.split(',').includes(name))continue;
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
    const checks=await measure(page);Object.assign(result,checks);
    if(app==='admin'){
     const count=await page.evaluate(()=>{
       const modal=document.querySelector('dialog:modal');
       const probe=document.createElement('span');document.body.append(probe);
       const colors=['action','notice','error'].map(role=>{probe.style.backgroundColor=`var(--color-${role})`;return getComputedStyle(probe).backgroundColor;});probe.remove();
       return [...document.querySelectorAll('main button,dialog button')].filter(e=>!e.closest('.theme-switch')&&e.checkVisibility({checkVisibilityCSS:true})&&(!modal||modal.contains(e))&&colors.includes(getComputedStyle(e).backgroundColor)).length;
     });
     if(count!==expected)result.primary=`expected ${expected}, got ${count}`;
    }
    await page.screenshot({path:join(screenshots,`${name}-${theme}-${width}-${font}.png`),fullPage:true});
   }catch(error){result.error=error.message;}
   finally{results.push(result);await page.close();}
  }
  console.log(`Completed ${width}px / ${font}% / ${theme}`);
 }
 writeFileSync('.t122-review/browser-results.json',JSON.stringify(results,null,2));
 const failures=results.filter(r=>r.error||r.primary||r.errors.length||r.geometry?.length||r.axe?.length);
 console.log(JSON.stringify(failures,null,2));assert.deepEqual(failures,[]);
}finally{await browser.close();await admin.close();await operator.close();await new Promise(done=>landing.close(done));rmSync(output,{recursive:true,force:true});}
