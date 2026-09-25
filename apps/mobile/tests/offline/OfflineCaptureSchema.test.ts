import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { OFFLINE_SCHEMA_V6 } from '../../src/offline/OfflineCaptureDatabase';

describe('OfflineCaptureDatabase production schema', () => {
  it('executes the complete production schema with real SQLite', () => {
    expect(() => executeWithRealSqlite(OFFLINE_SCHEMA_V6)).not.toThrow();
  });

  it('rejects an intentional syntax error through the same real SQLite path', () => {
    const invalidSchema = OFFLINE_SCHEMA_V6.replace(
      'CREATE TABLE offline_owner',
      'CREATE TABL offline_owner',
    );
    expect(invalidSchema).not.toBe(OFFLINE_SCHEMA_V6);
    expect(() => executeWithRealSqlite(invalidSchema)).toThrow(/syntax error/u);
  });
});

function executeWithRealSqlite(schema: string): void {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(schema);
  } finally {
    database.close();
  }
}
