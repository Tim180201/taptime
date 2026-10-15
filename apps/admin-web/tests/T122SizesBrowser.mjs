import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildWeb,launchBrowser,measure} from '../../../scripts/browser/harness.mjs';
const spec=readFileSync('ADO/01_Architecture/Web_Entwurf_v2/README.md','utf8');
const minimumControl=Number(spec.match(/Bedienelemente mindestens (\d+) px/)[1]);
const minimumInput=Number(spec.match(/Eingabefelder mindestens (\d+) px/)[1]);
let app,browser;
before(async()=>{app=await buildWeb('admin-web',true);browser=await launchBrowser();});
after(async()=>{await browser?.close();await app?.close();});
async function visit(width,theme,path){const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme});page.setDefaultTimeout(5000);await page.goto(app.origin+path);return page;}
for(const theme of ['dark','light']){
 for(const width of [390,1023,1440])test(`sizes ${theme}/${width}: controls and fields follow README`,async()=>{
  const p=await visit(width,theme,'/#login');try{await p.getByLabel('E-Mail').waitFor();
   const sizes=await p.locator('button,input').evaluateAll(els=>els.filter(e=>e.checkVisibility()).map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),field:e.tagName==='INPUT'})));
   for(const x of sizes){assert.ok(x.height>=minimumControl-.1,JSON.stringify(x));if(x.field)assert.ok(x.font>=minimumInput,JSON.stringify(x));}
  }finally{await p.close();}
 });
 for(const width of [390,1023])test(`narrow ${theme}/${width}: one brand, bottom navigation, account in More`,async()=>{
  const p=await visit(width,theme,'/uebersicht#overview');try{await p.locator('.metric-card').first().waitFor();
   const visible=await p.locator('.app-shell .brand').evaluateAll(els=>els.filter(e=>e.checkVisibility()).length);assert.equal(visible,1);
   assert.equal(await p.getByRole('button',{name:'Menü',exact:true}).count(),0);
   await p.locator('.mobile-navigation').getByRole('button',{name:'Mehr',exact:true}).click();
   const sheet=p.getByRole('dialog',{name:'Mehr'});await sheet.waitFor();
   assert.equal(await sheet.getByRole('button',{name:'Automatisch',exact:true}).isVisible(),true);
   assert.equal(await sheet.getByRole('button',{name:'Abmelden',exact:true}).isVisible(),true);
   assert.match(await sheet.innerText(),/Administrator/);assert.deepEqual(await measure(p),{geometry:[],axe:[]});
  }finally{await p.close();}
 });
 test(`tables ${theme}: narrow rows retain value labels without horizontal scrolling`,async()=>{
  const p=await visit(390,theme,'/kunden#quota-warning');try{await p.locator('.customers-view tbody td').first().waitFor();
   const cells=await p.locator('.customers-view tbody td').evaluateAll(els=>els.map(e=>({label:e.dataset.label,position:getComputedStyle(e).position})));
   assert.ok(cells.length);for(const c of cells){assert.ok(c.label);assert.equal(c.position,'static');}
   assert.deepEqual(await measure(p),{geometry:[],axe:[]});
  }finally{await p.close();}
 });
 test(`brand ${theme}: wide header has exactly one visible product mark`,async()=>{
  const p=await visit(1440,theme,'/uebersicht#overview');try{await p.locator('.metric-card').first().waitFor();
   assert.equal(await p.locator('.app-shell .brand').evaluateAll(els=>els.filter(e=>e.checkVisibility()).length),1);
   assert.equal(await p.locator('.sidebar > .brand').isVisible(),theme==='dark');
  }finally{await p.close();}
 });
 test(`theme control ${theme}: selected preference uses navigation colours`,async()=>{
  const p=await visit(1440,theme,'/#login');try{const b=p.getByRole('button',{name:theme==='dark'?'Dunkel':'Hell',exact:true});await b.click();
   const colors=await b.evaluate(el=>{const probe=document.createElement('span');el.parentElement.append(probe);probe.style.backgroundColor='var(--color-surface-raised)';probe.style.color='var(--color-accent)';const expected=getComputedStyle(probe),actual=getComputedStyle(el);const out=[actual.backgroundColor,expected.backgroundColor,actual.color,expected.color];probe.remove();return out;});assert.equal(colors[0],colors[1]);assert.equal(colors[2],colors[3]);
  }finally{await p.close();}
 });
}
