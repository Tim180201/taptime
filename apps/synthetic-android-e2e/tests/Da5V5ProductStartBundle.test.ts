import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const operatorBundle = fileURLToPath(
  new URL('../dist/da5V5Main.js', import.meta.url),
);

describe('DA5 V5 Product operator bundle start smoke', () => {
  it('builds and reaches the DA5 operator input boundary without inspecting an APK', () => {
    const build = spawnSync(
      'npm',
      ['run', 'build', '--workspace=@taptime/synthetic-android-e2e'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: process.env,
      },
    );
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);

    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith('TAPTIME_')),
    );
    const start = spawnSync(
      process.execPath,
      [operatorBundle],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: environment,
      },
    );

    expect(start.status).toBe(1);
    expect(start.stdout).toBe('');
    expect(start.stderr).toContain(
      'DA5 V5 requires the exact explicit synthetic profile',
    );
    expect(start.stderr).not.toContain('Synthetic E2E release APK');
    expect(start.stderr).not.toContain(
      'synthetic_e2e_android_runtime_complete_verified',
    );
  }, 30_000);
});
