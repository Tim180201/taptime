import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
const jars=globSync(join(homedir(),'.gradle/caches/modules-2/files-2.1/**/*.jar'));
const compiler=jars.find(path=>path.includes('/kotlin-compiler-embeddable/2.1.20/'));
const stdlib=jars.find(path=>path.includes('/kotlin-stdlib/2.1.20/'));
const dependencies=jars.filter(path=>/\/(kotlin-compiler-embeddable|kotlin-daemon-embeddable|kotlin-stdlib|kotlin-script-runtime|kotlin-reflect|kotlinx-coroutines-core-jvm|trove4j|annotations)\//.test(path));
const native=fileURLToPath(new URL('../../modules/taptime-lock-screen/android/src/main/java/com/taptime/lockscreen/',import.meta.url));
it.skipIf(!compiler||!stdlib)('T-104b compiles and executes the production Kotlin response and notification policy',()=>{
  const root=mkdtempSync(join(tmpdir(),'t104b-kotlin-'));
  try {
    const out=join(root,'logic.jar');
    const compile=spawnSync('java',['-cp',[compiler!,stdlib!,...dependencies].join(':'),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
      '-no-stdlib','-no-reflect','-classpath',stdlib!,'-d',out,join(native,'LockScreenLogic.kt'),join(native,'LockScreenIo.kt'),
      fileURLToPath(new URL('./T104bLogicAssertions.kt',import.meta.url))],{encoding:'utf8',timeout:60000});
    expect(compile.status,compile.stderr).toBe(0);
    const run=spawnSync('java',['-cp',out+':'+stdlib,'com.taptime.lockscreen.T104bLogicAssertionsKt'],{encoding:'utf8',timeout:10000});
    expect(run.status,run.stderr).toBe(0);expect(run.stdout).toContain('lock-screen outcomes and clock verified');
  } finally {rmSync(root,{recursive:true,force:true});}
},75000);
it('T-104b native boundary has no trampoline, login storage, service or credential-bearing Intent',()=>{
  const read=(name:string)=>readFileSync(join(native,name),'utf8');
  const receiver=read('LockScreenActionReceiver.kt'),notification=read('LockScreenNotification.kt');
  expect(receiver).toContain('goAsync()');expect(receiver).toContain('finally { pending.finish() }');
  expect(receiver).not.toMatch(/startActivity|startService|startForeground/);
  expect(notification).not.toMatch(/putExtra|setPublicVersion/);
  expect(notification).toContain('VISIBILITY_PUBLIC');expect(notification).toContain('IMPORTANCE_DEFAULT');
  expect(notification).toContain('setAuthenticationRequired(false)');expect(notification).toContain('FLAG_IMMUTABLE');
  expect(read('LockScreenHttp.kt')).not.toContain('X-TapTime-Expected-Membership-Id');
  expect(read('TapTimeLockScreenModule.kt')).toContain('LockScreenIo.execute');
  expect(read('TapTimeLockScreenModule.kt')).toContain('promise: Promise');
  expect(read('LockScreenRuntime.kt')).toContain('if (current.optBoolean("ownCapturePending")) return');
  expect(read('LockScreenNotification.kt')).toContain('LockScreenLogic.canSend');
  expect(read('LockScreenStore.kt')).not.toMatch(/setUnlockedDeviceRequired|SecureStore|setUserAuthenticationRequired\(true\)/);
});
