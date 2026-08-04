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

  it('builds and reaches the hardware-free DA5 startup guard without APK or ADB use', () => {
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
      'signal_abort',
    ]) {
      expect(bundle).toContain(category);
    }
    expect(bundle).toContain('cleanup_status=');
    expect(bundle).toContain('cleanup_substage=');
    expect(bundle).toContain('install_abandon');
    expect(bundle).toContain('runner_binding');
    expect(bundle).toContain('uncertainty_escalation');
    expect(bundle).toContain('settleDa5V5BackgroundOperation');
    expect(bundle).toContain('install-create');
    expect(bundle).toContain('install-write');
    expect(bundle).toContain('install-commit');
    expect(bundle).toContain('install-abandon');
    expect(bundle).toContain('UsbFfs');

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

    const startNear = spawnSync(
      process.execPath,
      [operatorBundle],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...environment,
          PATH: '',
          TAPTIME_DA5_V5_ANDROID_API: '35',
          TAPTIME_DA5_V5_ANDROID_BUILD: 'synthetic-build',
          TAPTIME_DA5_V5_ANDROID_RELEASE: '15',
          TAPTIME_DA5_V5_DEVICE_MODEL: 'Synthetic Galaxy',
          TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT: 'a'.repeat(40),
          TAPTIME_DA5_V5_IMPLEMENTATION_TREE: 'b'.repeat(40),
          TAPTIME_DA5_V5_PG_CONFIG: `${repositoryRoot}/.missing-da5-v5-pg-config`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY:
            `${repositoryRoot}/.missing-da5-v5-runtime-guard`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256: 'c'.repeat(64),
          TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST:
            `${repositoryRoot}/.missing-da5-v5-runtime-guard-manifest`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256: 'd'.repeat(64),
          TAPTIME_DA5_V5_TAG_A_FINGERPRINT: 'B55E8B6AEB30',
          TAPTIME_DA5_V5_TAG_B_FINGERPRINT: '32A54C8F2F29',
          TAPTIME_DA5_V5_TAG_TECHNOLOGY: 'NfcA',
          TAPTIME_DA5_V5_TAG_X_FINGERPRINT: 'F61C9F702CFE',
          TAPTIME_DA5_V5_TALKBACK_PACKAGE:
            'com.google.android.marvin.talkback',
          TAPTIME_DA5_V5_TALKBACK_VERSION: '15.1.0',
          TAPTIME_SYNTHETIC_E2E_PASSWORD: 'e'.repeat(64),
          TAPTIME_SYNTHETIC_E2E_PROFILE: 'da5-v5',
        },
      },
    );

    expect(startNear.status).toBe(1);
    expect(startNear.stdout).toBe('');
    expect(startNear.stderr).toBe('da5_v5_start_failed\n');
    expect(startNear.stderr).not.toContain('Synthetic E2E release APK');
  }, 30_000);
});
