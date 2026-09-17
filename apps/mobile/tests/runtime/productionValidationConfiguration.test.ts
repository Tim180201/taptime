import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mobileDirectory = fileURLToPath(new URL('../..', import.meta.url));

describe('production validation build configuration', () => {
  it('excludes the encrypted offline store and its key from Android backup and transfer', async () => {
    const require = createRequire(import.meta.url);
    const appConfig = require('../../app.json').expo;
    expect(appConfig.android.allowBackup).toBe(false);
    expect(appConfig.plugins).toContain('./plugins/withOfflineStorageBackupBoundary');
    expect(appConfig.plugins).toContainEqual(['expo-secure-store', { configureAndroidBackup: false }]);
    expect(appConfig.plugins).toContainEqual(['expo-sqlite', { useSQLCipher: true }]);

    const withBackupBoundary = require('../../plugins/withOfflineStorageBackupBoundary');
    const config = withBackupBoundary({ name: 'Backup boundary test', slug: 'backup-boundary-test' });
    const manifest = await config.mods.android.manifest({
      ...config,
      modRequest: {},
      modResults: { manifest: { application: [{ $: { 'android:allowBackup': 'true' } }] } },
    });
    expect(manifest.modResults.manifest.application[0].$).toMatchObject({
      'android:allowBackup': 'false',
      'android:fullBackupContent': '@xml/taptime_offline_backup_rules',
      'android:dataExtractionRules': '@xml/taptime_offline_data_extraction_rules',
    });

    const directory = await mkdtemp(join(tmpdir(), 'taptime-backup-boundary-'));
    try {
      await config.mods.android.dangerous({
        ...config, modRequest: { platformProjectRoot: directory },
      });
      const xmlDirectory = join(directory, 'app/src/main/res/xml');
      const backup = await readFile(join(xmlDirectory, 'taptime_offline_backup_rules.xml'), 'utf8');
      const extraction = await readFile(join(xmlDirectory, 'taptime_offline_data_extraction_rules.xml'), 'utf8');
      const cloudBackup = extraction.match(/<cloud-backup[^>]*>([\s\S]*?)<\/cloud-backup>/)?.[1];
      const deviceTransfer = extraction.match(/<device-transfer>([\s\S]*?)<\/device-transfer>/)?.[1];
      for (const rules of [backup, cloudBackup, deviceTransfer]) {
        expect(rules).toContain('<exclude domain="sharedpref" path="SecureStore" />');
        expect(rules).toContain('<exclude domain="file" path="SQLite" />');
        expect(rules).toContain('<exclude domain="database" path="." />');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

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
