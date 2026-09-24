import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { readDirectoryAsync, makeDirectoryAsync, deleteAsync } from 'expo-file-system/legacy';
import { OfflineAccountStorage, type OfflineDatabaseFiles } from './OfflineAccountStorage';
import {
  openDatabaseAsync,
  defaultDatabaseDirectory,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from 'expo-sqlite';
import {
  OfflineCaptureDatabase,
  type OfflineDatabaseConnection,
  type OfflineSqlParams,
} from './OfflineCaptureDatabase';
import { bytesToLowercaseHex } from './encoding';

const actors = new Map<string, { keyHex: string; database: OfflineCaptureDatabase }>();

export function getExpoOfflineCaptureDatabase(databaseKey: Uint8Array, databaseName = 'taptime-offline-v1.db'): OfflineCaptureDatabase {
  const keyHex = bytesToLowercaseHex(databaseKey);
  const actor = actors.get(databaseName);
  if (actor !== undefined) {
    if (actor.keyHex !== keyHex) throw new Error('Offline database actor is already bound to another key');
    return actor.database;
  }
  const database = new OfflineCaptureDatabase(
    async name => new ExpoSqliteConnection(await openDatabaseAsync(name, { useNewConnection: true })),
    databaseKey, databaseName,
  );
  actors.set(databaseName, { keyHex, database });
  return database;
}

let accountStorage: OfflineAccountStorage | undefined;
export function getExpoOfflineAccountStorage(): OfflineAccountStorage {
  return accountStorage ??= new OfflineAccountStorage(SecureStore, getRandomBytesAsync,
    getExpoOfflineCaptureDatabase, expoOfflineDatabaseFiles());
}

export function expoOfflineDatabaseFiles(): OfflineDatabaseFiles {
  return {
      async list() {
        const directory = databaseDirectory();
        await makeDirectoryAsync(directory, { intermediates: true });
        // The legacy API throws on an unreadable directory; Directory.list() can return [].
        return readDirectoryAsync(directory);
      },
      async remove(name) {
        if (name !== 'taptime-offline-v1.db' && !/^taptime-offline-g-[A-Za-z0-9_-]{43}\.db$/.test(name)) {
          throw new Error('Invalid offline database name');
        }
        await actors.get(name)?.database.close();
        for (const suffix of ['', '-wal', '-shm', '-journal']) {
          await deleteAsync(`${databaseDirectory()}/${name}${suffix}`, { idempotent: true });
        }
        actors.delete(name);
      },
    };
}
function databaseDirectory(): string {
  if (!defaultDatabaseDirectory.startsWith('/')) throw new Error('Offline database directory unavailable');
  return `file://${defaultDatabaseDirectory}`;
}

export class ExpoSqliteConnection implements OfflineDatabaseConnection {
  constructor(private readonly database: SQLiteDatabase) {}

  execAsync(source: string): Promise<void> {
    return this.database.execAsync(source);
  }

  async runAsync(
    source: string,
    params: OfflineSqlParams,
  ): Promise<{ readonly changes: number }> {
    const result = await this.database.runAsync(source, params as SQLiteBindParams);
    return { changes: result.changes };
  }

  getFirstAsync<Row>(
    source: string,
    params: OfflineSqlParams = [],
  ): Promise<Row | null> {
    return this.database.getFirstAsync<Row>(source, params as SQLiteBindParams);
  }

  getAllAsync<Row>(
    source: string,
    params: OfflineSqlParams = [],
  ): Promise<Row[]> {
    return this.database.getAllAsync<Row>(source, params as SQLiteBindParams);
  }

  withExclusiveTransactionAsync(
    task: (transaction: OfflineDatabaseConnection) => Promise<void>,
  ): Promise<void> {
    return this.withExclusiveTransaction(task);
  }

  closeAsync(): Promise<void> {
    return this.database.closeAsync();
  }

  private async withExclusiveTransaction(
    task: (transaction: OfflineDatabaseConnection) => Promise<void>,
  ): Promise<void> {
    let began = false;
    try {
      // Expo's built-in exclusive helper opens a second connection. SQLCipher keys and the
      // first-file salt are connection-local, so a fresh encrypted database must instead keep
      // keying, first-page creation and every exclusive mutation on this one actor connection.
      await this.execAsync('BEGIN EXCLUSIVE');
      began = true;
      await task(this);
      await this.execAsync('COMMIT');
    } catch (error) {
      if (began) {
        await this.execAsync('ROLLBACK').catch(() => undefined);
      }
      throw error;
    }
  }
}
