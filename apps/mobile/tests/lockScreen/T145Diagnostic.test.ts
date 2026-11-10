import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
it.skipIf(process.platform!=='darwin')('executes every last-tap outcome, privacy, no replay and deletion in the production Swift engine',()=>{
  const out=mkdtempSync(join(tmpdir(),'t145-swift-'));
  const source=(file:string)=>fileURLToPath(new URL(file,import.meta.url));
  try {
    const binary=join(out,'tests');
    const compile=spawnSync('/usr/bin/swiftc',['-module-cache-path',join(out,'cache'),'-parse-as-library',
      source('../../modules/taptime-lock-screen/ios/LockScreenModel.swift'),
      source('../../modules/taptime-lock-screen/ios/LockScreenEngine.swift'),source('./T145DiagnosticAssertions.swift'),'-o',binary],
      {encoding:'utf8',timeout:60_000});
    expect(compile.status,compile.stderr).toBe(0);
    const run=spawnSync(binary,[],{encoding:'utf8',timeout:20_000});
    expect(run.status,run.stderr).toBe(0);expect(run.stdout).toContain('T145: all outcomes');
  } finally {rmSync(out,{recursive:true,force:true});}
},85_000);
