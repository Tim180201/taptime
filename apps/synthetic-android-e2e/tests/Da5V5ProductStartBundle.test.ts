import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const operatorBundle = fileURLToPath(
  new URL('../dist/da5V5Main.js', import.meta.url),
);

describe('DA5 V5 Product operator bundle start smoke', () => {
  it('bounds the GHSA-rgw5-rvv9-x895 intermediate-expansion path in a child', () => {
    const regression = spawnSync(
      process.execPath,
      [
        '--max-old-space-size=64',
        '--input-type=module',
        '--eval',
        `
          import { createRequire } from 'node:module';
          import { expand } from 'brace-expansion';

          const require = createRequire(import.meta.url);
          const { version } = require('brace-expansion/package.json');
          const part = '{' + '0'.repeat(50) + '1..100000}';
          const input = '{' + Array(400).fill(part).join(',') + '}';
          const expanded = expand(input);
          const totalLength = expanded.reduce((sum, value) => sum + value.length, 0);
          if (expanded.length === 0 || totalLength > 4_000_000) process.exit(2);
          process.stdout.write(JSON.stringify({ totalLength, version }));
        `,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
        maxBuffer: 64 * 1024,
        timeout: 5_000,
      },
    );

    expect(regression.error, regression.stderr).toBeUndefined();
    expect(regression.signal, regression.stderr).toBeNull();
    expect(regression.status, regression.stderr).toBe(0);
    expect(JSON.parse(regression.stdout)).toMatchObject({
      version: '5.0.9',
    });
  }, 10_000);

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
    const bundle = readFileSync(operatorBundle, 'utf8');
    expect(bundle).toContain('da5_v5_android_install=mismatch category=');
    for (const category of [
      'artifact_reverify',
      'child_start_transport',
      'stdin_pipe',
      'timeout',
      'child_exit',
      'package_manager_receipt',
      'installed_provenance',
      'cleanup',
    ]) {
      expect(bundle).toContain(category);
    }
    expect(bundle).toContain('install-create');
    expect(bundle).toContain('install-write');
    expect(bundle).toContain('install-commit');
    expect(bundle).toContain('install-abandon');

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
