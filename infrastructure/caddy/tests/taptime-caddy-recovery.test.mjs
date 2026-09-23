import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

// Host bind mounts are essential to this test, just as for the real Compose service.
const root = mkdtempSync(join(process.cwd(), '.t031-local-'));
const composeFile = join(root, 'compose.yml');
const state = join(root, 'state');
const env = { ...process.env, COMPOSE_PROJECT_NAME: `t031-recovery-${process.pid}`,
  TAPTIME_DEPLOY_COMPOSE_FILE: composeFile, TAPTIME_DEPLOY_CADDY_STATE_DIRECTORY: state,
  TAPTIME_DEPLOY_POSTGRES_VOLUME_STATE_FILE: join(root, 'absent-volume-state') };
const run = (...args) => execFileSync('docker', args, { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const compose = (...args) => run('compose', '--file', composeFile, ...args);
const shell = code => spawnSync('bash', ['-c', 'set -euo pipefail; source infrastructure/deploy; PREVIOUS_VERSION=aaaaaaa; DESIRED_VERSION=bbbbbbb; ' + code],
  { env, encoding: 'utf8' });
const ok = result => assert.equal(result.status, 0, result.stdout + result.stderr);
let port;
const response = async () => (await fetch(`http://127.0.0.1:${port}/`, { headers: { Connection: 'close' } })).text();
async function ready(expected) {
  const id = compose('ps', '--all', '--quiet', 'caddy');
  port = run('inspect', '--format', '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}', id);
  for (let i = 0; i < 50; i++) {
    try { if (await response() === expected) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`Caddy did not serve ${expected}`);
}
async function replaceCaddyfile(content) {
  writeFileSync(join(root, 'Caddyfile'), content, { flush: true });
  // Colima's shared-file metadata may lag an in-place host write. Check what Caddy
  // can actually read before exercising its load behavior; never retry the load itself.
  const id = compose('ps', '--all', '--quiet', 'caddy');
  for (let i = 0; i < 50; i++) {
    if (run('exec', id, 'cat', '/etc/caddy/Caddyfile') === content.trim()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('The candidate file is not yet visible in the mounted service');
}
before(async () => {
  writeFileSync(join(root, 'Caddyfile'), ':8080 {\n respond "old"\n}\n');
  writeFileSync(composeFile, JSON.stringify({ services: { caddy: {
    image: 'caddy:2.10.2-alpine', restart: 'unless-stopped', ports: ['127.0.0.1:0:8080'],
    volumes: [`${root}/Caddyfile:/etc/caddy/Caddyfile:ro`],
  } } }));
  compose('up', '--detach', '--no-deps', 'caddy');
  await ready('old');
});
after(() => {
  try { compose('down', '--volumes', '--remove-orphans'); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test('real API snapshot is private and validated with the live mounts', () => {
  ok(shell('save_running_caddy'));
  assert.equal(statSync(state).mode & 0o777, 0o700);
  assert.equal(statSync(join(state, 'running.json')).mode & 0o777, 0o600);
  assert.ok(JSON.parse(readFileSync(join(state, 'running.json'), 'utf8')).apps.http);
});
test('candidate validation uses the actual service mounts and rejects a missing hash', async () => {
  await replaceCaddyfile( ':8080 {\n basic_auth {\n pilot {file./srv/missing-hash}\n }\n respond "new"\n}\n');
  assert.notEqual(shell('validate_caddy_candidate "$COMPOSE_FILE" bbbbbbb').status, 0);
});
test('real rejected reload preserves the edge; explicit snapshot restore matches GET bytes', async () => {
  const id = compose('ps', '--all', '--quiet', 'caddy');
  const rejected = spawnSync('docker', ['exec', id, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile', '--force'], { env, encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
  assert.equal(await response(), 'old');
  ok(shell('CADDY_RECOVERY_READY=1; restore_caddy_configuration'));
  await ready('old');
});
test('a live but wrong edge stays restored after a normal container restart', async () => {
  await replaceCaddyfile( ':8080 {\n respond "wrong"\n}\n');
  const id = compose('ps', '--all', '--quiet', 'caddy');
  run('exec', id, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile', '--force');
  assert.equal(await response(), 'wrong');
  ok(shell('CADDY_RECOVERY_READY=1; restore_caddy_configuration'));
  await ready('old');
  run('restart', compose('ps', '--all', '--quiet', 'caddy'));
  await ready('old');
});
test('a running container with an unreachable admin API falls back to the exact saved JSON', async () => {
  await replaceCaddyfile( '{\n admin off\n}\n:8080 {\n respond "wrong"\n}\n');
  const id = compose('ps', '--all', '--quiet', 'caddy');
  run('exec', id, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile', '--force');
  assert.equal(await response(), 'wrong');
  ok(shell('CADDY_RECOVERY_READY=1; restore_caddy_configuration'));
  await ready('old');
});
test('a failed container starts with the exact saved JSON, despite an invalid Caddyfile', async () => {
  await replaceCaddyfile( 'invalid-caddyfile {\n totally_invalid_directive\n}\n');
  compose('up', '--detach', '--no-deps', '--force-recreate', 'caddy');
  const id = compose('ps', '--all', '--quiet', 'caddy');
  let restarting = false;
  for (let i = 0; i < 50; i++) {
    restarting = run('inspect', '--format', '{{.State.Restarting}}', id) === 'true';
    if (restarting) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(restarting, true);
  ok(shell('CADDY_RECOVERY_READY=1; restore_caddy_configuration'));
  await ready('old');
  const restored = compose('ps', '--all', '--quiet', 'caddy');
  assert.deepEqual(JSON.parse(run('inspect', '--format', '{{json .Config.Cmd}}', restored)),
    ['caddy', 'run', '--config', '/etc/caddy/taptime-recovery.json']);
});
