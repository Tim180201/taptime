import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { MembershipId, OrganizationId } from '@taptime/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type {
  BackendApiDependencies,
  BackendApiDiagnostic,
  EmployeeMembershipEnrollmentCoordinator,
} from '../src/types.js';

const accessToken = 'header.payload.signature';
const membershipId = MembershipId('12000000-0000-4000-8000-000000000001');
const organizationId = OrganizationId('00000000-0000-4000-8000-000000000001');
const commandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const invitationSecret = Buffer.alloc(32, 17).toString('base64url');
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
    });
    expect(response.status).toBe(httpStatus);
    await expect(response.json()).resolves.toEqual({ error: { code: status } });
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
          }],
          nextCursor: 'v1:e:22000000-0000-4000-8000-000000000001',
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
      }],
      nextCursor: 'v1:e:22000000-0000-4000-8000-000000000001',
    });
  });

  it('redeems a canonical secret without accepting any client-supplied tenant context', async () => {
    const redeemInvitation = vi.fn(async () => ({
      status: 'succeeded' as const,
      organizationName: 'Synthetic Organization A',
      membershipDisplayName: 'Employee Alpha',
      role: 'employee' as const,
    }));
    const response = await post(await origin(coordinator({ redeemInvitation })),
      '/v1/employee-enrollment/redeem', { commandId, invitationSecret });
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
      correlationId: expect.any(String),
    }]);
    expect(JSON.stringify(diagnostics)).not.toContain(invitationSecret);
  });
});

function coordinator(
  overrides: Partial<EmployeeMembershipEnrollmentCoordinator> = {},
): EmployeeMembershipEnrollmentCoordinator {
  return {
    async createInvitation() { return { status: 'unauthorized' }; },
    async redeemInvitation() { return { status: 'unauthorized' }; },
    async readEmployeeMembershipsProjection() { return { status: 'unauthorized' }; },
    ...overrides,
  };
}

async function origin(
  employeeEnrollment: EmployeeMembershipEnrollmentCoordinator,
  diagnostics: BackendApiDiagnostic[] = [],
): Promise<string> {
  const server = createBackendHttpServer(dependencies(employeeEnrollment), {
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

function dependencies(
  employeeEnrollment: EmployeeMembershipEnrollmentCoordinator,
): BackendApiDependencies {
  return {
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
