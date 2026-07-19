import {
  openDatabaseAsync,
  type SQLiteBindParams,
  type SQLiteDatabase,
} from 'expo-sqlite';
import {
  OfflineCaptureDatabase,
  type OfflineDatabaseConnection,
  type OfflineSqlParams,
} from './OfflineCaptureDatabase';
import { bytesToLowercaseHex } from './encoding';

let actor:
  | {
      readonly keyHex: string;
      readonly database: OfflineCaptureDatabase;
    }
  | null = null;

export function getExpoOfflineCaptureDatabase(
  databaseKey: Uint8Array,
): OfflineCaptureDatabase {
  const keyHex = bytesToLowercaseHex(databaseKey);
  if (actor !== null) {
    if (actor.keyHex !== keyHex) {
      throw new Error('Offline database actor is already bound to another key');
    }
    return actor.database;
  }
  const database = new OfflineCaptureDatabase(
    async (databaseName) => new ExpoSqliteConnection(
      await openDatabaseAsync(databaseName, { useNewConnection: false }),
    ),
    databaseKey,
  );
  actor = { keyHex, database };
  return database;
}

class ExpoSqliteConnection implements OfflineDatabaseConnection {
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
    return this.database.withExclusiveTransactionAsync(
      async (transaction) => task(new ExpoSqliteConnection(transaction)),
    );
  }

  closeAsync(): Promise<void> {
    return this.database.closeAsync();
  }
}
