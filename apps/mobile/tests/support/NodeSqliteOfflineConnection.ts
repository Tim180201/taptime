import { DatabaseSync } from 'node:sqlite';
import type { OfflineDatabaseConnection, OfflineSqlParams, OfflineSqlValue } from '../../src/offline/OfflineCaptureDatabase';

export class NodeSqliteOfflineConnection implements OfflineDatabaseConnection {
  private readonly database: DatabaseSync;

  constructor(filename = ':memory:') {
    this.database = new DatabaseSync(filename);
  }

  async execAsync(source: string): Promise<void> {
    this.database.exec(source);
  }

  async runAsync(
    source: string,
    params: OfflineSqlParams,
  ): Promise<{ readonly changes: number }> {
    const result = this.database.prepare(source).run(...sqliteValues(params));
    return { changes: Number(result.changes) };
  }

  async getFirstAsync<Row>(
    source: string,
    params: OfflineSqlParams = [],
  ): Promise<Row | null> {
    return (this.database.prepare(source).get(...sqliteValues(params)) as Row | undefined)
      ?? null;
  }

  async getAllAsync<Row>(
    source: string,
    params: OfflineSqlParams = [],
  ): Promise<Row[]> {
    return this.database.prepare(source).all(...sqliteValues(params)) as Row[];
  }

  async withExclusiveTransactionAsync(
    task: (transaction: OfflineDatabaseConnection) => Promise<void>,
  ): Promise<void> {
    this.database.exec('BEGIN EXCLUSIVE');
    try {
      await task(this);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.database.close();
  }
}

function sqliteValues(params: OfflineSqlParams): OfflineSqlValue[] {
  if (!Array.isArray(params)) {
    throw new TypeError('This real SQLite fixture accepts positional parameters only');
  }
  return [...params] as OfflineSqlValue[];
}
