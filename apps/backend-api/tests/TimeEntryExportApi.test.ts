import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { TimeEntryExporter } from '@taptime/backend-time-export';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies, BackendApiDiagnostic } from '../src/types.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';

const path = '/v1/administration/time-entries/export';
const validBody = {
  expectedMembershipId: '12000000-0000-4000-8000-000000000001',
  fromInclusive: '2026-07-01T00:00:00.000Z',
  toExclusive: '2026-08-01T00:00:00.000Z',
};
const servers: Server[] = [];

afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('DA2 TimeEntry export API', () => {
  it('returns exact committed CSV bytes and fixed download headers', async () => {
    const bytes = new TextEncoder().encode('\uFEFF"schema_version"\r\n');
    const exportTimeEntries = vi.fn<TimeEntryExporter['exportTimeEntries']>(async (command) => {
      expect(command.accessToken).toBe('aaa.bbb.ccc');
      expect(command.request).toEqual(validBody);
      expect(command.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      return {
        status: 'succeeded',
        bytes,
        byteCount: bytes.byteLength,
        rowCount: 0,
        sha256: 'a'.repeat(64),
        filename: 'taptime-time-entries_20260701T000000000Z_20260801T000000000Z.csv',
      };
    });
    const origin = await start({ exportTimeEntries });
    const response = await post(origin, validBody);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="taptime-time-entries_20260701T000000000Z_20260801T000000000Z.csv"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(bytes));
    expect(exportTimeEntries).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ...validBody, organizationId: '00000000-0000-4000-8000-000000000001' }],
    [{ ...validBody, fromInclusive: '2026-07-01T00:00:00Z' }],
    [{ ...validBody, toExclusive: '2026-08-02T00:00:00.000Z' }],
    [{ ...validBody, expectedMembershipId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }],
  ])('rejects non-canonical or selector-bearing body %# before the coordinator', async (body) => {
    const exportTimeEntries = vi.fn<TimeEntryExporter['exportTimeEntries']>();
    const origin = await start({ exportTimeEntries });
    const response = await post(origin, body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'invalid_request' } });
    expect(exportTimeEntries).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_request', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['export_schema_incompatible', 409],
    ['export_limit_exceeded', 422],
    ['service_unavailable', 503],
  ] as const)('maps %s to exact HTTP %i without CSV fragments', async (status, expectedStatus) => {
    const origin = await start({ async exportTimeEntries() { return { status }; } });
    const response = await post(origin, validBody);
    expect(response.status).toBe(expectedStatus);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.json()).toEqual({ error: { code: status } });
  });

  it('uses the opt-in v2 coordinator on the exact additive route', async () => {
    const bytes = new TextEncoder().encode('\uFEFF"schema_version";"target_type"\r\n');
    const exportTimeEntriesV2 = vi.fn(async () => ({
      status: 'succeeded' as const,
      bytes,
      byteCount: bytes.byteLength,
      rowCount: 0,
      sha256: 'b'.repeat(64),
      filename: 'taptime-time-entries_v2_20260701T000000000Z_20260801T000000000Z.csv',
    }));
    const origin = await start({
      async exportTimeEntries() { return { status: 'service_unavailable' }; },
      exportTimeEntriesV2,
    });

    const response = await fetch(`${origin}/v2/time-entries/export`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer aaa.bbb.ccc',
        'content-type': 'application/json',
      },
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from(bytes));
    expect(exportTimeEntriesV2).toHaveBeenCalledOnce();
  });

  it('rejects method, media type and legacy expected-Membership header', async () => {
    const exportTimeEntries = vi.fn<TimeEntryExporter['exportTimeEntries']>();
    const origin = await start({ exportTimeEntries });
    const get = await fetch(`${origin}${path}`, { method: 'GET' });
    expect(get.status).toBe(405);
    const text = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { authorization: 'Bearer aaa.bbb.ccc', 'content-type': 'text/plain' },
      body: JSON.stringify(validBody),
    });
    expect(text.status).toBe(400);
    const header = await post(origin, validBody, {
      'x-taptime-expected-membership-id': validBody.expectedMembershipId,
    });
    expect(header.status).toBe(400);
    expect(exportTimeEntries).not.toHaveBeenCalled();
  });

  it('emits only fixed diagnostics when the coordinator throws', async () => {
    const diagnostics: BackendApiDiagnostic[] = [];
    const origin = await start({
      async exportTimeEntries() {
        throw new Error('postgres://secret foreign-tenant-value');
      },
    }, diagnostics);
    const response = await post(origin, validBody);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":{"code":"service_unavailable"}}');
    expect(diagnostics).toEqual([{
      code: 'time_entry_export_failed',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }]);
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
  });
});

async function start(
  timeEntryExporter: TimeEntryExporter,
  diagnostics: BackendApiDiagnostic[] = [],
): Promise<string> {
  const server = createBackendHttpServer(dependencies(timeEntryExporter), {
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

function dependencies(timeEntryExporter: TimeEntryExporter): BackendApiDependencies {
  return {
    ...unavailableOfflineDependencies(),
    timeEntryExporter,
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
    employeeEnrollment: {
      async createInvitation() { return { status: 'unauthorized' }; },
      async redeemInvitation() { return { status: 'unauthorized' }; },
      async readEmployeeMembershipsProjection() { return { status: 'unauthorized' }; },
    },
    tagReassignment: {
      async reassignNfcTag() { return { status: 'unauthorized' }; },
    },
  };
}

function post(
  origin: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer aaa.bbb.ccc',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
