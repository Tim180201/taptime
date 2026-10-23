import { environment, save, localDatabaseUrl } from './support.js';
import { generate, people } from './dataset.js';
import { Http, measureReads, exports, observeSql, sizeAndCounts, timeoutProbe } from './measure.js';
import { writeLoad } from './load.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { output } from './support.js';
import { cpus, totalmem, platform, release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';

const profile = process.argv.find(arg=>arg.startsWith('--profile='))?.slice(10) ?? 'both';
if (!['expected','peak','both'].includes(profile)) throw new Error('profile must be expected, peak or both');
const smoke = process.argv.includes('--smoke');
const browserSource=process.argv.find(arg=>arg.startsWith('--browser-source='))?.slice('--browser-source='.length);
if(browserSource&&resolve(browserSource)===output)throw new Error('Browser-only reruns require a separate output directory');
localDatabaseUrl();
await save('machine.json',{at:new Date().toISOString(),platform:platform(),release:release(),
  model:platform()==='darwin'?execFileSync('sysctl',['-n','hw.model'],{encoding:'utf8'}).trim():cpus()[0]?.model,
  cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),node:process.version,
  chrome:execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--version'],{encoding:'utf8'}).trim(),
  git:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),smoke});
for (const name of profile==='both'?['expected','peak']: [profile]) {
  // A previous successful run must never authorize partial results from a new
  // run in the same directory, including a browser-only replacement.
  await rm(resolve(output,name,'completion.json'),{force:true});
  try {
    const previousResources=JSON.parse(await readFile(resolve(output,name,'resources.json'),'utf8'));
    if(!previousResources.cleaned)throw new Error(`Resolve the previous ${name} resources.json before reusing this output directory`);
  } catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const env = await environment(name);
  try {
    await save(`${name}/postgres.json`,{version:env.version});
    await sizeAndCounts(env,`${name}/baseline`);
    const dataset = await generate(env,name as 'expected'|'peak',smoke);
    await save(`${name}/dataset.json`,dataset);
    console.log(`${name}: generation complete`);
    const http=new Http(env);
    if(browserSource) {
      const previous=JSON.parse(await readFile(resolve(browserSource,name,'dataset.json'),'utf8'));
      if(previous.reference!==dataset.reference||previous.entries!==dataset.entries||previous.smoke!==smoke)throw new Error('Browser source dataset differs from regenerated profile');
      // Recreate the same running/offline data, without remeasuring a burst.
      // These compressed setup writes are stored separately and never reported
      // as the ten-minute load test from the source measurement.
      await writeLoad(http,name,true);
      await env.db.query('ANALYZE');
      await sizeAndCounts(env,name);
      const {measureBrowser}=await import(pathToFileURL(resolve('tests/pilot-size/browser.mjs')).href);
      await measureBrowser({http,profile:name,reference:dataset.reference,people,output:resolve(output,'browser'),smoke,
        sourceRoot:resolve(browserSource),browserOnly:true});
      await save(`${name}/browser-source.json`,{source:resolve(browserSource),reference:dataset.reference,setupWritesCompressed:true});
      const browser=JSON.parse(await readFile(resolve(output,'browser',`${name}-browser.json`),'utf8'));
      await save(`${name}/completion.json`,{mode:'browser-only',profile:name,reference:dataset.reference,smoke,
        source:resolve(browserSource),browserScenarios:browser.map((row:{name:string})=>row.name),completedAt:new Date().toISOString()});
      continue;
    }
    await writeLoad(http,name,smoke);
    await env.db.query('ANALYZE');
    const sql=observeSql();
    try {
      sql.enable();
      await measureReads(http,dataset.reference,name,smoke);
      await exports(http,dataset.reference,name,smoke);
      sql.disable();
      await sizeAndCounts(env,name);
      await sql.explain(env,name);
    } finally { sql.restore(); }
    await timeoutProbe(http,dataset.reference,name);
    const {measureBrowser}=await import(pathToFileURL(resolve('tests/pilot-size/browser.mjs')).href);
    await measureBrowser({http,profile:name,reference:dataset.reference,people,output:resolve(output,'browser'),smoke});
    await save(`${name}/diagnostics.json`,env.diagnostics);
    const readResult=JSON.parse(await readFile(resolve(output,name,'reads.json'),'utf8'));
    const exportResult=JSON.parse(await readFile(resolve(output,name,'exports.json'),'utf8'));
    const browserResult=JSON.parse(await readFile(resolve(output,'browser',`${name}-browser.json`),'utf8'));
    await save(`${name}/completion.json`,{mode:'full',profile:name,reference:dataset.reference,smoke,
      readCases:readResult.map((row:{role:string;name:string})=>`${row.role}/${row.name}`),
      exportCases:exportResult.map((row:{month:string;version:number})=>`${row.month}/v${row.version}`),
      browserScenarios:browserResult.map((row:{name:string})=>row.name),
      activePeople:people.filter(person=>!person.former).length,offlineRequests:people.slice(6,26).length*2,
      burstWindowMilliseconds:600_000,completedAt:new Date().toISOString()});
  } finally { await env.cleanup(); }
}
