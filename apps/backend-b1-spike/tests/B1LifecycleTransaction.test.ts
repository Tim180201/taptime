import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  UserId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import {
  B1LifecycleTransaction,
  InjectedB1Failure,
  WorkEventContentConflictError,
} from '../src/LifecycleTransaction.js';
import {
  B1_APPLICATION_ROLE,
  B1_RUNTIME_ROLE,
  B1_SCHEMA,
  countB1Rows,
  executeUnnamedQuery,
  installB1Schema,
  truncateB1Schema,
  withTenantTransaction,
} from '../src/database.js';
import {
  directRuntimeConnectionTarget,
  installerConnectionTarget,
  optionalConnectionTarget,
  runtimePassword,
  type B1ConnectionTarget,
} from '../src/connectionTargets.js';
import type {
  B1LifecycleRequest,
  B1RequestContext,
  B1TableCounts,
  B1WriteStage,
} from '../src/types.js';

const installerTarget = installerConnectionTarget();
const directRuntimeTarget = directRuntimeConnectionTarget();
const syntheticRuntimePassword = runtimePassword();
const installerPool = new Pool({ connectionString: installerTarget.connectionString, max: 4 });
const runtimePool = new Pool({ connectionString: directRuntimeTarget.connectionString, max: 12 });

const organizationA = OrganizationId('synthetic-organization-a');
const organizationB = OrganizationId('synthetic-organization-b');
const userA = UserId('synthetic-user-a');
const userB = UserId('synthetic-user-b');
const targetA = customerAssignmentTarget(CustomerId('synthetic-customer-a'));
const targetB = customerAssignmentTarget(CustomerId('synthetic-customer-b'));

const contextA: B1RequestContext = { organizationId: organizationA, userId: userA };
const contextB: B1RequestContext = { organizationId: organizationB, userId: userB };
const sameOrganizationUserBContext: B1RequestContext = { organizationId: organizationA, userId: userB };

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function request(
  id: string,
  occurredAt: string,
  context: B1RequestContext = contextA,
  target = targetA,
): B1LifecycleRequest {
  return {
    requestId: `request-${id}`,
    context,
    localTimeEntryId: `local-time-entry-${id}`,
    workEvent: {
      id: WorkEventId(id),
      assignmentId: NfcAssignmentId(`assignment-${id}`),
      nfcTagId: NfcTagId(`tag-${id}`),
      target,
      occurredAt: createTimestamp(occurredAt),
    },
  };
}

function expectedCounts(overrides: Partial<B1TableCounts> = {}): B1TableCounts {
  return {
    workEvents: 0,
    workEventDecisions: 0,
    timeEntries: 0,
    syncReceipts: 0,
    auditEvents: 0,
    ...overrides,
  };
}

async function tenantQuery<Row extends Record<string, unknown>>(
  context: B1RequestContext,
  text: string,
  values: readonly unknown[] = [],
) {
  return withTenantTransaction(runtimePool, context, (client) => executeUnnamedQuery<Row>(client, text, values));
}

async function insertSyntheticWorkEvent(context: B1RequestContext, id: string): Promise<void> {
  await withTenantTransaction(runtimePool, context, (client) =>
    executeUnnamedQuery(
      client,
      `INSERT INTO ${B1_SCHEMA}.work_events (
         organization_id, id, assignment_id, nfc_tag_id, target_type, target_id,
         triggered_by, occurred_at, content_hash, content_hash_algorithm, content_hash_version
       ) VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $8, 'sha256', 1)`,
      [
        context.organizationId,
        id,
        `assignment-${id}`,
        `tag-${id}`,
        targetA.targetId,
        context.userId,
        '2026-07-13T10:00:00Z',
        '0'.repeat(64),
      ],
    ),
  );
}

async function databaseErrorCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}

async function runtimeTransactionErrorCode(sql: string): Promise<string | undefined> {
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    return await databaseErrorCode(client.query(sql));
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function contextIsEmpty(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ context_is_empty: boolean }>(`
    SELECT
      NULLIF(current_setting('app.organization_id', true), '') IS NULL
      AND NULLIF(current_setting('app.user_id', true), '') IS NULL
      AND current_user <> 'taptime_b1_app' AS context_is_empty
  `);
  return result.rows[0]?.context_is_empty ?? false;
}

async function tryAcquireUserLock(client: PoolClient, context: B1RequestContext): Promise<boolean> {
  await client.query('BEGIN');
  try {
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [`${context.organizationId}\u001f${context.userId}`],
    );
    return result.rows[0]?.acquired ?? false;
  } finally {
    await client.query('ROLLBACK');
  }
}

async function waitForAdvisoryWaiter(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await installerPool.query<{ waiting: string }>(
      "SELECT count(*) AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted",
    );
    if (Number(result.rows[0]?.waiting ?? 0) > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Concurrent request never waited for the transaction advisory lock');
}

let timeEntrySequence = 0;
let auditSequence = 0;
let lifecycle: B1LifecycleTransaction;

beforeAll(async () => {
  await installB1Schema(installerPool, syntheticRuntimePassword);
});

beforeEach(async () => {
  await truncateB1Schema(installerPool);
  timeEntrySequence = 0;
  auditSequence = 0;
  lifecycle = new B1LifecycleTransaction(runtimePool, {
    newTimeEntryId: () => TimeEntryId(`server-time-entry-${++timeEntrySequence}`),
    newAuditEventId: () => `audit-event-${++auditSequence}`,
  });
});

afterAll(async () => {
  await runtimePool.end();
  await installerPool.end();
});

describe('B1 managed-Node lifecycle transaction against direct PostgreSQL', () => {
  it('commits WorkEvent, Core start decision, TimeEntry, SyncReceipt and AuditEvent together', async () => {
    const result = await lifecycle.process(request('work-event-start', '2026-07-13T08:00:00.000Z'));

    expect(result).toEqual({
      decisionStatus: 'time_entry_started',
      escalationReason: null,
      serverTimeEntryId: 'server-time-entry-1',
      idempotentRetry: false,
    });
    expect(await countB1Rows(installerPool)).toEqual(
      expectedCounts({ workEvents: 1, workEventDecisions: 1, timeEntries: 1, syncReceipts: 1, auditEvents: 1 }),
    );

    const persisted = await tenantQuery<{
      status: string;
      start_work_event_id: string;
      user_id: string;
    }>(contextA, `SELECT status, start_work_event_id, user_id FROM ${B1_SCHEMA}.time_entries`);
    expect(persisted.rows).toEqual([
      { status: 'started', start_work_event_id: 'work-event-start', user_id: userA },
    ]);
  });

  it('commits a Core stop decision and preserves start/stop traceability', async () => {
    await lifecycle.process(request('work-event-start', '2026-07-13T08:00:00.000Z'));
    const result = await lifecycle.process(request('work-event-stop', '2026-07-13T08:00:05.000Z'));

    expect(result.decisionStatus).toBe('time_entry_stopped');
    const persisted = await tenantQuery<{
      status: string;
      start_work_event_id: string;
      stop_work_event_id: string;
      stopped_at: Date;
    }>(
      contextA,
      `SELECT status, start_work_event_id, stop_work_event_id, stopped_at FROM ${B1_SCHEMA}.time_entries`,
    );
    expect(persisted.rows[0]).toMatchObject({
      status: 'stopped',
      start_work_event_id: 'work-event-start',
      stop_work_event_id: 'work-event-stop',
    });
    expect(persisted.rows[0]?.stopped_at.toISOString()).toBe('2026-07-13T08:00:05.000Z');
  });

  it('persists the Core duplicate decision without mutating the active TimeEntry', async () => {
    await lifecycle.process(request('work-event-start', '2026-07-13T08:00:00.000Z'));
    const before = await tenantQuery<Record<string, unknown>>(
      contextA,
      `SELECT * FROM ${B1_SCHEMA}.time_entries`,
    );

    const result = await lifecycle.process(request('work-event-duplicate', '2026-07-13T08:00:04.999Z'));
    const after = await tenantQuery<Record<string, unknown>>(
      contextA,
      `SELECT * FROM ${B1_SCHEMA}.time_entries`,
    );

    expect(result.decisionStatus).toBe('duplicate_scan_ignored');
    expect(after.rows).toEqual(before.rows);
    expect(await countB1Rows(installerPool)).toEqual(
      expectedCounts({ workEvents: 2, workEventDecisions: 2, timeEntries: 1, syncReceipts: 2, auditEvents: 2 }),
    );
  });

  it('persists the Core other-target rejection without mutating the active TimeEntry', async () => {
    await lifecycle.process(request('work-event-start', '2026-07-13T08:00:00.000Z'));
    const before = await tenantQuery<Record<string, unknown>>(contextA, `SELECT * FROM ${B1_SCHEMA}.time_entries`);

    const result = await lifecycle.process(
      request('work-event-other-target', '2026-07-13T08:00:10.000Z', contextA, targetB),
    );
    const after = await tenantQuery<Record<string, unknown>>(contextA, `SELECT * FROM ${B1_SCHEMA}.time_entries`);

    expect(result.decisionStatus).toBe('active_entry_for_other_target_rejected');
    expect(after.rows).toEqual(before.rows);
  });

  it('persists the Core escalation without mutating the active TimeEntry', async () => {
    await lifecycle.process(request('work-event-start', '2026-07-13T08:00:05.000Z'));
    const before = await tenantQuery<Record<string, unknown>>(contextA, `SELECT * FROM ${B1_SCHEMA}.time_entries`);

    const result = await lifecycle.process(request('work-event-backward', '2026-07-13T08:00:04.999Z'));
    const after = await tenantQuery<Record<string, unknown>>(contextA, `SELECT * FROM ${B1_SCHEMA}.time_entries`);

    expect(result).toMatchObject({
      decisionStatus: 'escalation_required',
      escalationReason: 'work_event_precedes_active_time_entry',
    });
    expect(after.rows).toEqual(before.rows);
  });

  it('returns an identical WorkEvent retry idempotently without another write', async () => {
    const original = request('work-event-retry', '2026-07-13T08:00:00.000Z');
    const first = await lifecycle.process(original);
    const retry = await lifecycle.process({ ...original, requestId: 'retry-request-id' });

    expect(retry).toEqual({ ...first, idempotentRetry: true });
    expect(await countB1Rows(installerPool)).toEqual(
      expectedCounts({ workEvents: 1, workEventDecisions: 1, timeEntries: 1, syncReceipts: 1, auditEvents: 1 }),
    );
  });

  it('rejects the same WorkEventId with different canonical content and preserves the original', async () => {
    const original = request('work-event-conflict', '2026-07-13T08:00:00.000Z');
    await lifecycle.process(original);

    await expect(
      lifecycle.process({
        ...original,
        workEvent: { ...original.workEvent, target: targetB },
      }),
    ).rejects.toBeInstanceOf(WorkEventContentConflictError);
    expect(await countB1Rows(installerPool)).toEqual(
      expectedCounts({ workEvents: 1, workEventDecisions: 1, timeEntries: 1, syncReceipts: 1, auditEvents: 1 }),
    );
  });

  it.each<B1WriteStage>([
    'work_event',
    'time_entry',
    'work_event_decision',
    'sync_receipt',
    'audit_event',
  ])('rolls every table back after an injected failure following %s', async (stage) => {
    await expect(
      lifecycle.process(request(`work-event-failure-${stage}`, '2026-07-13T08:00:00.000Z'), {
        failAfter: stage,
      }),
    ).rejects.toEqual(new InjectedB1Failure(stage));

    expect(await countB1Rows(installerPool)).toEqual(expectedCounts());
  });

  it('serializes two concurrent scans for the same Organization/User and leaves no second active entry', async () => {
    const firstHasLock = deferred<void>();
    const releaseFirst = deferred<void>();
    const first = lifecycle.process(request('work-event-concurrent-start', '2026-07-13T08:00:00.000Z'), {
      afterLockAcquired: async () => {
        firstHasLock.resolve();
        await releaseFirst.promise;
      },
    });
    await firstHasLock.promise;

    const second = lifecycle.process(request('work-event-concurrent-stop', '2026-07-13T08:00:10.000Z'));
    await waitForAdvisoryWaiter();
    releaseFirst.resolve();

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.decisionStatus)).toEqual([
      'time_entry_started',
      'time_entry_stopped',
    ]);
    const active = await tenantQuery<{ count: string }>(
      contextA,
      `SELECT count(*) AS count FROM ${B1_SCHEMA}.time_entries WHERE status = 'started'`,
    );
    expect(Number(active.rows[0]?.count)).toBe(0);
    expect(await countB1Rows(installerPool)).toMatchObject({ timeEntries: 1 });
  });

  it('does not serialize different users behind one another', async () => {
    const userAHasLock = deferred<void>();
    const releaseUserA = deferred<void>();
    const userBHasLock = deferred<void>();
    const first = lifecycle.process(request('work-event-user-a', '2026-07-13T08:00:00.000Z'), {
      afterLockAcquired: async () => {
        userAHasLock.resolve();
        await releaseUserA.promise;
      },
    });
    await userAHasLock.promise;

    const second = lifecycle.process(
      request('work-event-user-b', '2026-07-13T08:00:00.000Z', sameOrganizationUserBContext),
      { afterLockAcquired: () => userBHasLock.resolve() },
    );
    await Promise.race([
      userBHasLock.promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('User B was incorrectly blocked')), 2_000)),
    ]);
    releaseUserA.resolve();

    const results = await Promise.all([first, second]);
    expect(results.map((result) => result.decisionStatus)).toEqual([
      'time_entry_started',
      'time_entry_started',
    ]);
    const activeForUserA = await tenantQuery<{ count: string }>(
      contextA,
      `SELECT count(*) AS count FROM ${B1_SCHEMA}.time_entries WHERE status = 'started'`,
    );
    const activeForUserB = await tenantQuery<{ count: string }>(
      sameOrganizationUserBContext,
      `SELECT count(*) AS count FROM ${B1_SCHEMA}.time_entries WHERE status = 'started'`,
    );
    expect(Number(activeForUserA.rows[0]?.count)).toBe(1);
    expect(Number(activeForUserB.rows[0]?.count)).toBe(1);
    expect((await countB1Rows(installerPool)).timeEntries).toBe(2);
  });

  it('isolates every lifecycle table by User inside the same Organization and prevents TimeEntry takeover', async () => {
    await lifecycle.process(request('work-event-same-org-user-a', '2026-07-13T08:00:00.000Z'));
    await lifecycle.process(
      request('work-event-same-org-user-b', '2026-07-13T08:00:00.000Z', sameOrganizationUserBContext),
    );

    const userBVisibilityQueries = [
      `SELECT id FROM ${B1_SCHEMA}.work_events WHERE triggered_by = $1`,
      `SELECT work_event_id FROM ${B1_SCHEMA}.work_event_decisions WHERE actor_user_id = $1`,
      `SELECT work_event_id FROM ${B1_SCHEMA}.sync_receipts WHERE actor_user_id = $1`,
      `SELECT id FROM ${B1_SCHEMA}.audit_events WHERE actor_user_id = $1`,
      `SELECT id FROM ${B1_SCHEMA}.time_entries WHERE user_id = $1`,
    ];
    for (const sql of userBVisibilityQueries) {
      const result = await tenantQuery(contextA, sql, [userB]);
      expect(result.rowCount).toBe(0);
    }

    const before = await installerPool.query(
      `SELECT * FROM ${B1_SCHEMA}.time_entries WHERE id = 'server-time-entry-2'`,
    );
    const hiddenUpdate = await tenantQuery(
      contextA,
      `UPDATE ${B1_SCHEMA}.time_entries
       SET status = 'stopped', stopped_at = '2026-07-13T09:00:00Z', stop_work_event_id = 'work-event-same-org-user-b'
       WHERE id = 'server-time-entry-2'`,
    );
    expect(hiddenUpdate.rowCount).toBe(0);

    const takeoverCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `UPDATE ${B1_SCHEMA}.time_entries SET user_id = $1 WHERE id = 'server-time-entry-2'`,
          [userA],
        ),
      ),
    );
    expect(takeoverCode).toBe('42501');
    const after = await installerPool.query(
      `SELECT * FROM ${B1_SCHEMA}.time_entries WHERE id = 'server-time-entry-2'`,
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('keeps the normal real Core start/stop lifecycle valid for two users in the same Organization', async () => {
    const startA = await lifecycle.process(request('normal-user-a-start', '2026-07-13T08:00:00.000Z'));
    const startB = await lifecycle.process(
      request('normal-user-b-start', '2026-07-13T08:00:00.000Z', sameOrganizationUserBContext),
    );
    const stopA = await lifecycle.process(request('normal-user-a-stop', '2026-07-13T08:00:05.000Z'));
    const stopB = await lifecycle.process(
      request('normal-user-b-stop', '2026-07-13T08:00:05.000Z', sameOrganizationUserBContext),
    );

    expect([startA.decisionStatus, startB.decisionStatus, stopA.decisionStatus, stopB.decisionStatus]).toEqual([
      'time_entry_started',
      'time_entry_started',
      'time_entry_stopped',
      'time_entry_stopped',
    ]);
    const userAEntries = await tenantQuery<{ status: string }>(
      contextA,
      `SELECT status FROM ${B1_SCHEMA}.time_entries`,
    );
    const userBEntries = await tenantQuery<{ status: string }>(
      sameOrganizationUserBContext,
      `SELECT status FROM ${B1_SCHEMA}.time_entries`,
    );
    expect(userAEntries.rows).toEqual([{ status: 'stopped' }]);
    expect(userBEntries.rows).toEqual([{ status: 'stopped' }]);
    expect((await countB1Rows(installerPool)).timeEntries).toBe(2);
  });

  it('rejects User A TimeEntry creation with User B start WorkEvent using the user-qualified FK', async () => {
    await insertSyntheticWorkEvent(sameOrganizationUserBContext, 'user-b-start-event');

    const errorCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `INSERT INTO ${B1_SCHEMA}.time_entries (
             organization_id, id, user_id, target_type, target_id, status, started_at, start_work_event_id
           ) VALUES ($1, $2, $3, 'customer', $4, 'started', $5, $6)`,
          [
            organizationA,
            'cross-user-start-time-entry',
            userA,
            targetA.targetId,
            '2026-07-13T10:00:00Z',
            'user-b-start-event',
          ],
        ),
      ),
    );

    expect(errorCode).toBe('23503');
    expect((await countB1Rows(installerPool)).timeEntries).toBe(0);
    expect(
      (
        await tenantQuery(
          contextA,
          `SELECT id FROM ${B1_SCHEMA}.work_events WHERE id = 'user-b-start-event'`,
        )
      ).rowCount,
    ).toBe(0);
  });

  it('rejects stopping User A TimeEntry with User B WorkEvent and leaves it active', async () => {
    await lifecycle.process(request('user-a-active-start', '2026-07-13T08:00:00.000Z'));
    await insertSyntheticWorkEvent(sameOrganizationUserBContext, 'user-b-stop-event');
    const before = await installerPool.query(
      `SELECT * FROM ${B1_SCHEMA}.time_entries WHERE id = 'server-time-entry-1'`,
    );

    const errorCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `UPDATE ${B1_SCHEMA}.time_entries
           SET status = 'stopped', stopped_at = '2026-07-13T10:00:00Z', stop_work_event_id = 'user-b-stop-event'
           WHERE id = 'server-time-entry-1'`,
        ),
      ),
    );

    expect(errorCode).toBe('23503');
    const after = await installerPool.query(
      `SELECT * FROM ${B1_SCHEMA}.time_entries WHERE id = 'server-time-entry-1'`,
    );
    expect(after.rows).toEqual(before.rows);
    expect(after.rows[0]).toMatchObject({ status: 'started', stopped_at: null, stop_work_event_id: null });
  });

  it.each([
    {
      evidence: 'WorkEventDecision',
      sql: `INSERT INTO ${B1_SCHEMA}.work_event_decisions (
        organization_id, work_event_id, actor_user_id, decision_status, engine_version, decision_payload
      ) VALUES ($1, $2, $3, 'escalation_required', 'cross-user-fk-test', '{}'::jsonb)`,
    },
    {
      evidence: 'SyncReceipt',
      sql: `INSERT INTO ${B1_SCHEMA}.sync_receipts (
        organization_id, work_event_id, actor_user_id, request_id, outcome
      ) VALUES ($1, $2, $3, 'cross-user-request', 'escalation_required')`,
    },
    {
      evidence: 'AuditEvent',
      sql: `INSERT INTO ${B1_SCHEMA}.audit_events (
        organization_id, id, work_event_id, actor_user_id, event_type, payload
      ) VALUES ($1, 'cross-user-audit', $2, $3, 'cross-user-attempt', '{}'::jsonb)`,
    },
  ])('rejects User A $evidence for User B WorkEvent with 23503', async ({ sql }) => {
    await insertSyntheticWorkEvent(sameOrganizationUserBContext, 'user-b-evidence-event');

    const errorCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(client, sql, [organizationA, 'user-b-evidence-event', userA]),
      ),
    );

    expect(errorCode).toBe('23503');
    expect(
      (
        await tenantQuery(
          contextA,
          `SELECT id FROM ${B1_SCHEMA}.work_events WHERE id = 'user-b-evidence-event'`,
        )
      ).rowCount,
    ).toBe(0);
  });

  it.each([
    {
      evidence: 'WorkEventDecision',
      sql: `INSERT INTO ${B1_SCHEMA}.work_event_decisions (
        organization_id, work_event_id, actor_user_id, decision_status, time_entry_id,
        engine_version, decision_payload
      ) VALUES ($1, $2, $3, 'time_entry_started', $4, 'cross-user-fk-test', '{}'::jsonb)`,
    },
    {
      evidence: 'SyncReceipt',
      sql: `INSERT INTO ${B1_SCHEMA}.sync_receipts (
        organization_id, work_event_id, actor_user_id, request_id, outcome, server_time_entry_id
      ) VALUES ($1, $2, $3, 'cross-user-time-entry-request', 'time_entry_started', $4)`,
    },
  ])('rejects User A $evidence reference to User B TimeEntry with 23503', async ({ sql }) => {
    await lifecycle.process(
      request('user-b-time-entry-event', '2026-07-13T08:00:00.000Z', sameOrganizationUserBContext),
    );
    await insertSyntheticWorkEvent(contextA, 'user-a-evidence-event');

    const errorCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(client, sql, [organizationA, 'user-a-evidence-event', userA, 'server-time-entry-1']),
      ),
    );

    expect(errorCode).toBe('23503');
    expect(
      (
        await tenantQuery(
          contextA,
          `SELECT id FROM ${B1_SCHEMA}.time_entries WHERE id = 'server-time-entry-1'`,
        )
      ).rowCount,
    ).toBe(0);
  });

  it.each([
    {
      table: 'work_events',
      identityColumn: 'id',
      identityValue: 'work-event-immutable',
      update: "target_id = 'tampered'",
    },
    {
      table: 'work_event_decisions',
      identityColumn: 'work_event_id',
      identityValue: 'work-event-immutable',
      update: "decision_status = 'tampered'",
    },
    {
      table: 'sync_receipts',
      identityColumn: 'work_event_id',
      identityValue: 'work-event-immutable',
      update: "outcome = 'tampered'",
    },
    {
      table: 'audit_events',
      identityColumn: 'id',
      identityValue: 'audit-event-1',
      update: "event_type = 'tampered'",
    },
  ])('denies UPDATE and DELETE on immutable $table and preserves the original row', async (immutable) => {
    await lifecycle.process(request('work-event-immutable', '2026-07-13T08:00:00.000Z'));
    const before = await installerPool.query(
      `SELECT * FROM ${B1_SCHEMA}.${immutable.table} WHERE ${immutable.identityColumn} = $1`,
      [immutable.identityValue],
    );

    const updateCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `UPDATE ${B1_SCHEMA}.${immutable.table} SET ${immutable.update} WHERE ${immutable.identityColumn} = $1`,
          [immutable.identityValue],
        ),
      ),
    );
    const deleteCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `DELETE FROM ${B1_SCHEMA}.${immutable.table} WHERE ${immutable.identityColumn} = $1`,
          [immutable.identityValue],
        ),
      ),
    );

    expect(updateCode).toBe('42501');
    expect(deleteCode).toBe('42501');
    const after = await installerPool.query(
      `SELECT * FROM ${B1_SCHEMA}.${immutable.table} WHERE ${immutable.identityColumn} = $1`,
      [immutable.identityValue],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('prevents Organization A from reading or writing Organization B rows', async () => {
    await lifecycle.process(request('work-event-tenant-b', '2026-07-13T08:00:00.000Z', contextB));

    const visible = await tenantQuery<{ id: string }>(
      contextA,
      `SELECT id FROM ${B1_SCHEMA}.work_events WHERE id = $1`,
      ['work-event-tenant-b'],
    );
    expect(visible.rows).toEqual([]);

    const writeCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `INSERT INTO ${B1_SCHEMA}.work_events (
             organization_id, id, assignment_id, nfc_tag_id, target_type, target_id,
             triggered_by, occurred_at, content_hash, content_hash_algorithm, content_hash_version
           ) VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $8, 'sha256', 1)`,
          [organizationB, 'forbidden-write', 'assignment', 'tag', 'customer', userA, '2026-07-13T09:00:00Z', '0'.repeat(64)],
        ),
      ),
    );
    expect(writeCode).toBe('42501');
  });

  it('uses a non-owner runtime login with no elevated attributes and only application-role membership', async () => {
    const roles = await installerPool.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolinherit: boolean;
      rolcanlogin: boolean;
    }>(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit, rolcanlogin
       FROM pg_roles WHERE rolname IN ($1, $2) ORDER BY rolname`,
      [B1_APPLICATION_ROLE, B1_RUNTIME_ROLE],
    );
    expect(roles.rows).toEqual([
      {
        rolname: B1_APPLICATION_ROLE,
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolinherit: false,
        rolcanlogin: false,
      },
      {
        rolname: B1_RUNTIME_ROLE,
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolinherit: false,
        rolcanlogin: true,
      },
    ]);

    const membership = await installerPool.query<{ role_name: string }>(
      `SELECT granted.rolname AS role_name
       FROM pg_auth_members membership
       JOIN pg_roles granted ON granted.oid = membership.roleid
       JOIN pg_roles member ON member.oid = membership.member
       WHERE member.rolname = $1`,
      [B1_RUNTIME_ROLE],
    );
    expect(membership.rows).toEqual([{ role_name: B1_APPLICATION_ROLE }]);

    const owners = await installerPool.query<{ owner: string }>(`
      SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = '${B1_SCHEMA}'
      UNION ALL
      SELECT DISTINCT pg_get_userbyid(relowner) AS owner
      FROM pg_class WHERE relnamespace = '${B1_SCHEMA}'::regnamespace
    `);
    expect(owners.rows.length).toBeGreaterThan(0);
    expect(owners.rows.every((row) => row.owner !== B1_RUNTIME_ROLE && row.owner !== B1_APPLICATION_ROLE)).toBe(true);
  });

  it('installs only operation-specific policies and the exact immutable/TimeEntry privilege matrix', async () => {
    const policies = await installerPool.query<{ tablename: string; cmd: string }>(
      `SELECT tablename, cmd FROM pg_policies
       WHERE schemaname = $1
       ORDER BY tablename, cmd`,
      [B1_SCHEMA],
    );
    expect(policies.rows).toEqual([
      { tablename: 'audit_events', cmd: 'INSERT' },
      { tablename: 'audit_events', cmd: 'SELECT' },
      { tablename: 'sync_receipts', cmd: 'INSERT' },
      { tablename: 'sync_receipts', cmd: 'SELECT' },
      { tablename: 'time_entries', cmd: 'INSERT' },
      { tablename: 'time_entries', cmd: 'SELECT' },
      { tablename: 'time_entries', cmd: 'UPDATE' },
      { tablename: 'work_event_decisions', cmd: 'INSERT' },
      { tablename: 'work_event_decisions', cmd: 'SELECT' },
      { tablename: 'work_events', cmd: 'INSERT' },
      { tablename: 'work_events', cmd: 'SELECT' },
    ]);

    for (const table of ['work_events', 'work_event_decisions', 'sync_receipts', 'audit_events']) {
      const privileges = await installerPool.query<{
        can_select: boolean;
        can_insert: boolean;
        can_update: boolean;
        can_delete: boolean;
      }>(
        `SELECT
           has_table_privilege($1, $2, 'SELECT') AS can_select,
           has_table_privilege($1, $2, 'INSERT') AS can_insert,
           has_table_privilege($1, $2, 'UPDATE') AS can_update,
           has_table_privilege($1, $2, 'DELETE') AS can_delete`,
        [B1_APPLICATION_ROLE, `${B1_SCHEMA}.${table}`],
      );
      expect(privileges.rows[0]).toEqual({
        can_select: true,
        can_insert: true,
        can_update: false,
        can_delete: false,
      });
    }

    const timeEntryPrivileges = await installerPool.query<{
      can_select: boolean;
      can_insert: boolean;
      can_table_update: boolean;
      can_status_update: boolean;
      can_stopped_at_update: boolean;
      can_stop_event_update: boolean;
      can_user_update: boolean;
      can_delete: boolean;
    }>(
      `SELECT
         has_table_privilege($1, '${B1_SCHEMA}.time_entries', 'SELECT') AS can_select,
         has_table_privilege($1, '${B1_SCHEMA}.time_entries', 'INSERT') AS can_insert,
         has_table_privilege($1, '${B1_SCHEMA}.time_entries', 'UPDATE') AS can_table_update,
         has_column_privilege($1, '${B1_SCHEMA}.time_entries', 'status', 'UPDATE') AS can_status_update,
         has_column_privilege($1, '${B1_SCHEMA}.time_entries', 'stopped_at', 'UPDATE') AS can_stopped_at_update,
         has_column_privilege($1, '${B1_SCHEMA}.time_entries', 'stop_work_event_id', 'UPDATE') AS can_stop_event_update,
         has_column_privilege($1, '${B1_SCHEMA}.time_entries', 'user_id', 'UPDATE') AS can_user_update,
         has_table_privilege($1, '${B1_SCHEMA}.time_entries', 'DELETE') AS can_delete`,
      [B1_APPLICATION_ROLE],
    );
    expect(timeEntryPrivileges.rows[0]).toEqual({
      can_select: true,
      can_insert: true,
      can_table_update: false,
      can_status_update: true,
      can_stopped_at_update: true,
      can_stop_event_update: true,
      can_user_update: false,
      can_delete: false,
    });
  });

  it('installs every required Organization/User-qualified unique key and foreign key', async () => {
    const constraints = await installerPool.query<{ conname: string; definition: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE connamespace = $1::regnamespace
         AND conname = ANY($2::text[])
       ORDER BY conname`,
      [
        B1_SCHEMA,
        [
          'audit_events_work_event_user_fk',
          'sync_receipts_time_entry_user_fk',
          'sync_receipts_work_event_user_fk',
          'time_entries_organization_user_id_unique',
          'time_entries_start_work_event_user_fk',
          'time_entries_stop_work_event_user_fk',
          'work_event_decisions_time_entry_user_fk',
          'work_event_decisions_work_event_user_fk',
          'work_events_organization_user_id_unique',
        ],
      ],
    );
    expect(Object.fromEntries(constraints.rows.map((row) => [row.conname, row.definition]))).toEqual({
      audit_events_work_event_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, actor_user_id, work_event_id)',
      ),
      sync_receipts_time_entry_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, actor_user_id, server_time_entry_id)',
      ),
      sync_receipts_work_event_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, actor_user_id, work_event_id)',
      ),
      time_entries_organization_user_id_unique: 'UNIQUE (organization_id, user_id, id)',
      time_entries_start_work_event_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, user_id, start_work_event_id)',
      ),
      time_entries_stop_work_event_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, user_id, stop_work_event_id)',
      ),
      work_event_decisions_time_entry_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, actor_user_id, time_entry_id)',
      ),
      work_event_decisions_work_event_user_fk: expect.stringContaining(
        'FOREIGN KEY (organization_id, actor_user_id, work_event_id)',
      ),
      work_events_organization_user_id_unique: 'UNIQUE (organization_id, triggered_by, id)',
    });
  });

  it('gives the runtime login no direct table access before SET ROLE or after RESET ROLE', async () => {
    await lifecycle.process(request('runtime-direct-access', '2026-07-13T08:00:00.000Z'));
    expect(await databaseErrorCode(runtimePool.query(`SELECT * FROM ${B1_SCHEMA}.work_events`))).toBe('42501');

    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET ROLE ${B1_APPLICATION_ROLE}`);
      await client.query(
        "SELECT set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true)",
        [organizationA, userA],
      );
      expect((await client.query(`SELECT * FROM ${B1_SCHEMA}.work_events`)).rowCount).toBe(1);
      await client.query('RESET ROLE');
      expect(await databaseErrorCode(client.query(`SELECT * FROM ${B1_SCHEMA}.work_events`))).toBe('42501');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('cannot disable RLS or create roles/schemas or alter policies with the runtime credential', async () => {
    await lifecycle.process(request('runtime-rls-proof', '2026-07-13T08:00:00.000Z'));

    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${B1_APPLICATION_ROLE}`);
      await client.query(
        "SELECT set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true)",
        [organizationA, userA],
      );
      await client.query('SET LOCAL row_security = off');
      expect(await databaseErrorCode(client.query(`SELECT * FROM ${B1_SCHEMA}.work_events`))).toBe('42501');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }

    expect(await runtimeTransactionErrorCode('CREATE ROLE b1_forbidden_role')).toBe('42501');
    expect(await runtimeTransactionErrorCode('CREATE SCHEMA b1_forbidden_schema')).toBe('42501');
    expect(
      await runtimeTransactionErrorCode(
        `ALTER POLICY work_events_select ON ${B1_SCHEMA}.work_events USING (true)`,
      ),
    ).toBe('42501');

    const forbiddenObjects = await installerPool.query<{ count: string }>(`
      SELECT
        (SELECT count(*) FROM pg_roles WHERE rolname = 'b1_forbidden_role')
        + (SELECT count(*) FROM pg_namespace WHERE nspname = 'b1_forbidden_schema') AS count
    `);
    expect(Number(forbiddenObjects.rows[0]?.count)).toBe(0);
  });

  it('rejects a cross-tenant foreign key even when the guessed WorkEventId exists', async () => {
    await lifecycle.process(request('work-event-foreign', '2026-07-13T08:00:00.000Z', contextB));

    const errorCode = await databaseErrorCode(
      withTenantTransaction(runtimePool, contextA, (client) =>
        executeUnnamedQuery(
          client,
          `INSERT INTO ${B1_SCHEMA}.time_entries (
             organization_id, id, user_id, target_type, target_id, status, started_at, start_work_event_id
           ) VALUES ($1, $2, $3, 'customer', $4, 'started', $5, $6)`,
          [organizationA, 'cross-tenant-time-entry', userA, targetA.targetId, '2026-07-13T08:00:00Z', 'work-event-foreign'],
        ),
      ),
    );
    expect(errorCode).toBe('23503');
  });

  it('does not disclose foreign evidence through guessed identifiers', async () => {
    await lifecycle.process(request('guessed-foreign-id', '2026-07-13T08:00:00.000Z', contextB));

    const evidence = await withTenantTransaction(runtimePool, contextA, async (client) => {
      const queries = [
        `SELECT id FROM ${B1_SCHEMA}.work_events WHERE id = $1`,
        `SELECT work_event_id FROM ${B1_SCHEMA}.work_event_decisions WHERE work_event_id = $1`,
        `SELECT work_event_id FROM ${B1_SCHEMA}.sync_receipts WHERE work_event_id = $1`,
        `SELECT work_event_id FROM ${B1_SCHEMA}.audit_events WHERE work_event_id = $1`,
        `SELECT id FROM ${B1_SCHEMA}.time_entries WHERE start_work_event_id = $1`,
      ];
      const results = [];
      for (const sql of queries) {
        results.push(await executeUnnamedQuery(client, sql, ['guessed-foreign-id']));
      }
      return results;
    });
    expect(evidence.every((result) => result.rowCount === 0)).toBe(true);
  });

  it('clears Organization/User/role context on a reused pool connection after commit and rollback', async () => {
    const singleConnectionPool = new Pool({ connectionString: directRuntimeTarget.connectionString, max: 1 });
    const isolatedLifecycle = new B1LifecycleTransaction(singleConnectionPool, {
      newTimeEntryId: () => TimeEntryId('single-connection-time-entry'),
      newAuditEventId: () => 'single-connection-audit',
    });
    try {
      await isolatedLifecycle.process(request('context-commit', '2026-07-13T08:00:00.000Z'));
      let client = await singleConnectionPool.connect();
      expect(await contextIsEmpty(client)).toBe(true);
      client.release();

      await expect(
        isolatedLifecycle.process(request('context-rollback', '2026-07-13T09:00:00.000Z', contextA, targetB), {
          failAfter: 'work_event',
        }),
      ).rejects.toBeInstanceOf(InjectedB1Failure);
      client = await singleConnectionPool.connect();
      expect(await contextIsEmpty(client)).toBe(true);
      client.release();
    } finally {
      await singleConnectionPool.end();
    }
  });

  it('releases the transaction advisory lock after both commit and rollback', async () => {
    await lifecycle.process(request('lock-commit', '2026-07-13T08:00:00.000Z'));
    let client = await runtimePool.connect();
    expect(await tryAcquireUserLock(client, contextA)).toBe(true);
    client.release();

    await expect(
      lifecycle.process(request('lock-rollback', '2026-07-13T09:00:00.000Z', contextA, targetB), {
        failAfter: 'work_event',
      }),
    ).rejects.toBeInstanceOf(InjectedB1Failure);
    client = await runtimePool.connect();
    expect(await tryAcquireUserLock(client, contextA)).toBe(true);
    client.release();
  });

  it('uses only unnamed queries and transaction-level advisory locks in the pool-compatible path', async () => {
    const observedQueries: string[] = [];
    const observedLifecycle = new B1LifecycleTransaction(runtimePool, {
      queryObserver: (text) => observedQueries.push(text),
      newTimeEntryId: () => TimeEntryId('observed-time-entry'),
      newAuditEventId: () => 'observed-audit-event',
    });

    await observedLifecycle.process(request('unnamed-query-proof', '2026-07-13T08:00:00.000Z'));

    expect(observedQueries.length).toBeGreaterThan(10);
    expect(observedQueries.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(observedQueries.every((sql) => !/\b(PREPARE|EXECUTE)\b/i.test(sql))).toBe(true);
    expect(observedQueries.every((sql) => !/pg_advisory_lock\s*\(/i.test(sql))).toBe(true);
  });
});

describe('configured B1 connection modes', () => {
  async function connectionSmoke(target: B1ConnectionTarget): Promise<void> {
    const targetPool = new Pool({ connectionString: target.connectionString, max: 2 });
    try {
      const version = await targetPool.query<{ server_version: string }>('SHOW server_version');
      expect(version.rows[0]?.server_version).toBeTruthy();

      const uniqueContext: B1RequestContext = {
        organizationId: OrganizationId(`synthetic-${target.mode}-organization`),
        userId: UserId(`synthetic-${target.mode}-user`),
      };
      const transaction = new B1LifecycleTransaction(targetPool);
      const result = await transaction.process(
        request(`work-event-${target.mode}`, '2026-07-13T12:00:00.000Z', uniqueContext),
      );
      expect(result.decisionStatus).toBe('time_entry_started');
    } finally {
      await targetPool.end();
    }
  }

  it('executes the direct PostgreSQL mode', async () => {
    await connectionSmoke(directRuntimeTarget);
  });

  const sessionTarget = optionalConnectionTarget('supavisor-session');
  it.skipIf(sessionTarget === null)('executes Supavisor Session Mode only on a prepared target', async () => {
    await connectionSmoke(sessionTarget!);
  });

  const transactionTarget = optionalConnectionTarget('supavisor-transaction');
  it.skipIf(transactionTarget === null)('executes Supavisor Transaction Mode only on a prepared target', async () => {
    await connectionSmoke(transactionTarget!);
  });
});
