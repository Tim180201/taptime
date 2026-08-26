import { performance } from 'node:perf_hooks';
import { Pool } from 'pg';
import type { TimeEntryExportRequest } from '@taptime/time-entry-export-contract';
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
const REFERENCE_EXPORT_PASSES = 8;
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
  it('fails closed above 10,000 rows without truncation or audit', async () => {
    await insertBulkStoppedEntries(installerPool, 9_999);
    expect((await exportV1()).status).toBe('export_limit_exceeded');
    expect(await exportAuditCount()).toBe(0);
  }, 120_000);

  it('fails closed above 8 MiB without truncation or audit', async () => {
    await truncateDa2DataTables(installerPool);
    await seedDa2(installerPool, true);
    await insertBulkStoppedEntries(installerPool, 5_998);
    expect((await exportV1()).status).toBe('export_limit_exceeded');
    expect(await exportAuditCount()).toBe(0);
  }, 120_000);

  it('fails payroll v3 closed above 8 MiB within a runner-relative budget', async () => {
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
    for (let pass = 0; pass < REFERENCE_EXPORT_PASSES; pass += 1) {
      expect((await exportV2()).status).toBe('export_limit_exceeded');
    }
    const referenceWorkMilliseconds = performance.now() - referenceStarted;
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
      + `reference-v2-${REFERENCE_EXPORT_PASSES}x=${format(referenceMilliseconds)}ms `
      + `payroll-v3=${format(exportMilliseconds)}ms ratio=${ratio.toFixed(2)}x `
      + `budget=${MAXIMUM_EXPORT_TO_REFERENCE_RATIO.toFixed(2)}x`,
    );
    if (totalMilliseconds > ABSOLUTE_WARNING_MILLISECONDS) {
      console.warn(
        `[T-025 boundary warning] absolute runtime ${format(totalMilliseconds)}ms exceeds `
        + `${ABSOLUTE_WARNING_MILLISECONDS}ms; the relative result remains authoritative`,
      );
    }

    expect(result.status).toBe('export_limit_exceeded');
    expect(await exportAuditCount()).toBe(0);
    expect(
      ratio,
      `payroll-v3 export took ${ratio.toFixed(2)}x its same-run eight-pass v2 reference`,
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

function exportV2() {
  return coordinator.exportTimeEntriesV2(command(), {
    deadlineEpochMilliseconds: Date.now() + BOUNDARY_EXPORT_DEADLINE_MILLISECONDS,
  });
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
