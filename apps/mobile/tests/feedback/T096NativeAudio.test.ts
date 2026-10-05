import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
const jars=globSync(join(homedir(),'.gradle/caches/modules-2/files-2.1/**/*.jar'));
const compiler=jars.find(path=>path.includes('/kotlin-compiler-embeddable/2.1.20/'));
const stdlib=jars.find(path=>path.includes('/kotlin-stdlib/2.1.20/'));
const dependencies=jars.filter(path=>/\/(kotlin-compiler-embeddable|kotlin-daemon-embeddable|kotlin-stdlib|kotlin-script-runtime|kotlin-reflect|kotlinx-coroutines-core-jvm|trove4j|annotations)\//.test(path));
function block(source:string,marker:string):string {
  const start=source.indexOf(marker);if(start<0)throw Error('native boundary missing');
  const brace=source.indexOf('{',start);let depth=1,end=brace+1;
  while(depth && end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
  return source.slice(start,end);
}
it.skipIf(!compiler || !stdlib)('T-096 runs the production audio worker against failed and interrupted AudioTracks',()=>{
  const source=readFileSync(new URL('../../modules/taptime-feedback/android/src/main/java/com/taptime/feedback/TapTimeFeedbackModule.kt',import.meta.url),'utf8');
  const worker=block(source,'audioExecutor.execute {');const tone=block(source,'private fun playToneSequence(');
  const root=mkdtempSync(join(tmpdir(),'t096-audio-'));
  try {
    const assertions=readFileSync(new URL('./T096AudioAssertions.kt',import.meta.url),'utf8');
    const file=join(root,'AudioCheck.kt'),out=join(root,'audio.jar');
    writeFileSync(file,assertions.replace('/* WORKER */',worker).replace('/* TONE */',tone));
    const compile=spawnSync('java',['-cp',[compiler!,stdlib!,...dependencies].join(':'),'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-no-stdlib','-no-reflect','-classpath',stdlib!,'-d',out,file],{encoding:'utf8',timeout:60000});
    expect(compile.status,compile.stderr).toBe(0);
    const run=spawnSync('java',['-cp',out+':'+stdlib,'AudioCheckKt'],{encoding:'utf8',timeout:10000});
    expect(run.status,run.stderr).toBe(0);expect(run.stdout).toContain('audio failures contained');
  } finally {rmSync(root,{recursive:true,force:true});}
},75000);
