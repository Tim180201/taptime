import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '@taptime/backend-schema';
import { PostgresIdentityMembershipResolver } from '@taptime/backend-identity';
import { EmployeeMembershipEnrollmentCoordinator, SupabaseAccountInviter } from '../src/index.js';
import { C3E1_INVITATION_RUNTIME_LOGIN, C3E1_ENROLLMENT_RUNTIME_LOGIN, c3e1RuntimeConnectionString,
  ensureC3E1RuntimeLogins, removeC3E1RuntimeLogins, fixtureAccessTokenVerifier,
  fixtureTokens, membershipIds, ids, seedC3C, truncateC3C, syntheticPassword } from './fixtures.js';

const database = process.env.C3C_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c';
const issuer = 'https://synthetic.invalid/auth/v1';
const subject = '93000000-0000-4000-8000-000000000047';
const email = 'person@example.test';
// Synthetic, generated in memory, never a real service-role key.
const key = `test-service-role-${randomUUID()}`;
let installer: Pool;
let invitations: Pool;
let enrollment: Pool;
let coordinator: EmployeeMembershipEnrollmentCoordinator;
const diagnostics: unknown[] = [];
const remote = vi.fn<typeof fetch>();
const command = () => ({ accessToken: fixtureTokens.adminA, expectedMembershipId: membershipIds.adminA,
  commandId: randomUUID(), displayName: 'Neue Person', email, locationId: null });

beforeAll(async () => {
  installer = new Pool({ connectionString: database });
  await installer.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE; DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installer);
  const invitationPassword = syntheticPassword(); const enrollmentPassword = syntheticPassword();
  await ensureC3E1RuntimeLogins(installer, invitationPassword, enrollmentPassword);
  invitations = new Pool({ connectionString: c3e1RuntimeConnectionString(database, C3E1_INVITATION_RUNTIME_LOGIN, invitationPassword) });
  enrollment = new Pool({ connectionString: c3e1RuntimeConnectionString(database, C3E1_ENROLLMENT_RUNTIME_LOGIN, enrollmentPassword) });
});
beforeEach(async () => {
  await truncateC3C(installer); await seedC3C(installer);
  diagnostics.length = 0; remote.mockReset();
  remote.mockImplementation(async (input, init) => {
    // Only the double sees credentials. Boolean assertions cannot print their value.
    expect(new Headers(init?.headers).get('apikey') === key).toBe(true);
    const url = new URL(String(input));
    expect(url.origin).toBe('https://synthetic.invalid');
    if (url.pathname.endsWith('/admin/users')) return Response.json({ users: [] });
    expect(url.pathname).toBe('/auth/v1/invite');
    expect(url.searchParams.get('redirect_to')).toBe('https://admin.example.test/willkommen');
    return Response.json({ id: subject, email });
  });
  coordinator = new EmployeeMembershipEnrollmentCoordinator(invitations, enrollment, fixtureAccessTokenVerifier,
    new SupabaseAccountInviter(issuer, key, 'https://admin.example.test/willkommen', (d) => diagnostics.push(d), remote));
});
afterAll(async () => {
  await invitations?.end(); await enrollment?.end();
  if (installer) { await removeC3E1RuntimeLogins(installer); await installer.end(); }
});

async function counts() {
  const result = await installer.query(`SELECT
    (SELECT count(*) FROM taptime_server.users) AS users,
    (SELECT count(*) FROM taptime_server.memberships) AS memberships,
    (SELECT count(*) FROM taptime_server.identity_bindings) AS bindings,
    (SELECT count(*) FROM taptime_server.employee_account_invitation_receipts) AS receipts`);
  return result.rows[0];
}

describe('T-047 PostgreSQL account invitation', () => {
  it('creates the binding and membership atomically and resolves normal login without redeeming a code', async () => {
    const request = command();
    const result = await coordinator.createAccountInvitation(request);
    expect(result.status).toBe('succeeded');
    const resolved = await new PostgresIdentityMembershipResolver(invitations).resolve({ issuer, subject });
    expect(resolved).toMatchObject({ status: 'resolved', membership: { organizationId: ids.organizationA, role: 'employee' } });
    const legacy = await installer.query('SELECT count(*) FROM taptime_server.employee_membership_invitations');
    expect(legacy.rows[0].count).toBe('0');
    const calls = remote.mock.calls.length;
    expect(await coordinator.createAccountInvitation(request)).toEqual(result);
    expect(remote.mock.calls.length).toBe(calls);
    expect(await coordinator.createAccountInvitation({ ...request, displayName: 'Andere Person' }))
      .toEqual({ status: 'command_id_conflict' });
    expect(remote.mock.calls.length).toBe(calls);
  });

  it('repairs a rollback after provider success on the same command without a second account or mail', async () => {
    const accounts = new Map<string, { id: string; email: string }>();
    let mails = 0;
    remote.mockImplementation(async (input) => {
      if (new URL(String(input)).pathname.endsWith('/admin/users')) {
        return Response.json({ users: [...accounts.values()] });
      }
      if (accounts.has(email)) throw new Error('Unexpected second invitation');
      const account = { id: subject, email };
      accounts.set(email, account); mails += 1;
      return Response.json(account);
    });
    const before = await counts();
    const request = command();
    const result = await coordinator.createAccountInvitation(request, { beforeCommit: async () => {
      throw new Error('forced local rollback');
    } });
    expect(result).toEqual({ status: 'invitation_needs_attention' });
    expect(await counts()).toEqual(before);
    expect(diagnostics).toContainEqual(expect.objectContaining({ code: 'account_invitation_needs_attention', targetAccount: subject }));
    const repaired = await coordinator.createAccountInvitation(request);
    expect(repaired).toMatchObject({ status: 'succeeded_existing_account', membershipId: expect.any(String) });
    expect(await counts()).toEqual(Object.fromEntries(Object.entries(before).map(([name, count]) => [name, String(Number(count) + 1)])));
    expect(accounts.size).toBe(1);
    expect(mails).toBe(1);
    const calls = remote.mock.calls.length;
    expect(await coordinator.createAccountInvitation(request)).toEqual(repaired);
    expect(remote.mock.calls.length).toBe(calls);
    expect((await new PostgresIdentityMembershipResolver(invitations).resolve({ issuer, subject })).status).toBe('resolved');
  });

  it('does not create half a membership when Supabase refuses invitation', async () => {
    const before = await counts();
    remote.mockResolvedValueOnce(Response.json({ users: [] })).mockResolvedValueOnce(
      Response.json({ code: 'email_address_not_authorized', msg: `${key} ${email}` }, { status: 400 }));
    expect(await coordinator.createAccountInvitation(command())).toEqual({ status: 'invitation_delivery_failed' });
    expect(await counts()).toEqual(before);
    expect(JSON.stringify(diagnostics).includes(key)).toBe(false);
    expect(JSON.stringify(diagnostics).includes(email)).toBe(false);
  });

  it('works without a key, preserves other operations and rejects unauthorized callers before using credentials', async () => {
    const disabled = new EmployeeMembershipEnrollmentCoordinator(invitations, enrollment, fixtureAccessTokenVerifier);
    expect(await disabled.createAccountInvitation(command())).toEqual({ status: 'account_creation_not_configured' });
    expect((await disabled.readEmployeeMembershipsProjection({ accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA, cursor: null, limit: 20 })).status).toBe('succeeded');
    expect(await coordinator.createAccountInvitation({ ...command(), accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA })).toEqual({ status: 'forbidden' });
    expect(await coordinator.createAccountInvitation({ ...command(), expectedMembershipId: membershipIds.adminB }))
      .toEqual({ status: 'forbidden' });
    expect(remote.mock.calls.length).toBe(0);
  });

  it('distinguishes existing membership, former membership and unrelated existing account without tenant disclosure', async () => {
    await coordinator.createAccountInvitation(command());
    remote.mockImplementation(async () => Response.json({ users: [{ id: subject, email }] }));
    expect(await coordinator.createAccountInvitation(command())).toEqual({ status: 'membership_exists' });
    const binding = await installer.query('SELECT user_id FROM taptime_server.identity_bindings WHERE subject = $1', [subject]);
    const member = await installer.query('SELECT id FROM taptime_server.memberships WHERE user_id = $1', [binding.rows[0].user_id]);
    await coordinator.revokeMembership({ accessToken: fixtureTokens.adminA, expectedMembershipId: membershipIds.adminA,
      commandId: randomUUID(), targetMembershipId: member.rows[0].id, expectedRowVersion: 1 });
    expect(await coordinator.createAccountInvitation(command())).toEqual({ status: 'former_membership' });
    const bindingsBefore = await installer.query('SELECT * FROM taptime_server.identity_bindings ORDER BY id');
    expect(await coordinator.createAccountInvitation({ ...command(), accessToken: fixtureTokens.adminB,
      expectedMembershipId: membershipIds.adminB })).toEqual({ status: 'email_exists' });
    expect((await installer.query('SELECT * FROM taptime_server.identity_bindings ORDER BY id')).rows).toEqual(bindingsBefore.rows);
  });

  it('binds an existing Supabase account without any local binding and never calls the invite endpoint', async () => {
    const unboundSubject = randomUUID();
    remote.mockImplementation(async () => Response.json({ users: [{ id: unboundSubject, email }] }));
    const before = await counts();
    const request = command();
    const result = await coordinator.createAccountInvitation(request);
    expect(result).toMatchObject({ status: 'succeeded_existing_account', membershipId: expect.any(String) });
    expect(await counts()).toEqual(Object.fromEntries(Object.entries(before).map(([name, count]) => [name, String(Number(count) + 1)])));
    expect(remote.mock.calls.every(([input]) => new URL(String(input)).pathname.endsWith('/admin/users'))).toBe(true);
    const resolved = await new PostgresIdentityMembershipResolver(invitations).resolve({ issuer, subject: unboundSubject });
    expect(resolved).toMatchObject({ status: 'resolved', membership: { organizationId: ids.organizationA, role: 'employee' } });
    const calls = remote.mock.calls.length;
    expect(await coordinator.createAccountInvitation(request)).toEqual(result);
    expect(remote.mock.calls.length).toBe(calls);
  });

  it.each(['email_exists', 'user_already_exists'])('resolves provider %s through the binding instead of assuming another organization', async (code) => {
    remote.mockResolvedValueOnce(Response.json({ users: [] }))
      .mockResolvedValueOnce(Response.json({ code }, { status: 422 }))
      .mockResolvedValueOnce(Response.json({ users: [{ id: subject, email }] }));
    expect(await coordinator.createAccountInvitation(command()))
      .toMatchObject({ status: 'succeeded_existing_account', membershipId: expect.any(String) });
    expect(remote.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/invite')).length).toBe(1);
  });

  it('does not call an unresolved provider duplicate another organization', async () => {
    const before = await counts();
    remote.mockResolvedValueOnce(Response.json({ users: [] }))
      .mockResolvedValueOnce(Response.json({ code: 'email_exists' }, { status: 422 }))
      .mockResolvedValueOnce(Response.json({ users: [] }));
    expect(await coordinator.createAccountInvitation(command())).toEqual({ status: 'invitation_needs_attention' });
    expect(await counts()).toEqual(before);
  });

  it('never rewrites an existing binding without a membership or labels it another organization', async () => {
    await installer.query('INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject) VALUES ($1, $2, $3, $4)',
      [randomUUID(), ids.orphan, issuer, subject]);
    remote.mockImplementation(async () => Response.json({ users: [{ id: subject, email }] }));
    const before = await counts();
    const bindingsBefore = await installer.query('SELECT * FROM taptime_server.identity_bindings ORDER BY id');
    expect(await coordinator.createAccountInvitation(command())).toEqual({ status: 'invitation_needs_attention' });
    expect(await counts()).toEqual(before);
    expect((await installer.query('SELECT * FROM taptime_server.identity_bindings ORDER BY id')).rows).toEqual(bindingsBefore.rows);
  });

  it('binds an existing account with its location and rejects an existing member outside the manager scope', async () => {
    const locationId = randomUUID(); const otherLocationId = randomUUID();
    await coordinator.changeMembershipRole({ accessToken: fixtureTokens.adminA,
      expectedMembershipId: membershipIds.adminA, commandId: randomUUID(),
      targetMembershipId: membershipIds.employeeA, expectedRowVersion: 1, role: 'standortleitung' });
    await prepareLocations(locationId, otherLocationId);
    remote.mockImplementation(async () => Response.json({ users: [{ id: subject, email }] }));
    const managerCommand = { ...command(), accessToken: fixtureTokens.employeeA,
      expectedMembershipId: membershipIds.employeeA, locationId };
    const before = await counts();
    expect(await coordinator.createAccountInvitation(managerCommand, { beforeCommit: async () => {
      throw new Error('forced existing-account rollback');
    } })).toEqual({ status: 'invitation_service_unavailable' });
    expect(await counts()).toEqual(before);
    const result = await coordinator.createAccountInvitation(managerCommand);
    expect(result).toMatchObject({ status: 'succeeded_existing_account', membershipId: expect.any(String) });
    if (result.status !== 'succeeded_existing_account') throw new Error('Expected existing-account success');
    expect((await installer.query('SELECT location_id FROM taptime_server.membership_home_location_assignments WHERE membership_id = $1',
      [result.membershipId])).rows).toEqual([{ location_id: locationId }]);
    const beforeRejected = await counts();
    expect(await coordinator.createAccountInvitation({ ...managerCommand, commandId: randomUUID(), locationId: otherLocationId }))
      .toEqual({ status: 'forbidden' });
    const outOfScopeSubject = randomUUID();
    remote.mockImplementation(async () => Response.json({ users: [{ id: outOfScopeSubject, email: 'other@example.test' }] }));
    expect(await coordinator.createAccountInvitation({ ...command(), email: 'other@example.test', locationId: otherLocationId }))
      .toMatchObject({ status: 'succeeded_existing_account' });
    const beforeOutOfScope = await counts();
    expect(await coordinator.createAccountInvitation({ ...managerCommand, commandId: randomUUID(), email: 'other@example.test' }))
      .toEqual({ status: 'forbidden' });
    expect(await counts()).toEqual(beforeOutOfScope);
    expect(Number(beforeOutOfScope.memberships)).toBe(Number(beforeRejected.memberships) + 1);
    expect(remote.mock.calls.every(([input]) => new URL(String(input)).pathname.endsWith('/admin/users'))).toBe(true);
  });

  it('contains malicious exception text and logs every actual credential use without secrets', async () => {
    remote.mockResolvedValueOnce(Response.json({ users: [] })).mockRejectedValueOnce(new Error(`${key} ${email}`));
    const result = await coordinator.createAccountInvitation(command());
    expect(result).toEqual({ status: 'invitation_needs_attention' });
    const output = JSON.stringify({ result, diagnostics });
    expect(output.includes(key)).toBe(false);
    expect(output.includes(email)).toBe(false);
    expect(diagnostics.filter((d) => (d as { code: string }).code === 'account_invitation_provider_request').length)
      .toBe(remote.mock.calls.length);
  });
});

async function prepareLocations(locationId: string, otherLocationId: string): Promise<void> {
  const client = await installer.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO taptime_server.locations (id, organization_id, display_name)
      VALUES ($1, $3, 'Verwalteter Standort'), ($2, $3, 'Anderer Standort')`, [locationId, otherLocationId, ids.organizationA]);
    await client.query(`INSERT INTO taptime_server.membership_home_location_assignments (id, organization_id, membership_id, location_id)
      SELECT gen_random_uuid(), organization_id, id, $2 FROM taptime_server.memberships
      WHERE organization_id = $1 AND revoked_at IS NULL`, [ids.organizationA, locationId]);
    await client.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
      SELECT gen_random_uuid(), organization_id, target_type, target_id, $2 FROM taptime_server.work_targets
      WHERE organization_id = $1 AND active`, [ids.organizationA, locationId]);
    await client.query(`INSERT INTO taptime_server.membership_management_location_grants (id, organization_id, membership_id, location_id)
      VALUES (gen_random_uuid(), $1, $2, $3)`, [ids.organizationA, membershipIds.employeeA, locationId]);
    await client.query(`SELECT set_config('app.user_id', $1, true), set_config('app.organization_id', $2, true),
      set_config('app.membership_id', $3, true), set_config('app.membership_role', 'administrator', true),
      set_config('app.correlation_id', $4, true)`, [ids.adminA, ids.organizationA, membershipIds.adminA, randomUUID()]);
    await client.query('SET LOCAL ROLE taptime_admin_setup');
    await client.query('SELECT taptime_server.set_organization_locations_enabled_v1($1, true)', [ids.organizationA]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
