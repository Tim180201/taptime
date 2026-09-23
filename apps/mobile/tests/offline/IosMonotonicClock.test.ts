import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleRoot = new URL('../../modules/taptime-monotonic-clock/', import.meta.url);

describe('D-082 iOS native clock', () => {
  it('registers the same native capability on Apple without changing its Android registration', () => {
    const config = JSON.parse(readFileSync(new URL('expo-module.config.json', moduleRoot), 'utf8'));
    expect(config.platforms).toContain('apple');
    expect(config.apple.modules).toContain('TapTimeMonotonicClockModule');
    expect(config.android).toEqual({ modules: ['com.taptime.monotonicclock.TapTimeMonotonicClockModule'] });
  });

  // Runs the production Swift policy itself; no JS reimplementation and no app build.
  // Linux CI has no Swift runtime. The macOS task must run this before handoff.
  it.skipIf(process.platform !== 'darwin')('preserves and rotates native persisted evidence according to D-082', () => {
    const directory = mkdtempSync(join(tmpdir(), 'taptime-ios-clock-test-'));
    try {
      const source = readFileSync(new URL('ios/IosClockState.swift', moduleRoot), 'utf8');
      const assertions = readFileSync(new URL('./IosClockStateAssertions.swift', import.meta.url), 'utf8');
      const script = join(directory, 'ClockTests.swift');
      writeFileSync(script, `${source}\n${assertions}`);
      const result = spawnSync('/usr/bin/swift', [script], { encoding: 'utf8', timeout: 60_000 });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('D-082 clock scenarios passed');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }, 65_000);
});
