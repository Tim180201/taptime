import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { productHtml } from '../../shared/productHtml.ts';
import { brandAssets } from '../../shared/brandAssets.ts';
import { launchBrowser } from '../../scripts/browser/harness.mjs';
import { observeSql } from './sql-observer.ts';
import { measureCases } from './read-measurement.ts';

// The existing browser test mechanism replaces main.tsx with a fixture entry.
// These entries retain the real coordinators, parsers and views; only auth/transport are local.
async function buildFixture(app,output) {
  const root=resolve('apps',app),directory=await mkdtemp(join(output,'.web-'));
  try {
    await build({root,configFile:false,envDir:false,logLevel:'warn',plugins:[{
      name:'pilot-fixture-entry',enforce:'pre',transform(_code,file) {
        if(file===join(root,'src/main.tsx'))return `import ${JSON.stringify(resolve('tests/pilot-size',app==='admin-web'?'admin-entry.tsx':'operator-entry.tsx'))};`;
      },
    },react(),productHtml(),brandAssets()],build:{outDir:directory,emptyOutDir:true}});
    const server=createServer(async(req,res)=>{
      try {
        const pathname=new URL(req.url,'http://127.0.0.1').pathname;
        if(pathname==='/version.txt'){res.end('synthetic-T099a');return;}
        if(/^\/v\d+\//.test(pathname)){res.writeHead(500);res.end('Fixture request was not intercepted');return;}
        const requested=resolve(directory,'.'+pathname);
        const file=requested.startsWith(directory+'/')&&existsSync(requested)&&extname(requested)?requested:join(directory,'index.html');
        res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream');
        res.end(await readFile(file));
      }catch(error){res.writeHead(500);res.end(String(error));}
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    return {origin:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(done=>server.close(done));await rm(directory,{recursive:true,force:true});}};
  } catch(error){await rm(directory,{recursive:true,force:true});throw error;}
}

export async function measureBrowser({http,profile,reference,people,output,smoke,sourceRoot=resolve(output,'..'),browserOnly=false,replaySource,clockTime}) {
  await mkdir(output,{recursive:true});
  if(!smoke&&!browserOnly) {
    const root=sourceRoot;
    let reads=JSON.parse(await readFile(resolve(root,profile,'reads.json'),'utf8'));
    const month=(await http.env.db.query(`SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Berlin') AS start,
      (($1::date+interval '1 month') AT TIME ZONE 'Europe/Berlin') AS finish`,[reference.slice(0,7)+'-01'])).rows[0];
    const quotaCases=reads.filter(row=>row.name==='quota-alerts'&&['administrator','standortleitung'].includes(row.role))
      .map(row=>({...row,name:'quota-alerts-current',body:{...row.body,cursor:null,fromInclusive:month.start.toISOString(),toExclusive:month.finish.toISOString()}}));
    const fixtures=JSON.parse(await readFile(resolve(root,profile,'largest-responses.json'),'utf8'));
    const measured=await measureCases(http,quotaCases,role=>role==='administrator'?people[0]:people[1],profile,false,
      async(path,value)=>writeFile(resolve(root,path),JSON.stringify(value,null,2)+'\n'),reads,fixtures);
    reads=measured.results;
    const previous=JSON.parse(await readFile(resolve(root,profile,'slow-queries.json'),'utf8'));
    const responseLimitProbes=[];
    for(const reading of reads.filter(row=>row.role==='administrator'&&row.name.includes('F018')&&row.samples.some(sample=>sample.status>=500))) {
      for(const limit of [Math.floor(reading.body.limit/5),Math.floor(reading.body.limit/2),reading.body.limit]) {
        const response=await http.request(reading.path,{...reading.body,limit},people[0],reading.accept);
        responseLimitProbes.push({name:reading.name,limit,response});
      }
    }
    await writeFile(resolve(root,profile,'F018-probe.json'),JSON.stringify(responseLimitProbes,null,2));
    const observer=observeSql(async(path,value)=>writeFile(resolve(root,path),JSON.stringify(value,null,2)+'\n'));
    const probes=[];
    try {
      observer.enable();
      const cutoff=Math.min(...previous.map(query=>query.ms));
      for(const reading of reads.filter(row=>row.samples.some(sample=>sample.status>=500||sample.milliseconds>=cutoff))) {
        const actor=reading.role==='operator'?'operator':reading.role==='administrator'?people[0]:reading.role==='standortleitung'?people[1]:people[6];
        const response=await http.request(reading.path,reading.body,actor,reading.accept);
        probes.push({name:reading.name,role:reading.role,response});
      }
      const exportRows=JSON.parse(await readFile(resolve(root,profile,'exports.json'),'utf8'));
      const window=reads.find(row=>row.role==='administrator'&&row.name==='customer-month').body;
      const selectedMonth=new Date(Date.UTC(Number(reference.slice(0,4)),Number(reference.slice(5,7))-2,1)).toISOString().slice(0,7);
      for(const exported of exportRows.filter(row=>row.month===selectedMonth&&row.samples.some(sample=>sample.status>=500))) {
        const response=await http.request(`/v${exported.version}/time-entries/export`,{
          expectedMembershipId:people[0].member,fromInclusive:window.fromInclusive,toExclusive:window.toExclusive,
        },people[0],'text/csv');
        probes.push({name:`export-v${exported.version}`,role:'administrator',month:exported.month,response});
      }
      observer.disable();
      await writeFile(resolve(root,profile,'diagnostic-probes.json'),JSON.stringify(probes,null,2));
      await observer.explain(http.env,profile,previous);
    }finally{observer.restore();}
  }
  const largest=Object.entries(JSON.parse(await readFile(resolve(sourceRoot,profile,'largest-responses.json'),'utf8')))
    .map(([key,value])=>({...value,role:key.split('/')[0]}));
  let admin,operator,browser;
  const previous=new Date(reference+'T12:00:00Z');previous.setUTCDate(1);previous.setUTCMonth(previous.getUTCMonth()-1);
  const month=previous.toISOString().slice(0,7);
  const scenarios=[
    ['overview','/uebersicht'],['employees',`/beschaeftigte?monat=${month}`],['access',`/beschaeftigte?monat=${month}`,'Zugänge'],
    ['person',`/beschaeftigte/${people[6].member}?monat=${month}`],['customers',`/kunden?monat=${month}`],
    ['review','/pruefungen'],['export',`/lohnexport?monat=${month}`],
    ['archive-people','/archiv'],['archive-targets','/archiv?bereich=ziele'],
    ['setup','/einrichtung'],['locations','/einrichtung?bereich=standorte'],
    ['operator','/'],['operator-audit','/protokoll'],['operator-health','/betriebszustand'],
  ];
  const results=[];
  const exactResponses=new Map(),largestBrowserPages=new Map();
  const browserClock=clockTime?new Date(clockTime):new Date();
  await writeFile(join(output,`${profile}-clock.json`),JSON.stringify({at:browserClock.toISOString()}));
  try {
    admin=await buildFixture('admin-web',output);
    operator=await buildFixture('operator-web',output);
    browser=await launchBrowser();
    for (const [name,path,tab] of scenarios) {
      const isOperator=name.startsWith('operator'),web=isOperator?operator:admin;
      const fixture=new Map(replaySource?JSON.parse(await readFile(join(replaySource,`${profile}-${name}-fixtures.json`),'utf8')):[]);
      const samples=[];
      const fixtureDiscoveries=[];
      let primedSignature='';
      const requestKey=(path,body,accept)=>JSON.stringify([path,body,accept]);
      const exact=async(path,body,accept)=>{
        const key=JSON.stringify([isOperator,requestKey(path,body,accept)]);
        if(!exactResponses.has(key))exactResponses.set(key,await http.request(path,body,isOperator?'operator':people[0],accept));
        return exactResponses.get(key);
      };
      const prepareLargest=async()=>{
        if(replaySource)return;
        for(const [key,initial] of fixture) {
          const [path,body,accept]=JSON.parse(key);
          // These coordinators assemble every page and validate identity/cursor
          // continuity. Their exact page chain already contains the largest page.
          if(!body||body.cursor!=null||/\/(?:managed-person-time|own-time\/query|archive\/person-time|review-days\/query)$/.test(path)||initial.status!==200)continue;
          const measuredKey=JSON.stringify([isOperator,key]);
          if(largestBrowserPages.has(measuredKey)){fixture.set(key,largestBrowserPages.get(measuredKey));continue;}
          const comparable=value=>JSON.stringify(Object.entries(value??{}).filter(([key])=>!['cursor','limit'].includes(key)).sort(([a],[b])=>a.localeCompare(b)));
          const candidates=largest.filter(item=>item.role===(isOperator?'operator':'administrator')&&item.path===path&&(item.accept??'application/json')===accept&&comparable(item.request)===comparable(body)&&item.response.status===200);
          const biggest=candidates.sort((a,b)=>b.response.bytes-a.response.bytes)[0];
          let response=initial;
          if(biggest&&biggest.response.bytes>response.bytes)response={...biggest.response,fixtureSource:'largest-measured-page',measuredRequest:biggest.request};
          // Walk outside the browser request: no client timer is running here.
          if(!smoke&&!biggest&&'cursor' in body) {
            const seen=new Set();let current=initial;
            console.log(`${profile}: preparing largest browser page ${path}`);
            for(;;) {
              const parsed=JSON.parse(current.text),cursor=parsed.nextCursor??parsed.page?.nextCursor;
              if(!cursor)break;
              if(seen.has(cursor))throw new Error(`Repeated browser cursor ${path}`);
              seen.add(cursor);
              const request={...body,cursor};current=await exact(path,request,accept);
              if(current.status!==200)throw new Error(`Browser page walk failed: ${path} ${current.status}`);
              if(current.bytes>response.bytes)response={...current,fixtureSource:'largest-browser-query-page',measuredRequest:request};
            }
            console.log(`${profile}: prepared ${seen.size+1} pages for ${path}`);
          }
          largestBrowserPages.set(measuredKey,response);fixture.set(key,response);
        }
      };
      // Prime by reading the real local HTTP server, then replay those exact bytes twenty times.
      for(let sample=-1;sample<(smoke?1:20);sample++) {
        const page=await browser.newPage({viewport:{width:1440,height:1000}});
        page.setDefaultTimeout(sample<0?60000:15000);
        const errors=[];
        const discovered=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.clock.setFixedTime(browserClock);
        await page.addInitScript(priming=>{window.pilotPriming=priming;},sample<0);
        await page.route('**/*',async route=>{
          const request=route.request(),url=new URL(request.url());
          if(url.origin!==web.origin){errors.push('Unexpected external request');return route.abort();}
          if(!/^\/v\d+\//.test(url.pathname))return route.continue();
          const body=request.postDataJSON()??undefined,accept=request.headers().accept;
          const key=requestKey(url.pathname,body,accept);
          if(!fixture.has(key)) {
            if(replaySource){errors.push(`Missing recorded fixture ${key}`);return route.fulfill({status:500,body:'{}'});}
            // Asynchronous UI sections can reveal a dependent lookup only in a
            // later navigation. Gather its real response, discard that entire
            // timing series, and restart; never count live HTTP as replay time.
            if(sample>=0)discovered.push(key);
            fixture.set(key,await exact(url.pathname,body,accept));
          }
          const response=fixture.get(key);
          return route.fulfill({status:response.status,body:response.text,headers:{'content-type':response.headers['content-type']??'application/json','cache-control':'no-store'}});
        });
        const start=performance.now();
        let failed;
        try {
          await page.goto(web.origin+path);
          await page.locator(isOperator?'.operator-sidebar':'.sidebar').first().waitFor();
          await page.locator('main h1').first().waitFor();
          if(tab)await page.getByRole('tab',{name:tab,exact:true}).click();
          if(name==='person')await page.locator('.calendar-layout').first().waitFor();
          await page.waitForFunction(()=>window.pilotActivity?.count>0&&window.pilotActivity.pending===0&&performance.now()-window.pilotActivity.lastActivity>100);
          await page.evaluate(()=>document.fonts.ready);
          await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
        }catch(error){failed=String(error);}
        const milliseconds=performance.now()-start;
        const activity=await page.evaluate(()=>window.pilotActivity);
        const text=await page.locator('body').innerText();
        if(sample>=0)samples.push({milliseconds,requests:activity?.count??0,responses:activity?.responses??[],errors,failed,
          visibleErrors:text.split('\n').filter(line=>/konnte|nicht geladen|fehlgeschlagen|nicht verfügbar/i.test(line))});
        if(sample===0)await page.screenshot({path:join(output,`${profile}-${name}.png`),fullPage:true});
        await page.close();
        if(failed)throw new Error(`Browser fixture ${name} did not become ready: ${failed}`);
        if(errors.length)throw new Error(`Browser fixture ${name}: ${errors.join('; ')}`);
        if(discovered.length) {
          fixtureDiscoveries.push(...discovered);samples.length=0;sample=-2;
          console.log(`${profile}: browser ${name}: discovered dependent reads; replay series restarted`);
          await prepareLargest();continue;
        }
        if(sample<0) {
          await prepareLargest();
          // A largest membership page may omit the selected person, prompting
          // a real archive lookup on the next render. Discover those dependent
          // reads until the response catalog is stable before timing anything.
          const signature=JSON.stringify([...fixture].map(([key,value])=>[key,value.status,value.text]));
          if(signature!==primedSignature){primedSignature=signature;sample--;}
        }
      }
      const times=samples.map(s=>s.milliseconds).sort((a,b)=>a-b);
      results.push({name,path,samples,fixtureDiscoveries,p50:times[Math.ceil(times.length*.5)-1],p95:times[Math.ceil(times.length*.95)-1],
        maxRequests:Math.max(...samples.map(s=>s.requests)),maxResponseBytes:Math.max(0,...[...fixture.values()].map(r=>r.bytes))});
      await writeFile(join(output,`${profile}-browser.json`),JSON.stringify(results,null,2));
      await writeFile(join(output,`${profile}-${name}-fixtures.json`),JSON.stringify([...fixture.entries()],null,2));
      console.log(`${profile}: browser ${name}: ${results.at(-1).p95.toFixed(1)} ms; ${results.at(-1).maxRequests} requests`);
    }
  } finally {await browser?.close();await admin?.close();await operator?.close();}
  // Capture the final physical size after diagnostic/browser reads, including
  // the real operator audit writes those reads cause.
  if(browserOnly)return results;
  const sizePath=resolve(sourceRoot,profile,'size.json');
  const size=JSON.parse(await readFile(sizePath,'utf8'));
  size.bytesBeforeBrowser=size.bytes;
  size.bytes=Number((await http.env.db.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
  size.measuredAt=new Date().toISOString();
  await writeFile(sizePath,JSON.stringify(size,null,2)+'\n');
  return results;
}
