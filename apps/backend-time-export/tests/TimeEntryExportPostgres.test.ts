import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { TimeEntryExportRequest } from '@taptime/time-entry-export-contract';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TimeEntryExportCoordinator } from '../src/index.js';
import {
  DA2_RUNTIME_LOGIN,
  ids,
  insertBulkStoppedEntries,
  resetMigrateAndPrepare,
  runtimeConnectionString,
  seedDa2,
  tokens,
  verifier,
} from './fixtures.js';

const installerConnectionString = process.env.DA2_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da2';
const runtimePassword = process.env.DA2_RUNTIME_PASSWORD ?? 'da2-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 4 });
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

beforeEach(async () => {
  await resetMigrateAndPrepare(installerPool, runtimePassword);
  await seedDa2(installerPool);
}, 30_000);

afterAll(async () => {
  await runtimePool.end();
  await installerPool.end();
});

describe('DA2 PostgreSQL export security and truth', () => {
  it('exports only the derived tenant snapshot and appends one exact hash-bound audit', async () => {
    const result = await exportAs(tokens.adminA);
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;

    const text = Buffer.from(result.bytes).toString('utf8');
    expect(result.rowCount).toBe(2);
    expect(text).toContain(ids.stoppedEntryA);
    expect(text).toContain(ids.activeEntryA);
    expect(text).not.toContain(ids.activeEntryB);
    expect(text).toContain('"stopped";"2026-07-21T08:00:00.123456Z"');
    expect(text).toContain('"3723.000001"');
    expect(text).toContain('"started";"2026-07-21T10:00:00.000000Z";"";""');
    expect(text).toContain('"\'=Kunde; ""Nord"""');
    expect(result.sha256).toBe(createHash('sha256').update(result.bytes).digest('hex'));

    const audits = await installerPool.query<{
      event_type: string;
      actor_user_id: string;
      organization_id: string;
      correlation_id: string;
      payload: Record<string, unknown>;
    }>(`SELECT event_type, actor_user_id, organization_id, correlation_id, payload
        FROM taptime_server.audit_events
        WHERE event_type = 'TimeEntryExportGenerated'`);
    expect(audits.rows).toEqual([{
      event_type: 'TimeEntryExportGenerated',
      actor_user_id: ids.adminA,
      organization_id: ids.organizationA,
      correlation_id: '90000000-0000-4000-8000-000000000001',
      payload: {
        schemaVersion: 1,
        fromInclusive: request.fromInclusive,
        toExclusive: request.toExclusive,
        rowCount: 2,
        byteCount: result.byteCount,
        sha256: result.sha256,
      },
    }]);
    expect(JSON.stringify(audits.rows[0]!.payload)).not.toContain('Jörg');
    expect(JSON.stringify(audits.rows[0]!.payload)).not.toContain('Kunde');
  });

  it('returns header-only bytes and a truthful zero-row audit for an empty interval', async () => {
    const result = await exportAs(tokens.adminA, {
      ...request,
      fromInclusive: '2026-07-02T00:00:00.000Z',
      toExclusive: '2026-07-03T00:00:00.000Z',
    });
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    expect(result.rowCount).toBe(0);
    expect(Buffer.from(result.bytes).toString('utf8')).toContain('"schema_version"');
    const audit = await installerPool.query<{ row_count: number }>(
      `SELECT (payload->>'rowCount')::integer AS row_count
       FROM taptime_server.audit_events WHERE event_type = 'TimeEntryExportGenerated'`,
    );
    expect(audit.rows[0]!.row_count).toBe(0);
  });

  it('distinguishes rejected identity from employee and stale expected Membership authority', async () => {
    expect((await exportAs(tokens.rejected)).status).toBe('unauthorized');
    expect((await exportAs(tokens.employeeA, {
      ...request,
      expectedMembershipId: ids.membershipEmployeeA,
    })).status).toBe('forbidden');
    expect((await exportAs(tokens.adminA, {
      ...request,
      expectedMembershipId: ids.membershipEmployeeA,
    })).status).toBe('forbidden');
    expect(await exportAuditCount()).toBe(0);
  });

  it('retains stable revoked-employee attribution without granting that employee export authority', async () => {
    await installerPool.query(
      `UPDATE taptime_server.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.membershipEmployeeA],
    );
    const result = await exportAs(tokens.adminA);
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    const text = Buffer.from(result.bytes).toString('utf8');
    expect(text).toContain(ids.membershipEmployeeA);
    expect(text).toContain('Jörg Export');
  });

  it('fails the complete export on missing same-Organization/User Membership integrity', async () => {
    await installerPool.query(`
      ALTER TABLE taptime_server.memberships DISABLE TRIGGER ALL;
      DELETE FROM taptime_server.memberships WHERE id = '${ids.membershipEmployeeA}';
      ALTER TABLE taptime_server.memberships ENABLE TRIGGER ALL;
    `);
    expect((await exportAs(tokens.adminA)).status).toBe('service_unavailable');
    expect(await exportAuditCount()).toBe(0);
  });

  it('rolls back without bytes or success audit when audit insertion fails', async () => {
    await installerPool.query(
      `REVOKE INSERT ON taptime_server.audit_events
       FROM taptime_time_export_function_owner`,
    );
    expect((await exportAs(tokens.adminA)).status).toBe('service_unavailable');
    expect(await exportAuditCount()).toBe(0);
  });

  it('fails closed above 10,000 rows without truncation or audit', async () => {
    await insertBulkStoppedEntries(installerPool, 9_999);
    expect((await exportAs(tokens.adminA)).status).toBe('export_limit_exceeded');
    expect(await exportAuditCount()).toBe(0);
  }, 30_000);

  it('fails closed above 8 MiB without truncation or audit', async () => {
    await resetMigrateAndPrepare(installerPool, runtimePassword);
    await seedDa2(installerPool, true);
    await insertBulkStoppedEntries(installerPool, 5_998);
    expect((await exportAs(tokens.adminA)).status).toBe('export_limit_exceeded');
    expect(await exportAuditCount()).toBe(0);
  }, 30_000);

  it('uses one repeatable-read snapshot when a Stop commits after the read', async () => {
    const result = await coordinator.exportTimeEntries(
      command(tokens.adminA, request),
      { afterSnapshotRead: () => stopActiveEntryA(installerPool) },
    );
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    const firstText = Buffer.from(result.bytes).toString('utf8');
    const activeRow = firstText.split('\r\n').find((line) => line.includes(ids.activeEntryA));
    expect(activeRow).toContain('"started"');

    const second = await exportAs(tokens.adminA);
    expect(second.status).toBe('succeeded');
    if (second.status !== 'succeeded') return;
    const secondRow = Buffer.from(second.bytes).toString('utf8')
      .split('\r\n').find((line) => line.includes(ids.activeEntryA));
    expect(secondRow).toContain('"stopped"');
  });

  it('holds current Administrator authority through commit and rejects after revocation wins', async () => {
    let revocation: Promise<unknown> | undefined;
    const first = await coordinator.exportTimeEntries(
      command(tokens.adminA, request),
      {
        afterAuthorityLocked() {
          revocation = installerPool.query(
            `UPDATE taptime_server.memberships
             SET revoked_at = transaction_timestamp(), row_version = row_version + 1
             WHERE id = $1`,
            [ids.membershipAdminA],
          );
        },
      },
    );
    expect(first.status).toBe('succeeded');
    await revocation;
    expect((await exportAs(tokens.adminA)).status).toBe('unauthorized');
  });

  it('does not leak tenant or role context when the one-connection pool is reused', async () => {
    const first = await exportAs(tokens.adminA);
    expect(first.status).toBe('succeeded');
    const second = await exportAs(tokens.adminB, {
      ...request,
      expectedMembershipId: ids.membershipAdminB,
    });
    expect(second.status).toBe('succeeded');
    if (second.status !== 'succeeded') return;
    const text = Buffer.from(second.bytes).toString('utf8');
    expect(text).toContain(ids.organizationB);
    expect(text).toContain(ids.activeEntryB);
    expect(text).not.toContain(ids.organizationA);

    const context = await runtimePool.query<{ role_name: string; organization_id: string }>(
      `SELECT current_user AS role_name,
        pg_catalog.current_setting('app.organization_id', true) AS organization_id`,
    );
    expect(context.rows[0]).toEqual({ role_name: DA2_RUNTIME_LOGIN, organization_id: '' });
  });

  it('keeps direct role access default-deny and exposes no forbidden tables or writes', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_time_exporter');
      const invisible = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM taptime_server.time_entries',
      );
      expect(invisible.rows[0]!.count).toBe('0');
      expect(await postgresCode(client.query('SELECT * FROM taptime_server.nfc_tags')))
        .toBe('42501');
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_time_exporter');
      expect(await postgresCode(client.query(
        `INSERT INTO taptime_server.audit_events
          (id, organization_id, event_type, entity_type, entity_id, occurred_at,
           correlation_id, payload)
         VALUES (gen_random_uuid(), $1, 'TimeEntryExportGenerated', 'TimeEntryExport',
           gen_random_uuid(), now(), 'forbidden', '{}')`,
        [ids.organizationA],
      ))).toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const roles = await installerPool.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(`SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
        FROM pg_catalog.pg_roles
        WHERE rolname IN ('taptime_time_exporter', 'taptime_time_export_function_owner')
        ORDER BY rolname`);
    expect(roles.rows).toEqual([
      {
        rolname: 'taptime_time_export_function_owner', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: true,
      },
      {
        rolname: 'taptime_time_exporter', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: false,
      },
    ]);
  });
});

function command(accessToken: string, exportRequest: TimeEntryExportRequest) {
  return {
    accessToken,
    correlationId: '90000000-0000-4000-8000-000000000001',
    request: exportRequest,
  };
}

function exportAs(accessToken: string, exportRequest: TimeEntryExportRequest = request) {
  return coordinator.exportTimeEntries(command(accessToken, exportRequest));
}

async function exportAuditCount(): Promise<number> {
  const result = await installerPool.query<{ count: number }>(
    `SELECT count(*)::integer AS count FROM taptime_server.audit_events
     WHERE event_type = 'TimeEntryExportGenerated'`,
  );
  return result.rows[0]!.count;
}

async function stopActiveEntryA(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stopEvent = '50000000-0000-4000-8000-000000000199';
    await client.query(
      `INSERT INTO taptime_server.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
         content_hash_version)
       VALUES ($1, $2, $3, $4, 'customer', $5, $6, '2026-07-21T11:00:00Z',
         repeat('d', 64), 'sha256', 1)`,
      [
        stopEvent,
        ids.organizationA,
        ids.assignmentA,
        ids.tagA,
        ids.customerA,
        ids.employeeA2,
      ],
    );
    await client.query(
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $1,
         stopped_at = '2026-07-21T11:00:00Z', row_version = row_version + 1
       WHERE id = $2`,
      [stopEvent, ids.activeEntryA],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, time_entry_id, engine_version, decision_payload)
       VALUES ($1, $2, $3, 'customer', $4, 'time_entry_stopped', $5, 'da2-race', '{}')`,
      [stopEvent, ids.organizationA, ids.employeeA2, ids.customerA, ids.activeEntryA],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function postgresCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}
