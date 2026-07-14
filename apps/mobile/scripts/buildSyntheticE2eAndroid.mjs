import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobileDirectory = fileURLToPath(new URL('..', import.meta.url));
const androidDirectory = fileURLToPath(new URL('../android', import.meta.url));
const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
const androidSdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
if (androidSdk === undefined || !existsSync(androidSdk)) {
  throw new Error('Synthetic E2E local build requires ANDROID_HOME or ANDROID_SDK_ROOT');
}
run('java', ['-version'], { capture: true });
const trackedAndroid = run('git', ['ls-files', 'android'], { capture: true }).stdout.trim();
if (trackedAndroid.length > 0) {
  throw new Error('Synthetic E2E prebuild refuses to replace a tracked Android project');
}
if (existsSync(androidDirectory)) {
  throw new Error(
    'Synthetic E2E prebuild refuses to replace an existing untracked Android project',
  );
}

const environment = {
  ...process.env,
  APP_VARIANT: 'synthetic-e2e',
  EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'synthetic-e2e',
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_taptime_synthetic_android_e2e',
  EXPO_PUBLIC_TAPTIME_API_BASE_URL: 'http://127.0.0.1:3000',
  EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
};

const packageJsonBeforePrebuild = readFileSync(packageJsonPath, 'utf8');
try {
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], {
    environment,
  });
} finally {
  if (readFileSync(packageJsonPath, 'utf8') !== packageJsonBeforePrebuild) {
    writeFileSync(packageJsonPath, packageJsonBeforePrebuild, 'utf8');
  }
}
run('./gradlew', ['assembleRelease'], {
  cwd: androidDirectory,
  environment,
});
process.stdout.write('synthetic_e2e_android_apk_ready\n');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? mobileDirectory,
    env: options.environment ?? process.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Synthetic E2E build command failed: ${command}`);
  }
  return result;
}
