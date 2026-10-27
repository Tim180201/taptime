import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const directory = fileURLToPath(new URL('.', import.meta.url));
test('PostgreSQL probe requires opt-in before accessing Docker', () => {
  const result = spawnSync(process.execPath, [`${directory}/postgres-probe.mjs`], {
    env: { ...process.env, TAPTIME_BACKUP_SCALE: '', DOCKER_HOST: 'ssh://must-not-be-contacted.invalid' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set TAPTIME_BACKUP_SCALE=synthetic-local-only/);
});
test('preflight refuses remote Docker endpoints before inspecting an image', () => {
  for (const endpoint of ['ssh://must-not-be-contacted.invalid', 'tcp://192.0.2.1:2375']) {
    const result = spawnSync(process.execPath, [`${directory}/preflight.mjs`, 'synthetic-unused'], {
      env: { ...process.env, DOCKER_HOST: endpoint }, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Only a local Docker Unix socket is allowed/);
  }
});
