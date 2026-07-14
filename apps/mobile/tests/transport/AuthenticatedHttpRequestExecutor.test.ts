import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedRequestAttempt,
  AuthenticatedRequestCapability,
  AuthenticatedRequestExecution,
  EphemeralAccessTokenReader,
} from '../../src/auth/contracts';
import { AuthenticatedHttpRequestExecutor } from '../../src/transport/AuthenticatedHttpRequestExecutor';

class FixedAuthentication implements AuthenticatedRequestCapability {
  constructor(private readonly accessToken = 'memory-only-access') {}

  async executeAuthenticatedRequest<Value>(
    attempt: (
      accessToken: EphemeralAccessTokenReader,
    ) => Promise<AuthenticatedRequestAttempt<Value>>,
  ): Promise<AuthenticatedRequestExecution<Value>> {
    return attempt(() => this.accessToken);
  }
}

class CountingAuthentication implements AuthenticatedRequestCapability {
  calls = 0;

  async executeAuthenticatedRequest<Value>(
    attempt: (
      accessToken: EphemeralAccessTokenReader,
    ) => Promise<AuthenticatedRequestAttempt<Value>>,
  ): Promise<AuthenticatedRequestExecution<Value>> {
    this.calls += 1;
    return attempt(() => 'token');
  }
}

describe('AuthenticatedHttpRequestExecutor', () => {
  it('injects the access token only as Bearer and fixes JSON, cookie and redirect policy', async () => {
    const requests: Array<[URL | RequestInfo, RequestInit | undefined]> = [];
    const executor = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async (input, init) => {
        requests.push([input, init]);
        return Response.json({ accepted: true });
      },
    );
    const body = JSON.stringify({ organizationId: 'synthetic', payload: 'CaseSensitive' });

    await expect(executor.post(new URL('https://api.example/v1/test'), body)).resolves.toEqual({
      status: 'response',
      statusCode: 200,
      contentType: 'application/json',
      body: '{"accepted":true}',
    });
    expect(requests).toEqual([[
      'https://api.example/v1/test',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer memory-only-access',
          'Content-Type': 'application/json',
        },
        body,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        signal: expect.any(AbortSignal),
      },
    ]]);
    expect(body).not.toContain('memory-only-access');
  });

  it.each([429, 500, 503])('maps HTTP %s to a typed transient failure', async (status) => {
    const executor = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async () => new Response('{}', { status }),
    );
    await expect(executor.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'transient_failure' });
  });

  it('maps network and deadline failures to typed transient failures', async () => {
    const network = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async () => { throw new Error('network detail'); },
    );
    await expect(network.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'transient_failure' });

    let suppliedSignal: AbortSignal | undefined;
    const deadline = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async (_input, init) => new Promise<Response>((_resolve, reject) => {
        suppliedSignal = init?.signal ?? undefined;
        suppliedSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
      5,
    );
    await expect(deadline.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'transient_failure' });
    expect(suppliedSignal?.aborted).toBe(true);
  });

  it('treats rejected, manual, and reported redirects as unavailable without forwarding', async () => {
    const rejected = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async () => { throw new TypeError('redirect mode is set to error'); },
    );
    await expect(rejected.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'unavailable' });

    const manual = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async () => new Response(null, {
        status: 302,
        headers: { location: 'https://other-origin.example/credential-target' },
      }),
    );
    await expect(manual.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'unavailable' });

    const redirectedResponse = Response.json({ accepted: true });
    Object.defineProperty(redirectedResponse, 'redirected', { value: true });
    const reported = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async () => redirectedResponse,
    );
    await expect(reported.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('passes a 401 only to the authority capability and never consumes its body', async () => {
    const authentication = new CountingAuthentication();
    const executor = new AuthenticatedHttpRequestExecutor(
      authentication,
      async () => new Response('provider detail', { status: 401 }),
    );

    await expect(executor.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'authority_rejected' });
    expect(authentication.calls).toBe(1);
  });

  it('rejects oversized request and response bodies before returning application data', async () => {
    const fetchRequest = vi.fn(async () => new Response('x'.repeat(16 * 1024 + 1), {
      headers: { 'content-type': 'application/json' },
    }));
    const executor = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      fetchRequest,
    );

    await expect(executor.post(
      new URL('https://api.example/v1/test'),
      'x'.repeat(16 * 1024 + 1),
    )).resolves.toEqual({ status: 'unavailable' });
    expect(fetchRequest).not.toHaveBeenCalled();

    await expect(executor.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects invalid body length metadata and invalid deadlines fail-fast', async () => {
    const executor = new AuthenticatedHttpRequestExecutor(
      new FixedAuthentication(),
      async () => new Response('{}', { headers: { 'content-length': 'not-a-number' } }),
    );
    await expect(executor.post(new URL('https://api.example/v1/test'), '{}'))
      .resolves.toEqual({ status: 'unavailable' });
    expect(() => new AuthenticatedHttpRequestExecutor(new FixedAuthentication(), fetch, 0))
      .toThrow('positive safe integer');
  });
});
