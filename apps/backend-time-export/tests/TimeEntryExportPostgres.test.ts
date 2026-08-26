import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { TimeEntryExportRequest } from '@taptime/time-entry-export-contract';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TimeEntryExportCoordinator, type TimeEntryExportCoordinatorControls } from '../src/index.js';
import {
  DA2_RUNTIME_LOGIN,
  ids,
  resetMigrateAndPrepare,
  runtimeConnectionString,
  seedDa2,
  tokens,
  truncateDa2DataTables,
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
let schemaProtectionBaseline: SchemaProtectionSnapshot;

const request: TimeEntryExportRequest = Object.freeze({
  expectedMembershipId: ids.membershipAdminA,
  fromInclusive: '2026-07-01T00:00:00.000Z',
  toExclusive: '2026-08-01T00:00:00.000Z',
});

beforeAll(async () => {
  await resetMigrateAndPrepare(installerPool, runtimePassword);
  schemaProtectionBaseline = await readSchemaProtectionSnapshot();
}, 30_000);

beforeEach(async () => {
  await truncateDa2DataTables(installerPool);
  await seedDa2(installerPool);
}, 30_000);

afterAll(async () => {
  await runtimePool.end();
  await installerPool.end();
});

describe('DA2 PostgreSQL export security and truth', () => {
  const testCases: Array<{
    readonly name: string;
    readonly run: () => void | Promise<void>;
    readonly timeout?: number;
  }> = [];
  const registerExportTest = (
    name: string,
    run: () => void | Promise<void>,
    timeout?: number,
  ) => testCases.push({ name, run, timeout });

  registerExportTest('exports only the derived tenant snapshot and appends one exact hash-bound audit', async () => {
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

  registerExportTest('returns header-only bytes and a truthful zero-row audit for an empty interval', async () => {
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

  registerExportTest('rejects a generalized range through CSV v1 and exports exact Project/manual truth in v2', async () => {
    const projectId = '20000000-0000-4000-8000-000000000090';
    const startEventId = '50000000-0000-4000-8000-000000000090';
    const stopEventId = '50000000-0000-4000-8000-000000000091';
    const entryId = '60000000-0000-4000-8000-000000000090';
    await installerPool.query(
      `INSERT INTO taptime_server.projects (id, organization_id, display_name)
       VALUES ($1::uuid, $2::uuid, 'Innenausbau')`,
      [projectId, ids.organizationA],
    );
    await installerPool.query(
      `INSERT INTO taptime_server.work_events (
         id, organization_id, assignment_id, nfc_tag_id, target_type,
         target_customer_id, triggered_by_user_id, occurred_at, content_hash,
         content_hash_algorithm, content_hash_version, trigger_type
       ) VALUES
         ($3::uuid, $2::uuid, NULL, NULL, 'project', $1::uuid, $5::uuid,
          '2026-07-22T08:00:00Z', repeat('1', 64), 'sha256', 2, 'manual'),
         ($4::uuid, $2::uuid, NULL, NULL, 'project', $1::uuid, $5::uuid,
          '2026-07-22T09:00:00Z', repeat('2', 64), 'sha256', 2, 'manual')`,
      [projectId, ids.organizationA, startEventId, stopEventId, ids.employeeA],
    );
    const client = await installerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      await client.query(
        `INSERT INTO taptime_server.time_entries (
         id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, started_via
       ) VALUES (
         $5::uuid, $2::uuid, $4::uuid, 'project', $1::uuid, 'started',
         $3::uuid, '2026-07-22T08:00:00Z', 'manual'
         )`,
        [
          projectId,
          ids.organizationA,
          startEventId,
          ids.employeeA,
          entryId,
        ],
      );
      await client.query(
        `INSERT INTO taptime_server.canonical_decisions (
           work_event_id, organization_id, actor_user_id, target_type,
           target_customer_id, decision_type, time_entry_id, engine_version,
           decision_payload
         ) VALUES
           ($1::uuid, $2::uuid, $3::uuid, 'project', $4::uuid,
            'time_entry_started', $5::uuid, 'da5-test', '{}'::jsonb)`,
        [startEventId, ids.organizationA, ids.employeeA, projectId, entryId],
      );
      await client.query('COMMIT');
      await client.query('BEGIN');
      await client.query(
        `UPDATE taptime_server.time_entries
         SET status = 'stopped', stop_work_event_id = $1::uuid,
             stopped_at = '2026-07-22T09:00:00Z', stopped_via = 'manual',
             row_version = row_version + 1
         WHERE id = $2::uuid`,
        [stopEventId, entryId],
      );
      await client.query(
        `INSERT INTO taptime_server.canonical_decisions (
           work_event_id, organization_id, actor_user_id, target_type,
           target_customer_id, decision_type, time_entry_id, engine_version,
           decision_payload
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, 'project', $4::uuid,
           'time_entry_stopped', $5::uuid, 'da5-test', '{}'::jsonb
         )`,
        [stopEventId, ids.organizationA, ids.employeeA, projectId, entryId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await expect(exportAs(tokens.adminA)).resolves.toEqual({
      status: 'export_schema_incompatible',
    });
    let reachedAudit = false;
    const result = await coordinator.exportTimeEntriesV2(command(tokens.adminA, request), {
      beforeAudit() { reachedAudit = true; },
    });
    expect(reachedAudit).toBe(true);
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    const text = Buffer.from(result.bytes).toString('utf8');
    expect(text).toContain('"project"');
    expect(text).toContain('"Innenausbau"');
    expect(text).toContain('"manual";"manual"');
    expect(text).toContain(entryId);
  });

  registerExportTest('exports the fixed twelve-column payroll truth with breaks, local day, provenance and correction', async () => {
    // Reproduce the valid creation-time shape: display_name is nullable but immutable later.
    await installerPool.query('ALTER TABLE taptime_server.memberships DISABLE TRIGGER USER');
    try {
      await installerPool.query(
        `UPDATE taptime_server.memberships SET display_name = NULL WHERE id = $1`,
        [ids.membershipEmployeeA],
      );
    } finally {
      await installerPool.query('ALTER TABLE taptime_server.memberships ENABLE TRIGGER USER');
    }
    await persistBreak({
      intervalId: '68000000-0000-4000-8000-000000000101',
      startEventId: '58000000-0000-4000-8000-000000000101',
      stopEventId: '58000000-0000-4000-8000-000000000102',
      timeEntryId: ids.stoppedEntryA,
      userId: ids.employeeA,
      startedAt: '2026-07-21T08:15:00Z',
      stoppedAt: '2026-07-21T08:20:00Z',
    });
    await persistBreak({
      intervalId: '68000000-0000-4000-8000-000000000102',
      startEventId: '58000000-0000-4000-8000-000000000103',
      stopEventId: '58000000-0000-4000-8000-000000000104',
      timeEntryId: ids.stoppedEntryA,
      userId: ids.employeeA,
      startedAt: '2026-07-21T08:30:00Z',
      stoppedAt: '2026-07-21T08:40:00Z',
    });
    await insertStoppedEntry({
      entryId: '60000000-0000-4000-8000-000000000110',
      startEventId: '50000000-0000-4000-8000-000000000110',
      stopEventId: '50000000-0000-4000-8000-000000000111',
      userId: ids.employeeA,
      startedAt: '2026-07-20T22:30:00Z',
      stoppedAt: '2026-07-20T23:30:00Z',
      startedVia: 'manual',
      stoppedVia: 'nfc',
    });
    const correctedEntryId = '60000000-0000-4000-8000-000000000112';
    await insertStoppedEntry({
      entryId: correctedEntryId,
      startEventId: '50000000-0000-4000-8000-000000000112',
      stopEventId: '50000000-0000-4000-8000-000000000113',
      userId: ids.employeeA,
      startedAt: '2026-07-22T08:00:00Z',
      stoppedAt: '2026-07-22T12:00:00Z',
      startedVia: 'manual',
      stoppedVia: 'nfc',
    });
    await persistBreak({
      intervalId: '68000000-0000-4000-8000-000000000112',
      startEventId: '58000000-0000-4000-8000-000000000112',
      stopEventId: '58000000-0000-4000-8000-000000000113',
      timeEntryId: correctedEntryId,
      userId: ids.employeeA,
      startedAt: '2026-07-22T08:30:00Z',
      stoppedAt: '2026-07-22T09:00:00Z',
    });
    await persistBreak({
      intervalId: '68000000-0000-4000-8000-000000000113',
      startEventId: '58000000-0000-4000-8000-000000000114',
      stopEventId: '58000000-0000-4000-8000-000000000115',
      timeEntryId: correctedEntryId,
      userId: ids.employeeA,
      startedAt: '2026-07-22T09:45:00Z',
      stoppedAt: '2026-07-22T10:15:00Z',
    });
    await insertRevision({
      timeEntryId: correctedEntryId,
      userId: ids.employeeA,
      startedAt: '2026-07-22T10:00:00Z',
      stoppedAt: '2026-07-22T12:00:00Z',
    });
    await insertRecoveredRevision({
      timeEntryId: '60000000-0000-4000-8000-000000000114',
      userId: ids.employeeA,
      startedAt: '2026-07-23T08:00:00Z',
      stoppedAt: '2026-07-23T09:30:00Z',
    });

    const result = await exportV3As(tokens.adminA);
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    const lines = Buffer.from(result.bytes).toString('utf8').split('\r\n');
    expect(lines[0]?.split(';')).toHaveLength(12);
    const breakDurationFromFunction = await effectiveDurationAsAdmin(ids.stoppedEntryA);
    expect(breakDurationFromFunction).toBe('2823');
    const breakRow = lines.find((line) => line.includes('2026-07-21T08:00:00.123456Z'));
    expect(breakRow).toContain(`"${ids.membershipEmployeeA}";"";"2026-07-21"`);
    expect(breakRow).toContain('"10:00:00.123456";"11:02:03.123457"');
    expect(breakRow).toContain(`"900";"${breakDurationFromFunction}"`);
    expect(breakRow).toContain('"start=nfc; end=nfc";"no"');
    const midnightRow = lines.find((line) => line.includes('2026-07-20T22:30:00.000000Z'));
    expect(midnightRow).toContain('"2026-07-21";"00:30:00.000000"');
    expect(midnightRow).toContain('"start=manual; end=nfc"');
    const correctedDurationFromFunction = await effectiveDurationAsAdmin(correctedEntryId);
    expect(correctedDurationFromFunction).toBe('6300');
    const correctedRow = lines.find((line) => line.includes('2026-07-22T10:00:00.000000Z'));
    expect(correctedRow).toContain(`"900";"${correctedDurationFromFunction}"`);
    expect(correctedRow).toContain('"yes; revision=1"');
    const recoveredRow = lines.find((line) => line.includes('2026-07-23T08:00:00.000000Z'));
    expect(recoveredRow).toContain('"0";"5400"');
    expect(recoveredRow).toContain('"start=manual; end=manual";"yes; revision=1"');
    expect(result.filename).toContain('taptime-time-entries_v3_');

    const audit = await installerPool.query<{ schema_version: number }>(
      `SELECT (payload->>'schemaVersion')::integer AS schema_version
       FROM taptime_server.audit_events WHERE event_type = 'TimeEntryExportGenerated'`,
    );
    expect(audit.rows).toEqual([{ schema_version: 3 }]);
  });

  registerExportTest('renders the Europe/Berlin daylight-saving jump from the UTC truth', async () => {
    await insertStoppedEntry({
      entryId: '60000000-0000-4000-8000-000000000120',
      startEventId: '50000000-0000-4000-8000-000000000120',
      stopEventId: '50000000-0000-4000-8000-000000000121',
      userId: ids.employeeA,
      startedAt: '2026-03-29T00:30:00Z',
      stoppedAt: '2026-03-29T01:30:00Z',
      startedVia: 'manual',
      stoppedVia: 'nfc',
    });
    const result = await exportV3As(tokens.adminA, {
      ...request,
      fromInclusive: '2026-03-20T00:00:00.000Z',
      toExclusive: '2026-04-10T00:00:00.000Z',
    });
    expect(result.status).toBe('succeeded');
    if (result.status !== 'succeeded') return;
    const text = Buffer.from(result.bytes).toString('utf8');
    expect(text).toContain('"2026-03-29";"01:30:00.000000";"03:30:00.000000"');
    expect(text).toContain('"2026-03-29T00:30:00.000000Z";"2026-03-29T01:30:00.000000Z"');
    expect(text).toContain('"0";"3600"');
  });

  registerExportTest('keeps v2 byte-identical and a foreign Organization out of v3', async () => {
    const v2Before = await coordinator.exportTimeEntriesV2(command(tokens.adminA, request));
    const ownV3 = await exportV3As(tokens.adminA);
    const v2After = await coordinator.exportTimeEntriesV2(command(tokens.adminA, request));
    expect(v2Before.status).toBe('succeeded');
    expect(ownV3.status).toBe('succeeded');
    expect(v2After.status).toBe('succeeded');
    if (v2Before.status !== 'succeeded' || v2After.status !== 'succeeded') return;
    expect(Buffer.from(v2After.bytes)).toEqual(Buffer.from(v2Before.bytes));

    const foreign = await exportV3As(tokens.adminB, {
      ...request,
      expectedMembershipId: ids.membershipAdminB,
    });
    expect(foreign.status).toBe('succeeded');
    if (foreign.status !== 'succeeded') return;
    const text = Buffer.from(foreign.bytes).toString('utf8');
    expect(text).toContain(ids.membershipEmployeeB);
    expect(text).not.toContain(ids.membershipEmployeeA);
    expect(text).not.toContain('Jörg Export');
  });

  registerExportTest('returns one coherent old snapshot when a correction commits after snapshot read, then effective-new', async () => {
    const raced = await coordinator.exportTimeEntries(command(tokens.adminA, request), {
      afterSnapshotRead: async () => insertEffectiveRevision(),
    });
    expect(raced.status).toBe('succeeded');
    if (raced.status !== 'succeeded') return;
    const racedText = Buffer.from(raced.bytes).toString('utf8');
    expect(racedText).toContain('"2026-07-21T08:00:00.123456Z"');
    expect(racedText).not.toContain('"2026-07-21T08:15:00.000000Z"');

    const after = await exportAs(tokens.adminA);
    expect(after.status).toBe('succeeded');
    if (after.status !== 'succeeded') return;
    const afterText = Buffer.from(after.bytes).toString('utf8');
    expect(afterText).toContain('"2026-07-21T08:15:00.000000Z"');
    expect(afterText).toContain('"2026-07-21T09:15:00.000000Z"');
    expect(afterText).not.toContain('"2026-07-21T08:00:00.123456Z"');
  });

  registerExportTest('distinguishes rejected identity from employee and stale expected Membership authority', async () => {
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

  registerExportTest('retains stable revoked-employee attribution without granting that employee export authority', async () => {
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

  registerExportTest('fails the complete export on missing same-Organization/User Membership integrity', async () => {
    await installerPool.query(`
      ALTER TABLE taptime_server.memberships DISABLE TRIGGER ALL;
      DELETE FROM taptime_server.memberships WHERE id = '${ids.membershipEmployeeA}';
      ALTER TABLE taptime_server.memberships ENABLE TRIGGER ALL;
    `);
    expect((await exportAs(tokens.adminA)).status).toBe('service_unavailable');
    expect(await exportAuditCount()).toBe(0);
  });

  registerExportTest('rolls back without bytes or success audit when audit insertion fails', async () => {
    await installerPool.query(
      `REVOKE INSERT ON taptime_server.audit_events
       FROM taptime_time_export_function_owner`,
    );
    try {
      expect((await exportAs(tokens.adminA)).status).toBe('service_unavailable');
      expect(await exportAuditCount()).toBe(0);
    } finally {
      await installerPool.query(
        `GRANT INSERT (
           id, organization_id, actor_user_id, event_type, entity_type,
           entity_id, occurred_at, correlation_id, payload
         ) ON taptime_server.audit_events
         TO taptime_time_export_function_owner`,
      );
      expect(await readSchemaProtectionSnapshot()).toEqual(schemaProtectionBaseline);
    }
  });

  registerExportTest('uses one repeatable-read snapshot when a Stop commits after the read', async () => {
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

  registerExportTest('holds current Administrator authority through commit and rejects after revocation wins', async () => {
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

  registerExportTest('does not leak tenant or role context when the one-connection pool is reused', async () => {
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

  registerExportTest('keeps direct role access default-deny and exposes no forbidden tables or writes', async () => {
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
    expect(await readSchemaProtectionSnapshot()).toEqual(schemaProtectionBaseline);
  });

  const orderedTestCases = process.env.DA2_TEST_ORDER === 'reverse'
    ? [...testCases].reverse()
    : testCases;
  for (const testCase of orderedTestCases) {
    it(testCase.name, testCase.run, testCase.timeout);
  }
});

interface SchemaProtectionSnapshot {
  readonly roles: unknown;
  readonly memberships: unknown;
  readonly triggers: unknown;
  readonly policies: unknown;
  readonly tablePrivileges: unknown;
  readonly columnPrivileges: unknown;
  readonly rowSecurity: unknown;
}

async function readSchemaProtectionSnapshot(): Promise<SchemaProtectionSnapshot> {
  const result = await installerPool.query<SchemaProtectionSnapshot>(`
    SELECT
      (
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(role_state) ORDER BY role_state.rolname)
        FROM (
          SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb,
                 rolcreaterole, rolreplication, rolbypassrls
          FROM pg_catalog.pg_roles
          WHERE rolname LIKE 'taptime_%'
        ) AS role_state
      ) AS roles,
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(membership_state)
          ORDER BY membership_state.role_name, membership_state.member_name
        )
        FROM (
          SELECT parent.rolname AS role_name, member.rolname AS member_name,
                 edge.admin_option, edge.inherit_option, edge.set_option
          FROM pg_catalog.pg_auth_members AS edge
          JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
          JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
          WHERE parent.rolname LIKE 'taptime_%' OR member.rolname LIKE 'taptime_%'
        ) AS membership_state
      ) AS memberships,
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(trigger_state)
          ORDER BY trigger_state.table_name, trigger_state.trigger_name
        )
        FROM (
          SELECT relation.relname AS table_name, trigger.tgname AS trigger_name,
                 trigger.tgenabled AS enabled,
                 pg_catalog.pg_get_triggerdef(trigger.oid, false) AS definition
          FROM pg_catalog.pg_trigger AS trigger
          JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger.tgrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'taptime_server' AND NOT trigger.tgisinternal
        ) AS trigger_state
      ) AS triggers,
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(policy_state)
          ORDER BY policy_state.tablename, policy_state.policyname
        )
        FROM (
          SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
          FROM pg_catalog.pg_policies
          WHERE schemaname = 'taptime_server'
        ) AS policy_state
      ) AS policies,
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(table_privilege_state)
          ORDER BY table_privilege_state.table_name
        )
        FROM (
          SELECT relation.relname AS table_name, relation.relacl::text AS access_control
          FROM pg_catalog.pg_class AS relation
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'taptime_server' AND relation.relkind = 'r'
        ) AS table_privilege_state
      ) AS "tablePrivileges",
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(column_privilege_state)
          ORDER BY column_privilege_state.table_name, column_privilege_state.column_name
        )
        FROM (
          SELECT relation.relname AS table_name, attribute.attname AS column_name,
                 attribute.attacl::text AS access_control
          FROM pg_catalog.pg_attribute AS attribute
          JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'taptime_server'
            AND relation.relkind = 'r'
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
        ) AS column_privilege_state
      ) AS "columnPrivileges",
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(row_security_state)
          ORDER BY row_security_state.table_name
        )
        FROM (
          SELECT relation.relname AS table_name,
                 relation.relrowsecurity AS enabled,
                 relation.relforcerowsecurity AS forced
          FROM pg_catalog.pg_class AS relation
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'taptime_server' AND relation.relkind = 'r'
        ) AS row_security_state
      ) AS "rowSecurity"
  `);
  const snapshot = result.rows[0];
  if (snapshot === undefined) {
    throw new Error('DA2 schema protection snapshot is unavailable');
  }
  return snapshot;
}

function command(accessToken: string, exportRequest: TimeEntryExportRequest) {
  return {
    accessToken,
    correlationId: '90000000-0000-4000-8000-000000000001',
    request: exportRequest,
  };
}

function exportAs(
  accessToken: string,
  exportRequest: TimeEntryExportRequest = request,
  controls: TimeEntryExportCoordinatorControls = {},
) {
  return coordinator.exportTimeEntries(command(accessToken, exportRequest), controls);
}

function exportV3As(
  accessToken: string,
  exportRequest: TimeEntryExportRequest = request,
  controls: TimeEntryExportCoordinatorControls = {},
) {
  return coordinator.exportTimeEntriesV3(command(accessToken, exportRequest), controls);
}

async function effectiveDurationAsAdmin(timeEntryId: string): Promise<string | null> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT
         set_config('app.user_id', $1, true),
         set_config('app.organization_id', $2, true),
         set_config('app.membership_id', $3, true),
         set_config('app.membership_role', 'administrator', true)`,
      [ids.adminA, ids.organizationA, ids.membershipAdminA],
    );
    await client.query('SET LOCAL ROLE taptime_administrator');
    const result = await client.query<{ seconds: string | null }>(
      `SELECT taptime_server.effective_work_duration_seconds_v1($1)::text AS seconds`,
      [timeEntryId],
    );
    await client.query('ROLLBACK');
    return result.rows[0]?.seconds ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

async function insertEffectiveRevision(): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.time_record_revisions
      (organization_id, time_record_id, revision_number, canonical_time_entry_id,
       user_id, target_type, target_customer_id, effective_started_at,
       effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
       reason, previous_revision_number, command_id, request_hash)
     VALUES ($1, $2, 1, $2, $3, 'customer', $4,
       '2026-07-21T08:15:00.000Z', '2026-07-21T09:15:00.000Z', 2,
       $5, $6, 'Synthetic snapshot race', NULL,
       '80000000-0000-4000-8000-000000000101', repeat('a', 64))`,
    [
      ids.organizationA, ids.stoppedEntryA, ids.employeeA, ids.customerA,
      ids.adminA, ids.membershipAdminA,
    ],
  );
}

async function persistBreak(input: {
  intervalId: string;
  startEventId: string;
  stopEventId: string;
  timeEntryId: string;
  userId: string;
  startedAt: string;
  stoppedAt: string;
}): Promise<void> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    await client.query(
      `INSERT INTO taptime_server.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
         content_hash_version, trigger_type, subject_type)
       VALUES ($1, $2, NULL, NULL, NULL, NULL, $3, $4,
         repeat('d', 64), 'sha256', 3, 'manual', 'break')`,
      [input.startEventId, ids.organizationA, input.userId, input.startedAt],
    );
    await client.query(
      `INSERT INTO taptime_server.break_intervals
        (id, organization_id, user_id, time_entry_id, status, start_work_event_id,
         started_at, started_via)
       VALUES ($1, $2, $3, $4, 'started', $5, $6, 'manual')`,
      [input.intervalId, ids.organizationA, input.userId, input.timeEntryId,
        input.startEventId, input.startedAt],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         subject_type, decision_type, time_entry_id, break_interval_id,
         engine_version, decision_payload)
       VALUES ($1, $2, $3, NULL, NULL, 'break', 'break_started', $4, $5,
         't013-test', '{"status":"break_started"}')`,
      [input.startEventId, ids.organizationA, input.userId, input.timeEntryId, input.intervalId],
    );
    await client.query('COMMIT');
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    await client.query(
      `INSERT INTO taptime_server.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
         content_hash_version, trigger_type, subject_type)
       VALUES ($1, $2, NULL, NULL, NULL, NULL, $3, $4,
         repeat('e', 64), 'sha256', 3, 'manual', 'break')`,
      [input.stopEventId, ids.organizationA, input.userId, input.stoppedAt],
    );
    await client.query(
      `UPDATE taptime_server.break_intervals
       SET status = 'stopped', stop_work_event_id = $1, stopped_at = $2,
         stopped_via = 'manual', row_version = row_version + 1
       WHERE id = $3`,
      [input.stopEventId, input.stoppedAt, input.intervalId],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         subject_type, decision_type, time_entry_id, break_interval_id,
         engine_version, decision_payload)
       VALUES ($1, $2, $3, NULL, NULL, 'break', 'break_stopped', $4, $5,
         't013-test', '{"status":"break_stopped"}')`,
      [input.stopEventId, ids.organizationA, input.userId, input.timeEntryId, input.intervalId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertStoppedEntry(input: {
  entryId: string;
  startEventId: string;
  stopEventId: string;
  userId: string;
  startedAt: string;
  stoppedAt: string;
  startedVia: 'nfc' | 'manual';
  stoppedVia: 'nfc' | 'manual';
}): Promise<void> {
  const client = await installerPool.connect();
  const eventShape = (via: 'nfc' | 'manual') => via === 'nfc'
    ? [ids.assignmentA, ids.tagA, 1]
    : [null, null, 2];
  const startShape = eventShape(input.startedVia);
  const stopShape = eventShape(input.stoppedVia);
  try {
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    await client.query(
      `INSERT INTO taptime_server.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
         content_hash_version, trigger_type)
       VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7,
         repeat('a', 64), 'sha256', $8, $9)`,
      [input.startEventId, ids.organizationA, startShape[0], startShape[1], ids.customerA,
        input.userId, input.startedAt, startShape[2], input.startedVia],
    );
    await client.query(
      `INSERT INTO taptime_server.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, started_via)
       VALUES ($1, $2, $3, 'customer', $4, 'started', $5, $6, $7)`,
      [input.entryId, ids.organizationA, input.userId, ids.customerA,
        input.startEventId, input.startedAt, input.startedVia],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, time_entry_id, engine_version, decision_payload)
       VALUES ($1, $2, $3, 'customer', $4, 'time_entry_started', $5,
         't013-test', '{}')`,
      [input.startEventId, ids.organizationA, input.userId, ids.customerA, input.entryId],
    );
    await client.query('COMMIT');
    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');
    await client.query(
      `INSERT INTO taptime_server.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
         content_hash_version, trigger_type)
       VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7,
         repeat('b', 64), 'sha256', $8, $9)`,
      [input.stopEventId, ids.organizationA, stopShape[0], stopShape[1], ids.customerA,
        input.userId, input.stoppedAt, stopShape[2], input.stoppedVia],
    );
    await client.query(
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $1, stopped_at = $2,
         stopped_via = $3, row_version = row_version + 1 WHERE id = $4`,
      [input.stopEventId, input.stoppedAt, input.stoppedVia, input.entryId],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, time_entry_id, engine_version, decision_payload)
       VALUES ($1, $2, $3, 'customer', $4, 'time_entry_stopped', $5,
         't013-test', '{}')`,
      [input.stopEventId, ids.organizationA, input.userId, ids.customerA, input.entryId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertRevision(input: {
  timeEntryId: string;
  userId: string;
  startedAt: string;
  stoppedAt: string;
}): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.time_record_revisions
      (organization_id, time_record_id, revision_number, canonical_time_entry_id,
       user_id, target_type, target_customer_id, effective_started_at,
       effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
       reason, previous_revision_number, command_id, request_hash)
     VALUES ($1, $2, 1, $2, $3, 'customer', $4, $5, $6, 2,
       $7, $8, 'Synthetic payroll correction', NULL, gen_random_uuid(), repeat('c', 64))`,
    [ids.organizationA, input.timeEntryId, input.userId, ids.customerA,
      input.startedAt, input.stoppedAt, ids.adminA, ids.membershipAdminA],
  );
}

async function insertRecoveredRevision(input: {
  timeEntryId: string;
  userId: string;
  startedAt: string;
  stoppedAt: string;
}): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.time_record_revisions
      (organization_id, time_record_id, revision_number, canonical_time_entry_id,
       user_id, target_type, target_customer_id, effective_started_at,
       effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
       reason, previous_revision_number, command_id, request_hash)
     VALUES ($1, $2, 1, NULL, $3, 'customer', $4, $5, $6, 0,
       $7, $8, 'Synthetic recovered payroll record', NULL,
       gen_random_uuid(), repeat('f', 64))`,
    [ids.organizationA, input.timeEntryId, input.userId, ids.customerA,
      input.startedAt, input.stoppedAt, ids.adminA, ids.membershipAdminA],
  );
}

async function postgresCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}
