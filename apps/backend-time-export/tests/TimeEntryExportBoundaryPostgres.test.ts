import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';
import { TIME_ENTRY_EXPORT_MAXIMUM_ROWS, TIME_ENTRY_EXPORT_MAXIMUM_BYTES, type TimeEntryExportRequest } from '@taptime/time-entry-export-contract';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TimeEntryExportCoordinator } from '../src/index.js';
import {
  ids,
  insertBulkStoppedEntries,
  resetMigrateAndPrepare,
  runtimeConnectionString,
  seedDa2,
  tokens,
  truncateDa2DataTables,
  verifier,
} from './fixtures.js';

const installerConnectionString = process.env.DA2_BOUNDARY_DATABASE_URL
  ?? process.env.DA2_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da2';
const runtimePassword = process.env.DA2_RUNTIME_PASSWORD ?? 'da2-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 2 });
const runtimePool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, runtimePassword),
  max: 1,
});
const coordinator = new TimeEntryExportCoordinator(runtimePool, verifier);

const request: TimeEntryExportRequest = Object.freeze({
  expectedMembershipId: ids.membershipAdminA,
  fromInclusive: '2026-07-01T00:00:00.000Z',
  toExclusive: '2026-08-01T00:00:00.000Z',
});
const BOUNDARY_EXPORT_DEADLINE_MILLISECONDS = 120_000;
const ABSOLUTE_WARNING_MILLISECONDS = 10_000;
const REFERENCE_ROWS = 7_500;
const REFERENCE_DURATION_PROBES_PER_ROW = 6;
const REFERENCE_DURATION_PROBE = '10800';
const REFERENCE_BYTES = 7_544_998;
const REFERENCE_SHA256 =
  '7dc76dad286bf2caaaa46bd9f27fdc8ec98c4beeced2474387786c8c01ec5364';
const MAXIMUM_EXPORT_TO_REFERENCE_RATIO = 1.2;

beforeAll(async () => {
  await resetMigrateAndPrepare(installerPool, runtimePassword);
}, 60_000);

beforeEach(async () => {
  await truncateDa2DataTables(installerPool);
  await seedDa2(installerPool);
}, 60_000);

afterAll(async () => {
  await runtimePool.end();
  await installerPool.end();
});

describe('DA2 export size boundaries in an isolated database run', () => {
  it('fails closed above the D-152 row bound without truncation or audit', async () => {
    const existing = Number((await installerPool.query('SELECT count(*) FROM taptime_server.effective_time_records_v2 WHERE organization_id=$1', [ids.organizationA])).rows[0].count);
    await insertBulkStoppedEntries(installerPool, TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1 - existing);
    expect((await exportV1()).status).toBe('export_limit_exceeded');
    expect(await exportAuditCount()).toBe(0);
  }, 120_000);

  it('streams the complete maximum-sized payroll month and audits its exact bytes', async () => {
    const existing = Number((await installerPool.query('SELECT count(*) FROM taptime_server.effective_time_records_v2 WHERE organization_id=$1', [ids.organizationA])).rows[0].count);
    await insertBulkStoppedEntries(installerPool, TIME_ENTRY_EXPORT_MAXIMUM_ROWS - existing);
    const result = await coordinator.exportTimeEntriesV4(command(), {streamResponse:true});
    expect(result.status).toBe('streaming');
    if (result.status !== 'streaming') throw new Error(result.status);
    const hash = createHash('sha256');
    let bytes = 0, largestChunk = 0, lines = 0;
    for await (const chunk of result.stream) {
      const buffer = Buffer.from(chunk);
      hash.update(buffer); bytes += buffer.length; largestChunk = Math.max(largestChunk,buffer.length);
      lines += buffer.toString('utf8').split('\r\n').length - 1;
    }
    expect(lines - 1).toBe(TIME_ENTRY_EXPORT_MAXIMUM_ROWS);
    expect(largestChunk).toBeLessThan(bytes / 2);
    const audit = (await installerPool.query("SELECT payload FROM taptime_server.audit_events WHERE event_type='TimeEntryExportGenerated'")).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].payload).toMatchObject({rowCount:TIME_ENTRY_EXPORT_MAXIMUM_ROWS,byteCount:bytes,sha256:hash.digest('hex')});
  }, 120_000);

  it('exports the formerly rejected wide CSV completely within the derived byte bound', async () => {
    await truncateDa2DataTables(installerPool);
    await seedDa2(installerPool, true);
    await insertBulkStoppedEntries(installerPool, 5_998);
    const result = await exportV1();
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') throw new Error(result.status);
    expect(result.byteCount).toBeGreaterThan(8 * 1024 * 1024);
    expect(result.byteCount).toBeLessThanOrEqual(TIME_ENTRY_EXPORT_MAXIMUM_BYTES);
    expect(await exportAuditCount()).toBe(1);
  }, 120_000);

  // TL decision T-099b (26.10.2026): budget 1.50 instead of 1.30. Migration 063 made the shared export work several
  // times faster, so v4's inherent extra columns (origin, changed, comment) now weigh 2-35 % depending on the runner
  // (GitHub median 1.33 at about 100 ms). The pathological v4 plans this guard was written for (T-066: overlap
  // search, per-row authority) cost multiples of v3 and still fail at 1.50.
  it('serves v4 within 1.5x the same-run v3 median for 7,500 rows', async () => {
    await insertBulkStoppedEntries(installerPool, REFERENCE_ROWS);
    const run = async (version: 3 | 4) => {
      const started = performance.now();
      const controls = {
        deadlineEpochMilliseconds: Date.now() + BOUNDARY_EXPORT_DEADLINE_MILLISECONDS,
      };
      const result = version === 3 ? await exportV3(controls)
        : await coordinator.exportTimeEntriesV4(command(), controls);
      const milliseconds = performance.now() - started;
      expect(result.status).toBe('succeeded');
      if (result.status !== 'succeeded') throw new Error(result.status);
      expect(result.rowCount).toBe(REFERENCE_ROWS + 2);
      return milliseconds;
    };
    // Warm both paths once. Alternating samples spread runner drift across both
    // versions; a median prevents one GC/scheduling pause deciding the budget.
    await run(3);
    await run(4);
    const v3Samples: number[] = [], v4Samples: number[] = [];
    for (let sample = 0; sample < 5; sample++) {
      v3Samples.push(await run(3));
      v4Samples.push(await run(4));
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[2]!;
    const v3Milliseconds = median(v3Samples), v4Milliseconds = median(v4Samples);
    const ratio = v4Milliseconds / v3Milliseconds;
    console.info('[T-066 v4 boundary] ' + JSON.stringify({
      v3Samples, v4Samples, v3Median: v3Milliseconds, v4Median: v4Milliseconds, ratio, budget: 1.50,
    }));
    if (Math.max(v3Milliseconds, v4Milliseconds) > 8_000) {
      console.warn('[T-066 v4 boundary warning] absolute export runtime exceeds 8000ms; the relative result remains authoritative');
    }
    expect(ratio, `v4 median took ${ratio.toFixed(2)}x its same-run v3 median`).toBeLessThanOrEqual(1.5);
  }, 2 * BOUNDARY_EXPORT_DEADLINE_MILLISECONDS + 60_000);

  it('exports wide payroll v3 above the former byte bound within a runner-relative budget', async () => {
    await truncateDa2DataTables(installerPool);
    await seedDa2(installerPool, true);

    const syntheticRunnerFactor = environmentFactor('T025_SYNTHETIC_RUNNER_FACTOR');
    const syntheticExportRegression = environmentMilliseconds(
      'T025_SYNTHETIC_EXPORT_REGRESSION_MS',
    );

    const fixtureStarted = performance.now();
    await insertBulkStoppedEntries(installerPool, 7_500);
    const fixtureMilliseconds = performance.now() - fixtureStarted;

    const referenceStarted = performance.now();
    const referenceWorkMilliseconds = await measureRunnerReference();
    await delay(referenceWorkMilliseconds * (syntheticRunnerFactor - 1));
    const referenceMilliseconds = performance.now() - referenceStarted;

    const exportStarted = performance.now();
    const result = await exportV3({
      deadlineEpochMilliseconds: Date.now() + BOUNDARY_EXPORT_DEADLINE_MILLISECONDS,
      afterSnapshotRead: () => delay(syntheticExportRegression),
    });
    const exportWorkMilliseconds = performance.now() - exportStarted;
    await delay(exportWorkMilliseconds * (syntheticRunnerFactor - 1));
    const exportMilliseconds = performance.now() - exportStarted;
    const ratio = exportMilliseconds / referenceMilliseconds;
    const totalMilliseconds = fixtureMilliseconds + referenceMilliseconds + exportMilliseconds;

    console.info(
      `[T-025 boundary] fixture=${format(fixtureMilliseconds)}ms `
      + `reference=${format(referenceMilliseconds)}ms `
      + `payroll-v3=${format(exportMilliseconds)}ms ratio=${ratio.toFixed(2)}x `
      + `budget=${MAXIMUM_EXPORT_TO_REFERENCE_RATIO.toFixed(2)}x`,
    );
    if (totalMilliseconds > ABSOLUTE_WARNING_MILLISECONDS) {
      console.warn(
        `[T-025 boundary warning] absolute runtime ${format(totalMilliseconds)}ms exceeds `
        + `${ABSOLUTE_WARNING_MILLISECONDS}ms; the relative result remains authoritative`,
      );
    }

    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') throw new Error(result.status);
    expect(result.rowCount).toBe(REFERENCE_ROWS + 2);
    expect(result.byteCount).toBeGreaterThan(8 * 1024 * 1024);
    expect(await exportAuditCount()).toBe(1);
    expect(
      ratio,
      `payroll-v3 export took ${ratio.toFixed(2)}x its same-run PostgreSQL reference`,
    ).toBeLessThanOrEqual(MAXIMUM_EXPORT_TO_REFERENCE_RATIO);
  }, 180_000);
});

function exportV1() {
  return coordinator.exportTimeEntries(command(), {
    deadlineEpochMilliseconds: Date.now() + BOUNDARY_EXPORT_DEADLINE_MILLISECONDS,
  });
}

function exportV3(controls: Parameters<TimeEntryExportCoordinator['exportTimeEntriesV3']>[1]) {
  return coordinator.exportTimeEntriesV3(command(), controls);
}

async function measureRunnerReference(): Promise<number> {
  const client = await installerPool.connect();
  try {
    // Keep the baseline independent of the production export while matching its row-wise
    // PostgreSQL work and wide database-to-Node transfer on the same runner.
    await client.query(`
      CREATE OR REPLACE FUNCTION pg_temp.t025_reference_duration(
        requested_id uuid, requested_admin_membership_id uuid
      ) RETURNS bigint
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
      AS $reference$
        WITH record AS (
          SELECT effective.organization_id, effective.canonical_time_entry_id,
                 effective.effective_started_at, effective.effective_stopped_at
          FROM taptime_server.effective_time_records_v2 AS effective
          WHERE effective.time_record_id = requested_id
        ), authorized_record AS (
          SELECT record.*
          FROM record
          WHERE EXISTS (
            SELECT 1
            FROM taptime_server.memberships AS membership
            WHERE membership.organization_id = record.organization_id
              AND membership.id = requested_admin_membership_id
              AND membership.role = 'administrator'
              AND membership.revoked_at IS NULL
          )
        )
        SELECT GREATEST(
          0::bigint,
          pg_catalog.floor(pg_catalog.date_part(
            'epoch', record.effective_stopped_at - record.effective_started_at
          ))::bigint
          - COALESCE((
            SELECT pg_catalog.sum(pg_catalog.floor(pg_catalog.date_part(
              'epoch', LEAST(interval.stopped_at, record.effective_stopped_at)
                - GREATEST(interval.started_at, record.effective_started_at)
            ))::bigint)::bigint
            FROM taptime_server.break_intervals AS interval
            WHERE interval.organization_id = record.organization_id
              AND interval.time_entry_id = record.canonical_time_entry_id
          ), 0::bigint)
        )
        FROM authorized_record AS record
      $reference$
    `);
    const referenceStarted = performance.now();
    const reference = await client.query<{
      value: string;
      employee_name: string;
      target_name: string;
      duration_probe: string;
    }>(`
      SELECT entry.id::text AS value,
             pg_catalog.repeat('🕒', 120) AS employee_name,
             pg_catalog.repeat('🕒', 120) AS target_name,
             (${Array.from(
    { length: REFERENCE_DURATION_PROBES_PER_ROW },
    () => 'pg_temp.t025_reference_duration(entry.id, $2)',
  ).join(' + ')})::text AS duration_probe
      FROM taptime_server.time_entries AS entry
      WHERE entry.organization_id = $1
        AND entry.started_at >= '2026-07-22T00:00:00Z'::timestamptz
      ORDER BY entry.started_at, entry.id
      LIMIT $3
    `, [ids.organizationA, ids.membershipAdminA, REFERENCE_ROWS]);
    expect(reference.rows).toHaveLength(REFERENCE_ROWS);
    expect(reference.rows.every((row) => row.duration_probe === REFERENCE_DURATION_PROBE))
      .toBe(true);
    const referenceBytes = new TextEncoder().encode(reference.rows.map((row) => (
      `${row.value}|${row.employee_name}|${row.target_name}|${row.duration_probe}`
    )).join('\r\n'));
    expect(referenceBytes.byteLength).toBe(REFERENCE_BYTES);
    expect(createHash('sha256').update(referenceBytes).digest('hex')).toBe(REFERENCE_SHA256);
    return performance.now() - referenceStarted;
  } finally {
    client.release();
  }
}

function command() {
  return {
    accessToken: tokens.adminA,
    correlationId: '90000000-0000-4000-8000-000000000025',
    request,
  };
}

async function exportAuditCount(): Promise<number> {
  const result = await installerPool.query<{ count: number }>(
    `SELECT count(*)::integer AS count FROM taptime_server.audit_events
     WHERE event_type = 'TimeEntryExportGenerated'`,
  );
  return result.rows[0]!.count;
}

function environmentMilliseconds(name: string): number {
  const value = process.env[name];
  if (value === undefined) return 0;
  const milliseconds = Number(value);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 60_000) {
    throw new Error(`${name} must be an integer between 0 and 60000`);
  }
  return milliseconds;
}

function environmentFactor(name: string): number {
  const value = process.env[name];
  if (value === undefined) return 1;
  const factor = Number(value);
  if (!Number.isSafeInteger(factor) || factor < 1 || factor > 10) {
    throw new Error(`${name} must be an integer between 1 and 10`);
  }
  return factor;
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds === 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function format(milliseconds: number): string {
  return milliseconds.toFixed(0);
}
