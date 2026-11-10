import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
const root=fileURLToPath(new URL('../../modules/taptime-lock-screen/',import.meta.url));
it('declares the same background-only metadata in app and widget, with no foreground continuation',()=>{
  const intent=readFileSync(join(root,'widget/LockScreenActionIntent.swift'),'utf8');
  expect(intent).toContain('static var supportedModes: IntentModes { .background }');
  expect(intent).toContain('static var openAppWhenRun = false');
  expect(intent).toContain('static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed');
  expect(intent).not.toMatch(/ForegroundContinuableIntent|continueInForeground|requestToContinueInForeground|UIApplication/);
  const widget=readFileSync(join(root,'widget/TapTimeLiveActivity.swift'),'utf8');
  expect(widget).toContain('Link(destination: url) { label("open") }');
});
it.skipIf(process.platform!=='darwin')('typechecks runtime, widget and app intent against the installed iOS SDK and emits the mode witness',()=>{
  const developer=process.env.DEVELOPER_DIR??'/Applications/Xcode.app/Contents/Developer';
  // A missing SDK is an explicit failed prerequisite on a Mac, never silently replaced by a fake.
  expect(existsSync(developer),'Xcode required; do not install automatically').toBe(true);
  const env={...process.env,DEVELOPER_DIR:developer};
  const sdk=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8',env});
  expect(sdk.status,sdk.stderr).toBe(0);
  const out=mkdtempSync(join(tmpdir(),'t145-sdk-'));
  const file=(name:string)=>join(root,name);
  const minimum=readFileSync(file('ios/TapTimeLockScreen.podspec'),'utf8').match(/:ios => '([^']+)'/)?.[1];
  expect(minimum).toBeDefined();
  const common=['-sdk',sdk.stdout.trim(),'-target',`arm64-apple-ios${minimum}`,'-module-cache-path',join(out,'cache')];
  const compile=(args:string[])=>{
    const result=spawnSync('xcrun',['swiftc',...common,...args],{encoding:'utf8',env,timeout:180_000,maxBuffer:16*1024*1024});
    expect(result.status,result.stderr).toBe(0);return result;
  };
  try {
    compile(['-emit-module','-parse-as-library','-module-name','TapTimeLockScreen','-emit-module-path',join(out,'TapTimeLockScreen.swiftmodule'),
      ...['LockScreenModel','LockScreenEngine','LockScreenStorage','LockScreenHttp','LockScreenAttributes','TapTimeLockScreenRuntime'].map(name=>file(`ios/${name}.swift`))]);
    compile(['-typecheck','-application-extension','-D','TAPTIME_WIDGET',file('ios/LockScreenModel.swift'),file('ios/LockScreenAttributes.swift'),
      file('widget/LockScreenActionIntent.swift'),file('widget/TapTimeLiveActivity.swift')]);
    compile(['-typecheck','-I',out,file('widget/LockScreenActionIntent.swift'),file('widget/TapTimeForegroundLaunch.swift')]);
    const sil=compile(['-emit-silgen','-I',out,file('widget/LockScreenActionIntent.swift')]).stdout;
    expect(sil).toContain('#AppIntent.supportedModes!getter');
    expect(sil).toContain('#AppIntent.authenticationPolicy!getter');
    expect(sil).toContain('#AppIntent.openAppWhenRun!getter');
  } finally {rmSync(out,{recursive:true,force:true});}
},240_000);
