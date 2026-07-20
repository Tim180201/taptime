import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  verifySyntheticE2eAndroidRuntime,
} from './verifySyntheticE2eAndroidRuntime.mjs';

const mobileDirectory = fileURLToPath(new URL('..', import.meta.url));
const apk = fileURLToPath(new URL(
  '../android/app/build/outputs/apk/release/app-release.apk',
  import.meta.url,
));
if (!existsSync(apk)) {
  throw new Error('Synthetic E2E APK is missing; run the local build first');
}
verifySyntheticE2eAndroidRuntime(apk);

const devices = run('adb', ['devices'], true).stdout
  .split('\n')
  .slice(1)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 2 && parts[1] === 'device');
if (devices.length !== 1) {
  throw new Error('Synthetic E2E install requires exactly one trusted Android device');
}

if (parseReverseMappings(run('adb', ['reverse', '--list'], true).stdout).length !== 0) {
  throw new Error('Synthetic E2E install requires an empty adb reverse table');
}

const requiredMappings = [
  ['tcp:54321', 'tcp:54321'],
  ['tcp:3000', 'tcp:3000'],
];
try {
  for (const mapping of requiredMappings) {
    run('adb', ['reverse', ...mapping]);
  }
  const activeMappings = parseReverseMappings(run('adb', ['reverse', '--list'], true).stdout);
  if (
    activeMappings.length !== requiredMappings.length
    || requiredMappings.some(([device, host]) => (
      !activeMappings.some((mapping) => mapping.device === device && mapping.host === host)
    ))
  ) {
    throw new Error('Synthetic E2E adb reverse table does not contain exactly the required ports');
  }
  run('adb', ['install', '-r', apk]);
} catch (error) {
  for (const [device] of requiredMappings) {
    runBestEffort('adb', ['reverse', '--remove', device]);
  }
  throw error;
}
process.stdout.write([
  'synthetic_e2e_android_installed_with_loopback_reverse',
  'cleanup_required=npm run android:synthetic-e2e:disconnect --workspace=@taptime/mobile',
  '',
].join('\n'));

function parseReverseMappings(value) {
  return value
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts.at(-2)?.startsWith('tcp:'))
    .map((parts) => ({ device: parts.at(-2), host: parts.at(-1) }));
}

function runBestEffort(command, args) {
  spawnSync(command, args, {
    cwd: mobileDirectory,
    encoding: 'utf8',
    stdio: 'ignore',
  });
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: mobileDirectory,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Synthetic E2E device command failed: ${command}`);
  }
  return result;
}
