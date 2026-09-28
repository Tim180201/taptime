import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { applyMigrationSet, loadMigrations, migrate, B3_SCHEMA, B3_MIGRATION_TABLE } from '@taptime/backend-schema';
import { AdminWriteSessionCoordinator } from '../src/index.js';
import { seedC3C, truncateC3C, ids, membershipIds, fixtureTokens, fixtureAccessTokenVerifier } from './fixtures.js';

const pool = new Pool({ connectionString: process.env.C3C_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c', max: 4 });
const setup = new AdminWriteSessionCoordinator(pool, fixtureAccessTokenVerifier);
const admin = { accessToken: fixtureTokens.adminA, expectedMembershipId: membershipIds.adminA };
const locationA = '51000000-0000-4000-8000-000000000001';
const locationB = '51000000-0000-4000-8000-000000000002';
const foreignLocation = '51000000-0000-4000-8000-000000000003';

beforeAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(pool);
});
beforeEach(async () => {
  await truncateC3C(pool);
  await seedC3C(pool);
  await pool.query(`INSERT INTO taptime_server.locations (id, organization_id, display_name)
    VALUES ($1, $4, 'Standort A'), ($2, $4, 'Standort B'), ($3, $5, 'Anderer Betrieb')`,
  [locationA, locationB, foreignLocation, ids.organizationA, ids.organizationB]);
  await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments (id, organization_id, membership_id, location_id)
    SELECT gen_random_uuid(), organization_id, id, CASE WHEN organization_id = $1 THEN $2::uuid ELSE $3::uuid END
    FROM taptime_server.memberships`, [ids.organizationA, locationA, foreignLocation]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
    SELECT gen_random_uuid(), organization_id, target_type, target_id,
      CASE WHEN organization_id = $1 THEN $2::uuid ELSE $3::uuid END
    FROM taptime_server.work_targets WHERE active`, [ids.organizationA, locationA, foreignLocation]);
  await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = true, row_version = row_version + 1`);
});
afterAll(async () => { await pool.end(); });

it('T086 A: administrator creates a customer with its location in one committed transaction', async () => {
  const command = { ...admin, commandId: randomUUID(), displayName: 'Neuer Kunde', locationId: locationA };
  let beforeCommit = false;
  let outcome: unknown;
  try {
    outcome = await setup.createCustomer(command, { beforeCommit: () => { beforeCommit = true; } });
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    outcome = { errorCode: failure.code, message: failure.message, beforeCommit };
  }
  expect(outcome).toMatchObject({ status: 'succeeded', idempotentRetry: false });
});

const manager = { accessToken: fixtureTokens.employeeA, expectedMembershipId: membershipIds.employeeA };
async function grantManager() {
  await pool.query(`UPDATE taptime_server.memberships SET role = 'standortleitung', row_version = row_version + 1 WHERE id = $1`, [ids.membershipEmployeeA]);
  await pool.query(`INSERT INTO taptime_server.membership_management_location_grants (id, organization_id, membership_id, location_id)
    VALUES (gen_random_uuid(), $1, $2, $3)`, [ids.organizationA, ids.membershipEmployeeA, locationA]);
}
const create = (actor: { accessToken: string; expectedMembershipId: typeof admin.expectedMembershipId } = admin, locationId: string | undefined = locationA) => ({ ...actor, commandId: randomUUID(), displayName: 'Neuer Kunde', ...(locationId === undefined ? {} : { locationId }) });

it('requires a location when enabled and rejects one when disabled; retains the old no-location command', async () => {
  await expect(setup.createCustomer({ ...admin, commandId: randomUUID(), displayName: 'Ohne Standort' })).resolves.toEqual({ status: 'location_required' });
  await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = false, row_version = row_version + 1`);
  await expect(setup.createCustomer(create())).resolves.toEqual({ status: 'invalid_request' });
  const command = { ...admin, commandId: randomUUID(), displayName: 'Ohne Standort' };
  await expect(setup.createCustomer(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: false });
  await expect(setup.createCustomer(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: true });
});
it.each([locationB, foreignLocation, '51000000-0000-4000-8000-000000000099'])('manager cannot create in another/missing location %s', async locationId => {
  await grantManager();
  const command = create(manager, locationId);
  await expect(setup.createCustomer(command)).resolves.toEqual({ status: 'forbidden' });
  expect((await pool.query('SELECT 1 FROM taptime_server.admin_setup_command_receipts WHERE command_id = $1', [command.commandId])).rows).toEqual([]);
  expect((await pool.query('SELECT 1 FROM taptime_server.customers WHERE display_name = $1', [command.displayName])).rows).toEqual([]);
});
it('administrator cannot create in a foreign or inactive location', async () => {
  await expect(setup.createCustomer(create(admin, foreignLocation))).resolves.toEqual({ status: 'forbidden' });
  await pool.query(`UPDATE taptime_server.locations SET active = false, deactivated_at = transaction_timestamp(), row_version = row_version + 1 WHERE id = $1`, [locationB]);
  await expect(setup.createCustomer(create(admin, locationB))).resolves.toEqual({ status: 'forbidden' });
});
it('manager creates, sees and replays exactly one customer, binding and receipt with the real role', async () => {
  await grantManager();
  const command = create(manager);
  const first = await setup.createCustomer(command);
  expect(first.status).toBe('succeeded');
  if (first.status !== 'succeeded') throw new Error('customer not created');
  await expect(setup.createCustomer(command)).resolves.toEqual({ ...first, idempotentRetry: true });
  expect((await pool.query(`SELECT customer_location_id, actor_membership_role FROM taptime_server.admin_setup_command_receipts WHERE command_id = $1`, [command.commandId])).rows)
    .toEqual([{ customer_location_id: locationA, actor_membership_role: 'standortleitung' }]);
  expect((await pool.query(`SELECT location_id FROM taptime_server.work_target_location_assignments WHERE target_id = $1 AND revoked_at IS NULL`, [first.customer.id])).rows).toEqual([{ location_id: locationA }]);
  expect((await pool.query(`SELECT event_type FROM taptime_server.audit_events WHERE correlation_id = $1 ORDER BY event_type`, [command.commandId])).rows)
    .toEqual([{ event_type: 'CustomerCreated' }, { event_type: 'WorkTargetLocationAssigned' }]);
  await expect(setup.readSetupProjection({ ...manager, cursor: null, limit: 20 })).resolves.toMatchObject({ status: 'succeeded', customers: expect.arrayContaining([first.customer]) });
  await pool.query(`UPDATE taptime_server.membership_management_location_grants SET revoked_at = transaction_timestamp() WHERE membership_id = $1`, [ids.membershipEmployeeA]);
  await expect(setup.createCustomer(command)).resolves.toEqual({ status: 'forbidden' });
});
it('same command with a different allowed location or name conflicts and cannot add a second customer', async () => {
  const command = create();
  await expect(setup.createCustomer(command)).resolves.toMatchObject({ status: 'succeeded' });
  await expect(setup.createCustomer({ ...command, locationId: locationB })).resolves.toEqual({ status: 'command_id_conflict' });
  await expect(setup.createCustomer({ ...command, displayName: 'Anderer Name' })).resolves.toEqual({ status: 'command_id_conflict' });
  expect((await pool.query(`SELECT count(*)::integer AS count FROM taptime_server.customers WHERE display_name = $1`, [command.displayName])).rows).toEqual([{ count: 1 }]);
});
it('administrator can replay committed commands after changing the optional-location setting', async () => {
  const located = create();
  const first = await setup.createCustomer(located);
  expect(first.status).toBe('succeeded');
  await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = false, row_version = row_version + 1`);
  await expect(setup.createCustomer(located)).resolves.toEqual({ ...first, idempotentRetry: true });
  const legacy = { ...admin, commandId: randomUUID(), displayName: 'Vor Aktivierung' };
  const second = await setup.createCustomer(legacy);
  if (second.status !== 'succeeded') throw new Error('legacy customer missing');
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
    VALUES (gen_random_uuid(), $1, 'customer', $2, $3)`, [ids.organizationA, second.customer.id, locationA]);
  await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = true, row_version = row_version + 1`);
  await expect(setup.createCustomer(legacy)).resolves.toEqual({ ...second, idempotentRetry: true });
});
it('employee and manager with disabled locations cannot create', async () => {
  await expect(setup.createCustomer(create(manager))).resolves.toEqual({ status: 'forbidden' });
  await grantManager();
  await pool.query(`UPDATE taptime_server.organizations SET locations_enabled = false, row_version = row_version + 1`);
  await expect(setup.createCustomer(create(manager))).resolves.toEqual({ status: 'forbidden' });
  await expect(setup.createCustomer({ ...manager, commandId: randomUUID(), displayName: 'Ohne Standort' })).resolves.toEqual({ status: 'forbidden' });
});
it('rolls customer, location, audit and receipt back together if the operation fails before commit', async () => {
  await grantManager();
  const command = create(manager);
  await expect(setup.createCustomer(command, { beforeCommit() { throw new Error('injected'); } })).rejects.toThrow('injected');
  expect((await pool.query(`SELECT 1 FROM taptime_server.customers WHERE display_name = $1`, [command.displayName])).rows).toEqual([]);
  expect((await pool.query(`SELECT 1 FROM taptime_server.audit_events WHERE correlation_id = $1`, [command.commandId])).rows).toEqual([]);
  await expect(setup.createCustomer(command)).resolves.toMatchObject({ status: 'succeeded', idempotentRetry: false });
});

async function sql(operation: (client: import('pg').PoolClient) => Promise<unknown>, locationId = locationA) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true),
      set_config('app.membership_id', $3, true), set_config('app.membership_role', 'standortleitung', true),
      set_config('app.correlation_id', $4, true), set_config('app.customer_creation_location_id', $5, true)`,
    [ids.organizationA, ids.employeeA, ids.membershipEmployeeA, randomUUID(), locationId]);
    await client.query('SET LOCAL ROLE taptime_admin_setup');
    return await operation(client);
  } finally { await client.query('ROLLBACK'); client.release(); }
}
it.each([locationB, foreignLocation])('RLS itself rejects a customer insert for disallowed location %s', async locationId => {
  await grantManager();
  await expect(sql(client => client.query(`INSERT INTO taptime_server.customers (id, organization_id, display_name, active)
    VALUES ($1, $2, 'SQL forbidden', true)`, [randomUUID(), ids.organizationA]), locationId)).rejects.toMatchObject({ code: '42501' });
});
it('RLS rejects foreign-tenant inserts even when the chosen location is managed', async () => {
  await grantManager();
  await expect(sql(client => client.query(`INSERT INTO taptime_server.customers (id, organization_id, display_name, active)
    VALUES ($1, $2, 'SQL forbidden', true)`, [randomUUID(), ids.organizationB]))).rejects.toMatchObject({ code: '42501' });
});
it('RLS rejects binding a new customer outside the managed location, and rejects binding existing customers', async () => {
  await grantManager();
  for (const locationId of [locationB, foreignLocation]) {
    await expect(sql(async client => {
      const customerId = randomUUID();
      await client.query(`INSERT INTO taptime_server.customers (id, organization_id, display_name, active) VALUES ($1, $2, 'SQL new', true)`, [customerId, ids.organizationA]);
      await client.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
        VALUES ($1, $2, 'customer', $3, $4)`, [randomUUID(), ids.organizationA, customerId, locationId]);
    })).rejects.toMatchObject({ code: '42501' });
  }
  await expect(sql(client => client.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
    VALUES ($1, $2, 'customer', $3, $4)`, [randomUUID(), ids.organizationA, ids.customerA, locationA]))).rejects.toMatchObject({ code: '42501' });
});
it('a forged role, location lifecycle changes and binding revocation stay forbidden in SQL', async () => {
  await grantManager();
  await sql(async client => {
    await client.query(`SELECT set_config('app.membership_role', 'administrator', true)`);
    expect((await client.query(`SELECT taptime_server.has_current_customer_creation_authority_v1($1, $2) AS allowed`, [ids.organizationA, locationA])).rows).toEqual([{ allowed: false }]);
  });
  await expect(sql(client => client.query(`INSERT INTO taptime_server.locations (id, organization_id, display_name) VALUES ($1, $2, 'Forbidden')`, [randomUUID(), ids.organizationA]))).rejects.toMatchObject({ code: '42501' });
  await sql(async client => {
    expect((await client.query(`UPDATE taptime_server.work_target_location_assignments SET revoked_at = transaction_timestamp() WHERE organization_id = $1`, [ids.organizationA])).rowCount).toBe(0);
  });
});

it('upgrades 034 with existing customers and receipts without changing their history or legacy replay', async () => {
  const migrations = await loadMigrations();
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await applyMigrationSet(pool, migrations.filter(migration => migration.version < '035'));
  await seedC3C(pool);
  const command = { ...admin, commandId: randomUUID(), displayName: 'Vor Migration' };
  const created = await setup.createCustomer(command);
  expect(created.status).toBe('succeeded');
  const snapshot = async () => ({
    customers: (await pool.query('SELECT * FROM taptime_server.customers ORDER BY id')).rows,
    audits: (await pool.query('SELECT * FROM taptime_server.audit_events ORDER BY id')).rows,
    receipts: (await pool.query('SELECT command_id, request_hash, result_customer_id, actor_membership_role FROM taptime_server.admin_setup_command_receipts ORDER BY command_id')).rows,
  });
  const before = await snapshot();
  const result = await applyMigrationSet(pool, migrations);
  expect(result.applied).toEqual(migrations.filter(migration => migration.version >= '035').map(migration => migration.version));
  expect(await snapshot()).toEqual(before);
  await expect(setup.createCustomer(command)).resolves.toEqual({ ...created, idempotentRetry: true });
});
