import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobileDirectory = fileURLToPath(new URL('..', import.meta.url));
const devices = run('adb', ['devices'], true).stdout
  .split('\n')
  .slice(1)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 2 && parts[1] === 'device');
if (devices.length !== 1) {
  throw new Error('Synthetic E2E disconnect requires exactly one trusted Android device');
}

const requiredMappings = [
  { device: 'tcp:54321', host: 'tcp:54321' },
  { device: 'tcp:3000', host: 'tcp:3000' },
];
const activeMappings = parseReverseMappings(run('adb', ['reverse', '--list'], true).stdout);
for (const required of requiredMappings) {
  const active = activeMappings.find((mapping) => mapping.device === required.device);
  if (active !== undefined && active.host !== required.host) {
    throw new Error('Synthetic E2E disconnect found an unexpected reverse mapping');
  }
}
for (const { device } of requiredMappings) {
  if (activeMappings.some((mapping) => mapping.device === device)) {
    run('adb', ['reverse', '--remove', device]);
  }
}

const remainingMappings = parseReverseMappings(run('adb', ['reverse', '--list'], true).stdout);
if (requiredMappings.some(({ device }) => (
  remainingMappings.some((mapping) => mapping.device === device)
))) {
  throw new Error('Synthetic E2E reverse mappings were not removed');
}
process.stdout.write('synthetic_e2e_loopback_reverse_removed\n');

function parseReverseMappings(value) {
  return value
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts.at(-2)?.startsWith('tcp:'))
    .map((parts) => ({ device: parts.at(-2), host: parts.at(-1) }));
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
