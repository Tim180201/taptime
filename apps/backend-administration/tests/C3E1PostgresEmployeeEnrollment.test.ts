import { createHash, randomUUID } from 'node:crypto';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  applyMigrationSet,
  loadMigrations,
  migrate,
} from '@taptime/backend-schema';
import {
  PostgresIdentityMembershipResolver,
  RequestActorResolutionService,
} from '@taptime/backend-identity';
import { MembershipId, OrganizationId } from '@taptime/core';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeMembershipEnrollmentCoordinator } from '../src/index.js';
import {
  C3E1_ENROLLMENT_RUNTIME_LOGIN,
  C3E1_INVITATION_RUNTIME_LOGIN,
  c3e1RuntimeConnectionString,
  ensureC3E1RuntimeLogins,
  fixtureAccessTokenVerifier,
  fixtureTokens,
  ids,
  membershipIds,
  postgresErrorCode,
  removeC3E1RuntimeLogins,
  seedC3C,
  syntheticPassword,
  truncateC3C,
} from './fixtures.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';

const installerDatabaseUrl = process.env.C3C_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c';
const invitationPassword = syntheticPassword();
const enrollmentPassword = syntheticPassword();
const invitationDomain = Buffer.from('taptime:c3e1:employee-invitation:v1\0', 'utf8');
const bootstrapOperator = 'taptime_bootstrap_operator_c3e1c3b000001';
const bootstrapPassword = syntheticPassword();
const membershipInsertPauseLock = 8_031_500_001n;

let installerPool: Pool;
let invitationPool: Pool;
let enrollmentPool: Pool;
let bootstrapPool: Pool;
let coordinator: EmployeeMembershipEnrollmentCoordinator;

beforeAll(async () => {
  installerPool = new Pool({ connectionString: installerDatabaseUrl, max: 6 });
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await expect(migrate(installerPool)).resolves.toEqual({
    applied: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021'],
    alreadyApplied: [],
  });
  await ensureC3E1RuntimeLogins(installerPool, invitationPassword, enrollmentPassword);
  await ensureBootstrapOperator();
  invitationPool = new Pool({
    connectionString: c3e1RuntimeConnectionString(
      installerDatabaseUrl,
      C3E1_INVITATION_RUNTIME_LOGIN,
      invitationPassword,
    ),
    max: 6,
    application_name: 'taptime-c3e1-invitation-test',
  });
  enrollmentPool = new Pool({
    connectionString: c3e1RuntimeConnectionString(
      installerDatabaseUrl,
      C3E1_ENROLLMENT_RUNTIME_LOGIN,
      enrollmentPassword,
    ),
    max: 6,
    application_name: 'taptime-c3e1-enrollment-test',
  });
  bootstrapPool = new Pool({
    connectionString: connectionStringFor(bootstrapOperator, bootstrapPassword),
    max: 4,
    application_name: 'taptime-c3b-c3e1-concurrency-test',
  });
  coordinator = new EmployeeMembershipEnrollmentCoordinator(
    invitationPool,
    enrollmentPool,
    fixtureAccessTokenVerifier,
  );
  await Promise.all([
    invitationPool.query('SELECT 1'),
    enrollmentPool.query('SELECT 1'),
    bootstrapPool.query('SELECT 1'),
  ]);
}, 30_000);

beforeEach(async () => {
  await removeC3E1FailureTrigger();
  await truncateC3C(installerPool);
  await seedC3C(installerPool);
});

afterAll(async () => {
  await removeC3E1FailureTrigger();
  await Promise.all([invitationPool?.end(), enrollmentPool?.end(), bootstrapPool?.end()]);
  if (installerPool !== undefined) {
    await removeBootstrapOperator();
    await removeC3E1RuntimeLogins(installerPool);
    await installerPool.end();
  }
});

describe('migration 008 Employee invitation and enrollment boundary', () => {
  it('records migration 008 and keeps creator and redeemer capabilities separated', async () => {
    expect((await loadMigrations()).map(({ version }) => version)).toEqual([
      '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021',
    ]);
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [],
      alreadyApplied: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021'],
    });
    expect(await postgresErrorCode(
      invitationPool.query('SET ROLE taptime_employee_enrollment_redeemer'),
    )).toBe('42501');
    expect(await postgresErrorCode(
      enrollmentPool.query('SET ROLE taptime_employee_invitation_creator'),
    )).toBe('42501');
    expect(await postgresErrorCode(
      invitationPool.query('SELECT * FROM taptime_server.employee_membership_invitations'),
    )).toBe('42501');
    expect(await postgresErrorCode(
      enrollmentPool.query('SELECT * FROM taptime_server.memberships'),
    )).toBe('42501');

    const effectiveTablePrivileges = await installerPool.query<{
      role_name: string; relation_name: string; privilege: string;
    }>(`
      SELECT role_name, relation.relname AS relation_name, privilege
      FROM (VALUES
        ('taptime_employee_invitation_creator'),
        ('taptime_employee_enrollment_redeemer')
      ) AS roles(role_name)
      CROSS JOIN pg_catalog.pg_class AS relation
      INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      CROSS JOIN unnest(ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ]) AS privilege
      WHERE namespace.nspname = 'taptime_server'
        AND relation.relkind IN ('r', 'p', 'v', 'm', 'S')
        AND pg_catalog.has_table_privilege(role_name, relation.oid, privilege)
      ORDER BY role_name, relation_name, privilege
    `);
    expect(effectiveTablePrivileges.rows).toEqual([]);

    const effectiveFunctionPrivileges = await installerPool.query<{
      role_name: string; function_name: string;
    }>(`
      SELECT role_name, capability.oid::regprocedure::text AS function_name
      FROM (VALUES
        ('taptime_employee_invitation_creator'),
        ('taptime_employee_enrollment_redeemer')
      ) AS roles(role_name)
      CROSS JOIN pg_catalog.pg_proc AS capability
      INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = capability.pronamespace
      WHERE namespace.nspname = 'taptime_server'
        AND pg_catalog.has_function_privilege(role_name, capability.oid, 'EXECUTE')
      ORDER BY role_name, function_name
    `);
    expect(effectiveFunctionPrivileges.rows).toEqual([
      {
        role_name: 'taptime_employee_enrollment_redeemer',
        function_name: 'taptime_server.redeem_employee_membership_invitation_v1(uuid,bytea,text,text,uuid,uuid,uuid)',
      },
      {
        role_name: 'taptime_employee_invitation_creator',
        function_name: 'taptime_server.create_employee_membership_invitation_v1(uuid,uuid,text,bytea)',
      },
      {
        role_name: 'taptime_employee_invitation_creator',
        function_name: 'taptime_server.read_employee_memberships_projection_v1(uuid,integer)',
      },
    ]);
  });

  it('creates a canonical one-time secret while storing only its digest and safe audit metadata', async () => {
    const commandId = randomUUID();
    const result = await createInvitation(commandId, 'Employee Alpha');
    expect(result).toMatchObject({
      status: 'succeeded',
      invitationSecret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    if (result.status !== 'succeeded') throw new Error('Expected invitation success');

    const stored = await installerPool.query<{
      token_digest: string;
      display_name: string;
      audit_count: number;
      audit_json: string;
    }>(`
      SELECT
        pg_catalog.encode(invitation.token_digest, 'hex') AS token_digest,
        invitation.display_name,
        (SELECT count(*)::integer FROM taptime_server.audit_events
         WHERE event_type = 'MembershipInvitationCreated'
           AND correlation_id = $1) AS audit_count,
        (SELECT row_to_json(audit)::text FROM taptime_server.audit_events AS audit
         WHERE event_type = 'MembershipInvitationCreated'
           AND correlation_id = $1) AS audit_json
      FROM taptime_server.employee_membership_invitations AS invitation
    `, [commandId]);
    const expectedDigest = createHash('sha256')
      .update(invitationDomain)
      .update(Buffer.from(result.invitationSecret, 'base64url'))
      .digest('hex');
    expect(stored.rows[0]).toMatchObject({
      token_digest: expectedDigest,
      display_name: 'Employee Alpha',
      audit_count: 1,
    });
    expect(stored.rows[0]!.audit_json).not.toContain(result.invitationSecret);
  });

  it('captures transaction-timeout client errors, destroys the connection, and rolls back', async () => {
    const timeoutPool = new Pool({
      connectionString: c3e1RuntimeConnectionString(
        installerDatabaseUrl,
        C3E1_INVITATION_RUNTIME_LOGIN,
        invitationPassword,
      ),
      max: 1,
      application_name: 'taptime-c3e1-transaction-timeout-test',
    });
    const timeoutCoordinator = new EmployeeMembershipEnrollmentCoordinator(
      timeoutPool,
      enrollmentPool,
      fixtureAccessTokenVerifier,
    );
    try {
      await timeoutPool.query('SELECT 1');
      await expect(timeoutCoordinator.createInvitation({
        accessToken: fixtureTokens.adminA,
        expectedMembershipId: membershipIds.adminA,
        commandId: randomUUID(),
        displayName: 'Employee Timeout',
        role: 'employee',
      }, {
        deadlineEpochMilliseconds: Date.now() + 400,
        beforeCommit: async () => new Promise((resolve) => setTimeout(resolve, 650)),
      })).rejects.toBeInstanceOf(Error);

      await vi.waitFor(() => expect(timeoutPool.totalCount).toBe(0));
      const state = await installerPool.query<{ invitations: number; receipts: number; audits: number }>(`
        SELECT
          (SELECT count(*)::integer FROM taptime_server.employee_membership_invitations
           WHERE display_name = 'Employee Timeout') AS invitations,
          (SELECT count(*)::integer FROM taptime_server.employee_invitation_command_receipts) AS receipts,
          (SELECT count(*)::integer FROM taptime_server.audit_events
           WHERE event_type = 'MembershipInvitationCreated') AS audits
      `);
      expect(state.rows[0]).toEqual({ invitations: 0, receipts: 0, audits: 0 });
      await expect(timeoutPool.query('SELECT 1 AS healthy')).resolves.toMatchObject({
        rows: [{ healthy: 1 }],
      });
    } finally {
      await timeoutPool.end();
    }
  });

  it('pins the 15-minute lifetime and canonicalizes the Membership display-name Unicode vector', async () => {
    const result = await createInvitation(randomUUID(), '  Cafe\u0301 Employee  ');
    expect(result.status).toBe('succeeded');
    const stored = await installerPool.query<{
      display_name: string;
      lifetime_seconds: string;
    }>(`
      SELECT display_name,
        pg_catalog.date_part('epoch', expires_at - created_at)::text AS lifetime_seconds
      FROM taptime_server.employee_membership_invitations
    `);
    expect(stored.rows).toEqual([{
      display_name: 'Café Employee',
      lifetime_seconds: '900',
    }]);
  });

  it('never re-discloses a secret on exact create replay and conflicts on changed input', async () => {
    const commandId = randomUUID();
    expect((await createInvitation(commandId, 'Employee Alpha')).status).toBe('succeeded');
    await expect(createInvitation(commandId, 'Employee Alpha')).resolves.toEqual({
      status: 'invitation_created_token_unavailable',
    });
    await expect(createInvitation(commandId, 'Employee Beta')).resolves.toEqual({
      status: 'command_id_conflict',
    });
    const count = await installerPool.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM taptime_server.employee_membership_invitations',
    );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('enforces the five-active-invitation cap while preserving exact replay', async () => {
    const firstCommand = randomUUID();
    expect((await createInvitation(firstCommand, 'Employee 1')).status).toBe('succeeded');
    for (let index = 2; index <= 5; index += 1) {
      expect((await createInvitation(randomUUID(), `Employee ${index}`)).status).toBe('succeeded');
    }
    await expect(createInvitation(firstCommand, 'Employee 1')).resolves.toEqual({
      status: 'invitation_created_token_unavailable',
    });
    await expect(createInvitation(randomUUID(), 'Employee 6')).resolves.toEqual({
      status: 'invitation_limit_reached',
    });
    const fixtureClient = await installerPool.connect();
    try {
      await fixtureClient.query("SET session_replication_role = 'replica'");
      await fixtureClient.query(`
        UPDATE taptime_server.employee_membership_invitations
        SET created_at = transaction_timestamp() - interval '16 minutes',
            expires_at = transaction_timestamp() - interval '1 minute'
        WHERE id = (
          SELECT id FROM taptime_server.employee_membership_invitations ORDER BY id LIMIT 1
        )
      `);
    } finally {
      await fixtureClient.query("SET session_replication_role = 'origin'");
      fixtureClient.release();
    }
    expect((await createInvitation(randomUUID(), 'Employee 6')).status).toBe('succeeded');
  });

  it('atomically creates User, Binding, Employee Membership, consumption, receipt and audits', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const redemptionCommandId = randomUUID();
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: redemptionCommandId,
      invitationSecret: invitation.invitationSecret,
    })).resolves.toEqual({
      status: 'succeeded',
      organizationName: 'Synthetic Organization A',
      membershipDisplayName: 'Employee Alpha',
      role: 'employee',
    });

    const state = await installerPool.query<{
      users: number;
      bindings: number;
      memberships: number;
      receipts: number;
      consumed: number;
      grant_audits: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.users) AS users,
        (SELECT count(*)::integer FROM taptime_server.identity_bindings
         WHERE issuer = $1 AND subject = 'prospective-a') AS bindings,
        (SELECT count(*)::integer FROM taptime_server.memberships
         WHERE role = 'employee' AND display_name = 'Employee Alpha' AND revoked_at IS NULL) AS memberships,
        (SELECT count(*)::integer FROM taptime_server.employee_enrollment_redemption_receipts
         WHERE command_id = $2) AS receipts,
        (SELECT count(*)::integer FROM taptime_server.employee_membership_invitations
         WHERE consumed_at IS NOT NULL AND redemption_command_id = $2) AS consumed,
        (SELECT count(*)::integer FROM taptime_server.audit_events
         WHERE event_type = 'MembershipGranted' AND correlation_id = $2::text
           AND actor_user_id = $3) AS grant_audits
    `, ['https://synthetic.invalid/auth', redemptionCommandId, ids.adminA]);
    expect(state.rows[0]).toEqual({
      users: 6,
      bindings: 1,
      memberships: 1,
      receipts: 1,
      consumed: 1,
      grant_audits: 1,
    });
  });

  it('allows exact redemption replay but rejects reuse by another verified identity without disclosure', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const commandId = randomUUID();
    const command = {
      accessToken: fixtureTokens.prospectiveA,
      commandId,
      invitationSecret: invitation.invitationSecret,
    } as const;
    expect((await coordinator.redeemInvitation(command)).status).toBe('succeeded');
    expect((await coordinator.redeemInvitation(command)).status).toBe('succeeded');
    await expect(coordinator.redeemInvitation({
      ...command,
      accessToken: fixtureTokens.prospectiveB,
    })).resolves.toEqual({ status: 'enrollment_unavailable' });
    const count = await installerPool.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM taptime_server.audit_events WHERE event_type = 'MembershipGranted'`,
    );
    expect(count.rows[0]!.count).toBe(1);
  });

  it('projects all managed Membership roles with bounded canonical pagination', async () => {
    for (const name of ['Employee Alpha', 'Employee Beta']) {
      const invitation = await createInvitation(randomUUID(), name);
      if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
      const token = name.endsWith('Alpha') ? fixtureTokens.prospectiveA : fixtureTokens.prospectiveB;
      expect((await coordinator.redeemInvitation({
        accessToken: token,
        commandId: randomUUID(),
        invitationSecret: invitation.invitationSecret,
      })).status).toBe('succeeded');
    }
    const memberships = [];
    const cursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const page = await coordinator.readEmployeeMembershipsProjection({
        accessToken: fixtureTokens.adminA,
        expectedMembershipId: membershipIds.adminA,
        cursor,
        limit: 1,
      });
      expect(page).toMatchObject({
        status: 'succeeded',
        organization: { id: ids.organizationA, name: 'Synthetic Organization A' },
      });
      if (page.status !== 'succeeded') throw new Error('Expected projection success');
      expect(page.employeeMemberships).toHaveLength(1);
      memberships.push(page.employeeMemberships[0]!);
      if (page.nextCursor !== null) {
        expect(page.nextCursor).toMatch(/^v1:m:[0-9a-f-]{36}$/);
        expect(cursors.has(page.nextCursor)).toBe(false);
        cursors.add(page.nextCursor);
      }
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(memberships).toHaveLength(5);
    expect(memberships.map(({ id }) => id)).toEqual(
      [...memberships.map(({ id }) => id)].sort(),
    );
    expect(memberships.map(({ role }) => role).sort()).toEqual([
      'administrator', 'administrator', 'employee', 'employee', 'employee',
    ]);
    expect(memberships.map(({ displayName, role, active, rowVersion }) => ({
      displayName, role, active, rowVersion,
    }))).toEqual(expect.arrayContaining([
      { displayName: 'Administrator', role: 'administrator', active: true, rowVersion: 1 },
      { displayName: 'Beschäftigter', role: 'employee', active: true, rowVersion: 1 },
      { displayName: 'Employee Alpha', role: 'employee', active: true, rowVersion: 1 },
      { displayName: 'Employee Beta', role: 'employee', active: true, rowVersion: 1 },
    ]));
  });

  it('hides prepared Locations while off, then projects and filters them through v2', async () => {
    const locationA = '91000000-0000-4000-8000-000000000301';
    const locationB = '91000000-0000-4000-8000-000000000302';
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.locations (id, organization_id, display_name)
       VALUES ($1, $3, 'Berlin'), ($2, $4, 'Hamburg')`,
      [locationA, locationB, ids.organizationA, ids.organizationB],
    );
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_home_location_assignments
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membershipIds.employeeA, locationA],
    );
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_home_location_assignments
         (id, organization_id, membership_id, location_id)
       SELECT gen_random_uuid(), membership.organization_id, membership.id, $3
       FROM ${B3_SCHEMA}.memberships AS membership
       WHERE membership.organization_id = $1
         AND membership.id <> $2
         AND membership.revoked_at IS NULL`,
      [ids.organizationA, membershipIds.employeeA, locationA],
    );
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.work_target_location_assignments
         (id, organization_id, target_type, target_id, location_id)
       SELECT gen_random_uuid(), target.organization_id, target.target_type, target.target_id, $2
       FROM ${B3_SCHEMA}.work_targets AS target
       WHERE target.organization_id = $1 AND target.active`,
      [ids.organizationA, locationA],
    );

    const currentProjection = await coordinator.readEmployeeMembershipsProjection({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      cursor: null,
      limit: 20,
    });
    expect(currentProjection.status).toBe('succeeded');
    if (currentProjection.status !== 'succeeded') throw new Error('Current projection failed');

    const featureOffProjection = await coordinator.readEmployeeMembershipsProjectionV2({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      cursor: null,
      limit: 20,
      locationId: null,
    });
    expect(featureOffProjection.status).toBe('succeeded');
    if (featureOffProjection.status !== 'succeeded') throw new Error('Projection failed');
    expect(featureOffProjection.employeeMemberships.map(({ id }) => id)).toEqual(
      currentProjection.employeeMemberships.map(({ id }) => id),
    );
    expect(featureOffProjection.employeeMemberships.every(
      (projectedMembership) => projectedMembership.location === null,
    )).toBe(true);

    await expect(coordinator.readEmployeeMembershipsProjectionV2({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      cursor: null,
      limit: 20,
      locationId: locationA,
    })).resolves.toEqual({ status: 'location_scope_forbidden' });

    await enableLocationsForOrganizationA();

    const locatedProjection = await coordinator.readEmployeeMembershipsProjectionV2({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      cursor: null,
      limit: 20,
      locationId: locationA,
    });
    expect(locatedProjection.status).toBe('succeeded');
    if (locatedProjection.status !== 'succeeded') throw new Error('Located projection failed');
    expect(locatedProjection.employeeMemberships.map(({ id }) => id)).toEqual(
      currentProjection.employeeMemberships.map(({ id }) => id),
    );
    expect(locatedProjection.employeeMemberships.every(({ location }) => (
      location?.id === locationA && location.name === 'Berlin'
    ))).toBe(true);

    await expect(coordinator.readEmployeeMembershipsProjectionV2({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      cursor: null,
      limit: 20,
      locationId: locationB,
    })).resolves.toEqual({ status: 'location_scope_forbidden' });
  });

  it('invites a second Administrator who resolves the same management capability', async () => {
    const invitationCommandId = randomUUID();
    const invitation = await coordinator.createInvitation({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: invitationCommandId,
      displayName: 'Administrator Neu',
      role: 'administrator',
    });
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const redemptionCommandId = randomUUID();
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: redemptionCommandId,
      invitationSecret: invitation.invitationSecret,
    })).resolves.toMatchObject({ status: 'succeeded', role: 'administrator' });
    const membership = await installerPool.query<{ id: string }>(
      `SELECT id FROM taptime_server.memberships
       WHERE organization_id = $1 AND display_name = 'Administrator Neu'`,
      [ids.organizationA],
    );
    const newMembershipId = MembershipId(membership.rows[0]!.id);
    await expect(coordinator.readEmployeeMembershipsProjection({
      accessToken: fixtureTokens.prospectiveA,
      expectedMembershipId: newMembershipId,
      cursor: null,
      limit: 20,
    })).resolves.toMatchObject({
      status: 'succeeded',
      organization: { id: ids.organizationA },
    });
    await expect(coordinator.createInvitation({
      accessToken: fixtureTokens.prospectiveA,
      expectedMembershipId: newMembershipId,
      commandId: randomUUID(),
      displayName: 'Vom zweiten Administrator',
      role: 'employee',
    })).resolves.toMatchObject({ status: 'succeeded' });
    await expect(coordinator.changeMembershipRole({
      accessToken: fixtureTokens.prospectiveA,
      expectedMembershipId: newMembershipId,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
      role: 'administrator',
    })).resolves.toMatchObject({ status: 'succeeded', membership: { role: 'administrator' } });
    await expect(coordinator.revokeMembership({
      accessToken: fixtureTokens.prospectiveA,
      expectedMembershipId: newMembershipId,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 2,
    })).resolves.toMatchObject({ status: 'succeeded', membership: { active: false } });
    const audits = await installerPool.query<{ event_type: string; actor_user_id: string }>(
      `SELECT event_type, actor_user_id::text
       FROM taptime_server.audit_events
       WHERE correlation_id IN ($1, $2)
       ORDER BY occurred_at, event_type`,
      [invitationCommandId, redemptionCommandId],
    );
    expect(audits.rows).toEqual([
      { event_type: 'MembershipInvitationCreated', actor_user_id: ids.adminA },
      { event_type: 'MembershipGranted', actor_user_id: ids.adminA },
    ]);
  });

  it('carries a Standortleitung through invitation, redemption, scoped read and revocation', async () => {
    const locationId = '21000000-0000-4000-8000-000000000001';
    await expect(coordinator.changeMembershipRole({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
      role: 'standortleitung',
    })).resolves.toMatchObject({
      status: 'succeeded',
      membership: { role: 'standortleitung' },
    });
    await prepareLocationManagerModel(locationId);

    const invitation = await coordinator.createInvitation({
      accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA,
      commandId: randomUUID(),
      displayName: 'Vom Standort eingeladen',
      role: 'employee',
      locationId,
    });
    expect(invitation.status).toBe('succeeded');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');

    await expect(coordinator.readEmployeeMembershipsProjection({
      accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA,
      cursor: null,
      limit: 20,
    })).resolves.toMatchObject({
      status: 'succeeded',
      employeeMemberships: expect.arrayContaining([
        expect.objectContaining({ id: membershipIds.employeeA, role: 'standortleitung' }),
      ]),
    });

    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    })).resolves.toMatchObject({ status: 'succeeded', role: 'employee' });
    const enrolled = await installerPool.query<{ id: string; row_version: string; location_id: string }>(
      `SELECT membership.id, membership.row_version, home.location_id
       FROM taptime_server.memberships AS membership
       JOIN taptime_server.membership_home_location_assignments AS home
         ON home.organization_id = membership.organization_id
        AND home.membership_id = membership.id
        AND home.revoked_at IS NULL
       WHERE membership.organization_id = $1
         AND membership.display_name = 'Vom Standort eingeladen'`,
      [ids.organizationA],
    );
    expect(enrolled.rows).toHaveLength(1);
    expect(enrolled.rows[0]!.location_id).toBe(locationId);

    await expect(coordinator.revokeMembership({
      accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA,
      commandId: randomUUID(),
      targetMembershipId: MembershipId(enrolled.rows[0]!.id),
      expectedRowVersion: Number(enrolled.rows[0]!.row_version),
    })).resolves.toMatchObject({
      status: 'succeeded',
      membership: { active: false, role: 'employee' },
    });
  });

  it('promotes an existing Membership and records the actor and target in the audit trail', async () => {
    const commandId = randomUUID();
    await expect(coordinator.changeMembershipRole({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId,
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
      role: 'administrator',
    })).resolves.toEqual({
      status: 'succeeded',
      membership: {
        id: membershipIds.employeeA,
        role: 'administrator',
        active: true,
        rowVersion: 2,
      },
      idempotentRetry: false,
    });
    const audit = await installerPool.query<{
      event_type: string; actor_user_id: string; entity_id: string;
    }>(
      `SELECT event_type, actor_user_id::text, entity_id::text
       FROM taptime_server.audit_events WHERE correlation_id = $1`,
      [commandId],
    );
    expect(audit.rows).toEqual([{
      event_type: 'MembershipRoleChanged',
      actor_user_id: ids.adminA,
      entity_id: ids.membershipEmployeeA,
    }]);
  });

  it('revokes access before the next request despite the still-valid provider token', async () => {
    const resolver = new RequestActorResolutionService(
      fixtureAccessTokenVerifier,
      new PostgresIdentityMembershipResolver(invitationPool),
    );
    await expect(resolver.resolve({
      accessToken: fixtureTokens.employeeA,
      requestedOrganizationId: OrganizationId(ids.organizationA),
    })).resolves.toMatchObject({ status: 'accepted' });
    const commandId = randomUUID();
    await expect(coordinator.revokeMembership({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId,
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
    })).resolves.toMatchObject({
      status: 'succeeded',
      membership: { active: false, rowVersion: 2 },
    });
    await expect(resolver.resolve({
      accessToken: fixtureTokens.employeeA,
      requestedOrganizationId: OrganizationId(ids.organizationA),
    })).resolves.toEqual({
      status: 'rejected',
      reason: 'identity_or_membership_unavailable',
    });
    const audit = await installerPool.query<{ count: number }>(
      `SELECT count(*)::integer AS count FROM taptime_server.audit_events
       WHERE correlation_id = $1 AND event_type = 'MembershipRevoked'
         AND actor_user_id = $2 AND entity_id = $3`,
      [commandId, ids.adminA, ids.membershipEmployeeA],
    );
    expect(audit.rows[0]!.count).toBe(1);
  });

  it('audits a completed password reset for an active Employee and rejects it after revocation', async () => {
    await expect(coordinator.recordPasswordReset({
      accessToken: fixtureTokens.employeeA,
    })).resolves.toEqual({ status: 'succeeded' });
    const audit = await installerPool.query<{
      actor_user_id: string; entity_id: string; membership_id: string;
    }>(`
      SELECT actor_user_id::text, entity_id::text,
             payload->>'membershipId' AS membership_id
      FROM taptime_server.audit_events
      WHERE event_type = 'PasswordResetCompleted'
    `);
    expect(audit.rows).toEqual([{
      actor_user_id: ids.employeeA,
      entity_id: ids.employeeA,
      membership_id: ids.membershipEmployeeA,
    }]);
    await expect(coordinator.revokeMembership({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
    })).resolves.toMatchObject({ status: 'succeeded' });
    await expect(coordinator.recordPasswordReset({
      accessToken: fixtureTokens.employeeA,
    })).resolves.toEqual({ status: 'forbidden' });
  });

  it('rejects self-revocation and removal of the final Administrator', async () => {
    await expect(coordinator.changeMembershipRole({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
      role: 'employee',
    })).resolves.toEqual({ status: 'invalid_request' });
    await expect(coordinator.revokeMembership({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.adminA,
      expectedRowVersion: 1,
    })).resolves.toEqual({ status: 'self_revocation_forbidden' });
    expect((await coordinator.changeMembershipRole({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.adminA2,
      expectedRowVersion: 1,
      role: 'employee',
    })).status).toBe('succeeded');
    await expect(coordinator.changeMembershipRole({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.adminA,
      expectedRowVersion: 1,
      role: 'employee',
    })).resolves.toEqual({ status: 'last_administrator' });
  });

  it('keeps a foreign Organization invisible and unmodifiable', async () => {
    await expect(coordinator.readEmployeeMembershipsProjection({
      accessToken: fixtureTokens.adminB,
      expectedMembershipId: membershipIds.adminB,
      cursor: null,
      limit: 20,
    })).resolves.toMatchObject({
      status: 'succeeded',
      organization: { id: ids.organizationB },
      employeeMemberships: [{ id: membershipIds.adminB }],
    });
    await expect(coordinator.revokeMembership({
      accessToken: fixtureTokens.adminB,
      expectedMembershipId: membershipIds.adminB,
      commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA,
      expectedRowVersion: 1,
    })).resolves.toEqual({ status: 'target_unavailable' });
    const target = await installerPool.query<{ revoked_at: Date | null; row_version: string }>(
      'SELECT revoked_at, row_version FROM taptime_server.memberships WHERE id = $1',
      [ids.membershipEmployeeA],
    );
    expect(target.rows[0]).toEqual({ revoked_at: null, row_version: '1' });
  });

  it('rejects malformed requests before authority and canonical unavailable secrets after verification', async () => {
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: 'not-a-secret',
    })).resolves.toEqual({ status: 'invalid_request' });
    const unknownSecret = Buffer.alloc(32, 7).toString('base64url');
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.rejected,
      commandId: randomUUID(),
      invitationSecret: unknownSecret,
    })).resolves.toEqual({ status: 'unauthorized' });
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: unknownSecret,
    })).resolves.toEqual({ status: 'enrollment_unavailable' });
  });

  it('rejects an Employee caller and an expected-Membership mismatch before invitation visibility', async () => {
    await expect(coordinator.createInvitation({
      accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA,
      commandId: randomUUID(),
      displayName: 'Employee Alpha',
      role: 'employee',
    })).resolves.toEqual({ status: 'forbidden' });
    await expect(coordinator.createInvitation({
      accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA2,
      commandId: randomUUID(),
      displayName: 'Employee Alpha',
      role: 'employee',
    })).resolves.toEqual({ status: 'forbidden' });
    const rows = await installerPool.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM taptime_server.employee_membership_invitations',
    );
    expect(rows.rows[0]!.count).toBe(0);
  });

  it('fails first redemption after creator revocation with zero partial identity or Membership write', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    await installerPool.query(
      `UPDATE taptime_server.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.membershipAdminA],
    );
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    })).resolves.toEqual({ status: 'enrollment_unavailable' });
    const state = await installerPool.query<{
      binding: number; membership: number; consumed: number; receipts: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.identity_bindings WHERE subject = 'prospective-a') AS binding,
        (SELECT count(*)::integer FROM taptime_server.memberships WHERE display_name = 'Employee Alpha') AS membership,
        (SELECT count(*)::integer FROM taptime_server.employee_membership_invitations WHERE consumed_at IS NOT NULL) AS consumed,
        (SELECT count(*)::integer FROM taptime_server.employee_enrollment_redemption_receipts) AS receipts
    `);
    expect(state.rows[0]).toEqual({ binding: 0, membership: 0, consumed: 0, receipts: 0 });
  });

  it('preserves a committed Employee and exact replay after later creator revocation', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const command = {
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    } as const;
    expect((await coordinator.redeemInvitation(command)).status).toBe('succeeded');
    await installerPool.query(
      `UPDATE taptime_server.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.membershipAdminA],
    );
    expect((await coordinator.redeemInvitation(command)).status).toBe('succeeded');
    const state = await installerPool.query<{ membership: number; audits: number }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.memberships
         WHERE display_name = 'Employee Alpha' AND revoked_at IS NULL) AS membership,
        (SELECT count(*)::integer FROM taptime_server.audit_events
         WHERE event_type = 'MembershipGranted') AS audits
    `);
    expect(state.rows[0]).toEqual({ membership: 1, audits: 1 });
  });

  it('rejects an identity with any historical Membership, including another Organization', async () => {
    await installerPool.query(
      `INSERT INTO taptime_server.memberships
        (id, organization_id, user_id, role, created_by_user_id, revoked_at, row_version)
       VALUES ($1, $2, $3, 'employee', $4, transaction_timestamp(), 2)`,
      [randomUUID(), ids.organizationB, ids.orphan, ids.adminB],
    );
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.orphan,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    })).resolves.toEqual({ status: 'enrollment_unavailable' });
    const invitationState = await installerPool.query<{ consumed_at: Date | null }>(
      'SELECT consumed_at FROM taptime_server.employee_membership_invitations',
    );
    expect(invitationState.rows[0]!.consumed_at).toBeNull();
  });

  it('serializes two invitations redeemed concurrently by one provider identity', async () => {
    const invitations = await Promise.all([
      createInvitation(randomUUID(), 'Employee Alpha'),
      createInvitation(randomUUID(), 'Employee Beta'),
    ]);
    if (invitations.some((invitation) => invitation.status !== 'succeeded')) {
      throw new Error('Expected invitation success');
    }
    const results = await Promise.all(invitations.map((invitation) => coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: invitation.status === 'succeeded' ? invitation.invitationSecret : '',
    })));
    expect(results.map(({ status }) => status).sort()).toEqual([
      'enrollment_unavailable', 'succeeded',
    ]);
    const state = await installerPool.query<{ memberships: number; consumed: number; audits: number }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.memberships WHERE display_name IS NOT NULL) AS memberships,
        (SELECT count(*)::integer FROM taptime_server.employee_membership_invitations WHERE consumed_at IS NOT NULL) AS consumed,
        (SELECT count(*)::integer FROM taptime_server.audit_events WHERE event_type = 'MembershipGranted') AS audits
    `);
    expect(state.rows[0]).toEqual({ memberships: 1, consumed: 1, audits: 1 });
  });

  it('serializes C3B bootstrap and C3E1 redemption on the shared issuer/subject and User locks', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Or Bootstrap Admin');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const [redemption, bootstrap] = await Promise.all([
      coordinator.redeemInvitation({
        accessToken: fixtureTokens.orphan,
        commandId: randomUUID(),
        invitationSecret: invitation.invitationSecret,
      }),
      bootstrapIdentity(randomUUID(), 'Concurrent Bootstrap', 'orphan'),
    ]);
    const outcomes = [
      `redemption:${redemption.status}`,
      `bootstrap:${bootstrap}`,
    ].sort();
    expect([
      [
        'bootstrap:identity_unavailable',
        'redemption:succeeded',
      ],
      [
        'bootstrap:succeeded',
        'redemption:enrollment_unavailable',
      ],
    ]).toContainEqual(outcomes);
    const state = await installerPool.query<{
      bindings: number;
      memberships: number;
      grant_audits: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.identity_bindings
         WHERE issuer = $1 AND subject = 'orphan') AS bindings,
        (SELECT count(*)::integer FROM taptime_server.memberships
         WHERE user_id = $2) AS memberships,
        (SELECT count(*)::integer FROM taptime_server.audit_events
         WHERE event_type IN ('MembershipGranted', 'FirstAdministratorMembershipGranted')
           AND entity_id IN (
             SELECT id FROM taptime_server.memberships WHERE user_id = $2
           )) AS grant_audits
    `, ['https://synthetic.invalid/auth', ids.orphan]);
    expect(state.rows[0]).toEqual({ bindings: 1, memberships: 1, grant_audits: 1 });
  });

  it('holds the verified Binding row while redemption is paused and serializes revocation after grant', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Existing Binding');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const blocker = await installerPool.connect();
    const revokerPool = new Pool({
      connectionString: installerDatabaseUrl,
      max: 1,
      application_name: 'taptime-c3e1-binding-revoker',
    });
    let blockerTransactionOpen = false;
    try {
      await installMembershipInsertPauseTrigger();
      await blocker.query('BEGIN');
      blockerTransactionOpen = true;
      await blocker.query('SELECT pg_catalog.pg_advisory_xact_lock($1::bigint)', [
        membershipInsertPauseLock.toString(),
      ]);
      const redemption = coordinator.redeemInvitation({
        accessToken: fixtureTokens.orphan,
        commandId: randomUUID(),
        invitationSecret: invitation.invitationSecret,
      });
      await waitForDatabaseLock('taptime-c3e1-enrollment-test');

      const revocation = revokerPool.query(`
        UPDATE taptime_server.identity_bindings
        SET revoked_at = transaction_timestamp()
        WHERE id = $1
      `, [ids.bindingOrphan]);
      await waitForDatabaseLock('taptime-c3e1-binding-revoker');

      await blocker.query('COMMIT');
      blockerTransactionOpen = false;
      await expect(redemption).resolves.toMatchObject({ status: 'succeeded' });
      await revocation;

      const state = await installerPool.query<{ revoked: boolean; memberships: number }>(`
        SELECT
          (SELECT revoked_at IS NOT NULL FROM taptime_server.identity_bindings
           WHERE id = $1) AS revoked,
          (SELECT count(*)::integer FROM taptime_server.memberships
           WHERE user_id = $2 AND role = 'employee' AND revoked_at IS NULL) AS memberships
      `, [ids.bindingOrphan, ids.orphan]);
      expect(state.rows[0]).toEqual({ revoked: true, memberships: 1 });
    } finally {
      if (blockerTransactionOpen) await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
      await revokerPool.end();
      await removeMembershipInsertPauseTrigger();
    }
  }, 10_000);

  it('cannot exceed the Organization invitation cap under concurrent distinct commands', async () => {
    for (let index = 1; index <= 4; index += 1) {
      expect((await createInvitation(randomUUID(), `Employee ${index}`)).status).toBe('succeeded');
    }
    const results = await Promise.all([
      createInvitation(randomUUID(), 'Employee 5'),
      createInvitation(randomUUID(), 'Employee 6'),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      'invitation_limit_reached', 'succeeded',
    ]);
    const rows = await installerPool.query<{ count: number }>(
      'SELECT count(*)::integer AS count FROM taptime_server.employee_membership_invitations',
    );
    expect(rows.rows[0]!.count).toBe(5);
  });

  it('rolls back every redemption write and audit when commit is interrupted', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    await expect(coordinator.redeemInvitation({
      accessToken: fixtureTokens.prospectiveA,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    }, {
      beforeCommit: () => { throw new Error('synthetic C3E1 rollback'); },
    })).rejects.toThrow('synthetic C3E1 rollback');
    const state = await installerPool.query<{
      binding: number; membership: number; consumed: number; receipt: number; audit: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.identity_bindings WHERE subject = 'prospective-a') AS binding,
        (SELECT count(*)::integer FROM taptime_server.memberships WHERE display_name = 'Employee Alpha') AS membership,
        (SELECT count(*)::integer FROM taptime_server.employee_membership_invitations WHERE consumed_at IS NOT NULL) AS consumed,
        (SELECT count(*)::integer FROM taptime_server.employee_enrollment_redemption_receipts) AS receipt,
        (SELECT count(*)::integer FROM taptime_server.audit_events WHERE event_type = 'MembershipGranted') AS audit
    `);
    expect(state.rows[0]).toEqual({ binding: 0, membership: 0, consumed: 0, receipt: 0, audit: 0 });
  });

  it.each([
    ['users', 'INSERT', ''],
    ['identity_bindings', 'INSERT', ''],
    ['memberships', 'INSERT', ''],
    ['employee_membership_invitations', 'UPDATE', ''],
    ['employee_enrollment_redemption_receipts', 'INSERT', ''],
    ['audit_events', 'INSERT', 'MembershipGranted'],
  ] as const)(
    'rolls back all state when PostgreSQL fails after %s %s',
    async (table, operation, eventType) => {
      const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
      if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
      await installC3E1FailureTrigger(table, operation, eventType);
      await expect(coordinator.redeemInvitation({
        accessToken: fixtureTokens.prospectiveA,
        commandId: randomUUID(),
        invitationSecret: invitation.invitationSecret,
      })).rejects.toThrow();
      await removeC3E1FailureTrigger();
      const state = await installerPool.query<{
        binding: number; membership: number; consumed: number; receipt: number; audit: number;
      }>(`
        SELECT
          (SELECT count(*)::integer FROM taptime_server.identity_bindings
           WHERE subject = 'prospective-a') AS binding,
          (SELECT count(*)::integer FROM taptime_server.memberships
           WHERE display_name = 'Employee Alpha') AS membership,
          (SELECT count(*)::integer FROM taptime_server.employee_membership_invitations
           WHERE consumed_at IS NOT NULL) AS consumed,
          (SELECT count(*)::integer FROM taptime_server.employee_enrollment_redemption_receipts) AS receipt,
          (SELECT count(*)::integer FROM taptime_server.audit_events
           WHERE event_type = 'MembershipGranted') AS audit
      `);
      expect(state.rows[0]).toEqual({ binding: 0, membership: 0, consumed: 0, receipt: 0, audit: 0 });
    },
  );

  it('rejects expired and canonical unknown secrets through the identical unavailable result', async () => {
    const invitation = await createInvitation(randomUUID(), 'Employee Alpha');
    if (invitation.status !== 'succeeded') throw new Error('Expected invitation success');
    const fixtureClient = await installerPool.connect();
    try {
      await fixtureClient.query("SET session_replication_role = 'replica'");
      await fixtureClient.query(
        `UPDATE taptime_server.employee_membership_invitations
         SET created_at = transaction_timestamp() - interval '16 minutes',
             expires_at = transaction_timestamp() - interval '1 minute'
         WHERE consumed_at IS NULL`,
      );
    } finally {
      await fixtureClient.query("SET session_replication_role = 'origin'");
      fixtureClient.release();
    }
    for (const secret of [invitation.invitationSecret, Buffer.alloc(32, 77).toString('base64url')]) {
      await expect(coordinator.redeemInvitation({
        accessToken: fixtureTokens.prospectiveA,
        commandId: randomUUID(),
        invitationSecret: secret,
      })).resolves.toEqual({ status: 'enrollment_unavailable' });
    }
  });

  it('atomically rejects pre-existing C3E1 role ACL contamination', async () => {
    const database = `taptime_c3e1_dirty_${Date.now()}`;
    await installerPool.query(`CREATE DATABASE "${database}"`);
    const url = new URL(installerDatabaseUrl);
    url.pathname = `/${database}`;
    const dirtyPool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await expect(applyMigrationSet(dirtyPool, migrations.slice(0, 7))).resolves.toMatchObject({
        applied: ['001', '002', '003', '004', '005', '006', '007'],
      });
      await dirtyPool.query('CREATE SCHEMA dirty_c3e1');
      await dirtyPool.query(
        'GRANT USAGE ON SCHEMA dirty_c3e1 TO taptime_employee_invitation_creator',
      );
      await expect(applyMigrationSet(dirtyPool, migrations.slice(7))).rejects.toMatchObject({
        code: '42501',
      });
      const ledger = await dirtyPool.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM ${B3_MIGRATION_TABLE} WHERE version = '008'`,
      );
      expect(ledger.rows[0]!.count).toBe(0);
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: dirtyPool,
        installerPool,
        databaseName: database,
      });
      await ensureC3E1RuntimeLogins(installerPool, invitationPassword, enrollmentPassword);
    }
  }, 30_000);
});

function createInvitation(commandId: string, displayName: string) {
  return coordinator.createInvitation({
    accessToken: fixtureTokens.adminA,
    expectedMembershipId: membershipIds.adminA,
    commandId,
    displayName,
    role: 'employee',
  });
}

async function prepareLocationManagerModel(locationId: string): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.locations (id, organization_id, display_name)
     VALUES ($1, $2, 'Verwalteter Standort')`,
    [locationId, ids.organizationA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.membership_home_location_assignments
       (id, organization_id, membership_id, location_id)
     SELECT gen_random_uuid(), membership.organization_id, membership.id, $2
     FROM taptime_server.memberships AS membership
     WHERE membership.organization_id = $1 AND membership.revoked_at IS NULL`,
    [ids.organizationA, locationId],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.work_target_location_assignments
       (id, organization_id, target_type, target_id, location_id)
     SELECT gen_random_uuid(), target.organization_id, target.target_type, target.target_id, $2
     FROM taptime_server.work_targets AS target
     WHERE target.organization_id = $1 AND target.active`,
    [ids.organizationA, locationId],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.membership_management_location_grants
       (id, organization_id, membership_id, location_id)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [ids.organizationA, membershipIds.employeeA, locationId],
  );

  await enableLocationsForOrganizationA();
}

async function enableLocationsForOrganizationA(): Promise<void> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT
         set_config('app.user_id', $1, true),
         set_config('app.organization_id', $2, true),
         set_config('app.membership_id', $3, true),
         set_config('app.membership_role', 'administrator', true),
         set_config('app.correlation_id', $4, true)`,
      [ids.adminA, ids.organizationA, ids.membershipAdminA, randomUUID()],
    );
    await client.query('SET LOCAL ROLE taptime_admin_setup');
    await client.query(
      'SELECT taptime_server.set_organization_locations_enabled_v1($1, true)',
      [ids.organizationA],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function bootstrapIdentity(
  requestId: string,
  organizationName: string,
  subject: string,
): Promise<string> {
  const client = await bootstrapPool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN READ WRITE');
    transactionOpen = true;
    await client.query('SET LOCAL ROLE taptime_bootstrap_executor');
    const result = await client.query<{ result_status: string }>(
      `SELECT result_status
       FROM taptime_server.bootstrap_first_organization($1, $2, $3, $4)`,
      [requestId, organizationName, 'https://synthetic.invalid/auth', subject],
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return result.rows[0]?.result_status ?? 'missing_result';
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function ensureBootstrapOperator(): Promise<void> {
  const database = new URL(installerDatabaseUrl).pathname.slice(1);
  await installerPool.query(`
    DO $operator$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${bootstrapOperator}'
      ) THEN
        CREATE ROLE ${bootstrapOperator}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $operator$;
    ALTER ROLE ${bootstrapOperator} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${bootstrapPassword}' VALID UNTIL '${new Date(Date.now() + 60 * 60 * 1_000).toISOString()}';
    REVOKE
      taptime_employee,
      taptime_administrator,
      taptime_server_lifecycle,
      taptime_identity_resolver,
      taptime_admin_setup,
      taptime_employee_invitation_creator,
      taptime_employee_enrollment_redeemer,
      taptime_bootstrap_executor
    FROM ${bootstrapOperator};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA} FROM ${bootstrapOperator};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA} FROM ${bootstrapOperator};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA} FROM ${bootstrapOperator};
    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${bootstrapOperator};
    REVOKE CREATE, TEMPORARY ON DATABASE "${database.replaceAll('"', '""')}" FROM ${bootstrapOperator};
    GRANT taptime_bootstrap_executor TO ${bootstrapOperator}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
    GRANT CONNECT ON DATABASE "${database.replaceAll('"', '""')}" TO ${bootstrapOperator};
  `);
}

async function removeBootstrapOperator(): Promise<void> {
  const database = new URL(installerDatabaseUrl).pathname.slice(1);
  await installerPool.query(`
    REVOKE CONNECT ON DATABASE "${database.replaceAll('"', '""')}" FROM ${bootstrapOperator};
    DROP OWNED BY ${bootstrapOperator};
    REVOKE taptime_bootstrap_executor FROM ${bootstrapOperator};
    DROP ROLE IF EXISTS ${bootstrapOperator};
  `);
}

function connectionStringFor(user: string, password: string): string {
  const url = new URL(installerDatabaseUrl);
  url.username = user;
  url.password = password;
  return url.toString();
}

async function installC3E1FailureTrigger(
  table: string,
  operation: 'INSERT' | 'UPDATE',
  eventType: string,
): Promise<void> {
  await installerPool.query(`
    CREATE OR REPLACE FUNCTION public.c3e1_test_fail_after_write()
    RETURNS trigger LANGUAGE plpgsql AS $failure$
    BEGIN
      IF TG_ARGV[0] = '' OR pg_catalog.to_jsonb(NEW)->>'event_type' = TG_ARGV[0] THEN
        RAISE EXCEPTION 'synthetic C3E1 rollback failure';
      END IF;
      RETURN NEW;
    END
    $failure$;
    CREATE TRIGGER c3e1_test_fail_after_write
      AFTER ${operation} ON ${B3_SCHEMA}.${table}
      FOR EACH ROW EXECUTE FUNCTION public.c3e1_test_fail_after_write('${eventType}');
  `);
}

async function removeC3E1FailureTrigger(): Promise<void> {
  for (const table of [
    'users',
    'identity_bindings',
    'memberships',
    'employee_membership_invitations',
    'employee_enrollment_redemption_receipts',
    'audit_events',
  ]) {
    await installerPool?.query(
      `DROP TRIGGER IF EXISTS c3e1_test_fail_after_write ON ${B3_SCHEMA}.${table}`,
    );
  }
  await installerPool?.query('DROP FUNCTION IF EXISTS public.c3e1_test_fail_after_write()');
  await removeMembershipInsertPauseTrigger();
}

async function installMembershipInsertPauseTrigger(): Promise<void> {
  await installerPool.query(`
    CREATE OR REPLACE FUNCTION public.c3e1_test_pause_employee_membership_insert()
    RETURNS trigger LANGUAGE plpgsql AS $pause$
    BEGIN
      PERFORM pg_catalog.pg_advisory_xact_lock(${membershipInsertPauseLock.toString()}::bigint);
      RETURN NEW;
    END
    $pause$;
    CREATE TRIGGER z_c3e1_test_pause_employee_membership_insert
      AFTER INSERT ON ${B3_SCHEMA}.memberships
      FOR EACH ROW WHEN (NEW.role = 'employee')
      EXECUTE FUNCTION public.c3e1_test_pause_employee_membership_insert();
  `);
}

async function removeMembershipInsertPauseTrigger(): Promise<void> {
  await installerPool?.query(
    `DROP TRIGGER IF EXISTS z_c3e1_test_pause_employee_membership_insert ON ${B3_SCHEMA}.memberships`,
  );
  await installerPool?.query(
    'DROP FUNCTION IF EXISTS public.c3e1_test_pause_employee_membership_insert()',
  );
}

async function waitForDatabaseLock(applicationName: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const result = await installerPool.query<{ waiting: boolean }>(`
      SELECT COALESCE(pg_catalog.bool_or(wait_event_type = 'Lock'), false) AS waiting
      FROM pg_catalog.pg_stat_activity
      WHERE application_name = $1
    `, [applicationName]);
    if (result.rows[0]?.waiting === true) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for PostgreSQL lock: ${applicationName}`);
}
