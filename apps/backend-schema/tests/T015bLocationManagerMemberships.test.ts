import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '../src/index.js';
import { ids, seedB3, truncateB3 } from './fixtures.js';

const installerConnectionString = process.env.B3_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 2 });

const membership = {
  admin: '12000000-0000-4000-8000-000000000001',
  manager: '12000000-0000-4000-8000-000000000002',
  managedEmployee: '12000000-0000-4000-8000-000000000003',
  foreignLocationEmployee: '12000000-0000-4000-8000-000000000006',
} as const;

const user = {
  foreignLocationEmployee: '10000000-0000-4000-8000-000000000006',
  invited: '10000000-0000-4000-8000-000000000007',
} as const;

const location = {
  managed: '91000000-0000-4000-8000-000000000001',
  other: '91000000-0000-4000-8000-000000000002',
  foreignOrganization: '91000000-0000-4000-8000-000000000003',
} as const;

const context = {
  admin: {
    organizationId: ids.organizationA,
    userId: ids.adminA,
    membershipId: membership.admin,
    membershipRole: 'administrator',
  },
  manager: {
    organizationId: ids.organizationA,
    userId: ids.employeeA,
    membershipId: membership.manager,
    membershipRole: 'standortleitung',
  },
} as const;

interface CapabilityContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly membershipRole: string;
}

async function withRole<Value>(
  role: string,
  actor: CapabilityContext | null,
  correlationId: string,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    if (actor !== null) {
      await client.query(
        `SELECT
           set_config('app.organization_id', $1, true),
           set_config('app.user_id', $2, true),
           set_config('app.membership_id', $3, true),
           set_config('app.membership_role', $4, true),
           set_config('app.correlation_id', $5, true)`,
        [actor.organizationId, actor.userId, actor.membershipId, actor.membershipRole,
          correlationId],
      );
    }
    await client.query(`SET LOCAL ROLE ${role}`);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function enableLocations(): Promise<void> {
  await withRole(
    'taptime_admin_setup',
    context.admin,
    '92000000-0000-4000-8000-000000000001',
    (client) => client.query(
      `SELECT ${B3_SCHEMA}.set_organization_locations_enabled_v1($1, true)`,
      [ids.organizationA],
    ),
  );
}

async function prepareLocationModel(enabled = true): Promise<void> {
  const roleChange = await withRole(
    'taptime_membership_manager',
    context.admin,
    '92000000-0000-4000-8000-000000000000',
    (client) => client.query<{ result_status: string }>(
      `SELECT result_status
       FROM ${B3_SCHEMA}.manage_membership_v1($1, $2, 1, 'change_role', 'standortleitung')`,
      ['92000000-0000-4000-8000-000000000000', membership.manager],
    ),
  );
  expect(roleChange.rows[0]).toEqual({ result_status: 'succeeded' });
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1)`,
    [user.foreignLocationEmployee],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.memberships
       (id, organization_id, user_id, role, created_by_user_id, display_name)
     VALUES ($1, $2, $3, 'employee', $4, 'Anderer Standort')`,
    [membership.foreignLocationEmployee, ids.organizationA,
      user.foreignLocationEmployee, ids.adminA],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.locations (id, organization_id, display_name) VALUES
       ($1, $3, 'Verwaltet'), ($2, $3, 'Nicht verwaltet'),
       ($4, $5, 'Fremder Betrieb')`,
    [location.managed, location.other, ids.organizationA,
      location.foreignOrganization, ids.organizationB],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.membership_home_location_assignments
       (id, organization_id, membership_id, location_id) VALUES
       (gen_random_uuid(), $1, $2, $6),
       (gen_random_uuid(), $1, $3, $6),
       (gen_random_uuid(), $1, $4, $6),
       (gen_random_uuid(), $1, $5, $7)`,
    [ids.organizationA, membership.admin, membership.manager,
      membership.managedEmployee, membership.foreignLocationEmployee,
      location.managed, location.other],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.work_target_location_assignments
       (id, organization_id, target_type, target_id, location_id)
     SELECT gen_random_uuid(), target.organization_id, target.target_type, target.target_id, $2
     FROM ${B3_SCHEMA}.work_targets AS target
     WHERE target.organization_id = $1 AND target.active`,
    [ids.organizationA, location.managed],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
       (id, organization_id, membership_id, location_id)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [ids.organizationA, membership.manager, location.other],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.membership_management_location_grants
       (id, organization_id, membership_id, location_id)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [ids.organizationA, membership.manager, location.managed],
  );
  if (enabled) await enableLocations();
}

async function createInvitation(input: {
  readonly actor: CapabilityContext;
  readonly commandId: string;
  readonly invitationId: string;
  readonly displayName: string;
  readonly role: string;
  readonly locationId: string | null;
  readonly digestByte: number;
}): Promise<{ result_status: string; result_expires_at: Date | null }> {
  return withRole(
    'taptime_membership_manager',
    input.actor,
    input.commandId,
    async (client) => {
      const result = await client.query<{
        result_status: string;
        result_expires_at: Date | null;
      }>(
        `SELECT result_status, result_expires_at
         FROM ${B3_SCHEMA}.create_membership_invitation_v3($1, $2, $3, $4, $5, $6)`,
        [input.commandId, input.invitationId, input.displayName, input.role,
          input.locationId, Buffer.alloc(32, input.digestByte)],
      );
      return result.rows[0]!;
    },
  );
}

beforeAll(async () => {
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installerPool);
});

beforeEach(async () => {
  await truncateB3(installerPool);
  await seedB3(installerPool);
});

afterAll(async () => {
  await installerPool.end();
});

describe('T-015b Location Manager Membership scope', () => {
  it('returns explicit scope kinds and filters the projection to current Management Locations', async () => {
    await prepareLocationModel();

    const scopes = await installerPool.query<{ scope_kind: string; location_id: string | null }>(
      `SELECT * FROM ${B3_SCHEMA}.has_membership_management_authority_v1(
         $1, $2, $3, 'read', NULL, NULL, NULL
       ) ORDER BY scope_kind, location_id`,
      [ids.organizationA, ids.employeeA, membership.manager],
    );
    expect(scopes.rows).toEqual([{ scope_kind: 'location', location_id: location.managed }]);

    const adminScope = await installerPool.query<{ scope_kind: string; location_id: string | null }>(
      `SELECT * FROM ${B3_SCHEMA}.has_membership_management_authority_v1(
         $1, $2, $3, 'read', NULL, NULL, NULL
       )`,
      [ids.organizationA, ids.adminA, membership.admin],
    );
    expect(adminScope.rows).toEqual([{ scope_kind: 'organization', location_id: null }]);

    const managerProjection = await withRole(
      'taptime_membership_manager',
      context.manager,
      '92000000-0000-4000-8000-000000000002',
      (client) => client.query<{ membership_id: string | null }>(
        `SELECT membership_id FROM ${B3_SCHEMA}.read_managed_memberships_v1(NULL, 20)`,
      ),
    );
    expect(managerProjection.rows.map((row) => row.membership_id).sort()).toEqual([
      membership.admin,
      membership.manager,
      membership.managedEmployee,
    ].sort());
    expect(managerProjection.rows).not.toContainEqual({
      membership_id: membership.foreignLocationEmployee,
    });

    const adminProjection = await withRole(
      'taptime_membership_manager',
      context.admin,
      '92000000-0000-4000-8000-000000000003',
      (client) => client.query<{ membership_id: string | null }>(
        `SELECT membership_id FROM ${B3_SCHEMA}.read_managed_memberships_v1(NULL, 20)`,
      ),
    );
    expect(adminProjection.rows.map((row) => row.membership_id)).toContain(
      membership.foreignLocationEmployee,
    );
  });

  it('allows only Employee invitations inside the current Management scope', async () => {
    await prepareLocationModel();
    const succeeded = await createInvitation({
      actor: context.manager,
      commandId: '92000000-0000-4000-8000-000000000010',
      invitationId: '93000000-0000-4000-8000-000000000010',
      displayName: 'Neue Beschäftigte',
      role: 'employee',
      locationId: location.managed,
      digestByte: 10,
    });
    expect(succeeded.result_status).toBe('succeeded');

    for (const [role, locationId, suffix] of [
      ['employee', location.other, 11],
      ['administrator', location.managed, 12],
      ['standortleitung', location.managed, 13],
    ] as const) {
      const result = await createInvitation({
        actor: context.manager,
        commandId: `92000000-0000-4000-8000-0000000000${suffix}`,
        invitationId: `93000000-0000-4000-8000-0000000000${suffix}`,
        displayName: `Unzulässig ${suffix}`,
        role,
        locationId,
        digestByte: suffix,
      });
      expect(result.result_status).toBe('forbidden');
    }

    const stored = await installerPool.query<{
      membership_role: string;
      home_location_id: string;
      request_hash_version: number;
    }>(
      `SELECT invitation.membership_role, invitation.home_location_id,
              receipt.request_hash_version
       FROM ${B3_SCHEMA}.employee_membership_invitations AS invitation
       JOIN ${B3_SCHEMA}.employee_invitation_command_receipts AS receipt
         ON receipt.organization_id = invitation.organization_id
        AND receipt.invitation_id = invitation.id`,
    );
    expect(stored.rows).toEqual([{
      membership_role: 'employee',
      home_location_id: location.managed,
      request_hash_version: 2,
    }]);
  });

  it('does not merge the same invitation command across two Locations', async () => {
    await prepareLocationModel();
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_management_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.manager, location.other],
    );
    const commandId = '92000000-0000-4000-8000-000000000020';
    expect((await createInvitation({
      actor: context.manager,
      commandId,
      invitationId: '93000000-0000-4000-8000-000000000020',
      displayName: 'Erster Standort',
      role: 'employee',
      locationId: location.managed,
      digestByte: 20,
    })).result_status).toBe('succeeded');
    expect((await createInvitation({
      actor: context.manager,
      commandId,
      invitationId: '93000000-0000-4000-8000-000000000021',
      displayName: 'Erster Standort',
      role: 'employee',
      locationId: location.other,
      digestByte: 21,
    })).result_status).toBe('command_id_conflict');
  });

  it('redeems into a valid Home Location in the same enabled transaction', async () => {
    await prepareLocationModel();
    const commandId = '92000000-0000-4000-8000-000000000030';
    const tokenDigest = Buffer.alloc(32, 30);
    expect((await createInvitation({
      actor: context.manager,
      commandId,
      invitationId: '93000000-0000-4000-8000-000000000030',
      displayName: 'Eingeladene Person',
      role: 'employee',
      locationId: location.managed,
      digestByte: 30,
    })).result_status).toBe('succeeded');

    const redemption = await withRole(
      'taptime_membership_enrollment_redeemer',
      null,
      '92000000-0000-4000-8000-000000000031',
      (client) => client.query<{ result_status: string; result_membership_role: string }>(
        `SELECT result_status, result_membership_role
         FROM ${B3_SCHEMA}.redeem_membership_invitation_v2($1, $2, $3, $4, $5, $6, $7)`,
        [
          '92000000-0000-4000-8000-000000000031',
          tokenDigest,
          'https://synthetic.invalid/auth',
          'invited-location-manager-employee',
          user.invited,
          '11000000-0000-4000-8000-000000000007',
          '12000000-0000-4000-8000-000000000007',
        ],
      ),
    );
    expect(redemption.rows[0]).toEqual({
      result_status: 'succeeded',
      result_membership_role: 'employee',
    });

    const home = await installerPool.query<{ location_id: string; locations_enabled: boolean }>(
      `SELECT home.location_id, organization.locations_enabled
       FROM ${B3_SCHEMA}.memberships AS membership
       JOIN ${B3_SCHEMA}.membership_home_location_assignments AS home
         ON home.organization_id = membership.organization_id
        AND home.membership_id = membership.id
        AND home.revoked_at IS NULL
       JOIN ${B3_SCHEMA}.organizations AS organization
         ON organization.id = membership.organization_id
       WHERE membership.id = $1`,
      ['12000000-0000-4000-8000-000000000007'],
    );
    expect(home.rows).toEqual([{ location_id: location.managed, locations_enabled: true }]);
  });

  it('allows revocation only for another active Employee at a managed Home Location', async () => {
    await prepareLocationModel();

    async function manage(targetMembershipId: string, commandType: string, role: string | null) {
      const commandId = `92000000-0000-4000-8000-${targetMembershipId.slice(-12)}`;
      const version = await installerPool.query<{ row_version: string }>(
        `SELECT row_version FROM ${B3_SCHEMA}.memberships WHERE id = $1`,
        [targetMembershipId],
      );
      return withRole(
        'taptime_membership_manager',
        context.manager,
        commandId,
        (client) => client.query<{ result_status: string }>(
            `SELECT result_status FROM ${B3_SCHEMA}.manage_membership_v1($1, $2, $3, $4, $5)`,
            [commandId, targetMembershipId, version.rows[0]!.row_version, commandType, role],
          ),
      );
    }

    expect((await manage(membership.foreignLocationEmployee, 'revoke', null)).rows[0])
      .toEqual({ result_status: 'forbidden' });
    expect((await manage(membership.admin, 'revoke', null)).rows[0])
      .toEqual({ result_status: 'forbidden' });
    expect((await manage(membership.manager, 'revoke', null)).rows[0])
      .toEqual({ result_status: 'self_revocation_forbidden' });
    expect((await manage(membership.managedEmployee, 'change_role', 'standortleitung')).rows[0])
      .toEqual({ result_status: 'forbidden' });
    expect((await manage(membership.managedEmployee, 'revoke', null)).rows[0])
      .toEqual({ result_status: 'succeeded' });
  });

  it('fails closed without a current Management grant, while off, and across Organizations', async () => {
    await prepareLocationModel(false);
    const disabled = await installerPool.query(
      `SELECT * FROM ${B3_SCHEMA}.has_membership_management_authority_v1(
         $1, $2, $3, 'read', NULL, NULL, NULL
       )`,
      [ids.organizationA, ids.employeeA, membership.manager],
    );
    expect(disabled.rows).toEqual([]);

    await enableLocations();
    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.membership_management_location_grants
       SET revoked_at = transaction_timestamp()
       WHERE organization_id = $1 AND membership_id = $2 AND revoked_at IS NULL`,
      [ids.organizationA, membership.manager],
    );
    const revoked = await installerPool.query(
      `SELECT * FROM ${B3_SCHEMA}.has_membership_management_authority_v1(
         $1, $2, $3, 'read', NULL, NULL, NULL
       )`,
      [ids.organizationA, ids.employeeA, membership.manager],
    );
    const foreignOrganization = await installerPool.query(
      `SELECT * FROM ${B3_SCHEMA}.has_membership_management_authority_v1(
         $1, $2, $3, 'read', NULL, NULL, NULL
       )`,
      [ids.organizationB, ids.employeeA, membership.manager],
    );
    expect(revoked.rows).toEqual([]);
    expect(foreignOrganization.rows).toEqual([]);
  });

  it('keeps exactly one authoritative scope function and rejects unknown persisted roles', async () => {
    const functions = await installerPool.query<{
      identity_arguments: string;
      result: string;
      returns_set: boolean;
    }>(
      `SELECT pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments,
              pg_catalog.pg_get_function_result(procedure.oid) AS result,
              procedure.proretset AS returns_set
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = $1
         AND procedure.proname = 'has_membership_management_authority_v1'`,
      [B3_SCHEMA],
    );
    expect(functions.rows).toHaveLength(1);
    expect(functions.rows[0]).toMatchObject({
      result: 'TABLE(scope_kind text, location_id uuid)',
      returns_set: true,
    });

    await expect(installerPool.query(
      `UPDATE ${B3_SCHEMA}.memberships SET role = 'unknown-role' WHERE id = $1`,
      [membership.manager],
    )).rejects.toMatchObject({ code: '23514' });
    await expect(installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.offline_capture_leases
        (id, organization_id, installation_id, identity_binding_id, user_id, membership_id,
         membership_row_version, membership_role, issued_at, expires_at, configuration_revision,
         item_count, serialized_bytes, manifest_digest)
       VALUES (gen_random_uuid(), $1, gen_random_uuid(), gen_random_uuid(), $2, $3,
         1, 'unknown-role', transaction_timestamp(), transaction_timestamp() + interval '12 hours',
         repeat('a', 64), 0, 0, repeat('b', 64))`,
      [ids.organizationA, ids.employeeA, membership.manager],
    )).rejects.toMatchObject({ code: '23514' });
  });
});
