import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
it.skipIf(process.platform!=='darwin')('T-096 excludes the SQLite directory through production Foundation code',()=>{
  const root=mkdtempSync(join(tmpdir(),'t096-backup-'));
  try {
    const source=readFileSync(new URL('../../modules/taptime-offline-storage/ios/OfflineBackupBoundary.swift',import.meta.url),'utf8');
    const file=join(root,'check.swift');
    writeFileSync(file,source+`\nlet directory = URL(fileURLWithPath: CommandLine.arguments[1]).appendingPathComponent("SQLite")\ntry FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)\ntry OfflineBackupBoundary.exclude(directory)\nlet values = try directory.resourceValues(forKeys: [.isExcludedFromBackupKey])\nassert(values.isExcludedFromBackup == true)\nprint("backup excluded")\n`);
    const result=spawnSync('/usr/bin/swift',[file,root],{encoding:'utf8',timeout:60000});
    expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('backup excluded');
  } finally {rmSync(root,{recursive:true,force:true});}
},65000);
