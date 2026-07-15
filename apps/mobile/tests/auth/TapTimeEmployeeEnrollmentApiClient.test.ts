import { describe, expect, it, vi } from 'vitest';
import { TapTimeEmployeeEnrollmentApiClient } from '../../src/auth/TapTimeEmployeeEnrollmentApiClient';

const commandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const invitationSecret = Buffer.alloc(32, 17).toString('base64url');

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

describe('TapTimeEmployeeEnrollmentApiClient', () => {
  it('invokes the default fetch with its required global receiver', async () => {
    const runtimeFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(json({
        status: 'succeeded',
        organizationName: 'Synthetic Organization A',
        membershipDisplayName: 'Employee Alpha',
        role: 'employee',
      }));
    });
    vi.stubGlobal('fetch', runtimeFetch);
    try {
      const client = new TapTimeEmployeeEnrollmentApiClient('https://api.example.test');
      await expect(client.redeem(() => 'token', commandId, invitationSecret))
        .resolves.toEqual({ status: 'succeeded' });
      expect(runtimeFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sends only command and canonical secret with ephemeral credential-free transport', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'succeeded',
      organizationName: 'Synthetic Organization A',
      membershipDisplayName: 'Employee Alpha',
      role: 'employee',
    }));
    const client = new TapTimeEmployeeEnrollmentApiClient('https://api.example.test/root', fetchRequest);
    await expect(client.redeem(() => 'memory-only-access', commandId, invitationSecret))
      .resolves.toEqual({ status: 'succeeded' });
    expect(fetchRequest).toHaveBeenCalledOnce();
    expect(fetchRequest.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/root/v1/employee-enrollment/redeem',
    );
    expect(fetchRequest.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST', credentials: 'omit', redirect: 'manual',
      headers: {
        Authorization: 'Bearer memory-only-access',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      commandId,
      invitationSecret,
    });
    expect(JSON.stringify(fetchRequest.mock.calls[0]?.[1]?.headers))
      .not.toMatch(/membership|organization|cookie/i);
  });

  it.each([
    ['too short', 'abc'],
    ['padding', `${invitationSecret}=`],
    ['alphabet', `${invitationSecret.slice(0, -1)}+`],
    ['trailing pad bits', `${invitationSecret.slice(0, -1)}B`],
  ])('rejects %s before reading the access token or making a request', async (_label, secret) => {
    const fetchRequest = vi.fn<typeof fetch>();
    const accessToken = vi.fn(() => 'must-not-be-read');
    const client = new TapTimeEmployeeEnrollmentApiClient('https://api.example.test', fetchRequest);
    await expect(client.redeem(accessToken, commandId, secret))
      .resolves.toEqual({ status: 'invalid_request' });
    expect(accessToken).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it.each([
    [401, { error: { code: 'unauthorized' } }, 'authority_rejected'],
    [404, { error: { code: 'enrollment_unavailable' } }, 'enrollment_unavailable'],
    [400, { error: { code: 'invalid_request' } }, 'invalid_request'],
    [503, { error: { code: 'service_unavailable' } }, 'transient_failure'],
  ] as const)('maps HTTP %s to %s', async (statusCode, body, status) => {
    const client = new TapTimeEmployeeEnrollmentApiClient(
      'https://api.example.test',
      async () => json(body, statusCode),
    );
    await expect(client.redeem(() => 'token', commandId, invitationSecret))
      .resolves.toEqual({ status });
  });

  it('fails closed for extra success fields, wrong content type, and redirects', async () => {
    const responses = [
      json({
        status: 'succeeded',
        organizationName: 'Synthetic Organization A',
        membershipDisplayName: 'Employee Alpha',
        role: 'employee',
        userId: 'must-not-escape',
      }),
      new Response('{}', { status: 200, headers: { 'Content-Type': 'text/html' } }),
      new Response(null, { status: 302, headers: { Location: 'https://other.example/' } }),
    ];
    const client = new TapTimeEmployeeEnrollmentApiClient(
      'https://api.example.test',
      async () => responses.shift()!,
    );
    for (let index = 0; index < 3; index += 1) {
      await expect(client.redeem(() => 'token', commandId, invitationSecret))
        .resolves.toEqual({ status: 'transient_failure' });
    }
  });

  it('cancels an oversized response before full buffering', async () => {
    const cancel = vi.fn();
    let index = 0;
    const chunks = [new Uint8Array(8 * 1024), new Uint8Array(8 * 1024), new Uint8Array(1)];
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(chunks[index++]!); },
      cancel,
    }, { highWaterMark: 0 }), { headers: { 'Content-Type': 'application/json' } });
    const client = new TapTimeEmployeeEnrollmentApiClient('https://api.example.test', async () => response);
    await expect(client.redeem(() => 'token', commandId, invitationSecret))
      .resolves.toEqual({ status: 'transient_failure' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(index).toBe(3);
  });
});
