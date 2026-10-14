import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {before,after,test} from 'node:test';
import {buildWeb,launchBrowser,measure} from '../../../scripts/browser/harness.mjs';
let web,browser;
const artifacts=process.env.TAPTIME_T117_ARTIFACTS??'.t117b-review/browser';
before(async()=>{web=await buildWeb('admin-web',true);browser=await launchBrowser();mkdirSync(artifacts,{recursive:true});});
after(async()=>{await browser?.close();await web?.close();});
const scenarios=[
 ['customers','/kunden#customers-admin','.customer-card'],
 ['people','/beschaeftigte#employees','.membership-tools'],
 ['access','/beschaeftigte#employees','.membership-tools',async p=>p.locator('.membership-tools summary').click(),1],
 ['setup','/einrichtung#setup-targets-locations','.entity-list:visible'],
 ['projects','/einrichtung#setup-targets-locations','.entity-list:visible',undefined,1],
 ['cards','/einrichtung#setup-targets-locations','.entity-list:visible',async p=>p.getByRole('button',{name:'Karten',exact:true}).click()],
 ['manual','/manuell#manual','.manual-start-bar'],
 ['own-backfill','/meine-zeiten?monat=2026-09#employee-backfill','.calendar-grid',async p=>p.getByRole('button',{name:'Zeit hinzufügen',exact:true}).click()],
 ['managed-backfill','/beschaeftigte/70000000-0000-4000-8000-000000000001?monat=2026-09#time-add','.calendar-grid',async p=>p.getByRole('button',{name:'Zeit hinzufügen',exact:true}).click()],
];
for(const width of [390,1440])for(const [name,path,wait,open,inputIndex=0]of scenarios)test(`T117 ${name}: ${width}px, 200% text, labelled search and usable results`,async()=>{
 const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.clock.setFixedTime(new Date('2026-09-23T12:00:00Z'));
  await page.goto(web.origin+path);await page.locator(wait).first().waitFor();if(open)await open(page);
  await page.getByRole('searchbox',{name:'Suchen',exact:true}).first().waitFor();
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const boxes=page.locator('input[type="search"]:visible');assert.ok(await boxes.count()>0);
  assert.ok(await boxes.first().evaluate(node=>parseFloat(getComputedStyle(node).fontSize)>=30));
  assert.deepEqual(await measure(page),{geometry:[],axe:[]});
  await page.screenshot({path:join(artifacts,`${name}-${width}-200.png`),fullPage:true});
  // Each visible search is usable at large text size; shared controls announce empty results.
  await boxes.nth(inputIndex).fill('Kein passender Name');
  await page.getByText('Keine Treffer für „Kein passender Name“',{exact:false}).first().waitFor();
  await page.getByRole('button',{name:'Suche löschen',exact:true}).first().click();
  await page.waitForFunction(()=>!document.body.textContent.includes('Keine Treffer für „Kein passender Name“'));
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
