import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const require=createRequire(import.meta.url);
const xcode=require('xcode');
const plugin=require('../../plugins/withTaptimeLiveActivity');
const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
const template=join(require.resolve('expo/package.json'),'../template.tgz');
const templateFile=(name:string)=>{
  const result=spawnSync('tar',['-xOf',template,`package/ios/${name}`],{encoding:'utf8'});
  expect(result.status,result.stderr).toBe(0);return result.stdout;
};

it('applies repeatably to the actual Expo template with per-target files, early embedding and inherited versions',async()=>{
  const temporary=mkdtempSync(join(tmpdir(),'t104c-plugin-'));
  try {
    const projectPath=join(temporary,'project.pbxproj');
    writeFileSync(projectPath,templateFile('HelloWorld.xcodeproj/project.pbxproj'));
    const project=xcode.project(projectPath);project.parseSync();
    const config=plugin({name:'Taptura',slug:'mobile',scheme:'taptime-validation',version:'2.7.1',ios:{bundleIdentifier:'com.tim180201.mobile',buildNumber:'34'}});
    const modRequest={projectRoot,platformProjectRoot:temporary,platform:'ios'};
    await config.mods.ios.xcodeproj({...config,modRequest,modResults:project});
    const generated=project.writeSync();
    await config.mods.ios.xcodeproj({...config,modRequest,modResults:project});
    expect(project.writeSync()).toBe(generated);
    const objects=project.hash.project.objects;
    const nativeTargets=Object.values(objects.PBXNativeTarget).filter((value:any)=>value.isa==='PBXNativeTarget') as any[];
    const app=project.getFirstTarget().firstTarget;
    const extension=nativeTargets.find(target=>target.name.replaceAll('"','')==='TapTimeLiveActivity');
    expect(extension).toBeDefined();
    const group=(Object.values(objects.PBXGroup) as any[]).find(value=>value.name==='TapTimeLiveActivity');
    expect(group.path).toBe('TapTimeLiveActivity');
    const grouped=new Set(group.children.map((ref:any)=>ref.value));
    const visited=new Set<string>();
    for(const target of nativeTargets){
      for(const ref of target.buildPhases){
        const phase=objects.PBXSourcesBuildPhase[ref.value]??objects.PBXResourcesBuildPhase[ref.value];
        for(const file of phase?.files??[]){
          expect(visited.has(file.value)).toBe(false);visited.add(file.value);
          if(target===extension)expect(grouped.has(objects.PBXBuildFile[file.value].fileRef)).toBe(true);
        }
      }
      for(const ref of objects.XCConfigurationList[target.buildConfigurationList].buildConfigurations){
        const settings=objects.XCBuildConfiguration[ref.value].buildSettings;
        expect(settings).not.toHaveProperty('CURRENT_PROJECT_VERSION');
        expect(settings).not.toHaveProperty('MARKETING_VERSION');
      }
    }
    const projectSettings=objects.XCConfigurationList[project.getFirstProject().firstProject.buildConfigurationList].buildConfigurations;
    for(const ref of projectSettings){
      expect(objects.XCBuildConfiguration[ref.value].buildSettings).toMatchObject({CURRENT_PROJECT_VERSION:'"34"',MARKETING_VERSION:'"2.7.1"'});
    }
    const embed=app.buildPhases.findIndex((ref:any)=>objects.PBXCopyFilesBuildPhase?.[ref.value]?.files.some((file:any)=>
      objects.PBXBuildFile[file.value].fileRef===extension.productReference));
    expect(embed).toBeGreaterThanOrEqual(0);
    app.buildPhases.forEach((ref:any,index:number)=>{if(objects.PBXShellScriptBuildPhase[ref.value])expect(embed).toBeLessThan(index);});
    const original=templateFile('HelloWorld/AppDelegate.swift');
    const changed=await config.mods.ios.appDelegate({...config,modRequest,modResults:{language:'swift',contents:original}});
    const content=changed.modResults.contents as string;
    expect(content.indexOf('TapTimeForegroundLaunch.run')).toBeLessThan(content.indexOf('window = UIWindow'));
    expect(content.indexOf('factory.startReactNative')).toBeLessThan(content.indexOf('return super.application'));
    const again=await config.mods.ios.appDelegate({...config,modRequest,modResults:{language:'swift',contents:content}});
    expect(again.modResults.contents).toBe(content);
    const info=await config.mods.ios.infoPlist({...config,modRequest,modResults:{}});
    expect(info.modResults).toMatchObject({CFBundleVersion:'$(CURRENT_PROJECT_VERSION)',CFBundleShortVersionString:'$(MARKETING_VERSION)',TapTimeLockScreenScheme:'taptime-validation'});
    expect(readFileSync(join(temporary,'TapTimeLiveActivity/Info.plist'),'utf8')).toContain('$(CURRENT_PROJECT_VERSION)');
  }finally{rmSync(temporary,{recursive:true,force:true});}
});
