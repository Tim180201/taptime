import { describe, expect, it } from 'vitest';
import { TapTimeSessionApiClient } from '../../src/auth/TapTimeSessionApiClient';

const session = {
  userId: '10000000-0000-4000-8000-000000000101',
  membershipId: '12000000-0000-4000-8000-000000000101',
  organizationId: '00000000-0000-4000-8000-000000000101',
  role: 'employee',
};

describe('TapTimeSessionApiClient', () => {
  it('sends the access token only as Bearer authorization to exact GET /v1/session', async () => {
    const requests: Array<[URL | RequestInfo, RequestInit | undefined]> = [];
    const fetchRequest: typeof fetch = async (input, init) => {
      requests.push([input, init]);
      return Response.json(session);
    };
    const client = new TapTimeSessionApiClient(
      'https://api.taptime.example/base/',
      fetchRequest,
    );

    await expect(client.resolve('memory-only-access')).resolves.toEqual({
      status: 'resolved', session,
    });
    expect(requests).toHaveLength(1);
    const [url, init] = requests[0]!;
    expect(String(url)).toBe('https://api.taptime.example/base/v1/session');
    expect(init).toEqual({
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer memory-only-access' },
      signal: expect.any(AbortSignal),
    });
    expect(JSON.stringify(init)).not.toContain('refresh');
  });

  it('maps backend authority rejection distinctly', async () => {
    const client = new TapTimeSessionApiClient('https://api.example/', async () => new Response(
      JSON.stringify({ error: { code: 'unauthorized' } }), { status: 401 },
    ));
    await expect(client.resolve('token')).resolves.toEqual({ status: 'authority_rejected' });
  });

  it.each([400, 404, 429, 500, 503])(
    'maps HTTP %s to retryable context unavailability',
    async (status) => {
      const client = new TapTimeSessionApiClient(
        'https://api.example/',
        async () => new Response('{}', { status }),
      );
      await expect(client.resolve('token')).resolves.toEqual({ status: 'unavailable' });
    },
  );

  it.each([
    null,
    [],
    { ...session, role: 'owner' },
    { ...session, userId: 'not-a-uuid' },
    { ...session, providerSubject: 'must-not-escape' },
    { userId: session.userId, role: 'employee' },
  ])('rejects malformed or over-broad success JSON', async (body) => {
    const client = new TapTimeSessionApiClient(
      'https://api.example/',
      async () => Response.json(body),
    );
    await expect(client.resolve('token')).resolves.toEqual({ status: 'unavailable' });
  });

  it('maps network and JSON failures to context unavailability', async () => {
    const networkClient = new TapTimeSessionApiClient('https://api.example/', async () => {
      throw new Error('network detail');
    });
    await expect(networkClient.resolve('token')).resolves.toEqual({ status: 'unavailable' });

    const jsonClient = new TapTimeSessionApiClient(
      'https://api.example/',
      async () => new Response('not-json'),
    );
    await expect(jsonClient.resolve('token')).resolves.toEqual({ status: 'unavailable' });
  });

  it('aborts a stalled request and maps it to retryable context unavailability', async () => {
    let suppliedSignal: AbortSignal | undefined;
    const client = new TapTimeSessionApiClient(
      'https://api.example/',
      async (_input, init) => new Promise<Response>((_resolve, reject) => {
        suppliedSignal = init?.signal ?? undefined;
        suppliedSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
      10,
    );

    await expect(client.resolve('memory-only-access')).resolves.toEqual({ status: 'unavailable' });
    expect(suppliedSignal?.aborted).toBe(true);
  });

  it('rejects an invalid request deadline at composition time', () => {
    expect(() => new TapTimeSessionApiClient('https://api.example/', fetch, 0))
      .toThrow('positive safe integer');
  });
});
