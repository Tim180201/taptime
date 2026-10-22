import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const source = path => readFileSync(path, 'utf8');
const constant = (path, name) => {
  const match = source(path).match(new RegExp(`^readonly ${name}=([0-9]+)$`, 'm'));
  assert.ok(match, `${path}: ${name} must be an explicit numeric source constant`);
  return Number(match[1]);
};
const timeout = (unit, key) => {
  const match = source(`infrastructure/backup/${unit}.service`).match(new RegExp(`^${key}=([0-9]+)(s|min|h)?$`, 'm'));
  assert.ok(match, `${unit}: ${key} must be finite`);
  return Number(match[1]) * ({ s: 1, min: 60, h: 3600 }[match[2] ?? 's']);
};
const library = resolve('infrastructure/backup/taptime-backup-workspace');
const lockWait = Number(execFileSync('bash', ['-c', 'source "$1"; unset TAPTIME_BORG_LOCK_WAIT_SECONDS; borg_lock_wait_seconds', 'sh', library], { encoding: 'utf8' }).trim());
const monitor = 'infrastructure/monitoring/taptime-immediate-monitor';

test('oneshot timeouts cover their monitor limit plus the real lock wait', () => {
  for (const [unit, name] of [['taptime-backup', 'BACKUP_PAUSE_CEILING_SECONDS'], ['taptime-restore-verify', 'RESTORE_VERIFY_PAUSE_MAX_SECONDS']]) {
    assert.ok(timeout(unit, 'TimeoutStartSec') >= constant(monitor, name) + lockWait,
      `${unit} can be killed before the monitored work and lock wait finish`);
  }
});
test('archiver lock wait exceeds every legitimate oneshot holder including stop timeout and reserve', () => {
  const archiverWait = constant('infrastructure/backup/taptime-wal-archiver', 'ARCHIVER_BORG_LOCK_WAIT_SECONDS');
  for (const unit of ['taptime-backup', 'taptime-restore-verify']) {
    assert.ok(archiverWait > timeout(unit, 'TimeoutStartSec') + timeout(unit, 'TimeoutStopSec'),
      `${unit} needs a positive cleanup reserve before the archiver times out`);
  }
});
test('bounded SSH preserves absolute executable paths and puts limits first', () => {
  for (const command of ['ssh -p 23', '/usr/bin/ssh -o ConnectTimeout=999', '/ssh']) {
    const result = execFileSync('bash', ['-c', 'source "$1"; BORG_RSH="$2"; bound_borg_ssh; printf "%s" "$BORG_RSH"', 'sh', library, command], { encoding: 'utf8' });
    assert.ok(result.startsWith(`${command.split(' ')[0]} -o ConnectTimeout=30 -o ServerAliveInterval=30 -o ServerAliveCountMax=4`));
  }
  for (const command of ['', 'rsh -p 23', 'relative/ssh -p 23', '/usr/bin/ssh-wrapper -p 23']) {
    assert.throws(() => execFileSync('bash', ['-c', 'source "$1"; BORG_RSH="$2"; bound_borg_ssh', 'sh', library, command], { stdio: 'pipe' }));
  }
});
