import type { AddressInfo } from 'node:net';
import type { ReassignNfcTagResult } from '@taptime/backend-administration';
import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
} from '@taptime/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type {
  BackendApiDependencies,
  BackendApiDiagnostic,
  NfcTagReassignmentPort,
} from '../src/types.js';

const ids = {
  membership: '12000000-0000-4000-8000-000000000001',
  command: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  tag: '30000000-0000-4000-8000-000000000001',
  assignment: '40000000-0000-4000-8000-000000000001',
  resultAssignment: '40000000-0000-4000-8000-000000000002',
  targetCustomer: '20000000-0000-4000-8000-000000000004',
} as const;
const token = 'aaa.bbb.ccc';
const servers: ReturnType<typeof createBackendHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('C3E2 reassignment API boundary', () => {
  it('accepts only the exact canonical command and serializes the allowlisted result', async () => {
    const reassignNfcTag = vi.fn<NfcTagReassignmentPort['reassignNfcTag']>(async () => ({
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: true,
      resultAssignmentId: NfcAssignmentId(ids.resultAssignment),
      replacedAssignmentId: NfcAssignmentId(ids.assignment),
      targetCustomerId: CustomerId(ids.targetCustomer),
      effectiveAt: '2026-07-18T12:34:56.789Z',
    }));
    const origin = await start(reassignment(reassignNfcTag));

    const response = await post(origin, command());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: true,
      resultAssignmentId: ids.resultAssignment,
      replacedAssignmentId: ids.assignment,
      targetCustomerId: ids.targetCustomer,
      effectiveAt: '2026-07-18T12:34:56.789Z',
    });
    expect(reassignNfcTag).toHaveBeenCalledWith({
      accessToken: token,
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      nfcTagId: ids.tag,
      expectedActiveAssignmentId: ids.assignment,
      targetCustomerId: ids.targetCustomer,
    }, {
      deadlineEpochMilliseconds: expect.any(Number),
    });

    for (const invalid of [
      { ...command(), commandId: ids.command.toUpperCase() },
      { ...command(), organizationId: '00000000-0000-4000-8000-000000000001' },
      { ...command(), expectedActiveAssignmentId: 'not-a-uuid' },
    ]) {
      const rejected = await post(origin, invalid);
      expect(rejected.status).toBe(400);
      await expect(rejected.json()).resolves.toEqual({ error: { code: 'invalid_request' } });
    }
    expect(reassignNfcTag).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unauthorized', 401],
    ['forbidden', 403],
    ['assignment_target_unavailable', 404],
    ['assignment_conflict', 409],
    ['assignment_in_use', 409],
    ['command_id_conflict', 409],
    ['invalid_request', 400],
  ] as const)('maps %s to its disclosure-safe HTTP status', async (status, expectedHttpStatus) => {
    const origin = await start(reassignment(async () => (
      { status } as ReassignNfcTagResult
    )));
    const response = await post(origin, command());
    expect(response.status).toBe(expectedHttpStatus);
    await expect(response.json()).resolves.toEqual({ error: { code: status } });
  });

  it('maps dependency failure to 503 and emits only a safe diagnostic', async () => {
    const diagnostics: BackendApiDiagnostic[] = [];
    const origin = await start(reassignment(async () => {
      throw new Error('database detail must not escape');
    }), diagnostics);
    const response = await post(origin, command());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: 'service_unavailable' } });
    expect(diagnostics).toEqual([{
      code: 'administration_failed',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }]);
  });

  it('rejects aliases, query strings, wrong methods and administration narrowing headers', async () => {
    const reassignNfcTag = vi.fn<NfcTagReassignmentPort['reassignNfcTag']>(
      async () => ({ status: 'unauthorized' }),
    );
    const origin = await start(reassignment(reassignNfcTag));
    const requests = [
      fetch(`${origin}/v1/administration/nfc-tags/reassign/`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(command()),
      }),
      fetch(`${origin}/v1/administration/nfc-tags/reassign?retry=1`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(command()),
      }),
      fetch(`${origin}/v1/administration/nfc-tags/reassign`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      }),
      fetch(`${origin}/v1/administration/nfc-tags/reassign`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-taptime-expected-membership-id': ids.membership,
        },
        body: JSON.stringify(command()),
      }),
    ];
    const responses = await Promise.all(requests);
    expect(responses.map(({ status }) => status)).toEqual([404, 404, 405, 400]);
    expect(reassignNfcTag).not.toHaveBeenCalled();
  });

  it('rejects non-exact JSON content type, oversized bodies and browser preflight', async () => {
    const reassignNfcTag = vi.fn<NfcTagReassignmentPort['reassignNfcTag']>(
      async () => ({ status: 'unauthorized' }),
    );
    const origin = await start(reassignment(reassignNfcTag));
    const wrongContentType = await fetch(`${origin}/v1/administration/nfc-tags/reassign`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(command()),
    });
    const oversized = await fetch(`${origin}/v1/administration/nfc-tags/reassign`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...command(), padding: 'x'.repeat(16 * 1_024) }),
    });
    const preflight = await fetch(`${origin}/v1/administration/nfc-tags/reassign`, {
      method: 'OPTIONS',
      headers: { origin: 'https://admin.example' },
    });

    expect(wrongContentType.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(preflight.status).toBe(405);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    expect(reassignNfcTag).not.toHaveBeenCalled();
  });
});

function command() {
  return {
    expectedMembershipId: ids.membership,
    commandId: ids.command,
    nfcTagId: ids.tag,
    expectedActiveAssignmentId: ids.assignment,
    targetCustomerId: ids.targetCustomer,
  };
}

function reassignment(
  reassignNfcTag: NfcTagReassignmentPort['reassignNfcTag'],
): NfcTagReassignmentPort {
  return { reassignNfcTag };
}

async function start(
  tagReassignment: NfcTagReassignmentPort,
  diagnostics: BackendApiDiagnostic[] = [],
): Promise<string> {
  const dependencies: BackendApiDependencies = {
    tagReassignment,
    sessionAuthority: { async resolve() { return { status: 'rejected' }; } },
    scanContextResolver: { async resolve() { return { status: 'not_resolved' }; } },
    lifecycleIngestor: {
      async ingest() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    deferredLifecycleIngestor: {
      async ingestDeferred() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    administration: {
      async createCustomer() { return { status: 'unauthorized' }; },
      async provisionNfcTag() { return { status: 'unauthorized' }; },
      async readSetupProjection() { return { status: 'unauthorized' }; },
    },
    employeeEnrollment: {
      async createInvitation() { return { status: 'unauthorized' }; },
      async redeemInvitation() { return { status: 'unauthorized' }; },
      async readEmployeeMembershipsProjection() { return { status: 'unauthorized' }; },
    },
  };
  const server = createBackendHttpServer(dependencies, {
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function post(origin: string, body: unknown): Promise<Response> {
  return fetch(`${origin}/v1/administration/nfc-tags/reassign`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
