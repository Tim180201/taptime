import { describe, expect, it, vi } from 'vitest';

import {
  REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS,
  SYNTHETIC_E2E_RUNTIME_ENVIRONMENT,
} from '../../scripts/syntheticE2eRuntimeContract.mjs';
import {
  assertSyntheticE2eRuntimeCompleteness,
  verifySyntheticE2eAndroidRuntime,
} from '../../scripts/verifySyntheticE2eAndroidRuntime.mjs';

describe('synthetic Android E2E runtime-completeness verifier', () => {
  it('accepts a Hermes dump containing every exact synthetic runtime value', () => {
    const dump = REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS
      .map(({ value }) => `String ${JSON.stringify(value)}`)
      .join('\n');

    expect(() => assertSyntheticE2eRuntimeCompleteness(dump)).not.toThrow();
    expect(SYNTHETIC_E2E_RUNTIME_ENVIRONMENT).toMatchObject({
      APP_VARIANT: 'synthetic-e2e',
      EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'synthetic-e2e',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        'sb_publishable_taptime_synthetic_android_e2e',
      EXPO_PUBLIC_TAPTIME_API_BASE_URL: 'http://127.0.0.1:3000',
      EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
    });
  });

  it.each(REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS)(
    'rejects a Hermes dump missing $name',
    ({ name, value: omitted }) => {
      const incompleteDump = REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS
        .filter(({ value }) => value !== omitted)
        .map(({ value }) => `String ${JSON.stringify(value)}`)
        .join('\n');

      expect(() => assertSyntheticE2eRuntimeCompleteness(incompleteDump))
        .toThrow(name);
    },
  );

  it('uses only the injected exact unzip and hermesc paths', () => {
    const unzipPath = '/synthetic/tools/unzip';
    const hermesCompilerPath = '/synthetic/tools/hermesc';
    const runtimeDump = REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS
      .map(({ value }) => `String ${JSON.stringify(value)}`)
      .join('\n');
    const run = vi.fn((
      command: string,
      arguments_: readonly string[],
    ) => {
      if (command === unzipPath && arguments_[0] === '-Z1') {
        return { stdout: 'assets/index.android.bundle\n' };
      }
      if (command === unzipPath && arguments_[0] === '-p') {
        return { stdout: Buffer.from('synthetic-hermes-bundle') };
      }
      if (command === hermesCompilerPath) {
        return { stdout: runtimeDump };
      }
      throw new Error(`unexpected command: ${command}`);
    });
    const dependencies = {
      exists: vi.fn(() => true),
      mkdtemp: vi.fn(() => '/synthetic/runtime-temp'),
      remove: vi.fn(),
      run,
      tmpdir: vi.fn(() => '/synthetic'),
      writeFile: vi.fn(),
      writeOutput: vi.fn(),
    };

    expect(() => verifySyntheticE2eAndroidRuntime(
      '/synthetic/candidate.apk',
      {
        dependencies,
        hermesCompilerPath,
        unzipPath,
      },
    )).not.toThrow();
    expect(run.mock.calls.map(([command]) => command)).toEqual([
      unzipPath,
      unzipPath,
      hermesCompilerPath,
    ]);
    expect(dependencies.remove).toHaveBeenCalledWith(
      '/synthetic/runtime-temp',
    );
  });

  it.each(['unzipPath', 'hermesCompilerPath'] as const)(
    'rejects a non-canonical injected %s before command execution',
    (field) => {
      const run = vi.fn();
      expect(() => verifySyntheticE2eAndroidRuntime(
        '/synthetic/candidate.apk',
        {
          dependencies: {
            exists: vi.fn(() => true),
            mkdtemp: vi.fn(),
            remove: vi.fn(),
            run,
            tmpdir: vi.fn(),
            writeFile: vi.fn(),
            writeOutput: vi.fn(),
          },
          hermesCompilerPath: '/synthetic/tools/hermesc',
          unzipPath: '/synthetic/tools/unzip',
          [field]: 'unzip',
        },
      )).toThrow(/not canonical/u);
      expect(run).not.toHaveBeenCalled();
    },
  );
});
