import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { MembershipId, OrganizationId } from '@taptime/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBackendHttpServer,
  type BackendHttpServerOptions,
} from '../src/BackendHttpServer.js';
import type {
  BackendApiDependencies,
  BackendApiDiagnostic,
  EmployeeMembershipEnrollmentCoordinator,
} from '../src/types.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';

const accessToken = 'header.payload.signature';
const membershipId = MembershipId('12000000-0000-4000-8000-000000000001');
const organizationId = OrganizationId('00000000-0000-4000-8000-000000000001');
const commandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const invitationSecret = Buffer.alloc(32, 17).toString('base64url');
const proxySharedSecret = Buffer.alloc(32, 23).toString('base64url');
const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('C3E1 Employee enrollment HTTP contract', () => {
  it('returns the one-time invitation secret in the exact no-store success shape', async () => {
    const employeeEnrollment = coordinator({
      async createInvitation() {
        return {
          status: 'succeeded',
          invitationSecret,
          expiresAt: '2026-07-15T12:34:56.789Z',
        };
      },
    });
    const response = await post(await origin(employeeEnrollment),
      '/v1/administration/employee-invitations', {
        expectedMembershipId: membershipId,
        commandId,
        displayName: 'Employee Alpha',
        role: 'employee',
      });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      status: 'succeeded',
      invitationSecret,
      expiresAt: '2026-07-15T12:34:56.789Z',
    });
  });

  it('passes an explicit Home Location to invitation creation and rejects unknown roles', async () => {
    const locationId = '21000000-0000-4000-8000-000000000001';
    const createInvitation = vi.fn<EmployeeMembershipEnrollmentCoordinator['createInvitation']>(
      async () => ({
        status: 'succeeded',
        invitationSecret,
        expiresAt: '2026-07-15T12:34:56.789Z',
      }),
    );
    const apiOrigin = await origin(coordinator({ createInvitation }));
    const accepted = await post(apiOrigin, '/v1/administration/employee-invitations', {
      expectedMembershipId: membershipId,
      commandId,
      displayName: 'Employee Alpha',
      role: 'employee',
      locationId,
    });
    expect(accepted.status).toBe(200);
    expect(createInvitation).toHaveBeenCalledWith(
      { accessToken, expectedMembershipId: membershipId, commandId,
        displayName: 'Employee Alpha', role: 'employee', locationId },
      { deadlineEpochMilliseconds: expect.any(Number) },
    );

    const rejected = await post(apiOrigin, '/v1/administration/employee-invitations', {
      expectedMembershipId: membershipId,
      commandId,
      displayName: 'Employee Alpha',
      role: 'unknown-role',
      locationId,
    });
    expect(rejected.status).toBe(400);
    expect(createInvitation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['invitation_created_token_unavailable', 409],
    ['invitation_limit_reached', 409],
    ['command_id_conflict', 409],
    ['forbidden', 403],
    ['unauthorized', 401],
    ['invalid_request', 400],
  ] as const)('maps invitation creation %s to its normative HTTP status', async (status, httpStatus) => {
    const response = await post(await origin(coordinator({
      async createInvitation() { return { status }; },
    })), '/v1/administration/employee-invitations', {
      expectedMembershipId: membershipId,
      commandId,
      displayName: 'Employee Alpha',
      role: 'employee',
    });
    expect(response.status).toBe(httpStatus);
    await expect(response.json()).resolves.toEqual({ error: { code: status } });
  });

  it('records a completed password reset through the active provider identity only', async () => {
    const recordPasswordReset = vi.fn<
      EmployeeMembershipEnrollmentCoordinator['recordPasswordReset']
    >(async () => ({ status: 'succeeded' }));
    const response = await post(await origin(coordinator({ recordPasswordReset })),
      '/v1/auth/password-reset/audit', {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'succeeded' });
    expect(recordPasswordReset).toHaveBeenCalledWith(
      { accessToken }, { deadlineEpochMilliseconds: expect.any(Number) },
    );
  });

  it('returns the bounded Employee Membership projection in its exact public shape', async () => {
    const response = await post(await origin(coordinator({
      async readEmployeeMembershipsProjection() {
        return {
          status: 'succeeded',
          organization: { id: organizationId, name: 'Synthetic Organization A' },
          employeeMemberships: [{
            id: MembershipId('22000000-0000-4000-8000-000000000001'),
            displayName: 'Employee Alpha',
            role: 'employee',
            active: true,
            rowVersion: 3,
          }],
          nextCursor: 'v1:m:22000000-0000-4000-8000-000000000001',
        };
      },
    })), '/v1/administration/employee-memberships-projection', {
      expectedMembershipId: membershipId,
      cursor: null,
      limit: 20,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'succeeded',
      organization: { id: organizationId, name: 'Synthetic Organization A' },
      employeeMemberships: [{
        id: '22000000-0000-4000-8000-000000000001',
        displayName: 'Employee Alpha',
        role: 'employee',
        active: true,
        rowVersion: 3,
      }],
      nextCursor: 'v1:m:22000000-0000-4000-8000-000000000001',
    });
  });

  it('versions the located projection and exposes a distinct foreign-Location rejection', async () => {
    const locationId = '21000000-0000-4000-8000-000000000001';
    const readEmployeeMembershipsProjectionV2 = vi.fn<
      NonNullable<EmployeeMembershipEnrollmentCoordinator['readEmployeeMembershipsProjectionV2']>
    >(async () => ({
      status: 'succeeded',
      organization: { id: organizationId, name: 'Synthetic Organization A' },
      employeeMemberships: [{
        id: MembershipId('22000000-0000-4000-8000-000000000001'),
        displayName: 'Employee Alpha',
        role: 'employee',
        active: true,
        rowVersion: 3,
        location: { id: locationId, name: 'Berlin' },
      }],
      nextCursor: null,
    }));
    const apiOrigin = await origin(coordinator({ readEmployeeMembershipsProjectionV2 }));
    const response = await post(apiOrigin,
      '/v2/administration/employee-memberships-projection', {
        expectedMembershipId: membershipId,
        cursor: null,
        limit: 20,
        locationId,
      });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'succeeded',
      organization: { id: organizationId, name: 'Synthetic Organization A' },
      employeeMemberships: [{
        id: '22000000-0000-4000-8000-000000000001',
        displayName: 'Employee Alpha',
        role: 'employee',
        active: true,
        rowVersion: 3,
        location: { id: locationId, name: 'Berlin' },
      }],
      nextCursor: null,
    });
    expect(readEmployeeMembershipsProjectionV2).toHaveBeenCalledWith(
      { accessToken, expectedMembershipId: membershipId, cursor: null, limit: 20, locationId },
      { deadlineEpochMilliseconds: expect.any(Number) },
    );

    readEmployeeMembershipsProjectionV2.mockResolvedValueOnce({
      status: 'location_scope_forbidden',
    });
    const rejected = await post(apiOrigin,
      '/v2/administration/employee-memberships-projection', {
        expectedMembershipId: membershipId,
        cursor: null,
        limit: 20,
        locationId: '21000000-0000-4000-8000-000000000002',
      });
    expect(rejected.status).toBe(403);
    await expect(rejected.json()).resolves.toEqual({
      error: { code: 'location_scope_forbidden' },
    });
  });

  it('exposes membership revocation with optimistic concurrency and exact success data', async () => {
    const targetMembershipId = MembershipId('22000000-0000-4000-8000-000000000001');
    const revokeMembership = vi.fn<EmployeeMembershipEnrollmentCoordinator['revokeMembership']>(
      async () => ({
        status: 'succeeded',
        membership: { id: targetMembershipId, role: 'employee', active: false, rowVersion: 4 },
        idempotentRetry: false,
      }),
    );
    const response = await post(await origin(coordinator({ revokeMembership })),
      '/v1/administration/memberships/revoke', {
        expectedMembershipId: membershipId,
        commandId,
        targetMembershipId,
        expectedRowVersion: 3,
      });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'succeeded',
      membership: { id: targetMembershipId, role: 'employee', active: false, rowVersion: 4 },
      idempotentRetry: false,
    });
    expect(revokeMembership).toHaveBeenCalledWith(
      { accessToken, expectedMembershipId: membershipId, commandId,
        targetMembershipId, expectedRowVersion: 3 },
      { deadlineEpochMilliseconds: expect.any(Number) },
    );
  });

  it.each([
    ['last_administrator', 409],
    ['self_revocation_forbidden', 409],
    ['stale_row_version', 409],
    ['target_unavailable', 404],
    ['forbidden', 403],
  ] as const)('maps membership mutation %s without hiding the domain conflict', async (
    status,
    httpStatus,
  ) => {
    const response = await post(await origin(coordinator({
      async changeMembershipRole() { return { status }; },
    })), '/v1/administration/memberships/change-role', {
      expectedMembershipId: membershipId,
      commandId,
      targetMembershipId: '22000000-0000-4000-8000-000000000001',
      expectedRowVersion: 3,
      role: 'administrator',
    });
    expect(response.status).toBe(httpStatus);
    await expect(response.json()).resolves.toEqual({ error: { code: status } });
  });

  it('redeems a canonical secret without accepting any client-supplied tenant context', async () => {
    let propagatedDeadline = 0;
    const redeemInvitation = vi.fn<EmployeeMembershipEnrollmentCoordinator['redeemInvitation']>(
      async (_command, controls) => {
        propagatedDeadline = controls?.deadlineEpochMilliseconds ?? 0;
        return {
          status: 'succeeded',
          organizationName: 'Synthetic Organization A',
          membershipDisplayName: 'Employee Alpha',
          role: 'employee',
        };
      },
    );
    const beforeRequest = Date.now();
    const response = await post(await origin(coordinator({ redeemInvitation })),
      '/v1/employee-enrollment/redeem', { commandId, invitationSecret });
    const afterRequest = Date.now();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'succeeded',
      organizationName: 'Synthetic Organization A',
      membershipDisplayName: 'Employee Alpha',
      role: 'employee',
    });
    expect(redeemInvitation).toHaveBeenCalledWith(
      { accessToken, commandId, invitationSecret },
      { deadlineEpochMilliseconds: expect.any(Number) },
    );
    expect(propagatedDeadline).toBeGreaterThanOrEqual(beforeRequest + 10_000);
    expect(propagatedDeadline).toBeLessThanOrEqual(afterRequest + 10_000);
  });

  it.each([
    ['enrollment_unavailable', 404],
    ['unauthorized', 401],
    ['invalid_request', 400],
  ] as const)('maps redemption %s without lifecycle disclosure', async (status, httpStatus) => {
    const response = await post(await origin(coordinator({
      async redeemInvitation() { return { status }; },
    })), '/v1/employee-enrollment/redeem', { commandId, invitationSecret });
    expect(response.status).toBe(httpStatus);
    await expect(response.json()).resolves.toEqual({ error: { code: status } });
  });

  it.each([
    ['short', 'abc'],
    ['padded', `${invitationSecret}=`],
    ['bad alphabet', `${invitationSecret.slice(0, -1)}+`],
    ['non-zero trailing pad bits', `${invitationSecret.slice(0, -1)}B`],
  ])('rejects a %s secret before calling the verifier-backed coordinator', async (_label, secret) => {
    const redeemInvitation = vi.fn();
    const response = await post(await origin(coordinator({ redeemInvitation })),
      '/v1/employee-enrollment/redeem', { commandId, invitationSecret: secret });
    expect(response.status).toBe(400);
    expect(redeemInvitation).not.toHaveBeenCalled();
  });

  it('rejects expected-Membership headers and extra JSON keys on redemption', async () => {
    const redeemInvitation = vi.fn();
    const apiOrigin = await origin(coordinator({ redeemInvitation }));
    const headerResponse = await post(apiOrigin, '/v1/employee-enrollment/redeem', {
      commandId,
      invitationSecret,
    }, { 'x-taptime-expected-membership-id': membershipId });
    expect(headerResponse.status).toBe(400);
    const bodyResponse = await post(apiOrigin, '/v1/employee-enrollment/redeem', {
      commandId,
      invitationSecret,
      organizationId,
    });
    expect(bodyResponse.status).toBe(400);
    expect(redeemInvitation).not.toHaveBeenCalled();
  });

  it('collapses internal redemption failures to 503 and a secret-free diagnostic', async () => {
    const diagnostics: BackendApiDiagnostic[] = [];
    const response = await post(await origin(coordinator({
      async redeemInvitation() { throw new Error(invitationSecret); },
    }), diagnostics), '/v1/employee-enrollment/redeem', { commandId, invitationSecret });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: 'service_unavailable' } });
    expect(diagnostics).toEqual([{
      code: 'employee_enrollment_failed',
      route: 'employee_enrollment_redeem',
      correlationId: expect.any(String),
    }]);
    expect(JSON.stringify(diagnostics)).not.toContain(invitationSecret);
  });

  it('rate-limits enrollment redemption per forwarded address without affecting another address', async () => {
    const apiOrigin = await origin(coordinator(), [], trustedProxyOptions());
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await post(apiOrigin, '/v1/employee-enrollment/redeem',
        { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
      expect(response.status, `attempt ${attempt}`).toBe(401);
    }
    const limited = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('60');
    await expect(limited.json()).resolves.toEqual({ error: { code: 'rate_limited' } });

    const otherAddress = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, proxyHeaders('198.51.100.20'));
    expect(otherAddress.status).toBe(401);
  });

  it('ignores forged X-Forwarded-For values on a direct connection', async () => {
    const apiOrigin = await origin(coordinator());
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await post(apiOrigin, '/v1/employee-enrollment/redeem',
        { commandId, invitationSecret }, { 'x-forwarded-for': `192.0.2.${attempt}` });
      expect(response.status, `attempt ${attempt}`).toBe(401);
    }
    const response = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, { 'x-forwarded-for': '198.51.100.99' });
    expect(response.status).toBe(429);
  });

  it('fails closed when a caller claims a forwarded address without Caddy proof', async () => {
    const apiOrigin = await origin(coordinator(), [], trustedProxyOptions());
    const missingProof = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, { 'x-forwarded-for': '192.0.2.10' });
    expect(missingProof.status).toBe(400);
    const wrongProof = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, {
        'x-forwarded-for': '192.0.2.10',
        'x-taptime-proxy-secret': Buffer.alloc(32, 24).toString('base64url'),
      });
    expect(wrongProof.status).toBe(400);
  });

  it('does not distinguish a valid from an invalid invitation body once rate-limited', async () => {
    const diagnostics: BackendApiDiagnostic[] = [];
    const apiOrigin = await origin(coordinator({
      async redeemInvitation() {
        return {
          status: 'succeeded', organizationName: 'Synthetic Organization A',
          membershipDisplayName: 'Employee Alpha', role: 'employee',
        };
      },
    }), diagnostics, trustedProxyOptions());
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await post(apiOrigin, '/v1/employee-enrollment/redeem',
        { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
      expect(response.status, `attempt ${attempt}`).toBe(200);
    }
    const valid = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
    const invalid = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret: 'invalid' }, proxyHeaders('192.0.2.10'));
    expect(valid.status).toBe(429);
    expect(invalid.status).toBe(429);
    await expect(valid.json()).resolves.toEqual({ error: { code: 'rate_limited' } });
    await expect(invalid.json()).resolves.toEqual({ error: { code: 'rate_limited' } });
    expect(diagnostics).toEqual([]);
  });

  it('allows enrollment redemption again after the short window expires', async () => {
    let now = 1_000;
    const apiOrigin = await origin(coordinator(), [], {
      ...trustedProxyOptions(),
      rateLimitClock: () => now,
    });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await post(apiOrigin, '/v1/employee-enrollment/redeem',
        { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
      expect(response.status, `attempt ${attempt}`).toBe(401);
    }
    const limited = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
    expect(limited.status).toBe(429);
    now += 60_000;
    const recovered = await post(apiOrigin, '/v1/employee-enrollment/redeem',
      { commandId, invitationSecret }, proxyHeaders('192.0.2.10'));
    expect(recovered.status).toBe(401);
  });

  it('requires proxy proof and applies the address limit to every v1, v2 and v3 path',
    async () => {
    const apiOrigin = await origin(coordinator(), [], trustedProxyOptions());
    const untrustedV3 = await post(apiOrigin, '/v3/offline-capture-leases', {}, {});
    expect(untrustedV3.status).toBe(400);
    for (let attempt = 1; attempt <= 300; attempt += 1) {
      const path = attempt % 3 === 0
        ? '/v3/not-a-route'
        : attempt % 2 === 0 ? '/v2/not-a-route' : '/v1/not-a-route';
      const response = await post(apiOrigin, path, {}, proxyHeaders('192.0.2.10'));
      expect(response.status, `attempt ${attempt}`).toBe(404);
    }
    const limited = await post(apiOrigin, '/v3/offline-capture-leases', {},
      proxyHeaders('192.0.2.10'));
    expect(limited.status).toBe(429);
  });
});

function coordinator(
  overrides: Partial<EmployeeMembershipEnrollmentCoordinator> = {},
): EmployeeMembershipEnrollmentCoordinator {
  return {
    async createInvitation() { return { status: 'unauthorized' }; },
    async redeemInvitation() { return { status: 'unauthorized' }; },
    async readEmployeeMembershipsProjection() { return { status: 'unauthorized' }; },
    async readEmployeeMembershipsProjectionV2() { return { status: 'unauthorized' }; },
    async revokeMembership() { return { status: 'unauthorized' }; },
    async changeMembershipRole() { return { status: 'unauthorized' }; },
    async recordPasswordReset() { return { status: 'unauthorized' }; },
    ...overrides,
  };
}

async function origin(
  employeeEnrollment: EmployeeMembershipEnrollmentCoordinator,
  diagnostics: BackendApiDiagnostic[] = [],
  options: BackendHttpServerOptions = {},
): Promise<string> {
  const server = createBackendHttpServer(dependencies(employeeEnrollment), {
    ...options,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  openServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function trustedProxyOptions(): BackendHttpServerOptions {
  return { clientAddressMode: { mode: 'trusted_proxy', sharedSecret: proxySharedSecret } };
}

function proxyHeaders(address: string): Record<string, string> {
  return {
    'x-forwarded-for': address,
    'x-taptime-proxy-secret': proxySharedSecret,
  };
}

function dependencies(
  employeeEnrollment: EmployeeMembershipEnrollmentCoordinator,
): BackendApiDependencies {
  return {
    ...unavailableOfflineDependencies(),
    employeeEnrollment,
    sessionAuthority: { async resolve() { return { status: 'rejected' }; } },
    scanContextResolver: { async resolve() { return { status: 'not_resolved' }; } },
    lifecycleIngestor: {
      async ingest() {
        return { status: 'deferred', evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive' };
      },
    },
    deferredLifecycleIngestor: {
      async ingestDeferred() {
        return { status: 'deferred', evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive' };
      },
    },
    administration: {
      async createCustomer() { return { status: 'unauthorized' }; },
      async provisionNfcTag() { return { status: 'unauthorized' }; },
      async readSetupProjection() { return { status: 'unauthorized' }; },
    },
    tagReassignment: {
      async reassignNfcTag() { return { status: 'unauthorized' }; },
    },
  };
}

function post(
  apiOrigin: string,
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${apiOrigin}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    credentials: 'omit',
    redirect: 'manual',
  });
}
