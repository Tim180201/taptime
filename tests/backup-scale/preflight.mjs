import { localDocker, requireLocalImage } from './local-docker.mjs';

const image = process.argv[2];
if (!image || process.argv.length !== 3) throw new Error('Usage: node tests/backup-scale/preflight.mjs EXISTING_IMAGE');
const docker = localDocker();
const details = requireLocalImage(docker, image);
/** @type {{kind: string, image: string, id: string, platform: string, measurements: boolean,
 * tools?: string, available?: boolean, reason?: string}} */
const result = { kind: 'prerequisite-check-only', image, ...details, measurements: false };
try {
  result.tools = docker(['run', '--rm', '--pull=never', '--network=none', '--read-only',
    '--entrypoint', 'sh', image, '-ec',
    'for tool in borg bash flock tar sha256sum; do command -v "$tool"; done; borg --version']).trim();
  result.available = true;
} catch {
  result.available = false;
  result.reason = 'Required tools unavailable; no installation or pull attempted.';
  process.exitCode = 2;
}
console.log(JSON.stringify(result, null, 2));
