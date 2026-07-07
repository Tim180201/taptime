import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readJsonArray, writeJsonArray } from '../../../src/infrastructure/persistence/JsonFileStore';

interface SampleRecord {
  readonly id: string;
  readonly value: number;
}

// DT-015 spike (Development Sprint 010 Plan, Section 14 step 1): prove the shared file-store
// helper round-trips correctly against a temp directory before any adapter is built on it.
describe('JsonFileStore (DT-015 spike)', () => {
  let tempDirectory: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'taptime-json-file-store-'));
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('returns an empty array when the file does not exist yet', () => {
    const filePath = join(tempDirectory, 'missing.json');

    expect(readJsonArray<SampleRecord>(filePath)).toEqual([]);
  });

  it('writes and re-reads an array of plain objects, round-tripping exactly', () => {
    const filePath = join(tempDirectory, 'records.json');
    const records: SampleRecord[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];

    writeJsonArray(filePath, records);

    expect(readJsonArray<SampleRecord>(filePath)).toEqual(records);
  });

  it('creates intermediate directories that do not exist yet', () => {
    const filePath = join(tempDirectory, 'nested', 'deeper', 'records.json');

    writeJsonArray(filePath, [{ id: 'a', value: 1 }]);

    expect(readJsonArray<SampleRecord>(filePath)).toEqual([{ id: 'a', value: 1 }]);
  });

  it('overwrites the previous contents on a second write', () => {
    const filePath = join(tempDirectory, 'records.json');
    writeJsonArray(filePath, [{ id: 'a', value: 1 }]);

    writeJsonArray(filePath, [{ id: 'b', value: 2 }]);

    expect(readJsonArray<SampleRecord>(filePath)).toEqual([{ id: 'b', value: 2 }]);
  });

  it('treats an empty file as an empty array rather than a parse error', () => {
    const filePath = join(tempDirectory, 'empty.json');
    writeJsonArray(filePath, []);

    expect(readJsonArray<SampleRecord>(filePath)).toEqual([]);
  });

  it('a fresh read after a write from a different logical instance sees the same data (simulated restart)', () => {
    const filePath = join(tempDirectory, 'records.json');
    writeJsonArray(filePath, [{ id: 'a', value: 1 }]);

    // A "fresh instance" here is simply a new read call - the helper is stateless, so this
    // directly proves durability across what would be a process restart for a stateful caller.
    const reReadRecords = readJsonArray<SampleRecord>(filePath);

    expect(reReadRecords).toEqual([{ id: 'a', value: 1 }]);
  });
});
