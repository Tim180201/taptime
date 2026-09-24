import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { applyMigrationSet, loadMigrations, migrate, B3_SCHEMA, B3_MIGRATION_TABLE } from '@taptime/backend-schema';
import { CustomerId, NfcTagId, NfcAssignmentId } from '@taptime/core';
import { PostgresIdentityMembershipResolver } from '@taptime/backend-identity';
import { AdminWriteSessionCoordinator, NfcTagReassignmentCoordinator, EmployeeMembershipEnrollmentCoordinator } from '../src/index.js';
import { seedC3C, truncateC3C, ids, membershipIds, fixtureTokens, fixtureAccessTokenVerifier } from './fixtures.js';

const url = process.env.C3C_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c';
const pool = new Pool({ connectionString: url, max: 4 });
const setup = new AdminWriteSessionCoordinator(pool, fixtureAccessTokenVerifier);
const reassign = new NfcTagReassignmentCoordinator(pool, fixtureAccessTokenVerifier);
const enrollment = new EmployeeMembershipEnrollmentCoordinator(pool, pool, fixtureAccessTokenVerifier);
const manager = { accessToken: fixtureTokens.employeeA, expectedMembershipId: membershipIds.employeeA };
const admin = { accessToken: fixtureTokens.adminA, expectedMembershipId: membershipIds.adminA };
const locationA = '51000000-0000-4000-8000-000000000001';
const locationB = '51000000-0000-4000-8000-000000000002';
const foreignLocation = '51000000-0000-4000-8000-000000000003';
const otherCustomer = '21000000-0000-4000-8000-000000000001';
const foreignTag = '31000000-0000-4000-8000-000000000001';
const otherTag = '31000000-0000-4000-8000-000000000002';
const otherAssignment = '41000000-0000-4000-8000-000000000002';

async function seedLocations(enabled = true) {
  await pool.query(`UPDATE taptime_server.memberships SET role = 'standortleitung', row_version = row_version + 1 WHERE id = $1`, [ids.membershipEmployeeA]);
  await pool.query(`INSERT INTO taptime_server.locations (id, organization_id, display_name)
    VALUES ($1, $4, 'Standort A'), ($2, $4, 'Standort B'), ($3, $5, 'Zweiter Betrieb')`,
  [locationA, locationB, foreignLocation, ids.organizationA, ids.organizationB]);
  await pool.query(`INSERT INTO taptime_server.customers (id, organization_id, display_name, active)
    VALUES ($1, $3, 'Zweites Ziel in A', true), ($2, $3, 'Ziel in B', true)`, [ids.targetCustomerA, otherCustomer, ids.organizationA]);
  await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments (id, organization_id, membership_id, location_id)
    SELECT gen_random_uuid(), organization_id, id, CASE WHEN organization_id = $1 THEN $2::uuid ELSE $3::uuid END
    FROM taptime_server.memberships`, [ids.organizationA, locationA, foreignLocation]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
    SELECT gen_random_uuid(), organization_id, target_type, target_id,
      CASE WHEN organization_id = $1 THEN CASE WHEN target_id = $4 THEN $3::uuid ELSE $2::uuid END ELSE $5::uuid END
    FROM taptime_server.work_targets WHERE active`, [ids.organizationA, locationA, locationB, otherCustomer, foreignLocation]);
  await pool.query(`INSERT INTO taptime_server.membership_management_location_grants (id, organization_id, membership_id, location_id)
    VALUES (gen_random_uuid(), $1, $2, $3)`, [ids.organizationA, ids.membershipEmployeeA, locationA]);
  await pool.query(`INSERT INTO taptime_server.nfc_tags (id, organization_id, display_name, payload_value)
    VALUES ($1, $3, 'Fremder Tag', 'nfc:uid:v1:DD'), ($2, $4, 'Standort B Tag', 'nfc:uid:v1:EE')`,
  [foreignTag, otherTag, ids.organizationB, ids.organizationA]);
  await pool.query(`INSERT INTO taptime_server.nfc_assignments (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
    VALUES (gen_random_uuid(), $1, $2, 'customer', $3, true), ($4, $5, $6, 'customer', $7, true)`,
  [ids.organizationB, foreignTag, ids.customerB, otherAssignment, ids.organizationA, otherTag, otherCustomer]);
  if (enabled) await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = true, row_version = row_version + 1`);
}

async function sql<Value>(role: string, operation: (client: PoolClient) => Promise<Value>, asAdmin = false): Promise<Value> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true),
      set_config('app.membership_id', $3, true), set_config('app.membership_role', $4, true), set_config('app.correlation_id', $5, true)`,
    [ids.organizationA, asAdmin ? ids.adminA : ids.employeeA, asAdmin ? ids.membershipAdminA : ids.membershipEmployeeA,
      asAdmin ? 'administrator' : 'standortleitung', randomUUID()]);
    await client.query(`SET LOCAL ROLE ${role}`);
    return await operation(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}
const provision = (customerId = ids.customerA as string) => ({ ...manager, commandId: randomUUID(),
  customerId: CustomerId(customerId), displayName: 'Neuer Tag', canonicalPayload: 'nfc:uid:v1:AABB' });
const move = (target = ids.targetCustomerA as string, tag = ids.tagAssignedA as string, assignment = ids.assignmentA as string) => ({
  ...manager, commandId: randomUUID(), nfcTagId: NfcTagId(tag), expectedActiveAssignmentId: NfcAssignmentId(assignment), targetCustomerId: CustomerId(target),
});
async function session(actor: { accessToken: string; expectedMembershipId: typeof manager.expectedMembershipId } = manager) {
  const resolver = new PostgresIdentityMembershipResolver(pool);
  const verified = await fixtureAccessTokenVerifier.verify(actor.accessToken);
  if (verified.status !== 'verified') throw new Error('fixture token');
  const result = await resolver.resolve(verified.identity);
  if (result.status !== 'resolved') throw new Error('fixture membership');
  return resolver.resolveAdministrationSession(result.membership);
}

beforeAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(pool);
});
beforeEach(async () => { await truncateC3C(pool); await seedC3C(pool); await seedLocations(); });
afterAll(async () => { await pool.end(); });

describe('T060 SQL NFC authority and coordinator seam', () => {
  it.each([otherCustomer, ids.customerB, ids.inactiveCustomerA])('a: refuses foreign or unlocated customer %s without tag or receipt', async (customer) => {
    const command = provision(customer);
    await expect(setup.provisionNfcTag(command)).resolves.toEqual({ status: 'forbidden' });
    expect((await pool.query(`SELECT command_id FROM taptime_server.admin_setup_command_receipts WHERE command_id = $1`, [command.commandId])).rows).toEqual([]);
    expect((await pool.query(`SELECT id FROM taptime_server.nfc_tags WHERE payload_value = $1`, [command.canonicalPayload])).rows).toEqual([]);
  });
  it('a: SQL itself rejects an active customer with no location, including the NULL-customer read scope', async () => {
    await sql('taptime_admin_setup', async (client) => {
      await client.query('RESET ROLE');
      await client.query(`UPDATE taptime_server.work_target_location_assignments SET revoked_at = transaction_timestamp()
        WHERE organization_id = $1 AND location_id = $2 AND revoked_at IS NULL`, [ids.organizationA, locationA]);
      await client.query('SET LOCAL ROLE taptime_admin_setup');
      const result = await client.query(`SELECT taptime_server.has_current_nfc_setup_authority_v1($1, $2) AS customer,
        taptime_server.has_current_nfc_setup_authority_v1($1, NULL) AS any_customer`, [ids.organizationA, ids.customerA]);
      expect(result.rows).toEqual([{ customer: false, any_customer: false }]);
      expect((await client.query('SELECT id FROM taptime_server.customers')).rows).toEqual([]);
    });
  });
  it('b: provisions and replays in A, retaining the real membership role in the receipt', async () => {
    const command = provision();
    await expect(setup.provisionNfcTag(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: false });
    await expect(setup.provisionNfcTag(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: true });
    expect((await pool.query(`SELECT actor_membership_role, membership_id FROM taptime_server.admin_setup_command_receipts WHERE command_id = $1`,
      [command.commandId])).rows).toEqual([{ actor_membership_role: 'standortleitung', membership_id: ids.membershipEmployeeA }]);
  });
  it.each(['revoked', 'disabled'] as const)('c: revokes effective NFC authority (%s), including retries and projection', async (kind) => {
    const command = provision();
    expect((await setup.provisionNfcTag(command)).status).toBe('succeeded');
    if (kind === 'revoked') await pool.query(`UPDATE taptime_server.membership_management_location_grants SET revoked_at = transaction_timestamp() WHERE membership_id = $1`, [ids.membershipEmployeeA]);
    else await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = false, row_version = row_version + 1 WHERE id = $1`, [ids.organizationA]);
    await expect(setup.provisionNfcTag(command)).resolves.toEqual({ status: 'forbidden' });
    await expect(setup.readSetupProjection({ ...manager, cursor: null, limit: 20 })).resolves.toEqual({ status: 'forbidden' });
    await expect(session()).resolves.toMatchObject({ projection: { nfcSetupAvailable: false, availableSections: ['own_time', 'manual_capture'] } });
    await sql('taptime_admin_setup', async (client) => {
      for (const table of ['customers', 'nfc_tags', 'nfc_assignments', 'admin_setup_command_receipts', 'admin_break_tag_command_receipts']) {
        expect((await client.query(`SELECT 1 FROM taptime_server.${table}`)).rows).toEqual([]);
      }
    });
  });
  it('d: leaves customer creation and location lifecycle administrator-only even with an NFC grant', async () => {
    await expect(setup.createCustomer({ ...manager, commandId: randomUUID(), displayName: 'Verboten' })).resolves.toEqual({ status: 'forbidden' });
    await expect(setup.mutateLocationSetup({ ...manager, commandId: randomUUID(), action: 'create_location', locationId: randomUUID(), displayName: 'Verboten' })).resolves.toEqual({ status: 'forbidden' });
    await expect(setup.mutateLocationSetup({ ...manager, commandId: randomUUID(), action: 'set_locations_enabled', enabled: false })).resolves.toEqual({ status: 'forbidden' });
  });
  it.each([
    [otherCustomer, ids.tagAssignedA, ids.assignmentA],
    [ids.customerB, ids.tagAssignedA, ids.assignmentA],
    [ids.targetCustomerA, otherTag, otherAssignment],
  ])('e: refuses reassignment across source/target location or tenant boundary (%s)', async (target, tag, assignment) => {
    const command = move(target, tag, assignment);
    await expect(reassign.reassignNfcTag(command)).resolves.toEqual({ status: 'forbidden' });
    expect((await pool.query(`SELECT active FROM taptime_server.nfc_assignments WHERE id = $1`, [assignment])).rows).toEqual([{ active: true }]);
    expect((await pool.query(`SELECT 1 FROM taptime_server.admin_setup_command_receipts WHERE command_id = $1`, [command.commandId])).rows).toEqual([]);
  });
  it('e: reassigns and replays within A, keeping history and real role', async () => {
    const command = move();
    await expect(reassign.reassignNfcTag(command)).resolves.toMatchObject({ status: 'succeeded', assignmentChanged: true, idempotentRetry: false });
    await expect(reassign.reassignNfcTag(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: true });
    expect((await pool.query(`SELECT actor_membership_role FROM taptime_server.admin_setup_command_receipts WHERE command_id = $1`, [command.commandId])).rows).toEqual([{ actor_membership_role: 'standortleitung' }]);
    expect((await pool.query(`SELECT active FROM taptime_server.nfc_assignments WHERE id = $1`, [ids.assignmentA])).rows).toEqual([{ active: false }]);
  });
  it.each([true, false])('e: still blocks reassignment while work is running (Location captured: %s)', async (locationsEnabledAtStart) => {
    if (!locationsEnabledAtStart) await pool.query(`UPDATE taptime_server.organizations
      SET locations_enabled = false, row_version = row_version + 1 WHERE id = $1`, [ids.organizationA]);
    const eventId = randomUUID();
    const entryId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO taptime_server.work_events (
        id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
        triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm, content_hash_version
      ) VALUES ($1, $2, $3, $4, 'customer', $5, $6, '2026-07-18T08:00:00Z', $7, 'sha256', 1)`,
      [eventId, ids.organizationA, ids.assignmentA, ids.tagAssignedA, ids.customerA, ids.employeeA, 'a'.repeat(64)]);
      await client.query(`INSERT INTO taptime_server.time_entries (
        id, organization_id, user_id, target_type, target_customer_id, status, start_work_event_id, started_at
      ) VALUES ($1, $2, $3, 'customer', $4, 'started', $5, '2026-07-18T08:00:00Z')`,
      [entryId, ids.organizationA, ids.employeeA, ids.customerA, eventId]);
      await client.query(`INSERT INTO taptime_server.canonical_decisions (
        work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
        decision_type, time_entry_id, engine_version, decision_payload
      ) VALUES ($1, $2, $3, 'customer', $4, 'time_entry_started', $5, 'core-0.1.0', '{"status":"time_entry_started"}')`,
      [eventId, ids.organizationA, ids.employeeA, ids.customerA, entryId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    if (!locationsEnabledAtStart) await pool.query(`UPDATE taptime_server.organizations
      SET locations_enabled = true, row_version = row_version + 1 WHERE id = $1`, [ids.organizationA]);
    await expect(reassign.reassignNfcTag(move())).resolves.toMatchObject({ status: 'assignment_in_use' });
    expect((await pool.query(`SELECT active FROM taptime_server.nfc_assignments WHERE id = $1`, [ids.assignmentA])).rows).toEqual([{ active: true }]);
  });
  it.each([
    ['employee', locationA, 'succeeded'], ['employee', locationB, 'forbidden'],
    ['employee', foreignLocation, 'forbidden'], ['standortleitung', locationA, 'forbidden'], ['administrator', locationA, 'forbidden'],
  ] as const)('f: existing invitation authority %s at %s remains %s', async (role, locationId, status) => {
    await expect(enrollment.createInvitation({ ...manager, commandId: randomUUID(), displayName: 'Neue Person', role, locationId })).resolves.toMatchObject({ status });
  });
  it('g: SQL and backend session separate NFC from general setup for manager/admin/employee', async () => {
    await expect(session()).resolves.toMatchObject({ projection: { nfcSetupAvailable: true, availableSections: ['employees', 'time_records', 'review_items', 'own_time', 'manual_capture'] } });
    await expect(session(admin)).resolves.toMatchObject({ projection: { nfcSetupAvailable: true, availableSections: expect.arrayContaining(['setup']) } });
    await sql('taptime_identity_resolver', async (client) => {
      expect((await client.query(`SELECT setup_available, nfc_setup_available FROM taptime_server.read_administration_session_v2($1, $2, $3)`,
        [ids.organizationA, ids.employeeA, ids.membershipEmployeeA])).rows).toEqual([{ setup_available: false, nfc_setup_available: true }]);
    });
    await pool.query(`UPDATE taptime_server.memberships SET role = 'employee', row_version = row_version + 1 WHERE id = $1`, [ids.membershipEmployeeA]);
    await expect(session()).resolves.toMatchObject({ projection: { nfcSetupAvailable: false } });
  });
  it('b/g: serves only scoped customers/tags; permits a break tag through the NULL-customer authority', async () => {
    const command = { ...manager, commandId: randomUUID(), displayName: 'Pause', canonicalPayload: 'nfc:uid:v1:CC' };
    await expect(setup.provisionBreakNfcTag(command)).resolves.toMatchObject({ status: 'succeeded' });
    await expect(setup.provisionBreakNfcTag(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: true });
    const projection = await setup.readSetupProjection({ ...manager, cursor: null, limit: 20 });
    expect(projection.status).toBe('succeeded');
    if (projection.status !== 'succeeded') throw new Error('Expected projection');
    expect(projection.customers.map(c => c.id).sort()).toEqual([ids.customerA, ids.targetCustomerA].sort());
    expect(projection.nfcTags.map(t => t.displayName).sort()).toEqual(['Assigned Tag A', 'Pause']);
    for (const role of ['taptime_admin_setup', 'taptime_assignment_reassigner']) {
      await sql(role, async (client) => {
        const tags = (await client.query('SELECT id FROM taptime_server.nfc_tags')).rows.map(r => r.id);
        expect(tags).toContain(ids.tagAssignedA);
        expect(tags).not.toContain(otherTag);
        expect(tags).not.toContain(foreignTag);
        expect(tags).not.toContain(ids.tagUnassignedA);
        expect((await client.query(`SELECT 1 FROM taptime_server.nfc_assignments WHERE id = $1`, [otherAssignment])).rows).toEqual([]);
      });
    }
  });
  it('a/e: direct SQL locks and assignment writes cannot bypass the customer scope', async () => {
    for (const role of ['taptime_admin_setup', 'taptime_assignment_reassigner']) {
      const fn = role === 'taptime_admin_setup' ? 'lock_admin_setup_active_customer_v1' : 'lock_assignment_reassignment_target_v1';
      await expect(sql(role, client => client.query(`SELECT * FROM taptime_server.${fn}($1, $2)`, [ids.organizationA, otherCustomer]))).rejects.toMatchObject({ code: '42501' });
      await expect(sql(role, client => client.query(`INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active) VALUES ($1, $2, $3, 'customer', $4, true)`,
      [randomUUID(), ids.organizationA, ids.tagUnassignedA, otherCustomer]))).rejects.toMatchObject({ code: '42501' });
    }
  });
  it('g: rejects a forged administrator setting for a real manager', async () => {
    await sql('taptime_admin_setup', async client => {
      await client.query(`SELECT set_config('app.membership_role', 'administrator', true)`);
      expect((await client.query(`SELECT taptime_server.has_current_nfc_setup_authority_v1($1, $2) AS allowed`, [ids.organizationA, ids.customerA])).rows).toEqual([{ allowed: false }]);
    });
  });
});

it('migration 027: upgrades a populated 026 database without rewriting existing application rows', async () => {
  // This suite owns its disposable database; the next beforeEach reseeds after the upgrade.
  await pool.query(`DROP SCHEMA ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE ${B3_MIGRATION_TABLE}`);
  const migrations = await loadMigrations();
  await applyMigrationSet(pool, migrations.filter(m => m.version < '027'));
  await seedC3C(pool);
  await seedLocations(false); // Includes customers with and without locations, and a live grant.
  const historicalCommand = { ...admin, commandId: randomUUID(), displayName: 'Aktiver Kunde ohne Standort' };
  expect((await setup.createCustomer(historicalCommand)).status).toBe('succeeded');
  const tables = ['organizations', 'memberships', 'customers', 'work_targets', 'locations',
    'work_target_location_assignments', 'membership_management_location_grants', 'nfc_tags', 'nfc_assignments',
    'admin_setup_command_receipts', 'audit_events'];
  // Compare the columns that existed before the upgrade; additive migrations may
  // introduce new defaults without rewriting any of the original values.
  const columns = await Promise.all(tables.map(async table => (await pool.query<{column_name:string}>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='taptime_server'
      AND table_name=$1 ORDER BY ordinal_position`,[table],
  )).rows.map(row => `"${row.column_name.replaceAll('"','""')}"`).join(',')));
  const snapshot = async () => Promise.all(tables.map(async (table,index) => (await pool.query(
    `SELECT to_jsonb(r) AS row FROM (SELECT ${columns[index]} FROM taptime_server.${table}) r ORDER BY to_jsonb(r)::text`,
  )).rows));
  const before = await snapshot();
  const result = await migrate(pool);
  expect(result.applied).toEqual(migrations.filter(m => m.version >= '027').map(m => m.version));
  expect(await snapshot()).toEqual(before);
  expect((await pool.query(`SELECT actor_membership_role FROM taptime_server.admin_setup_command_receipts
    WHERE command_id = $1`, [historicalCommand.commandId])).rows).toEqual([{ actor_membership_role: null }]);
  expect((await migrate(pool)).applied).toEqual([]);
  expect((await setup.createCustomer({ ...admin, commandId: randomUUID(), displayName: 'Bestand bleibt bedienbar' })).status).toBe('succeeded');
});
