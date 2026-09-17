import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKEND_HTTP_ROUTES,
  createBackendHttpServer,
  requestRateLimitScope,
  requestRoute,
  type BackendHttpServerOptions,
} from '../src/BackendHttpServer.js';
import { RequestRateLimiter } from '../src/RequestRateLimiter.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';

const registeredRoutes = Object.entries(BACKEND_HTTP_ROUTES);
const apiRoutes = registeredRoutes.filter(([, route]) => route !== 'health');
const sharedSecret = Buffer.alloc(32, 53).toString('base64url');
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
  vi.restoreAllMocks();
});

describe('registered route protection', () => {
  it('assigns a rate-limit scope to every registered API route', () => {
    // Every business route must be bounded, regardless of its version or name.
    // Health is the sole operational exception and has its own proxy test below.
    const unprotected = apiRoutes
      .filter(([path]) => !['general_api', 'enrollment_redemption'].includes(
        requestRateLimitScope(path) ?? '',
      ))
      .map(([path]) => path);
    expect(unprotected, 'Registered API routes without a protection class').toEqual([]);
  });

  it.each(registeredRoutes)('dispatches the registered path %s', (path, route) => {
    expect(requestRoute(path)).toBe(route);
    expect(requestRoute(`${path}?unexpected=1`)).toBeNull();
  });

  it.each(apiRoutes)('enforces the limiter before dispatch for %s', async (path) => {
    vi.spyOn(RequestRateLimiter.prototype, 'take').mockReturnValue({
      allowed: false, retryAfterSeconds: 7,
    });
    const origin = await start();
    const response = await fetch(`${origin}${path}`);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('7');
    expect(await response.json()).toEqual({ error: { code: 'rate_limited' } });
  });

  it.each(registeredRoutes)('requires trusted proxy provenance for %s', async (path) => {
    const origin = await start({ clientAddressMode: { mode: 'trusted_proxy', sharedSecret } });
    const response = await fetch(`${origin}${path}`, {
      headers: { 'x-forwarded-for': '192.0.2.53' },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'invalid_request' } });
  });

  it('keeps query variants and unknown paths within every registered API version bounded', async () => {
    const take = vi.spyOn(RequestRateLimiter.prototype, 'take').mockReturnValue({
      allowed: false, retryAfterSeconds: 7,
    });
    const origin = await start();
    const versions = new Set(apiRoutes.map(([path]) => path.split('/')[1]!));
    const paths = [
      ...apiRoutes.map(([path]) => `${path}?unexpected=1`),
      ...[...versions].flatMap((version) => [`/${version}`, `/${version}/not-a-route`]),
    ];
    for (const path of paths) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status, path).toBe(429);
      await response.text();
    }
    take.mockClear();
    for (const path of ['/not-a-route', ...[...versions].map((version) => `/${version}suffix`)]) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status, path).toBe(404);
      await response.text();
    }
    expect(take).not.toHaveBeenCalled();
  });

  it('keeps health outside the API budget while requiring proxy provenance', () => {
    for (const [path, route] of registeredRoutes) {
      if (route === 'health') expect(requestRateLimitScope(path)).toBeNull();
    }
    expect(requestRoute(undefined)).toBeNull();
    expect(requestRateLimitScope(undefined)).toBeNull();
  });

  it('shares the real v4 budget with older routes and recovers per address after expiry', async () => {
    let now = 1_000;
    const origin = await start({
      clientAddressMode: { mode: 'trusted_proxy', sharedSecret },
      rateLimitClock: () => now,
    });
    const referenceLimiter = new RequestRateLimiter(() => now);
    const address = '192.0.2.53';
    const path = '/v4/lifecycle-events/offline';
    const headers = (clientAddress: string) => ({
      'x-forwarded-for': clientAddress,
      'x-taptime-proxy-secret': sharedSecret,
      'content-type': 'application/json',
    });
    try {
      // Derive exhaustion from the real policy; do not copy its numerical limit.
      let decision;
      do {
        decision = referenceLimiter.take('general_api', address);
        const response = await fetch(`${origin}${path}`, {
          method: 'POST', headers: headers(address), body: '{}',
        });
        // Below the limit, token validation still rejects this unauthenticated call.
        expect(response.status).toBe(decision.allowed ? 401 : 429);
        await response.text();
        if (!decision.allowed) {
          expect(response.headers.get('retry-after')).toBe(String(decision.retryAfterSeconds));
        }
      } while (decision.allowed);

      const olderRoute = await fetch(`${origin}/v1/session`, { headers: headers(address) });
      expect(olderRoute.status).toBe(429);
      await olderRoute.text();
      const otherAddress = await fetch(`${origin}${path}`, {
        method: 'POST', headers: headers('198.51.100.53'), body: '{}',
      });
      expect(otherAddress.status).toBe(401);
      await otherAddress.text();

      now += decision.retryAfterSeconds * 1_000;
      const recovered = await fetch(`${origin}${path}`, {
        method: 'POST', headers: headers(address), body: '{}',
      });
      expect(recovered.status).toBe(401);
      await recovered.text();
    } finally {
      referenceLimiter.close();
    }
  });
});

async function start(options: BackendHttpServerOptions = {}): Promise<string> {
  // These boundary tests must finish before touching any business dependency.
  const dependencies = new Proxy({} as BackendApiDependencies, {
    get(_target, property) {
      throw new Error(`Unexpected business dependency access: ${String(property)}`);
    },
  });
  const server = createBackendHttpServer(dependencies, options);
  servers.push(server);
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Route protection test server has no TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}
