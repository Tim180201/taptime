import { Pool } from 'pg';
import { B3_MIGRATION_TABLE } from './migrations.js';

const connectionString = process.env.B3_DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error('B3_DATABASE_URL is required');
}

const pool = new Pool({ connectionString, max: 1 });
try {
  const result = await pool.query<{ version: string }>(
    `SELECT version FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
  );
  const versions = result.rows.map((row) => row.version);
  if (versions.join(',') !== '001,002,003,004,005,006,007,008,009,010,011') {
    throw new Error(`Unexpected backend schema migration versions: ${versions.join(',') || 'none'}`);
  }
  process.stdout.write(`Backend schema migration versions verified: ${versions.join(',')}\n`);
} finally {
  await pool.end();
}
