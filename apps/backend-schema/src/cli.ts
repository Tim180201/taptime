import { Pool } from 'pg';
import { migrate } from './migrations.js';

const connectionString = process.env.B3_DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  throw new Error('B3_DATABASE_URL is required');
}

const pool = new Pool({ connectionString, max: 1 });
try {
  const result = await migrate(pool);
  process.stdout.write(
    `B3 migrations complete: applied=${result.applied.join(',') || 'none'} existing=${result.alreadyApplied.join(',') || 'none'}\n`,
  );
} finally {
  await pool.end();
}
