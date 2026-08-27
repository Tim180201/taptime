import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  applyMigrationSet,
  loadMigrations,
  migrate,
} from '../src/index.js';
import { ids, postgresErrorCode, seedB3, truncateB3 } from './fixtures.js';
import { closePoolAndDropTestDatabase } from './support/postgresTestDatabaseCleanup.mjs';

const installerConnectionString = process.env.B3_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 3 });

const membership = {
  adminA: '12000000-0000-4000-8000-000000000001',
  employeeA: '12000000-0000-4000-8000-000000000002',
  employeeA2: '12000000-0000-4000-8000-000000000003',
  adminB: '12000000-0000-4000-8000-000000000004',
} as const;

const location = {
  aHome: '81000000-0000-4000-8000-000000000001',
  aAdditional: '81000000-0000-4000-8000-000000000002',
  bHome: '81000000-0000-4000-8000-000000000003',
} as const;

const projectA = '82000000-0000-4000-8000-000000000001';
const resolvedEvent = '84000000-0000-4000-8000-000000000001';
const rejectedOverrideEvent = '84000000-0000-4000-8000-000000000002';
const resolvedEntry = '85000000-0000-4000-8000-000000000001';
const recoveredRecord = '87000000-0000-4000-8000-000000000001';

interface CapabilityContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
}

const adminAContext: CapabilityContext = {
  organizationId: ids.organizationA,
  userId: ids.adminA,
  membershipId: membership.adminA,
};

async function withRole<Value>(
  role: string,
  context: CapabilityContext,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT
         set_config('app.organization_id', $1, true),
         set_config('app.user_id', $2, true),
         set_config('app.membership_id', $3, true),
         set_config('app.membership_role', 'administrator', true),
         set_config('app.correlation_id', '83000000-0000-4000-8000-000000000001', true)`,
      [context.organizationId, context.userId, context.membershipId],
    );
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

async function setLocationsEnabled(enabled: boolean): Promise<boolean> {
  return withRole('taptime_admin_setup', adminAContext, async (client) => {
    const result = await client.query<{ enabled: boolean }>(
      `SELECT ${B3_SCHEMA}.set_organization_locations_enabled_v1($1, $2) AS enabled`,
      [ids.organizationA, enabled],
    );
    return result.rows[0]!.enabled;
  });
}

async function insertLocation(
  id: string,
  organizationId: string,
  displayName: string,
): Promise<void> {
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.locations (id, organization_id, display_name)
     VALUES ($1, $2, $3)`,
    [id, organizationId, displayName],
  );
}

async function prepareCompleteOrganizationA(): Promise<void> {
  await insertLocation(location.aHome, ids.organizationA, 'Hauptstandort');
  await insertLocation(location.aAdditional, ids.organizationA, 'Nebenstandort');
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.membership_home_location_assignments
       (id, organization_id, membership_id, location_id)
     SELECT gen_random_uuid(), membership.organization_id, membership.id, $2
     FROM ${B3_SCHEMA}.memberships AS membership
     WHERE membership.organization_id = $1 AND membership.revoked_at IS NULL`,
    [ids.organizationA, location.aHome],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.work_target_location_assignments
       (id, organization_id, target_type, target_id, location_id)
     SELECT gen_random_uuid(), target.organization_id, target.target_type, target.target_id, $2
     FROM ${B3_SCHEMA}.work_targets AS target
     WHERE target.organization_id = $1 AND target.active`,
    [ids.organizationA, location.aHome],
  );
}

async function productReadSnapshot(): Promise<{
  readonly memberships: readonly Record<string, unknown>[];
  readonly targets: readonly Record<string, unknown>[];
}> {
  const memberships = await withRole(
    'taptime_membership_manager',
    adminAContext,
    (client) => client.query<Record<string, unknown>>(
      `SELECT * FROM ${B3_SCHEMA}.read_managed_memberships_v1(NULL, 20)`,
    ),
  );
  const targets = await withRole(
    'taptime_mobile_target_reader',
    {
      organizationId: ids.organizationA,
      userId: ids.employeeA,
      membershipId: membership.employeeA,
    },
    (client) => client.query<Record<string, unknown>>(
      `SELECT * FROM ${B3_SCHEMA}.read_mobile_work_targets_v1(
         $1, $2, $3, NULL, NULL, NULL, 51
       )`,
      [ids.organizationA, ids.employeeA, membership.employeeA],
    ),
  );
  return { memberships: memberships.rows, targets: targets.rows };
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

describe('T-015a optional Location model remains off by default', () => {
  it('lets the current Organization Administrator prepare every Location relation while off', async () => {
    const targets = await installerPool.query<{
      target_type: string;
      target_id: string;
    }>(
      `SELECT target_type, target_id FROM ${B3_SCHEMA}.work_targets
       WHERE organization_id = $1 AND active ORDER BY target_type, target_id`,
      [ids.organizationA],
    );

    const counts = await withRole('taptime_admin_setup', adminAContext, async (client) => {
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.locations (id, organization_id, display_name) VALUES
          ($1, $3, 'Runtime Hauptstandort'), ($2, $3, 'Runtime Nebenstandort')`,
        [location.aHome, location.aAdditional, ids.organizationA],
      );
      for (const membershipId of [membership.adminA, membership.employeeA, membership.employeeA2]) {
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.membership_home_location_assignments
             (id, organization_id, membership_id, location_id)
           VALUES (gen_random_uuid(), $1, $2, $3)`,
          [ids.organizationA, membershipId, location.aHome],
        );
      }
      for (const target of targets.rows) {
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.work_target_location_assignments
             (id, organization_id, target_type, target_id, location_id)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [ids.organizationA, target.target_type, target.target_id, location.aHome],
        );
      }
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
           (id, organization_id, membership_id, location_id)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [ids.organizationA, membership.employeeA, location.aAdditional],
      );
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.membership_management_location_grants
           (id, organization_id, membership_id, location_id)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [ids.organizationA, membership.employeeA2, location.aAdditional],
      );
      return client.query<{
        locations: number;
        homes: number;
        work_grants: number;
        management_grants: number;
        resources: number;
      }>(
        `SELECT
           (SELECT count(*)::integer FROM ${B3_SCHEMA}.locations) AS locations,
           (SELECT count(*)::integer FROM ${B3_SCHEMA}.membership_home_location_assignments)
             AS homes,
           (SELECT count(*)::integer FROM ${B3_SCHEMA}.membership_work_location_grants)
             AS work_grants,
           (SELECT count(*)::integer FROM ${B3_SCHEMA}.membership_management_location_grants)
             AS management_grants,
           (SELECT count(*)::integer FROM ${B3_SCHEMA}.work_target_location_assignments)
             AS resources`,
      );
    });

    expect(counts.rows[0]).toEqual({
      locations: 2,
      homes: 3,
      work_grants: 1,
      management_grants: 1,
      resources: targets.rowCount,
    });
    const state = await installerPool.query<{ locations_enabled: boolean }>(
      `SELECT locations_enabled FROM ${B3_SCHEMA}.organizations WHERE id = $1`,
      [ids.organizationA],
    );
    expect(state.rows[0]).toEqual({ locations_enabled: false });
  });

  it('keeps existing Product projections byte-for-byte unchanged while inactive setup exists', async () => {
    const before = await productReadSnapshot();

    await prepareCompleteOrganizationA();
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.employeeA2, location.aAdditional],
    );
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_management_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.employeeA, location.aAdditional],
    );

    const after = await productReadSnapshot();
    const feature = await installerPool.query<{ locations_enabled: boolean }>(
      `SELECT locations_enabled FROM ${B3_SCHEMA}.organizations WHERE id = $1`,
      [ids.organizationA],
    );
    expect(after).toEqual(before);
    expect(feature.rows[0]).toEqual({ locations_enabled: false });
  });

  it('rejects one unbound active row atomically and retains all inactive setup', async () => {
    await prepareCompleteOrganizationA();
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.projects (id, organization_id, display_name)
       VALUES ($1, $2, 'Ungebundenes Projekt')`,
      [projectA, ids.organizationA],
    );

    expect(await postgresErrorCode(setLocationsEnabled(true))).toBe('23514');

    const state = await installerPool.query<{
      locations_enabled: boolean;
      location_count: number;
      home_count: number;
      resource_count: number;
      project_count: number;
    }>(
      `SELECT organization.locations_enabled,
              (SELECT count(*)::integer FROM ${B3_SCHEMA}.locations
               WHERE organization_id = organization.id) AS location_count,
              (SELECT count(*)::integer
               FROM ${B3_SCHEMA}.membership_home_location_assignments
               WHERE organization_id = organization.id) AS home_count,
              (SELECT count(*)::integer
               FROM ${B3_SCHEMA}.work_target_location_assignments
               WHERE organization_id = organization.id) AS resource_count,
              (SELECT count(*)::integer FROM ${B3_SCHEMA}.projects
               WHERE organization_id = organization.id AND id = $2) AS project_count
       FROM ${B3_SCHEMA}.organizations AS organization
       WHERE organization.id = $1`,
      [ids.organizationA, projectA],
    );
    expect(state.rows[0]).toEqual({
      locations_enabled: false,
      location_count: 2,
      home_count: 3,
      resource_count: 2,
      project_count: 1,
    });
  });

  it('revalidates the complete current model after disable and rejects stale retained setup', async () => {
    await prepareCompleteOrganizationA();
    await expect(setLocationsEnabled(true)).resolves.toBe(true);
    await expect(setLocationsEnabled(false)).resolves.toBe(false);

    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.work_target_location_assignments
       SET revoked_at = transaction_timestamp()
       WHERE organization_id = $1
         AND target_type = 'customer'
         AND target_id = $2
         AND revoked_at IS NULL`,
      [ids.organizationA, ids.customerA],
    );

    expect(await postgresErrorCode(setLocationsEnabled(true))).toBe('23514');
    const state = await installerPool.query<{
      locations_enabled: boolean;
      retained: number;
      revoked: number;
    }>(
      `SELECT organization.locations_enabled,
              (SELECT count(*)::integer FROM ${B3_SCHEMA}.work_target_location_assignments
               WHERE organization_id = organization.id) AS retained,
              (SELECT count(*)::integer FROM ${B3_SCHEMA}.work_target_location_assignments
               WHERE organization_id = organization.id AND revoked_at IS NOT NULL) AS revoked
       FROM ${B3_SCHEMA}.organizations AS organization WHERE organization.id = $1`,
      [ids.organizationA],
    );
    expect(state.rows[0]).toEqual({ locations_enabled: false, retained: 2, revoked: 1 });
  });

  it('keeps Work and Management grants non-interchangeable and revokes their effect when off', async () => {
    await prepareCompleteOrganizationA();
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.employeeA2, location.aAdditional],
    );
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_management_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.employeeA, location.aAdditional],
    );
    await expect(setLocationsEnabled(true)).resolves.toBe(true);

    const enabled = await installerPool.query<{
      work_grant_is_work: boolean;
      work_grant_is_management: boolean;
      management_grant_is_work: boolean;
      management_grant_is_management: boolean;
      management_grant_is_people_authority: boolean;
    }>(
      `SELECT
         ${B3_SCHEMA}.membership_has_work_location_v1($1, $2, $4)
           AS work_grant_is_work,
         ${B3_SCHEMA}.membership_has_management_location_v1($1, $2, $4)
           AS work_grant_is_management,
         ${B3_SCHEMA}.membership_has_work_location_v1($1, $3, $4)
           AS management_grant_is_work,
         ${B3_SCHEMA}.membership_has_management_location_v1($1, $3, $4)
           AS management_grant_is_management,
         EXISTS (
           SELECT 1 FROM ${B3_SCHEMA}.has_membership_management_authority_v1(
             $1, $5, $3, 'read', NULL, NULL, NULL
           )
         ) AS management_grant_is_people_authority`,
      [
        ids.organizationA,
        membership.employeeA2,
        membership.employeeA,
        location.aAdditional,
        ids.employeeA,
      ],
    );
    expect(enabled.rows[0]).toEqual({
      work_grant_is_work: true,
      work_grant_is_management: false,
      management_grant_is_work: false,
      management_grant_is_management: true,
      management_grant_is_people_authority: false,
    });

    await expect(setLocationsEnabled(false)).resolves.toBe(false);
    const disabled = await installerPool.query<{ work: boolean; management: boolean }>(
      `SELECT
         ${B3_SCHEMA}.membership_has_work_location_v1($1, $2, $4) AS work,
         ${B3_SCHEMA}.membership_has_management_location_v1($1, $3, $4) AS management`,
      [ids.organizationA, membership.employeeA2, membership.employeeA, location.aAdditional],
    );
    const retained = await installerPool.query<{ work: number; management: number }>(
      `SELECT
         (SELECT count(*)::integer FROM ${B3_SCHEMA}.membership_work_location_grants
          WHERE organization_id = $1 AND revoked_at IS NULL) AS work,
         (SELECT count(*)::integer FROM ${B3_SCHEMA}.membership_management_location_grants
          WHERE organization_id = $1 AND revoked_at IS NULL) AS management`,
      [ids.organizationA],
    );
    expect(disabled.rows[0]).toEqual({ work: false, management: false });
    expect(retained.rows[0]).toEqual({ work: 1, management: 1 });

    expect(await postgresErrorCode(installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.employeeA2, location.aHome],
    ))).toBe('23514');
  });

  it('hides foreign-Organization Locations and rejects cross-Organization binding', async () => {
    await insertLocation(location.aHome, ids.organizationA, 'Standort A');
    await insertLocation(location.bHome, ids.organizationB, 'Standort B');

    const visible = await withRole(
      'taptime_admin_setup',
      adminAContext,
      (client) => client.query<{ id: string }>(
        `SELECT id FROM ${B3_SCHEMA}.locations ORDER BY id`,
      ),
    );
    expect(visible.rows).toEqual([{ id: location.aHome }]);

    expect(await postgresErrorCode(installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
         (id, organization_id, membership_id, location_id)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [ids.organizationA, membership.employeeA, location.bHome],
    ))).toBe('23503');

    const runtimeBind = withRole(
      'taptime_admin_setup',
      adminAContext,
      (client) => client.query(
        `INSERT INTO ${B3_SCHEMA}.membership_work_location_grants
           (id, organization_id, membership_id, location_id)
         VALUES (gen_random_uuid(), $1, $2, $3)`,
        [ids.organizationA, membership.employeeA, location.bHome],
      ),
    );
    expect(await postgresErrorCode(runtimeBind)).toBe('23503');
  });

  it('forces RLS on every new table and preserves nullable, immutable accepted history', async () => {
    const tables = await installerPool.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relation.relname, relation.relrowsecurity, relation.relforcerowsecurity
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = $1
         AND relation.relname = ANY($2::text[])
       ORDER BY relation.relname`,
      [
        B3_SCHEMA,
        [
          'locations',
          'membership_home_location_assignments',
          'membership_management_location_grants',
          'membership_work_location_grants',
          'work_target_location_assignments',
        ],
      ],
    );
    expect(tables.rows).toHaveLength(5);
    expect(tables.rows.every(
      (row) => row.relrowsecurity && row.relforcerowsecurity,
    )).toBe(true);

    const migrated = await installerPool.query<{
      work_events: number;
      time_entries: number;
      time_record_revisions: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM ${B3_SCHEMA}.work_events
          WHERE accepted_work_location_id IS NOT NULL) AS work_events,
         (SELECT count(*)::integer FROM ${B3_SCHEMA}.time_entries
          WHERE accepted_work_location_id IS NOT NULL) AS time_entries,
         (SELECT count(*)::integer FROM ${B3_SCHEMA}.time_record_revisions
          WHERE accepted_work_location_id IS NOT NULL) AS time_record_revisions`,
    );
    expect(migrated.rows[0]).toEqual({
      work_events: 0,
      time_entries: 0,
      time_record_revisions: 0,
    });

    await insertLocation(location.aHome, ids.organizationA, 'Unveränderlicher Standort');
    expect(await postgresErrorCode(installerPool.query(
      `UPDATE ${B3_SCHEMA}.work_events
       SET accepted_work_location_id = $1 WHERE id = $2`,
      [location.aHome, ids.eventA],
    ))).toBe('23514');
    expect(await postgresErrorCode(installerPool.query(
      `DELETE FROM ${B3_SCHEMA}.locations WHERE id = $1`,
      [location.aHome],
    ))).toBe('42501');
  });

  it('resolves enabled Work Location server-side and preserves it through record history', async () => {
    await prepareCompleteOrganizationA();
    await expect(setLocationsEnabled(true)).resolves.toBe(true);

    const insertEvent = (eventId: string, acceptedLocationId?: string) => installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.work_events
        (id, organization_id, target_type, target_customer_id, triggered_by_user_id,
         occurred_at, received_at, content_hash, content_hash_algorithm, content_hash_version,
         trigger_type, subject_type, accepted_work_location_id)
       VALUES ($1, $2, 'customer', $3, $4, '2026-08-26T08:00:00Z',
         '2026-08-26T08:00:01Z', $5, 'sha256', 2, 'manual', 'work', $6)`,
      [
        eventId,
        ids.organizationA,
        ids.customerA,
        ids.adminA,
        eventId.replaceAll('-', '').padEnd(64, 'a').slice(0, 64),
        acceptedLocationId ?? null,
      ],
    );

    await expect(insertEvent(resolvedEvent)).resolves.toBeDefined();
    expect(await postgresErrorCode(
      insertEvent(rejectedOverrideEvent, location.aAdditional),
    )).toBe('23514');
    expect(await postgresErrorCode(installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, accepted_work_location_id)
       VALUES ($1, $2, $3, 'customer', $4, 'started', $5,
         '2026-08-26T08:00:00Z', $6)`,
      [
        resolvedEntry,
        ids.organizationA,
        ids.adminA,
        ids.customerA,
        resolvedEvent,
        location.aAdditional,
      ],
    ))).toBe('23514');

    const client = await installerPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.time_entries
          (id, organization_id, user_id, target_type, target_customer_id, status,
           start_work_event_id, started_at)
         VALUES ($1, $2, $3, 'customer', $4, 'started', $5, '2026-08-26T08:00:00Z')`,
        [resolvedEntry, ids.organizationA, ids.adminA, ids.customerA, resolvedEvent],
      );
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.canonical_decisions
          (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
           decision_type, time_entry_id, engine_version, decision_payload)
         VALUES ($1, $2, $3, 'customer', $4, 'time_entry_started', $5,
           't015a-test', '{"status":"time_entry_started"}')`,
        [resolvedEvent, ids.organizationA, ids.adminA, ids.customerA, resolvedEntry],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    expect(await postgresErrorCode(installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.time_record_revisions
        (organization_id, time_record_id, revision_number, canonical_time_entry_id,
         user_id, target_type, target_customer_id, effective_started_at,
         effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
         reason, previous_revision_number, command_id, request_hash,
         accepted_work_location_id)
       VALUES ($1, $2, 1, $2, $3, 'customer', $4, '2026-08-26T08:00:00Z',
         '2026-08-26T09:00:00Z', 1, $3, $5, 'Korrektur', NULL,
         '86000000-0000-4000-8000-000000000001', $6, $7)`,
      [
        ids.organizationA,
        resolvedEntry,
        ids.adminA,
        ids.customerA,
        membership.adminA,
        'a'.repeat(64),
        location.aAdditional,
      ],
    ))).toBe('23514');

    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.time_record_revisions
        (organization_id, time_record_id, revision_number, canonical_time_entry_id,
         user_id, target_type, target_customer_id, effective_started_at,
         effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
         reason, previous_revision_number, command_id, request_hash)
       VALUES ($1, $2, 1, $2, $3, 'customer', $4, '2026-08-26T08:00:00Z',
         '2026-08-26T09:00:00Z', 1, $3, $5, 'Korrektur', NULL,
         '86000000-0000-4000-8000-000000000002', $6)`,
      [
        ids.organizationA,
        resolvedEntry,
        ids.adminA,
        ids.customerA,
        membership.adminA,
        'b'.repeat(64),
      ],
    );

    const accepted = await installerPool.query<{
      event_location: string;
      entry_location: string;
      revision_location: string;
    }>(
      `SELECT event.accepted_work_location_id AS event_location,
              entry.accepted_work_location_id AS entry_location,
              revision.accepted_work_location_id AS revision_location
       FROM ${B3_SCHEMA}.work_events AS event
       JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.start_work_event_id = event.id
       JOIN ${B3_SCHEMA}.time_record_revisions AS revision
         ON revision.organization_id = entry.organization_id
        AND revision.canonical_time_entry_id = entry.id
       WHERE event.id = $1`,
      [resolvedEvent],
    );
    expect(accepted.rows[0]).toEqual({
      event_location: location.aHome,
      entry_location: location.aHome,
      revision_location: location.aHome,
    });
  });

  it('never assigns current Resource setup to a recovered TimeRecord', async () => {
    await prepareCompleteOrganizationA();
    await expect(setLocationsEnabled(true)).resolves.toBe(true);

    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.time_record_revisions
        (organization_id, time_record_id, revision_number, canonical_time_entry_id,
         user_id, target_type, target_customer_id, effective_started_at,
         effective_stopped_at, base_row_version, actor_user_id, actor_membership_id,
         reason, previous_revision_number, command_id, request_hash)
       VALUES ($1, $2, 1, NULL, $3, 'customer', $4, '2026-08-25T08:00:00Z',
         '2026-08-25T09:00:00Z', 0, $5, $6, 'Wiederherstellung', NULL,
         '88000000-0000-4000-8000-000000000001', $7)`,
      [
        ids.organizationA,
        recoveredRecord,
        ids.employeeA,
        ids.customerA,
        ids.adminA,
        membership.adminA,
        'c'.repeat(64),
      ],
    );

    const recovered = await installerPool.query<{
      accepted_work_location_id: string | null;
      current_resource_location_id: string;
    }>(
      `SELECT revision.accepted_work_location_id, binding.location_id AS current_resource_location_id
       FROM ${B3_SCHEMA}.time_record_revisions AS revision
       JOIN ${B3_SCHEMA}.work_target_location_assignments AS binding
         ON binding.organization_id = revision.organization_id
        AND binding.target_type = revision.target_type
        AND binding.target_id = revision.target_customer_id
        AND binding.revoked_at IS NULL
       WHERE revision.organization_id = $1 AND revision.time_record_id = $2`,
      [ids.organizationA, recoveredRecord],
    );
    expect(recovered.rows[0]).toEqual({
      accepted_work_location_id: null,
      current_resource_location_id: location.aHome,
    });
  });

  it('runs migration 019 in its own rollbackable transaction without changing T-015b authority', async () => {
    const database = 'taptime_019_rollback_check';
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerConnectionString);
    url.pathname = `/${database}`;
    const rollbackPool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await applyMigrationSet(rollbackPool, migrations.slice(0, 18));
      const before = await rollbackPool.query<{ definition: string }>(
        `SELECT pg_catalog.pg_get_functiondef(
           '${B3_SCHEMA}.has_membership_management_authority_v1(uuid,uuid,uuid,text,uuid,text)'
             ::regprocedure
         ) AS definition`,
      );
      const client = await rollbackPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migrations[18]!.sql);
        const during = await client.query<{
          relation: string | null;
          flag: string | null;
          definition: string;
        }>(
          `SELECT
             to_regclass('${B3_SCHEMA}.locations')::text AS relation,
             (
               SELECT column_name FROM information_schema.columns
               WHERE table_schema = '${B3_SCHEMA}'
                 AND table_name = 'organizations'
                 AND column_name = 'locations_enabled'
             ) AS flag,
             pg_catalog.pg_get_functiondef(
               '${B3_SCHEMA}.has_membership_management_authority_v1(uuid,uuid,uuid,text,uuid,text)'
                 ::regprocedure
             ) AS definition`,
        );
        expect(during.rows[0]).toEqual({
          relation: `${B3_SCHEMA}.locations`,
          flag: 'locations_enabled',
          definition: before.rows[0]!.definition,
        });
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      const after = await rollbackPool.query<{
        relation: string | null;
        flag_count: number;
        transition: string | null;
      }>(
        `SELECT
           to_regclass('${B3_SCHEMA}.locations')::text AS relation,
           (
             SELECT count(*)::integer FROM information_schema.columns
             WHERE table_schema = '${B3_SCHEMA}'
               AND table_name = 'organizations'
               AND column_name = 'locations_enabled'
           ) AS flag_count,
           to_regprocedure(
             '${B3_SCHEMA}.set_organization_locations_enabled_v1(uuid,boolean)'
           )::text AS transition`,
      );
      expect(after.rows[0]).toEqual({ relation: null, flag_count: 0, transition: null });
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: rollbackPool,
        installerPool,
        databaseName: database,
      });
    }
  }, 30_000);
});
