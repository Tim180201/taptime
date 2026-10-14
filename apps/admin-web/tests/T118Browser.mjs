import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {before,after,test} from 'node:test';
import {buildWeb,launchBrowser,measure} from '../../../scripts/browser/harness.mjs';
let web,browser;
const artifacts=process.env.TAPTIME_T118_ARTIFACTS??'.t118b-review/browser';
before(async()=>{web=await buildWeb('admin-web',true);browser=await launchBrowser();mkdirSync(artifacts,{recursive:true});});
after(async()=>{await browser?.close();await web?.close();});
const scenarios=[
 ['customer','/kunden?kunde=40000000-0000-4000-8000-000000000001#t118-customer','Mitarbeiter'],
 ['person','/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09#t118-person','Kunden und Projekte'],
 ['manual','/manuell#t118-manual','Meine Kunden und Projekte'],
 ['own-backfill','/meine-zeiten?monat=2026-09#t118-own','Meine Kunden und Projekte'],
 ['managed-backfill','/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09#t118-managed','Zugeordnete Kunden und Projekte'],
];
for(const width of [390,1440])for(const [name,path,heading]of scenarios)test(`T118 ${name}: ${width}px, 200% text`,async()=>{
 const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(3500);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'));await page.goto(web.origin+path);
  if(name.includes('backfill'))await page.getByRole('button',{name:'Zeit hinzufügen',exact:true}).click();
  await page.getByRole('heading',{name:heading,exact:true}).waitFor();
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await page.evaluate(()=>document.fonts.ready);
  if(name==='customer'||name==='person'){
   await page.getByRole('button',{name:`${heading} zuordnen`,exact:true}).click();
   const checkbox=page.getByRole('checkbox',{name:'Neue Zuordnung mit einem ausführlichen lesbaren Namen',exact:true});await checkbox.focus();await page.keyboard.press('Space');assert.equal(await checkbox.isChecked(),true);
   assert.equal(await page.getByRole('checkbox',{name:/Schon zugeordnet/}).isChecked(),true);
   assert.deepEqual(await measure(page),{geometry:[],axe:[]});
   await page.screenshot({path:join(artifacts,`${name}-picker-${width}-200.png`),fullPage:true});
   await page.getByRole('button',{name:'Auswahl zuordnen',exact:true}).click();await page.getByText(/Neue Zuordnung.*Zugeordnet/).waitFor();
   await page.getByRole('button',{name:'Auswahl schließen',exact:true}).click();
  }else{
   await page.getByRole('button',{name:'Zugeordnetes Projekt mit ausführlichem lesbarem Namen',exact:true}).click();
  }
  assert.deepEqual(await measure(page),{geometry:[],axe:[]});
  await page.screenshot({path:join(artifacts,`${name}-${width}-200.png`),fullPage:true});assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
