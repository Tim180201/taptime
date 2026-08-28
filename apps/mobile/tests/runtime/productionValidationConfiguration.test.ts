import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mobileDirectory = fileURLToPath(new URL('../..', import.meta.url));

describe('production validation build configuration', () => {
  it('builds an internal APK with a separate identity and the production runtime', async () => {
    const [easSource, packageSource, buildSource] = await Promise.all([
      readFile(fileURLToPath(new URL('../../eas.json', import.meta.url)), 'utf8'),
      readFile(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
      readFile(fileURLToPath(new URL(
        '../../scripts/buildProductionValidationAndroid.mjs',
        import.meta.url,
      )), 'utf8'),
    ]);
    const eas = JSON.parse(easSource) as {
      readonly build: Readonly<Record<string, {
        readonly distribution: string;
        readonly env: Readonly<Record<string, string>>;
        readonly android: { readonly buildType: string };
      }>>;
    };
    const packageJson = JSON.parse(packageSource) as {
      readonly scripts: Readonly<Record<string, string>>;
    };
    const profile = eas.build['production-validation'];
    expect(profile).toBeDefined();
    expect(profile.distribution).toBe('internal');
    expect(profile.android.buildType).toBe('apk');
    expect(profile.env).toMatchObject({
      APP_VARIANT: 'production-validation',
      EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'production-validation',
      EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
      EXPO_PUBLIC_TAPTIME_API_BASE_URL: 'https://api.tb-infra.de',
    });
    expect(profile.env.EXPO_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\/[a-z]+\.supabase\.co$/u);
    expect(profile.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toMatch(/^sb_publishable_[\w-]+$/u);
    expect(packageJson.scripts['android:production-validation:build']).toBe(
      'node scripts/buildProductionValidationAndroid.mjs',
    );
    expect(packageJson.scripts['eas-build-post-install']).toBe(
      'npm run build --workspace=@taptime/mobile-work-contract'
      + ' && npm run build --workspace=@taptime/offline-sync-contract'
      + ' && npm run build --workspace=@taptime/time-review-contract',
    );
    expect(buildSource).toContain("['diff', '--quiet', 'HEAD', '--', ...sourcePathspec]");
    expect(buildSource).toContain("'packages/mobile-work-contract'");
    expect(buildSource).toContain("'package-lock.json'");
    expect(buildSource).not.toContain("'infrastructure'");
    expect(buildSource).toContain("'eas-cli@23.0.0'");
    expect(buildSource).toContain("'production-validation'");
    expect(buildSource).toContain('EAS_BUILD_GIT_COMMIT_HASH: sourceCommit');

    const commit = '5e461f581b8e4cba7ec11168b15a76d40c615a9b';
    const script = `
      const config = require('./app.config.js');
      process.stdout.write(JSON.stringify({
        extra: config.extra,
        name: config.name,
        packageName: config.android.package,
        scheme: config.scheme,
      }));
    `;
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: mobileDirectory,
      encoding: 'utf8',
      env: { ...process.env, ...profile.env, EAS_BUILD_GIT_COMMIT_HASH: commit },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      extra: {
        eas: { projectId: 'a585d394-130a-41d9-af16-53038ce2e7ff' },
        taptimeBuild: { sourceCommit: commit },
      },
      name: 'TapTim.e Produktionstest',
      packageName: 'com.tim180201.mobile.productionvalidation',
      scheme: 'taptime-production-validation',
    });
  });
});
