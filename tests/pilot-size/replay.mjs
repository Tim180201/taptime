import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

if(process.env.TAPTIME_PILOT_SIZE!=='synthetic-local-only'||process.env.CI)throw Error('Explicit local opt-in required; CI forbidden');
const root=resolve(process.argv[2]),profile=process.argv[3];
if(!['expected','peak'].includes(profile))throw Error('Select expected or peak');
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const source=await read(`${profile}/browser-source.json`);
if(resolve(source.source)===root)throw Error('Replay requires a separate browser-only output directory');
const resources=await read(`${profile}/resources.json`);
if(!resources.cleaned)throw Error('Recorded source resources must be cleaned first');
const old=await read(`browser/${profile}-browser.json`);
const person=old.find(row=>row.name==='person');
const member=person?.path.match(/^\/beschaeftigte\/([0-9a-f-]+)\?/)[1];
if(!member)throw Error('Missing recorded person scenario');
const overview=await read(`browser/${profile}-overview-fixtures.json`);
const window=overview.map(([key])=>JSON.parse(key)).find(([path])=>path==='/v2/administration/time-records/query')?.[1];
if(!Number.isFinite(Date.parse(window?.toExclusive)))throw Error('Missing recorded browser clock');
// No database or HTTP backend is opened: every API request must match saved bytes.
const {measureBrowser}=await import('./browser.mjs');
const people=[];people[6]={member};
await writeFile(join(root,profile,'completion.json'),JSON.stringify({mode:'incomplete'}));
const result=await measureBrowser({profile,reference:source.reference,people,output:join(root,'browser'),smoke:false,
  sourceRoot:source.source,browserOnly:true,replaySource:join(root,'browser'),clockTime:window.toExclusive});
await writeFile(join(root,profile,'completion.json'),JSON.stringify({mode:'browser-only',profile,reference:source.reference,
  source:source.source,smoke:false,browserScenarios:result.map(row=>row.name),completedAt:new Date().toISOString(),
  replayOnly:true,clock:window.toExclusive},null,2)+'\n');
