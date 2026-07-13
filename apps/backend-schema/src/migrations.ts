import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

export const B3_SCHEMA = 'taptime_server';
export const B3_MIGRATION_TABLE = 'public.taptime_server_schema_migrations';

export interface Migration {
  readonly version: string;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface MigrationResult {
  readonly applied: readonly string[];
  readonly alreadyApplied: readonly string[];
}

export class MigrationChecksumMismatchError extends Error {
  constructor(readonly version: string) {
    super(`Migration ${version} checksum differs from the applied version`);
  }
}

const migrationFilePattern = /^(\d{3})_([a-z0-9_]+)\.sql$/;

export async function loadMigrations(
  directory = fileURLToPath(new URL('../migrations/', import.meta.url)),
): Promise<readonly Migration[]> {
  const fileNames = (await readdir(directory))
    .filter((fileName) => migrationFilePattern.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  const migrations = await Promise.all(
    fileNames.map(async (fileName): Promise<Migration> => {
      const match = migrationFilePattern.exec(fileName);
      if (match === null) {
        throw new Error(`Invalid migration filename: ${fileName}`);
      }
      const sql = await readFile(join(directory, fileName), 'utf8');
      return {
        version: match[1]!,
        name: match[2]!,
        sql,
        checksum: createHash('sha256').update(sql, 'utf8').digest('hex'),
      };
    }),
  );

  const versions = new Set<string>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    versions.add(migration.version);
  }
  return migrations;
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${B3_MIGRATION_TABLE} (
      version text PRIMARY KEY,
      name text NOT NULL,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
    )
  `);
}

export async function applyMigrationSet(pool: Pool, migrations: readonly Migration[]): Promise<MigrationResult> {
  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const migration of migrations) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended('taptime-server-schema-migrations', 0))");
      await ensureMigrationTable(client);
      const existing = await client.query<{ checksum: string }>(
        `SELECT checksum FROM ${B3_MIGRATION_TABLE} WHERE version = $1`,
        [migration.version],
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0]?.checksum !== migration.checksum) {
          throw new MigrationChecksumMismatchError(migration.version);
        }
        alreadyApplied.push(migration.version);
        await client.query('COMMIT');
        continue;
      }

      await client.query(migration.sql);
      await client.query(
        `INSERT INTO ${B3_MIGRATION_TABLE} (version, name, checksum) VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
      await client.query('COMMIT');
      applied.push(migration.version);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, alreadyApplied };
}

export async function migrate(pool: Pool): Promise<MigrationResult> {
  return applyMigrationSet(pool, await loadMigrations());
}
