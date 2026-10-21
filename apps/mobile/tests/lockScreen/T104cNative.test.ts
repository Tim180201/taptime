import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
const root=fileURLToPath(new URL('../../modules/taptime-lock-screen/',import.meta.url));
it.skipIf(process.platform!=='darwin')('executes the production Swift engine and D-133 background boundary on macOS',()=>{
  const out=mkdtempSync(join(tmpdir(),'t104c-swift-'));
  try {
    const binary=join(out,'tests');
    const compile=spawnSync('/usr/bin/swiftc',['-module-cache-path',join(out,'module-cache'),'-parse-as-library',join(root,'ios/LockScreenModel.swift'),join(root,'ios/LockScreenEngine.swift'),
      fileURLToPath(new URL('./T104cLogicAssertions.swift',import.meta.url)),'-o',binary],{encoding:'utf8',timeout:60_000});
    expect(compile.status,compile.stderr).toBe(0);
    const run=spawnSync(binary,[],{encoding:'utf8',timeout:20_000});
    expect(run.status,run.stderr).toBe(0);expect(run.stdout).toContain('D-133 background action');
    expect(run.stdout).toContain('T-104c Swift response');
  }finally{rmSync(out,{recursive:true,force:true});}
},85_000);
it('keeps the native background storage and launch boundary separate from authentication',()=>{
  const read=(file:string)=>readFileSync(join(root,file),'utf8');
  const storage=read('ios/LockScreenStorage.swift');
  expect(storage).toContain('.completeFileProtectionUntilFirstUserAuthentication');
  expect(storage).toContain('isExcludedFromBackup = true');
  expect(storage).toContain('kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly');
  for (const method of ['replace', 'remove']) {
    const implementation=storage.slice(storage.indexOf(`func ${method}(`)).split('\n  }')[0];
    expect(implementation).toContain('guard UIApplication.shared.applicationState == .active');
  }
  expect(storage.replace(/\/\/[^\n]*/g,'')).not.toMatch(/SecureStore|refresh-token|confirmed-identity/);
  expect(read('widget/TapTimeForegroundLaunch.swift')).toContain('UIApplication.didBecomeActiveNotification');
  expect(read('widget/TapTimeForegroundLaunch.swift')).toContain('if application.applicationState != .background { start(); return }');
  const http=read('ios/LockScreenHttp.swift');
  expect(http).toContain('completionHandler(nil)');expect(http).not.toContain('X-TapTime-Expected-Membership-Id');
  expect(read('widget/LockScreenActionIntent.swift')).toContain('LiveActivityIntent');
  expect(read('widget/LockScreenActionIntent.swift')).not.toMatch(/SecureStore|Supabase|React/);
});
