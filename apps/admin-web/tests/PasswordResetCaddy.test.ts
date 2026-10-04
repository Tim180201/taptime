// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';

const container = `taptime-t094b-${randomUUID()}`;
let directory: string | undefined;
let origin: string;
const index = '<!doctype html><title>T-094b actual Caddy SPA fallback</title>';
const docker = (...args: string[]) => execFileSync('docker', args, {
  encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
});

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'taptime-t094b-'));
  const production = readFileSync(new URL('../../../infrastructure/caddy/Caddyfile', import.meta.url), 'utf8');
  const admin = production.match(/^admin\.tb-infra\.de \{[\s\S]*?^\}/m)?.[0];
  if (admin === undefined) throw new Error('Missing production Admin Web block');
  // Only replace the listen address. All handlers, headers and roots are production code.
  writeFileSync(join(directory, 'Caddyfile'), admin.replace('admin.tb-infra.de', ':8080'));
  mkdirSync(join(directory, 'admin-web', 'current'), { recursive: true });
  writeFileSync(join(directory, 'admin-web', 'current', 'index.html'), index);
  docker('create', '--name', container, '--publish', '127.0.0.1:0:8080',
    'caddy:2.10.2-alpine', 'caddy', 'run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile');
  docker('cp', join(directory, 'Caddyfile'), `${container}:/etc/caddy/Caddyfile`);
  docker('cp', join(directory, 'admin-web'), `${container}:/srv/admin-web`);
  docker('start', container);
  const port = docker('inspect', '--format', '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}', container).trim();
  origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  while (true) {
    try { if ((await fetch(origin)).ok) break; } catch { /* wait for the listener */ }
    if (Date.now() >= deadline) throw new Error('Local Caddy did not start');
    await setTimeout(100);
  }
}, 60_000);

afterAll(() => {
  try { docker('rm', '--force', container); } finally {
    if (directory !== undefined) rmSync(directory, { recursive: true, force: true });
  }
});

it('serves /passwort-neu as index.html through the real production SPA boundary', async () => {
  const response = await fetch(`${origin}/passwort-neu`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(await response.text()).toBe(index);
  const home = await fetch(origin);
  expect(await home.text()).toBe(index);
});
