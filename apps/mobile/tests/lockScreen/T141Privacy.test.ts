import {spawnSync} from 'node:child_process';
import {globSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect, it} from 'vitest';

const here=fileURLToPath(new URL('.',import.meta.url));
const native=fileURLToPath(new URL('../../modules/taptime-lock-screen/',import.meta.url));
const table=join(here,'T141TargetNames.tsv');
const jars=globSync(join(homedir(),'.gradle/caches/modules-2/files-2.1/**/*.jar'));
const compiler=jars.find(path=>path.includes('/kotlin-compiler-embeddable/2.1.20/'));
const stdlib=jars.find(path=>path.includes('/kotlin-stdlib/2.1.20/'));
const dependencies=jars.filter(path=>/\/(kotlin-compiler-embeddable|kotlin-daemon-embeddable|kotlin-stdlib|kotlin-script-runtime|kotlin-reflect|kotlinx-coroutines-core-jvm|trove4j|annotations)\//.test(path));

it.skipIf(!compiler||!stdlib)('T141 builds the production Android notification through a recording system boundary',()=>{
  const out=mkdtempSync(join(tmpdir(),'t141-kotlin-'));
  try {
    const files=['LockScreenLogic.kt','LockScreenState.kt','LockScreenNotification.kt'].map(file=>join(native,'android/src/main/java/com/taptime/lockscreen',file));
    const compile=spawnSync('java',['-cp',dependencies.join(':'),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
      '-no-stdlib','-no-reflect','-classpath',stdlib!,'-d',join(out,'tests.jar'),...files,
      ...globSync(join(here,'androidBoundary/*.kt')),join(here,'T141NotificationAssertions.kt')],{encoding:'utf8',timeout:60_000});
    expect(compile.status,compile.stderr).toBe(0);
    const run=spawnSync('java',['-cp',join(out,'tests.jar')+':'+stdlib,'com.taptime.lockscreen.T141NotificationAssertionsKt',table],{encoding:'utf8',timeout:10_000});
    expect(run.status,run.stderr).toBe(0);expect(run.stdout).toContain('all text fields and states verified');
  } finally {rmSync(out,{recursive:true,force:true});}
},75_000);

it.skipIf(process.platform!=='darwin')('T141 serializes the production Live Activity ContentState with the same name table',()=>{
  const out=mkdtempSync(join(tmpdir(),'t141-swift-'));
  try {
    // macOS has no ActivityKit. Only its protocol shape is supplied here; the real
    // model and ContentState execute unchanged. The iOS SDK typecheck remains required.
    writeFileSync(join(out,'ActivityKit.swift'),'public protocol ActivityAttributes: Codable { associatedtype ContentState: Codable & Hashable }');
    const shim=spawnSync('/usr/bin/swiftc',['-module-cache-path',join(out,'cache'),'-emit-module','-emit-library','-module-name','ActivityKit',
      join(out,'ActivityKit.swift'),'-o',join(out,'libActivityKit.dylib')],{cwd:out,encoding:'utf8',timeout:60_000});
    expect(shim.status,shim.stderr).toBe(0);
    const compile=spawnSync('/usr/bin/swiftc',['-module-cache-path',join(out,'cache'),'-parse-as-library','-I',out,'-L',out,'-lActivityKit',
      join(native,'ios/LockScreenModel.swift'),join(native,'ios/LockScreenAttributes.swift'),join(here,'T141ActivityAssertions.swift'),'-o',join(out,'tests')],{encoding:'utf8',timeout:60_000});
    expect(compile.status,compile.stderr).toBe(0);
    const run=spawnSync(join(out,'tests'),[table],{env:{...process.env,DYLD_LIBRARY_PATH:out},encoding:'utf8',timeout:10_000});
    expect(run.status,run.stderr).toBe(0);expect(run.stdout).toContain('initialled before serialization');
  } finally {rmSync(out,{recursive:true,force:true});}
},135_000);

it('T141 uses the common native boundary for app, native responses, preview and ActivityKit request/update/end',()=>{
  const android=readFileSync(join(native,'android/src/main/java/com/taptime/lockscreen/LockScreenRuntime.kt'),'utf8');
  expect(android).toContain('LockScreenNotification.show(');
  const ios=readFileSync(join(native,'ios/TapTimeLockScreenRuntime.swift'),'utf8');
  expect(ios.match(/TapTimeActivityAttributes.ContentState\(/g)).toHaveLength(1);
  expect(ios).toContain('stand?.state = previewState');
  expect(ios).toContain('matching.end(content,');expect(ios).toContain('matching.update(content)');
  expect(ios).toContain('content: content, pushType: nil');
});
