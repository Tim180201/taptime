import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBackendHttpServer,
  type BackendHttpServerOptions,
} from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('GET /health', () => {
  it('runs without authentication and returns only the healthy status', async () => {
    const healthCheck = vi.fn(async () => undefined);
    const origin = await start(healthCheck);

    const response = await fetch(`${origin}/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.text()).toBe('{"status":"ok"}');
    expect(healthCheck).toHaveBeenCalledOnce();
  });

  it('returns only the degraded status when the database check fails', async () => {
    const secret = 'postgresql://private-user:private-password@private-host/taptime';
    const origin = await start(async () => {
      throw new Error(secret);
    });

    const response = await fetch(`${origin}/health`);
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toBe('{"status":"degraded"}');
    expect(body).not.toContain(secret);
  });

  it('returns degraded after two seconds when the database check does not settle', async () => {
    const origin = await start(() => new Promise<void>(() => undefined));
    const startedAt = Date.now();

    const response = await fetch(`${origin}/health`);
    const elapsedMilliseconds = Date.now() - startedAt;

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"status":"degraded"}');
    expect(elapsedMilliseconds).toBeGreaterThanOrEqual(1_900);
    expect(elapsedMilliseconds).toBeLessThan(3_000);
  });

  it('rejects methods other than GET without running the database check', async () => {
    const healthCheck = vi.fn(async () => undefined);
    const origin = await start(healthCheck);

    const response = await fetch(`${origin}/health`, { method: 'POST' });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(healthCheck).not.toHaveBeenCalled();
  });

  it('makes the public health path prove the trusted Caddy hop', async () => {
    const healthCheck = vi.fn(async () => undefined);
    const sharedSecret = Buffer.alloc(32, 25).toString('base64url');
    const origin = await start(healthCheck, {
      clientAddressMode: { mode: 'trusted_proxy', sharedSecret },
    });

    const untrusted = await fetch(`${origin}/health`);
    expect(untrusted.status).toBe(400);
    expect(healthCheck).not.toHaveBeenCalled();

    const trusted = await fetch(`${origin}/health`, { headers: {
      'x-forwarded-for': '192.0.2.10',
      'x-taptime-proxy-secret': sharedSecret,
    } });
    expect(trusted.status).toBe(200);
    expect(healthCheck).toHaveBeenCalledOnce();
  });
});

async function start(
  healthCheck: () => Promise<void>,
  options: BackendHttpServerOptions = {},
): Promise<string> {
  const server = createBackendHttpServer(dependencies(healthCheck), options);
  servers.push(server);
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Health test server has no TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

function dependencies(healthCheck: () => Promise<void>): BackendApiDependencies {
  return {
    ...unavailableOfflineDependencies(),
    healthCheck,
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
      async revokeMembership() { return { status: 'unauthorized' }; },
      async changeMembershipRole() { return { status: 'unauthorized' }; },
      async recordPasswordReset() { return { status: 'unauthorized' }; },
    },
    tagReassignment: {
      async reassignNfcTag() { return { status: 'unauthorized' }; },
    },
  };
}
