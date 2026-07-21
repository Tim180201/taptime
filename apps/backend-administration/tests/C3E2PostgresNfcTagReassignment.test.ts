import { reassignNfcTagCommandDigestV1 } from '@taptime/administration-contract';
import { type SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import {
  ServerCanonicalLifecycleIngestionCoordinator,
  type LifecycleIngestionCommand,
} from '@taptime/backend-lifecycle';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '@taptime/backend-schema';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AdminWriteSessionCoordinator,
  C3E2_ASSIGNMENT_REASSIGNER_ROLE,
  C3E2DeadlineExceededError,
  InjectedC3E2Failure,
  NfcTagReassignmentCoordinator,
} from '../src/index.js';
import type { ReassignNfcTagCommand, ReassignmentWriteStage } from '../src/types.js';
import {
  C3E2_REASSIGNMENT_RUNTIME_LOGIN,
  c3e2RuntimeConnectionString,
  customerIds,
  ensureC3CRuntimeLogin,
  ensureC3E2RuntimeLogin,
  fixtureAccessTokenVerifier,
  fixtureTokens,
  ids,
  membershipIds,
  postgresErrorCode,
  removeC3CRuntimeLogin,
  removeC3E2RuntimeLogin,
  runtimeConnectionString as c3cRuntimeConnectionString,
  seedC3C,
  syntheticPassword,
  truncateC3C,
} from './fixtures.js';

const installerDatabaseUrl = process.env.C3C_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c';
const runtimePassword = syntheticPassword();
const lifecycleRuntimeLogin = 'taptime_c3e2_b6_race_test_login';
const organizationBResources = {
  targetCustomer: '20000000-0000-4000-8000-000000000005',
  tag: '30000000-0000-4000-8000-000000000003',
  assignment: '40000000-0000-4000-8000-000000000003',
} as const;
const commandIds = {
  primary: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  secondary: 'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
} as const;

let installerPool: Pool;
let c3cRuntimePool: Pool;
let runtimePool: Pool;
let lifecycleRuntimePool: Pool;
let adminWriteCoordinator: AdminWriteSessionCoordinator;
let coordinator: NfcTagReassignmentCoordinator;
let lifecycleCoordinator: ServerCanonicalLifecycleIngestionCoordinator;

beforeAll(async () => {
  installerPool = new Pool({ connectionString: installerDatabaseUrl, max: 6 });
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await expect(migrate(installerPool)).resolves.toEqual({
    applied: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011'],
    alreadyApplied: [],
  });
  await ensureC3CRuntimeLogin(installerPool, runtimePassword);
  await ensureC3E2RuntimeLogin(installerPool, runtimePassword);
  await ensureLifecycleRuntimeLogin(installerPool, runtimePassword);
  c3cRuntimePool = new Pool({
    connectionString: c3cRuntimeConnectionString(installerDatabaseUrl, runtimePassword),
    max: 4,
  });
  runtimePool = new Pool({
    connectionString: c3e2RuntimeConnectionString(installerDatabaseUrl, runtimePassword),
    max: 12,
  });
  lifecycleRuntimePool = new Pool({
    connectionString: runtimeConnectionString(
      installerDatabaseUrl,
      lifecycleRuntimeLogin,
      runtimePassword,
    ),
    max: 4,
  });
  adminWriteCoordinator = new AdminWriteSessionCoordinator(
    c3cRuntimePool,
    fixtureAccessTokenVerifier,
  );
  coordinator = new NfcTagReassignmentCoordinator(runtimePool, fixtureAccessTokenVerifier);
  lifecycleCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
    lifecycleRuntimePool,
    fixtureAccessTokenVerifier as SupabaseJwtAccessTokenVerifier,
  );
  await c3cRuntimePool.query('SELECT 1');
  await runtimePool.query('SELECT 1');
  await lifecycleRuntimePool.query('SELECT 1');
}, 30_000);

beforeEach(async () => {
  await truncateC3C(installerPool);
  await seedC3C(installerPool);
  await installerPool.query(
    `INSERT INTO taptime_server.customers
      (id, organization_id, display_name, active)
     VALUES ($1, $2, 'Target Customer A', true)`,
    [ids.targetCustomerA, ids.organizationA],
  );
});

afterAll(async () => {
  await lifecycleRuntimePool?.end();
  await runtimePool?.end();
  await c3cRuntimePool?.end();
  if (installerPool !== undefined) {
    await removeLifecycleRuntimeLogin(installerPool);
    await removeC3E2RuntimeLogin(installerPool);
    await removeC3CRuntimeLogin(installerPool);
    await installerPool.end();
  }
});

describe('C3E2 explicit NFC Tag reassignment', () => {
  it('atomically closes the expected Assignment, appends one successor, two audits and one receipt at one timestamp', async () => {
    const result = await coordinator.reassignNfcTag(command());

    expect(result).toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: true,
      replacedAssignmentId: ids.assignmentA,
      targetCustomerId: ids.targetCustomerA,
    });
    if (result.status !== 'succeeded') throw new Error('Expected success');
    expect(result.resultAssignmentId).not.toBe(ids.assignmentA);
    expect(result.effectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const assignments = await installerPool.query<{
      id: string;
      target_customer_id: string;
      active: boolean;
      valid_from: Date;
      valid_to: Date | null;
      row_version: string;
    }>(
      `SELECT id, target_customer_id, active, valid_from, valid_to, row_version
       FROM taptime_server.nfc_assignments
       WHERE organization_id = $1 AND nfc_tag_id = $2
       ORDER BY valid_from, id`,
      [ids.organizationA, ids.tagAssignedA],
    );
    expect(assignments.rows).toHaveLength(2);
    const oldAssignment = assignments.rows.find(({ id }) => id === ids.assignmentA)!;
    const newAssignment = assignments.rows.find(({ id }) => id === result.resultAssignmentId)!;
    expect(oldAssignment).toMatchObject({ active: false, row_version: '2' });
    expect(newAssignment).toMatchObject({
      target_customer_id: ids.targetCustomerA,
      active: true,
      valid_to: null,
      row_version: '1',
    });
    expect(oldAssignment.valid_to?.toISOString()).toBe(newAssignment.valid_from.toISOString());
    expect(newAssignment.valid_from.toISOString()).toBe(result.effectiveAt);

    const evidence = await installerPool.query<{
      receipts: number;
      audits: number;
      deactivated: number;
      assigned: number;
    }>(
      `SELECT
         (SELECT count(*)::integer
          FROM taptime_server.admin_setup_command_receipts
          WHERE command_id = $1) AS receipts,
         count(*)::integer AS audits,
         count(*) FILTER (WHERE event_type = 'NfcAssignmentDeactivated')::integer AS deactivated,
         count(*) FILTER (WHERE event_type = 'NfcTagAssigned')::integer AS assigned
       FROM taptime_server.audit_events
       WHERE correlation_id = $1::text`,
      [commandIds.primary],
    );
    expect(evidence.rows[0]).toEqual({
      receipts: 1,
      audits: 2,
      deactivated: 1,
      assigned: 1,
    });
  });

  it('records same-target intent as an idempotent no-op with zero Assignment or audit mutations', async () => {
    const result = await coordinator.reassignNfcTag(command({
      targetCustomerId: customerIds.customerA,
    }));
    expect(result).toEqual({
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: false,
      resultAssignmentId: ids.assignmentA,
      replacedAssignmentId: null,
      targetCustomerId: ids.customerA,
      effectiveAt: null,
    });
    const counts = await installerPool.query<{ assignments: number; audits: number; receipts: number }>(
      `SELECT
         (SELECT count(*)::integer FROM taptime_server.nfc_assignments) AS assignments,
         (SELECT count(*)::integer FROM taptime_server.audit_events
          WHERE correlation_id = $1) AS audits,
         (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts
          WHERE command_id = $2) AS receipts`,
      [commandIds.primary, commandIds.primary],
    );
    expect(counts.rows[0]).toEqual({ assignments: 1, audits: 0, receipts: 1 });
  });

  it('replays the global receipt before resource checks and rejects command reuse with a changed digest', async () => {
    const first = await coordinator.reassignNfcTag(command());
    const replay = await coordinator.reassignNfcTag(command());
    expect(first).toMatchObject({ status: 'succeeded', idempotentRetry: false });
    expect(replay).toEqual({
      ...(first as Extract<typeof first, { status: 'succeeded' }>),
      idempotentRetry: true,
    });

    await expect(coordinator.reassignNfcTag(command({
      targetCustomerId: customerIds.customerA,
    }))).resolves.toEqual({ status: 'command_id_conflict' });
    await expect(coordinator.reassignNfcTag(command({
      accessToken: fixtureTokens.adminA2,
      expectedMembershipId: membershipIds.adminA2,
    }))).resolves.toEqual({ status: 'command_id_conflict' });
  });

  it('rejects reuse of a global command ID across C3C and C3E2 command types', async () => {
    await expect(adminWriteCoordinator.createCustomer({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: commandIds.primary,
      displayName: 'Global Receipt Namespace Probe',
    })).resolves.toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
    });

    await expect(coordinator.reassignNfcTag(command())).resolves.toEqual({
      status: 'command_id_conflict',
    });
    await expect(reassignmentCounts()).resolves.toEqual({
      assignments: 1,
      active_assignments: 1,
      receipts: 1,
      audits: 1,
    });
  });

  it('returns disclosure-safe stale, target, authority and canonical-input failures', async () => {
    for (const unavailableResource of [
      command({
        expectedActiveAssignmentId: NfcAssignmentId(
          '40000000-0000-4000-8000-000000000099',
        ),
      }),
      command({
        nfcTagId: NfcTagId('30000000-0000-4000-8000-000000000099'),
      }),
      command({ nfcTagId: NfcTagId(ids.tagUnassignedA) }),
      command({ expectedActiveAssignmentId: NfcAssignmentId(ids.adversarialAssignmentA) }),
    ]) {
      await expect(coordinator.reassignNfcTag(unavailableResource))
        .resolves.toEqual({ status: 'assignment_conflict' });
    }
    for (const unavailableTarget of [
      customerIds.inactiveCustomerA,
      customerIds.customerB,
      CustomerId('20000000-0000-4000-8000-000000000099'),
    ]) {
      await expect(coordinator.reassignNfcTag(command({
        targetCustomerId: unavailableTarget,
      }))).resolves.toEqual({ status: 'assignment_target_unavailable' });
    }
    await expect(coordinator.reassignNfcTag(command({
      accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA,
    }))).resolves.toEqual({ status: 'forbidden' });
    await expect(coordinator.reassignNfcTag(command({
      expectedMembershipId: membershipIds.adminA2,
    }))).resolves.toEqual({ status: 'forbidden' });
    await expect(coordinator.reassignNfcTag(command({
      accessToken: fixtureTokens.rejected,
    }))).resolves.toEqual({ status: 'unauthorized' });
    await expect(coordinator.reassignNfcTag({
      ...command(),
      commandId: 'NOT-CANONICAL',
    })).resolves.toEqual({ status: 'invalid_request' });
  });

  it('blocks cutover while a started TimeEntry references the expected Assignment', async () => {
    await insertStartedTimeEntry(installerPool);
    await expect(coordinator.reassignNfcTag(command()))
      .resolves.toEqual({ status: 'assignment_in_use' });
    const assignment = await installerPool.query<{ active: boolean }>(
      `SELECT active FROM taptime_server.nfc_assignments WHERE id = $1`,
      [ids.assignmentA],
    );
    expect(assignment.rows).toEqual([{ active: true }]);
  });

  it('reuses the same receipt-free intent after B6 stops the active TimeEntry', async () => {
    const startedAt = Date.now() + 1_000;
    await expect(lifecycleCoordinator.ingest(
      lifecycleCommand('3', startedAt),
      membershipIds.employeeA,
    )).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    await expect(coordinator.reassignNfcTag(command()))
      .resolves.toEqual({ status: 'assignment_in_use' });

    await expect(lifecycleCoordinator.ingest(
      lifecycleCommand('4', startedAt + 6_000),
      membershipIds.employeeA,
    )).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_stopped' },
    });
    await expect(coordinator.reassignNfcTag(command())).resolves.toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: true,
    });
  });

  it('lets a B6 Start holding the old Assignment complete before rejecting reassignment as in use',
    async () => {
      const lifecycleLocked = deferred();
      const releaseLifecycle = deferred();
      const lifecycle = lifecycleCoordinator.ingest(
        lifecycleCommand('1'),
        membershipIds.employeeA,
        {
          afterConfigurationLocked: async () => {
            lifecycleLocked.resolve();
            await releaseLifecycle.promise;
          },
        },
      );
      await lifecycleLocked.promise;

      const reassignment = coordinator.reassignNfcTag(command());
      expect(await remainsPending(reassignment)).toBe(true);

      releaseLifecycle.resolve();
      await expect(lifecycle).resolves.toMatchObject({
        status: 'synchronized',
        decision: { status: 'time_entry_started' },
      });
      await expect(reassignment).resolves.toEqual({ status: 'assignment_in_use' });
    });

  it('lets reassignment holding the old Assignment complete before deferring the old B6 snapshot',
    async () => {
      const reassignmentLocked = deferred();
      const releaseReassignment = deferred();
      const reassignment = coordinator.reassignNfcTag(command(), {
        afterAssignmentLocked: async () => {
          reassignmentLocked.resolve();
          await releaseReassignment.promise;
        },
      });
      await reassignmentLocked.promise;

      const oldSnapshot = lifecycleCommand('2');
      const lifecycle = lifecycleCoordinator.ingest(
        oldSnapshot,
        membershipIds.employeeA,
      );
      expect(await remainsPending(lifecycle)).toBe(true);

      releaseReassignment.resolve();
      await expect(reassignment).resolves.toMatchObject({
        status: 'succeeded',
        assignmentChanged: true,
      });
      await expect(lifecycle).resolves.toMatchObject({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: false,
      });
      await expect(lifecycleCoordinator.ingest(
        oldSnapshot,
        membershipIds.employeeA,
      )).resolves.toMatchObject({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: true,
      });
      const oldEvidence = await installerPool.query<{
        target_customer_id: string;
        decisions: number;
        time_entries: number;
      }>(
        `SELECT event.target_customer_id,
           (SELECT count(*)::integer
            FROM taptime_server.canonical_decisions AS decision
            WHERE decision.work_event_id = event.id) AS decisions,
           (SELECT count(*)::integer
            FROM taptime_server.time_entries AS entry
            WHERE entry.start_work_event_id = event.id
               OR entry.stop_work_event_id = event.id) AS time_entries
         FROM taptime_server.work_events AS event
         WHERE event.id = $1`,
        [oldSnapshot.workEvent.id],
      );
      expect(oldEvidence.rows).toEqual([{
        target_customer_id: ids.customerA,
        decisions: 0,
        time_entries: 0,
      }]);
    });

  it.each<ReassignmentWriteStage>([
    'old_assignment_and_audit',
    'new_assignment_and_audit',
    'receipt',
  ])('rolls back every write and audit after injected stage %s', async (stage) => {
    await expect(coordinator.reassignNfcTag(command(), {
      afterWrite(completedStage) {
        if (completedStage === stage) throw new InjectedC3E2Failure(stage);
      },
    })).rejects.toMatchObject({ name: 'InjectedC3E2Failure', stage });
    const counts = await installerPool.query<{ assignments: number; receipts: number; audits: number }>(
      `SELECT
         (SELECT count(*)::integer FROM taptime_server.nfc_assignments) AS assignments,
         (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts) AS receipts,
         (SELECT count(*)::integer FROM taptime_server.audit_events
          WHERE correlation_id = $1) AS audits`,
      [commandIds.primary],
    );
    expect(counts.rows[0]).toEqual({ assignments: 1, receipts: 0, audits: 0 });
  });

  it('serializes concurrent identical commands into one mutation and one receipt replay', async () => {
    const results = await Promise.all([
      coordinator.reassignNfcTag(command()),
      coordinator.reassignNfcTag(command()),
    ]);
    expect(results.map((result) => result.status)).toEqual(['succeeded', 'succeeded']);
    expect(results.map((result) => (
      result.status === 'succeeded' ? result.idempotentRetry : null
    )).sort()).toEqual([false, true]);
    const counts = await installerPool.query<{ assignments: number; receipts: number }>(
      `SELECT
         (SELECT count(*)::integer FROM taptime_server.nfc_assignments) AS assignments,
         (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts) AS receipts`,
    );
    expect(counts.rows[0]).toEqual({ assignments: 2, receipts: 1 });
  });

  it('serializes different commands for one Tag into one success and one stale conflict', async () => {
    const assignmentLocked = deferred();
    const releaseAssignment = deferred();
    const first = coordinator.reassignNfcTag(command(), {
      afterAssignmentLocked: async () => {
        assignmentLocked.resolve();
        await releaseAssignment.promise;
      },
    });
    await assignmentLocked.promise;
    const second = coordinator.reassignNfcTag(command({
      commandId: commandIds.secondary,
    }));
    expect(await remainsPending(second)).toBe(true);

    releaseAssignment.resolve();
    await expect(first).resolves.toMatchObject({
      status: 'succeeded',
      assignmentChanged: true,
    });
    await expect(second).resolves.toEqual({ status: 'assignment_conflict' });
    const counts = await installerPool.query<{ assignments: number; receipts: number; audits: number }>(
      `SELECT
         (SELECT count(*)::integer FROM taptime_server.nfc_assignments) AS assignments,
         (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts) AS receipts,
         (SELECT count(*)::integer FROM taptime_server.audit_events) AS audits`,
    );
    expect(counts.rows[0]).toEqual({ assignments: 2, receipts: 1, audits: 2 });
  });

  it('keeps the command namespace independent across Organizations', async () => {
    await installerPool.query(
      `INSERT INTO taptime_server.customers
         (id, organization_id, display_name, active)
       VALUES ($1, $2, 'Target Customer B', true)`,
      [organizationBResources.targetCustomer, ids.organizationB],
    );
    await installerPool.query(
      `INSERT INTO taptime_server.nfc_tags
         (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, 'Assigned Tag B', 'nfc:uid:v1:BC')`,
      [organizationBResources.tag, ids.organizationB],
    );
    await installerPool.query(
      `INSERT INTO taptime_server.nfc_assignments
         (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
       VALUES ($1, $2, $3, 'customer', $4, true)`,
      [
        organizationBResources.assignment,
        ids.organizationB,
        organizationBResources.tag,
        ids.customerB,
      ],
    );

    await expect(coordinator.reassignNfcTag(command())).resolves.toMatchObject({
      status: 'succeeded',
      assignmentChanged: true,
    });
    await expect(coordinator.reassignNfcTag(command({
      accessToken: fixtureTokens.adminB,
      expectedMembershipId: membershipIds.adminB,
      nfcTagId: NfcTagId(organizationBResources.tag),
      expectedActiveAssignmentId: NfcAssignmentId(organizationBResources.assignment),
      targetCustomerId: CustomerId(organizationBResources.targetCustomer),
    }))).resolves.toMatchObject({
      status: 'succeeded',
      assignmentChanged: true,
    });
    const receipts = await installerPool.query<{ organization_id: string }>(
      `SELECT organization_id
       FROM taptime_server.admin_setup_command_receipts
       WHERE command_id = $1
       ORDER BY organization_id`,
      [commandIds.primary],
    );
    expect(receipts.rows).toEqual([
      { organization_id: ids.organizationA },
      { organization_id: ids.organizationB },
    ]);
  });

  it('rolls back on an expired deadline before commit and safely accepts an exact retry', async () => {
    await expect(coordinator.reassignNfcTag(command(), {
      deadlineEpochMilliseconds: Date.now() + 350,
      afterWrite: async (stage) => {
        if (stage === 'old_assignment_and_audit') {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      },
    })).rejects.toSatisfy((error: unknown) => (
      error instanceof C3E2DeadlineExceededError
      || (error instanceof Error && 'code' in error)
    ));
    await expect(reassignmentCounts()).resolves.toEqual({
      assignments: 1,
      active_assignments: 1,
      receipts: 0,
      audits: 0,
    });
    await expect(coordinator.reassignNfcTag(command())).resolves.toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
    });
  });

  it('rolls back a pre-commit interruption and keeps the same command retry-safe', async () => {
    await expect(coordinator.reassignNfcTag(command(), {
      beforeCommit() {
        throw new Error('synthetic response-path interruption before commit');
      },
    })).rejects.toThrow('synthetic response-path interruption before commit');
    await expect(reassignmentCounts()).resolves.toEqual({
      assignments: 1,
      active_assignments: 1,
      receipts: 0,
      audits: 0,
    });
    await expect(coordinator.reassignNfcTag(command())).resolves.toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
    });
  });

  it('rolls back a terminated runtime connection and recovers the pool without partial state',
    async () => {
      await expect(coordinator.reassignNfcTag(command(), {
        async afterAssignmentLocked() {
          const terminated = await installerPool.query<{ terminated: boolean }>(
            `SELECT pg_catalog.pg_terminate_backend(activity.pid) AS terminated
             FROM pg_catalog.pg_stat_activity AS activity
             WHERE activity.usename = $1
               AND activity.state = 'idle in transaction'
               AND activity.query LIKE '%FROM taptime_server.nfc_tags AS tag%'
             ORDER BY activity.pid
             LIMIT 1`,
            [C3E2_REASSIGNMENT_RUNTIME_LOGIN],
          );
          expect(terminated.rows).toEqual([{ terminated: true }]);
        },
      })).rejects.toBeInstanceOf(Error);
      await expect(reassignmentCounts()).resolves.toEqual({
        assignments: 1,
        active_assignments: 1,
        receipts: 0,
        audits: 0,
      });
      await expect(runtimePool.query('SELECT 1 AS healthy')).resolves.toMatchObject({
        rows: [{ healthy: 1 }],
      });
    });

  it('matches the SQL digest and denies the runtime login raw NFC payload access', async () => {
    const digest = await installerPool.query<{ digest: string }>(
      `SELECT encode(taptime_server.admin_reassign_nfc_tag_digest_v1(
         $1, $2, $3, $4, $5, $6
       ), 'hex') AS digest`,
      [
        ids.organizationA,
        ids.adminA,
        ids.membershipAdminA,
        ids.tagAssignedA,
        ids.assignmentA,
        ids.targetCustomerA,
      ],
    );
    expect(digest.rows[0]?.digest).toBe(reassignNfcTagCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      ids.tagAssignedA,
      ids.assignmentA,
      ids.targetCustomerA,
    ));
    expect(await postgresErrorCode(runtimePool.query(
      'SELECT payload_value FROM taptime_server.nfc_tags',
    ))).toBe('42501');
    const role = await installerPool.query<{
      rolinherit: boolean;
      rolbypassrls: boolean;
      parents: string;
    }>(
      `SELECT role.rolinherit, role.rolbypassrls,
         ARRAY(
           SELECT parent.rolname
           FROM pg_catalog.pg_auth_members AS edge
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
           WHERE edge.member = role.oid
           ORDER BY parent.rolname
         ) AS parents
       FROM pg_catalog.pg_roles AS role
       WHERE role.rolname = $1`,
      [C3E2_REASSIGNMENT_RUNTIME_LOGIN],
    );
    expect(role.rows[0]).toEqual({
      rolinherit: false,
      rolbypassrls: false,
      parents: '{taptime_assignment_reassigner,taptime_identity_resolver}',
    });
    const privileges = await installerPool.query<{
      owner_audit_select: boolean;
      owner_assignment_select: boolean;
      owner_customer_active_update: boolean;
      owner_customer_display_select: boolean;
      owner_customer_display_update: boolean;
      owner_customer_update: boolean;
      owner_payload_select: boolean;
      runtime_customer_update: boolean;
      runtime_membership_select: boolean;
      runtime_payload_select: boolean;
    }>(
      `SELECT
         has_table_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.audit_events',
           'SELECT'
         ) AS owner_audit_select,
         has_table_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.nfc_assignments',
           'SELECT'
         ) AS owner_assignment_select,
         has_column_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.customers',
           'active',
           'UPDATE'
         ) AS owner_customer_active_update,
         has_column_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.customers',
           'display_name',
           'SELECT'
         ) AS owner_customer_display_select,
         has_column_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.customers',
           'display_name',
           'UPDATE'
         ) AS owner_customer_display_update,
         has_table_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.customers',
           'UPDATE'
         ) AS owner_customer_update,
         has_column_privilege(
           'taptime_assignment_reassignment_function_owner',
           'taptime_server.nfc_tags',
           'payload_value',
           'SELECT'
         ) AS owner_payload_select,
         has_table_privilege(
           $1,
           'taptime_server.customers',
           'UPDATE'
         ) AS runtime_customer_update,
         has_table_privilege(
           $1,
           'taptime_server.memberships',
           'SELECT'
         ) AS runtime_membership_select,
         has_column_privilege(
           $1,
           'taptime_server.nfc_tags',
           'payload_value',
           'SELECT'
         ) AS runtime_payload_select`,
      [C3E2_ASSIGNMENT_REASSIGNER_ROLE],
    );
    expect(privileges.rows[0]).toEqual({
      owner_audit_select: false,
      owner_assignment_select: false,
      owner_customer_active_update: true,
      owner_customer_display_select: false,
      owner_customer_display_update: false,
      owner_customer_update: false,
      owner_payload_select: false,
      runtime_customer_update: false,
      runtime_membership_select: false,
      runtime_payload_select: false,
    });
  });
});

function command(
  overrides: Partial<ReassignNfcTagCommand> = {},
): ReassignNfcTagCommand {
  return {
    accessToken: fixtureTokens.adminA,
    expectedMembershipId: membershipIds.adminA,
    commandId: commandIds.primary,
    nfcTagId: NfcTagId(ids.tagAssignedA),
    expectedActiveAssignmentId: NfcAssignmentId(ids.assignmentA),
    targetCustomerId: customerIds.targetCustomerA,
    ...overrides,
  };
}

async function insertStartedTimeEntry(pool: Pool): Promise<void> {
  const eventId = '50000000-0000-4000-8000-000000000001';
  const timeEntryId = '60000000-0000-4000-8000-000000000001';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
    `INSERT INTO taptime_server.work_events (
       id, organization_id, assignment_id, nfc_tag_id, target_type,
       target_customer_id, triggered_by_user_id, occurred_at,
       content_hash, content_hash_algorithm, content_hash_version
     ) VALUES (
       $1, $2, $3, $4, 'customer', $5, $6, '2026-07-18T08:00:00Z',
       $7, 'sha256', 1
     )`,
    [
      eventId,
      ids.organizationA,
      ids.assignmentA,
      ids.tagAssignedA,
      ids.customerA,
      ids.employeeA,
      'a'.repeat(64),
    ],
  );
    await client.query(
    `INSERT INTO taptime_server.time_entries (
       id, organization_id, user_id, target_type, target_customer_id,
       status, start_work_event_id, started_at
     ) VALUES (
       $5,
       $1, $2, 'customer', $3, 'started', $4, '2026-07-18T08:00:00Z'
     )`,
      [ids.organizationA, ids.employeeA, ids.customerA, eventId, timeEntryId],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions (
         work_event_id, organization_id, actor_user_id, target_type,
         target_customer_id, decision_type, time_entry_id,
         engine_version, decision_payload
       ) VALUES (
         $1, $2, $3, 'customer', $4, 'time_entry_started', $5,
         'core-0.1.0', '{"status":"time_entry_started"}'
       )`,
      [eventId, ids.organizationA, ids.employeeA, ids.customerA, timeEntryId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function lifecycleCommand(
  suffix: '1' | '2' | '3' | '4',
  occurredAtEpochMilliseconds = Date.now(),
): LifecycleIngestionCommand {
  return {
    accessToken: fixtureTokens.employeeA,
    requestedOrganizationId: OrganizationId(ids.organizationA),
    workEvent: {
      id: WorkEventId(`50000000-0000-4000-8000-00000000001${suffix}`),
      assignmentId: NfcAssignmentId(ids.assignmentA),
      nfcTagId: NfcTagId(ids.tagAssignedA),
      target: customerAssignmentTarget(customerIds.customerA),
      occurredAt: createTimestamp(new Date(occurredAtEpochMilliseconds).toISOString()),
    },
    receipt: {
      id: `60000000-0000-4000-8000-00000000001${suffix}`,
      attemptNumber: 1,
    },
  };
}

async function reassignmentCounts(): Promise<{
  readonly assignments: number;
  readonly active_assignments: number;
  readonly receipts: number;
  readonly audits: number;
}> {
  const result = await installerPool.query<{
    assignments: number;
    active_assignments: number;
    receipts: number;
    audits: number;
  }>(
    `SELECT
       (SELECT count(*)::integer FROM taptime_server.nfc_assignments) AS assignments,
       (SELECT count(*)::integer FROM taptime_server.nfc_assignments
        WHERE active) AS active_assignments,
       (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts) AS receipts,
       (SELECT count(*)::integer FROM taptime_server.audit_events) AS audits`,
  );
  return result.rows[0]!;
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function remainsPending(operation: Promise<unknown>): Promise<boolean> {
  return Promise.race([
    operation.then(() => false, () => false),
    new Promise<true>((resolve) => setTimeout(() => resolve(true), 75)),
  ]);
}

function runtimeConnectionString(
  baseConnectionString: string,
  login: string,
  password: string,
): string {
  const url = new URL(baseConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('C3E2 B6 race tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = login;
  url.password = password;
  return url.toString();
}

async function ensureLifecycleRuntimeLogin(pool: Pool, password: string): Promise<void> {
  const escapedPassword = password.replaceAll("'", "''");
  await pool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${lifecycleRuntimeLogin}'
      ) THEN
        CREATE ROLE ${lifecycleRuntimeLogin}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${lifecycleRuntimeLogin} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${escapedPassword}';
    REVOKE taptime_employee, taptime_administrator, taptime_server_lifecycle,
      taptime_identity_resolver FROM ${lifecycleRuntimeLogin};
    GRANT taptime_identity_resolver, taptime_server_lifecycle TO ${lifecycleRuntimeLogin};
  `);
}

async function removeLifecycleRuntimeLogin(pool: Pool): Promise<void> {
  await pool.query(`
    REVOKE taptime_identity_resolver, taptime_server_lifecycle
      FROM ${lifecycleRuntimeLogin};
    DROP ROLE IF EXISTS ${lifecycleRuntimeLogin};
  `);
}
