import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  ExpoSqliteConnection,
} from '../../src/offline/ExpoOfflineCaptureDatabase';

const keyHex = '1a'.repeat(32);
const keyPragma = `PRAGMA key = "x'${keyHex}'"`;

describe('ExpoOfflineCaptureDatabase native connection boundary', () => {
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
