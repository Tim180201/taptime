import { readDirectoryAsync, makeDirectoryAsync, deleteAsync } from 'expo-file-system/legacy';
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' }));
vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({ readDirectoryAsync: vi.fn(), makeDirectoryAsync: vi.fn(), deleteAsync: vi.fn() }));
import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
  defaultDatabaseDirectory: '/app/SQLite',
}));

import {
  ExpoSqliteConnection,
  expoOfflineDatabaseFiles,
} from '../../src/offline/ExpoOfflineCaptureDatabase';

const keyHex = '1a'.repeat(32);
const keyPragma = `PRAGMA key = "x'${keyHex}'"`;

describe('ExpoOfflineCaptureDatabase native connection boundary', () => {
  it('propagates a failed file inventory instead of treating it as empty', async () => {
    vi.mocked(makeDirectoryAsync).mockResolvedValue();
    vi.mocked(readDirectoryAsync).mockRejectedValueOnce(new Error('unreadable directory'));
    await expect(expoOfflineDatabaseFiles().list()).rejects.toThrow('unreadable directory');
    expect(readDirectoryAsync).toHaveBeenCalledWith('file:///app/SQLite');
  });

  it('removes only a validated generation and all its SQLite sidecars', async () => {
    vi.mocked(deleteAsync).mockClear();
    await expoOfflineDatabaseFiles().remove('taptime-offline-v1.db');
    expect(vi.mocked(deleteAsync).mock.calls.map(call => call[0])).toEqual(
      ['', '-wal', '-shm', '-journal'].map(s => 'file:///app/SQLite/taptime-offline-v1.db' + s),
    );
    await expect(expoOfflineDatabaseFiles().remove('../foreign.db')).rejects.toThrow('Invalid offline database name');
    expect(deleteAsync).toHaveBeenCalledTimes(4);
  });

  it('keeps keying, BEGIN and every schema/data statement on the same actor connection',
    async () => {
    const main = fakeDatabase();
    const connection = new ExpoSqliteConnection(main.database);

    await connection.execAsync(keyPragma);
    await connection.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('UPDATE offline_owner SET capture_invalidated = 1');
    });

    expect(main.execLog).toEqual([
      keyPragma,
      'BEGIN EXCLUSIVE',
      'UPDATE offline_owner SET capture_invalidated = 1',
      'COMMIT',
    ]);
  });

  it('rolls back the actor connection when the exclusive task fails', async () => {
    const main = fakeDatabase();
    const connection = new ExpoSqliteConnection(main.database);

    await expect(connection.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('INSERT INTO offline_owner DEFAULT VALUES');
      throw new Error('synthetic transaction failure');
    })).rejects.toThrow('synthetic transaction failure');

    expect(main.execLog).toEqual([
      'BEGIN EXCLUSIVE',
      'INSERT INTO offline_owner DEFAULT VALUES',
      'ROLLBACK',
    ]);
  });
});

function fakeDatabase() {
  const execLog: string[] = [];
  const database = {
    async execAsync(source: string) {
      execLog.push(source);
    },
    async closeAsync() {},
  } as unknown as SQLiteDatabase;
  return { database, execLog };
}
