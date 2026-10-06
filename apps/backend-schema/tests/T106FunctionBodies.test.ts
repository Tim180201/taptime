import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations, type Migration } from '../src/index.js';
import { functionBodyDrift, latestFunctionBodies, type StoredFunction } from './support/migrationFunctionBodies.js';
import { closePoolAndDropTestDatabase } from './support/postgresTestDatabaseCleanup.mjs';

const requiredFunctions = [
  'operator_create_organization_v4', 'read_customer_hours_v1',
  'correct_time_record_v1', 'adjudicate_time_review_items_legacy_v1',
  'adjudicate_time_review_items_before_skip_v1', 'adjudicate_time_review_items_v1',
  'backfill_time_record_v1', 'comment_time_record_v1', 'prepare_administration_stop_v1',
  'void_time_record_v1', 'operator_set_organization_status_v1', 'operator_set_organization_package_v1',
];
const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t106_function_bodies_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const database = new Pool({ connectionString: url.href, max: 1 });
let created = false;
let migrations: readonly Migration[];
beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`);
  created = true;
  migrations = await loadMigrations();
  await applyMigrationSet(database, migrations);
});
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: database, installerPool: installer, databaseName });
  else await database.end();
  await installer.end();
});

async function functions(client: Pool | PoolClient): Promise<StoredFunction[]> {
  return (await client.query<StoredFunction>(`SELECT proname AS name, pronargs AS arity, prosrc AS body
    FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace AND prokind='f' ORDER BY proname,pronargs`)).rows;
}

it('T106 matches every changed function to its last explicit CREATE after all migrations', async () => {
  const actual = await functions(database), expected = latestFunctionBodies(migrations);
  expect(actual.filter(row => requiredFunctions.includes(row.name)).map(row => row.name).sort())
    .toEqual([...requiredFunctions].sort());
  expect(functionBodyDrift(actual.filter(row => requiredFunctions.includes(row.name)), expected)).toEqual([]);
  const otherDrift = functionBodyDrift(actual.filter(row => !requiredFunctions.includes(row.name)), expected);
  // TL scope: report other existing drift without changing unrelated functions.
  if (otherDrift.length) console.warn('Outside T106, explicit migration body drift:', otherDrift);
  else console.info('All taptime_server function bodies match their last explicit CREATE.');
});

it('T106 detects an intentionally replaced database body and passes again after rollback', async () => {
  const client = await database.connect(), expected = latestFunctionBodies(migrations);
  const drift = async () => functionBodyDrift((await functions(client)).filter(row => row.name === 'comment_time_record_v1'), expected);
  try {
    expect(await drift()).toEqual([]);
    await client.query('BEGIN');
    await client.query(`CREATE OR REPLACE FUNCTION taptime_server.comment_time_record_v1(request jsonb)
      RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog
      AS $probe$ BEGIN RETURN '{}'::jsonb; END $probe$`);
    expect(await drift()).toEqual([expect.stringContaining('comment_time_record_v1/1:')]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  expect(functionBodyDrift((await functions(database)).filter(row => row.name === 'comment_time_record_v1'), expected)).toEqual([]);
});
