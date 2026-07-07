import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildScanDemoPipeline, DEMO_KNOWN_PAYLOAD, type ScanDemoStorageOptions } from '../../src/cli/runScan';
import { FileOfflineQueue } from '../../src/infrastructure/persistence/FileOfflineQueue';
import { FileWorkEventRepository } from '../../src/infrastructure/persistence/FileWorkEventRepository';
import { FileTimeEntryRepository } from '../../src/infrastructure/persistence/FileTimeEntryRepository';

// Mirrors runScanCli.ts's buildDurableStorage() - this is a Node/Vitest test, not part of the
// apps/mobile bundle, so it is safe to import fs/path-dependent adapters directly here.
function buildDurableStorage(directory: string): ScanDemoStorageOptions {
  return {
    workEventRepository: new FileWorkEventRepository(join(directory, 'work-events.json')),
    timeEntryRepository: new FileTimeEntryRepository(join(directory, 'time-entries.json')),
    offlineQueue: new FileOfflineQueue(join(directory, 'offline-queue.json')),
  };
}

// DT-015: proves buildScanDemoPipeline's storage-selection extension is additive, not a
// behavior change - mirroring runScan.callerOverride.test.ts's proof style from Sprint 008.
// Omitting the option preserves today's in-memory-only behavior unchanged; supplying durable
// adapters proves storage that survives a fresh pipeline instance (simulated process
// restart), which is the core proof this sprint exists to deliver.
describe('buildScanDemoPipeline storage-selection support (DT-015)', () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'taptime-run-scan-storage-'));
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('preserves the existing in-memory-only default when no storage option is supplied', () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line));

    const outcome = pipeline.scan(DEMO_KNOWN_PAYLOAD);

    expect(outcome.stage).toBe('validation');
    expect(lines.some((line) => line.includes('accepted and started'))).toBe(true);
  });

  it('accepts explicit durable-storage adapters and produces the same accepted outcome as the in-memory default', () => {
    const lines: string[] = [];
    const pipeline = buildScanDemoPipeline((line) => lines.push(line), buildDurableStorage(tempDirectory));

    const outcome = pipeline.scan(DEMO_KNOWN_PAYLOAD);

    expect(outcome.stage).toBe('validation');
    expect(lines.some((line) => line.includes('accepted and started'))).toBe(true);
  });

  it('a TimeEntry written by one pipeline instance is still present when a fresh instance reads the same directory (simulated process restart)', () => {
    const firstLines: string[] = [];
    const firstPipeline = buildScanDemoPipeline((line) => firstLines.push(line), buildDurableStorage(tempDirectory));
    firstPipeline.scan(DEMO_KNOWN_PAYLOAD);
    expect(firstLines.some((line) => line.includes('accepted and started'))).toBe(true);

    const secondLines: string[] = [];
    const secondPipeline = buildScanDemoPipeline((line) => secondLines.push(line), buildDurableStorage(tempDirectory));
    secondPipeline.scan(DEMO_KNOWN_PAYLOAD);

    // A second scan against the same durable target, from a fresh pipeline instance built
    // from fresh adapter instances, only escalates (rather than starting a second TimeEntry)
    // if the first instance's TimeEntry actually survived on disk and was read back - this is
    // the core proof of durability.
    expect(secondLines.some((line) => line.includes('accepted but escalated'))).toBe(true);
  });

  it('does not leak state between two different storage directories', () => {
    const otherTempDirectory = mkdtempSync(join(tmpdir(), 'taptime-run-scan-storage-other-'));
    try {
      const firstPipeline = buildScanDemoPipeline(() => {}, buildDurableStorage(tempDirectory));
      firstPipeline.scan(DEMO_KNOWN_PAYLOAD);

      const otherDirectoryLines: string[] = [];
      const secondPipeline = buildScanDemoPipeline(
        (line) => otherDirectoryLines.push(line),
        buildDurableStorage(otherTempDirectory),
      );
      secondPipeline.scan(DEMO_KNOWN_PAYLOAD);

      // A fresh directory has no prior TimeEntry, so this scan starts (not escalates) - proof
      // that the two directories are genuinely isolated, not sharing hidden in-process state.
      expect(otherDirectoryLines.some((line) => line.includes('accepted and started'))).toBe(true);
    } finally {
      rmSync(otherTempDirectory, { recursive: true, force: true });
    }
  });
});
