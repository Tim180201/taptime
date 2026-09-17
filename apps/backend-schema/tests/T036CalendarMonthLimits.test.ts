import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations } from '../src/index.js';
import { seedB3 } from './fixtures.js';

const connectionString = process.env.B3_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const administrator = new Pool({ connectionString, max: 1 });
const databaseName = `t036_limit_upgrade_${randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(connectionString);
testUrl.pathname = `/${databaseName}`;
const database = new Pool({ connectionString: testUrl.href, max: 1 });
let created = false;

beforeAll(async () => {
  await administrator.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`);
  created = true;
  await applyMigrationSet(database, (await loadMigrations()).filter(({ version }) => version < '025'));
  await seedB3(database);
});

afterAll(async () => {
  await database.end();
  if (created) await administrator.query(`DROP DATABASE "${databaseName}"`);
  await administrator.end();
});

it('upgrades only live range guards while preserving all existing function protection and application data', async () => {
  const beforeFunctions = await functions();
  const beforeData = await applicationData();
  const changed = beforeFunctions.filter(({ source }) => source.includes("interval '31 days'"));
  expect(changed.length).toBeGreaterThan(0);

  await applyMigrationSet(database, (await loadMigrations()).filter(({ version }) => version === '025'));

  const afterFunctions = await functions();
  for (const before of beforeFunctions) {
    expect(afterFunctions.find(({ identity }) => identity === before.identity), before.identity)
      .toEqual({
        ...before,
        source: before.source.replaceAll(
          "interval '31 days'", 'taptime_server.maximum_calendar_month_range()',
        ),
      });
  }
  expect(afterFunctions.filter(({ identity }) =>
    !beforeFunctions.some((before) => before.identity === identity)).map(({ identity }) => identity))
    .toEqual(['taptime_server.maximum_calendar_month_range()']);
  expect(await applicationData()).toEqual(beforeData);
});

async function functions() {
  return (await database.query<{ identity: string; source: string; protection: unknown }>(`
    SELECT p.oid::regprocedure::text AS identity, p.prosrc AS source,
      jsonb_build_object('owner', p.proowner, 'acl', p.proacl, 'securityDefiner', p.prosecdef,
        'volatility', p.provolatile, 'configuration', p.proconfig, 'returnType', p.prorettype,
        'argumentTypes', p.proargtypes::text, 'language', p.prolang, 'strict', p.proisstrict,
        'parallel', p.proparallel) AS protection
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'taptime_server' ORDER BY identity
  `)).rows;
}

async function applicationData() {
  const tables = await database.query<{ tablename: string }>(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'taptime_server' ORDER BY tablename",
  );
  const data: Record<string, unknown> = {};
  for (const { tablename } of tables.rows) {
    const identifier = tablename.replaceAll('"', '""');
    data[tablename] = (await database.query<{ rows: unknown }>(
      `SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), '[]') AS rows
       FROM taptime_server."${identifier}" r`,
    )).rows[0]!.rows;
  }
  return data;
}
