import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import type {
  AdminCoordinatorControls,
  CreateCustomerCommand,
  ProvisionNfcTagCommand,
  ProvisionNfcTagResult,
  ReadSetupProjectionCommand,
} from '@taptime/backend-administration';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
} from '@taptime/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type {
  AdministrationCoordinator,
  BackendApiDependencies,
  BackendApiDiagnostic,
} from '../src/types.js';

const ids = {
  membership: '12aa0000-0000-4000-8000-000000000301',
  command: '13bb0000-0000-4000-8000-000000000301',
  customer: '14cc0000-0000-4000-8000-000000000301',
  tag: '15dd0000-0000-4000-8000-000000000301',
  assignment: '16ee0000-0000-4000-8000-000000000301',
  organization: '17ff0000-0000-4000-8000-000000000301',
} as const;
const token = 'abc.def.ghi';
const openServers: Server[] = [];

interface HttpResult {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly text: string;
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map(closeServer));
});

describe('C3C exact administration transport', () => {
  it('passes the exact Customer command and one finite deadline, then returns only the safe result',
    async () => {
      let received:
        | { readonly command: CreateCustomerCommand; readonly controls?: AdminCoordinatorControls }
        | undefined;
      const administration = administrationCoordinator({
        async createCustomer(command, controls) {
          received = { command, controls };
          return {
            status: 'succeeded',
            idempotentRetry: false,
            customer: {
              id: CustomerId(ids.customer),
              displayName: 'Werkstatt Nord',
              active: true,
            },
          };
        },
      });
      const before = Date.now();
      const origin = await startServer(administration, { operationTimeoutMilliseconds: 1_000 });
      const response = await postJson(origin, '/v1/administration/customers', {
        expectedMembershipId: ids.membership,
        commandId: ids.command,
        displayName: 'Werkstatt Nord',
      });

      expect(response.status).toBe(200);
      expect(JSON.parse(response.text)).toEqual({
        status: 'succeeded',
        idempotentRetry: false,
        customer: {
          id: ids.customer,
          displayName: 'Werkstatt Nord',
          active: true,
        },
      });
      expect(received?.command).toEqual({
        accessToken: token,
        expectedMembershipId: ids.membership,
        commandId: ids.command,
        displayName: 'Werkstatt Nord',
      });
      expect(received?.controls?.deadlineEpochMilliseconds).toBeGreaterThan(before);
      expect(received?.controls?.deadlineEpochMilliseconds).toBeLessThanOrEqual(Date.now() + 1_000);
      expectSafeHeaders(response);
    });

  it('passes the exact atomic Tag command but never serializes its raw canonical payload', async () => {
    const rawPayload = 'nfc:uid:v1:B55E8B6AEB30';
    let received: ProvisionNfcTagCommand | undefined;
    const origin = await startServer(administrationCoordinator({
      async provisionNfcTag(command) {
        received = command;
        return {
          status: 'succeeded',
          idempotentRetry: false,
          nfcTag: {
            id: NfcTagId(ids.tag),
            displayName: 'Eingang',
            validationFingerprint: 'A1B2C3D4E5F6',
            assignmentState: 'assigned',
            targetCustomerId: CustomerId(ids.customer),
          },
          assignmentId: NfcAssignmentId(ids.assignment),
          // Deliberately simulate an accidental future internal field: the HTTP allowlist strips it.
          canonicalPayload: rawPayload,
        } as ProvisionNfcTagResult & { readonly canonicalPayload: string };
      },
    }));

    const response = await postJson(origin, '/v1/administration/nfc-tags/provision', {
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      customerId: ids.customer,
      displayName: 'Eingang',
      canonicalPayload: rawPayload,
    });

    expect(response.status).toBe(200);
    expect(received).toEqual({
      accessToken: token,
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      customerId: ids.customer,
      displayName: 'Eingang',
      canonicalPayload: rawPayload,
    });
    expect(response.text).not.toContain(rawPayload);
    expect(JSON.parse(response.text)).toEqual({
      status: 'succeeded',
      idempotentRetry: false,
      nfcTag: {
        id: ids.tag,
        displayName: 'Eingang',
        validationFingerprint: 'A1B2C3D4E5F6',
        assignmentState: 'assigned',
        targetCustomerId: ids.customer,
      },
      assignmentId: ids.assignment,
    });
  });

  it('returns the combined safe projection below 16 KiB and forwards the global cursor', async () => {
    let received: ReadSetupProjectionCommand | undefined;
    const maximumName = '😀'.repeat(120);
    const customers = Array.from({ length: 10 }, (_, index) => ({
      id: CustomerId(numberedUuid('4', index + 1)),
      displayName: maximumName,
      active: true,
    }));
    const nfcTags = Array.from({ length: 10 }, (_, index) => ({
      id: NfcTagId(numberedUuid('5', index + 1)),
      displayName: maximumName,
      validationFingerprint: 'ABCDEF123456',
      assignmentState: 'unassigned' as const,
      targetCustomerId: null,
    }));
    const origin = await startServer(administrationCoordinator({
      async readSetupProjection(command) {
        received = command;
        return {
          status: 'succeeded',
          organization: { id: OrganizationId(ids.organization), name: maximumName },
          customers,
          nfcTags,
          nextCursor: 'v1:t:50000000-0000-4000-8000-000000000010',
        };
      },
    }));

    const cursor = 'v1:c:40000000-0000-4000-8000-000000000010';
    const response = await postJson(origin, '/v1/administration/setup-projection', {
      expectedMembershipId: ids.membership,
      cursor,
      limit: 20,
    });

    expect(response.status).toBe(200);
    expect(received).toEqual({
      accessToken: token,
      expectedMembershipId: ids.membership,
      cursor,
      limit: 20,
    });
    expect(Buffer.byteLength(response.text, 'utf8')).toBeLessThan(16 * 1_024);
    expect(JSON.parse(response.text)).toMatchObject({
      status: 'succeeded',
      nextCursor: 'v1:t:50000000-0000-4000-8000-000000000010',
    });
  });

  it.each([
    ['invalid_request', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['assignment_target_unavailable', 404],
    ['tag_payload_already_registered', 409],
    ['command_id_conflict', 409],
  ] as const)('maps %s to its fixed HTTP status without raw infrastructure detail',
    async (status, expectedStatus) => {
      const origin = await startServer(administrationCoordinator({
        async provisionNfcTag() {
          return { status } as ProvisionNfcTagResult;
        },
      }));
      const response = await postJson(origin, '/v1/administration/nfc-tags/provision', tagBody());
      expectGenericError(response, expectedStatus, status);
    });

  it('rejects the lifecycle Membership header on every administration route before invocation',
    async () => {
      let calls = 0;
      const origin = await startServer(administrationCoordinator({
        async createCustomer() {
          calls += 1;
          return { status: 'unauthorized' };
        },
        async provisionNfcTag() {
          calls += 1;
          return { status: 'unauthorized' };
        },
        async readSetupProjection() {
          calls += 1;
          return { status: 'unauthorized' };
        },
      }));
      const cases = [
        ['/v1/administration/customers', customerBody()],
        ['/v1/administration/nfc-tags/provision', tagBody()],
        ['/v1/administration/setup-projection', projectionBody()],
      ] as const;
      for (const [path, body] of cases) {
        const response = await postJson(origin, path, body, {
          'x-taptime-expected-membership-id': ids.membership,
        });
        expectGenericError(response, 400, 'invalid_request');
      }
      expect(calls).toBe(0);
    });

  it('rejects unsupported content types, malformed JSON, invalid UTF-8 and oversized bodies',
    async () => {
      let calls = 0;
      const origin = await startServer(administrationCoordinator({
        async createCustomer() {
          calls += 1;
          return { status: 'unauthorized' };
        },
      }));
      const malformed = Buffer.from('{', 'utf8');
      const invalidUtf8 = Buffer.from([0xc3, 0x28]);
      const cases = [
        {
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json; charset=utf-8',
            'content-length': '2',
          },
          body: Buffer.from('{}'),
        },
        {
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'content-length': String(malformed.byteLength),
          },
          body: malformed,
        },
        {
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'content-length': String(invalidUtf8.byteLength),
          },
          body: invalidUtf8,
        },
        {
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'content-length': String(16 * 1_024 + 1),
          },
        },
      ] as const;
      for (const testCase of cases) {
        expectGenericError(await request(origin, {
          method: 'POST',
          path: '/v1/administration/customers',
          ...testCase,
        }), 400, 'invalid_request');
      }
      expect(calls).toBe(0);
    });

  it.each([
    ['uppercase Membership', { ...customerBody(), expectedMembershipId: ids.membership.toUpperCase() }],
    ['uppercase command', { ...customerBody(), commandId: ids.command.toUpperCase() }],
    ['extra Organization', { ...customerBody(), organizationId: ids.organization }],
    ['nested Membership', { ...customerBody(), membership: { id: ids.membership } }],
    ['missing display name', { expectedMembershipId: ids.membership, commandId: ids.command }],
  ])('rejects %s as a closed Customer DTO', async (_label, body) => {
    let calls = 0;
    const origin = await startServer(administrationCoordinator({
      async createCustomer() {
        calls += 1;
        return { status: 'unauthorized' };
      },
    }));
    expectGenericError(
      await postJson(origin, '/v1/administration/customers', body),
      400,
      'invalid_request',
    );
    expect(calls).toBe(0);
  });

  it.each([
    ['uppercase Customer', { ...tagBody(), customerId: ids.customer.toUpperCase() }],
    ['extra active state', { ...tagBody(), active: true }],
    ['missing raw capture', {
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      customerId: ids.customer,
      displayName: 'Eingang',
    }],
  ])('rejects %s as a closed provision DTO', async (_label, body) => {
    let calls = 0;
    const origin = await startServer(administrationCoordinator({
      async provisionNfcTag() {
        calls += 1;
        return { status: 'unauthorized' };
      },
    }));
    expectGenericError(
      await postJson(origin, '/v1/administration/nfc-tags/provision', body),
      400,
      'invalid_request',
    );
    expect(calls).toBe(0);
  });

  it.each([
    ['zero limit', { ...projectionBody(), limit: 0 }],
    ['limit above 20', { ...projectionBody(), limit: 21 }],
    ['fractional limit', { ...projectionBody(), limit: 1.5 }],
    ['cursor above 256 bytes', { ...projectionBody(), cursor: 'ä'.repeat(129) }],
    ['missing cursor', { expectedMembershipId: ids.membership, limit: 20 }],
  ])('rejects %s as a closed bounded projection DTO', async (_label, body) => {
    let calls = 0;
    const origin = await startServer(administrationCoordinator({
      async readSetupProjection() {
        calls += 1;
        return { status: 'unauthorized' };
      },
    }));
    expectGenericError(
      await postJson(origin, '/v1/administration/setup-projection', body),
      400,
      'invalid_request',
    );
    expect(calls).toBe(0);
  });

  it.each([
    ['GET', '/v1/administration/customers', 405, 'POST'],
    ['GET', '/v1/administration/nfc-tags/provision', 405, 'POST'],
    ['GET', '/v1/administration/setup-projection', 405, 'POST'],
    ['POST', '/v1/administration/customers/', 404, undefined],
    ['POST', '/v1/administration/setup-projection?cursor=x', 404, undefined],
    ['POST', '/v1/administration/nfc-tags', 404, undefined],
  ] as const)('keeps the route exact for %s %s', async (method, path, status, allow) => {
    const origin = await startServer(administrationCoordinator());
    const response = await request(origin, { method, path });
    expect(response.status).toBe(status);
    expect(response.headers.allow).toBe(allow);
    expect(JSON.parse(response.text)).toEqual({
      error: { code: status === 405 ? 'method_not_allowed' : 'not_found' },
    });
  });

  it('maps a dependency failure and a bounded timeout to one generic 503 diagnostic', async () => {
    for (const mode of ['throw', 'timeout'] as const) {
      const diagnostics: BackendApiDiagnostic[] = [];
      const administration = administrationCoordinator({
        async createCustomer() {
          if (mode === 'throw') {
            throw new Error('sensitive database detail and token');
          }
          return new Promise(() => undefined);
        },
      });
      const origin = await startServer(administration, {
        operationTimeoutMilliseconds: 20,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      });
      const response = await postJson(origin, '/v1/administration/customers', customerBody());
      expectGenericError(response, 503, 'service_unavailable');
      expect(diagnostics).toEqual([{
        code: 'administration_failed',
        correlationId: response.headers['x-request-id'],
      }]);
      expect(JSON.stringify({ response, diagnostics })).not.toContain('sensitive database detail');
    }
  });
});

function administrationCoordinator(
  overrides: Partial<AdministrationCoordinator> = {},
): AdministrationCoordinator {
  return {
    async createCustomer() {
      return { status: 'unauthorized' };
    },
    async provisionNfcTag() {
      return { status: 'unauthorized' };
    },
    async readSetupProjection() {
      return { status: 'unauthorized' };
    },
    ...overrides,
  };
}

function dependencies(administration: AdministrationCoordinator): BackendApiDependencies {
  return {
    administration,
    employeeEnrollment: {
      async createInvitation() {
        return { status: 'unauthorized' };
      },
      async redeemInvitation() {
        return { status: 'unauthorized' };
      },
      async readEmployeeMembershipsProjection() {
        return { status: 'unauthorized' };
      },
    },
    sessionAuthority: { resolve: async () => ({ status: 'rejected' }) },
    scanContextResolver: { resolve: async () => ({ status: 'not_resolved' }) },
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
  };
}

async function startServer(
  administration: AdministrationCoordinator,
  options: Parameters<typeof createBackendHttpServer>[1] = {},
): Promise<string> {
  const server = createBackendHttpServer(dependencies(administration), options);
  openServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('C3C test server did not expose a TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

function customerBody() {
  return {
    expectedMembershipId: ids.membership,
    commandId: ids.command,
    displayName: 'Werkstatt Nord',
  };
}

function tagBody() {
  return {
    expectedMembershipId: ids.membership,
    commandId: ids.command,
    customerId: ids.customer,
    displayName: 'Eingang',
    canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30',
  };
}

function projectionBody() {
  return {
    expectedMembershipId: ids.membership,
    cursor: null,
    limit: 20,
  };
}

async function postJson(
  origin: string,
  path: string,
  body: unknown,
  additionalHeaders: Readonly<Record<string, string>> = {},
): Promise<HttpResult> {
  const serialized = JSON.stringify(body);
  return request(origin, {
    method: 'POST',
    path,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(serialized)),
      ...additionalHeaders,
    },
    body: serialized,
  });
}

async function request(
  origin: string,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string | Buffer;
  },
): Promise<HttpResult> {
  const url = new URL(options.path, origin);
  return new Promise<HttpResult>((resolve, reject) => {
    const outgoing = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: options.method,
      headers: options.headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.once('error', reject);
    if (options.body !== undefined) {
      outgoing.write(options.body);
    }
    outgoing.end();
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

function expectGenericError(response: HttpResult, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(JSON.parse(response.text)).toEqual({ error: { code } });
  expectSafeHeaders(response);
}

function expectSafeHeaders(response: HttpResult): void {
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.headers['set-cookie']).toBeUndefined();
}

function numberedUuid(prefix: '4' | '5', number: number): string {
  return `${prefix}0000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
}
