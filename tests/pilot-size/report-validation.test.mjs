import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertMeasurement } from './report-validation.mjs';

function complete() {
  const samples=Array.from({length:20},()=>({errors:[]}));
  return {profile:'fixture',dataset:{reference:'2026-10-22',smoke:false},resources:{cleaned:true},
    completion:{mode:'full',profile:'fixture',reference:'2026-10-22',smoke:false,
      readCases:['employee/own-time'],exportCases:['2026-09/v4'],browserScenarios:['overview'],
      activePeople:2,offlineRequests:4,burstWindowMilliseconds:600000},
    reads:[{role:'employee',name:'own-time',samples}],exports:[{month:'2026-09',version:4,samples}],
    browser:[{name:'overview',samples}],load:{smoke:false,elapsedSeconds:300,
      starts:[{headers:{date:'Thu, 22 Oct 2026 18:00:00 GMT'}},{headers:{date:'Thu, 22 Oct 2026 18:05:00 GMT'}}],
      offline:Array.from({length:4},()=>({}))}};
}

test('accepts a complete measurement using the declared population',()=>assert.doesNotThrow(()=>assertMeasurement(complete())));
for(const property of ['reads','exports','browser'])test(`rejects cleaned but missing ${property}`,()=>{
  const item=complete();item[property]=[];assert.throws(()=>assertMeasurement(item),/catalog/);
});
test('rejects incomplete repetitions',()=>{
  const item=complete();item.reads[0].samples.pop();assert.throws(()=>assertMeasurement(item),/repetitions/);
});
test('rejects compressed setup writes or missing timing, even with the right request counts',()=>{
  for(const change of [item=>{item.load.smoke=true;},item=>{item.load.elapsedSeconds=2;},item=>{delete item.load.elapsedSeconds;},item=>{item.load.starts[1].headers.date=item.load.starts[0].headers.date;}]){
    const item=complete();change(item);assert.throws(()=>assertMeasurement(item),/write load/);
  }
});
test('backend-only retrospective evidence requires a replacement browser',()=>{
  const item=complete();item.completion.mode='backend-verified';assert.throws(()=>assertMeasurement(item),/completed/);
});
test('rejects an interrupted burst beyond its declared window',()=>{
  for(const change of [item=>{item.load.elapsedSeconds=601;},item=>{item.load.starts[1].headers.date='Thu, 22 Oct 2026 18:11:00 GMT';}]){
    const item=complete();change(item);assert.throws(()=>assertMeasurement(item),/write load/);
  }
});
test('rejects uncompleted cleanup and fixture errors',()=>{
  const item=complete();item.resources.cleaned=false;assert.throws(()=>assertMeasurement(item),/Incomplete profile/);
  item.resources.cleaned=true;item.browser[0].samples[0].errors.push('Missing fixture');assert.throws(()=>assertMeasurement(item),/Invalid browser/);
});
