import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSync } from 'esbuild';
mkdirSync('.t099a-review',{recursive:true});

// These negative tests never open a database or browser connection.
for (const [name,override,expected] of [
  ['missing opt-in', { TAPTIME_PILOT_SIZE:'' }, /Local opt-in required/],
  ['CI refuses even explicit opt-in', { TAPTIME_PILOT_SIZE:'synthetic-local-only',CI:'true' }, /CI is forbidden/],
  ['remote database refused', {TAPTIME_PILOT_SIZE:'synthetic-local-only',TAPTIME_PILOT_DATABASE_URL:'postgresql://synthetic@production.invalid/postgres'}, /Only a numeric loopback/],
  ['database connection options refused', {TAPTIME_PILOT_SIZE:'synthetic-local-only',TAPTIME_PILOT_DATABASE_URL:'postgresql://synthetic@127.0.0.1/postgres?host=production.invalid'}, /Only a numeric loopback/],
]) test(name,()=>{
  const output=mkdtempSync(resolve('.t099a-review/guard-'));
  try {
    const result=spawnSync(process.execPath,['tests/pilot-size/run.mjs','--smoke'],{
      env:{...process.env,CI:'',TAPTIME_PILOT_DATABASE_URL:'',...override,TAPTIME_PILOT_OUTPUT:output},encoding:'utf8',timeout:30_000,
    });
    assert.notEqual(result.status,0);assert.match(result.stderr,expected);
  }finally{rmSync(output,{recursive:true,force:true});}
});

for(const ci of ['', 'true'])test(`direct entry refuses ${ci?'CI':'missing opt-in'}`,()=>{
  const directory=mkdtempSync(resolve('.t099a-review/guard-'));
  const entry=resolve(directory,'direct.mjs');
  try {
  buildSync({entryPoints:['tests/pilot-size/main.ts'],outfile:entry,bundle:true,packages:'external',platform:'node',format:'esm'});
  const result=spawnSync(process.execPath,['--import','tsx',entry,'--smoke'],{
    env:{...process.env,CI:ci,TAPTIME_PILOT_SIZE:ci?'synthetic-local-only':'',TAPTIME_PILOT_DATABASE_URL:'postgresql://synthetic@127.0.0.1/postgres'},
    encoding:'utf8',timeout:30_000,
  });
  assert.notEqual(result.status,0);assert.match(result.stderr,/Local opt-in required/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

for(const ci of ['', 'true'])test(`replay refuses ${ci?'CI':'missing opt-in'}`,()=>{
  const result=spawnSync(process.execPath,['tests/pilot-size/replay.mjs'],{
    env:{...process.env,CI:ci,TAPTIME_PILOT_SIZE:ci?'synthetic-local-only':''},encoding:'utf8',timeout:30_000,
  });
  assert.notEqual(result.status,0);assert.match(result.stderr,/Explicit local opt-in required; CI forbidden/);
});
