import { describe, expect, it, vi } from 'vitest';
import { AdminWebApiClient } from '../src/AdminWebApiClient';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  membership: '20000000-0000-4000-8000-000000000001',
  organization: '30000000-0000-4000-8000-000000000001',
  customer: '40000000-0000-4000-8000-000000000001',
  tag: '50000000-0000-4000-8000-000000000001',
  command: '60000000-0000-4000-8000-000000000001',
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function validProjection() {
  return {
    status: 'succeeded',
    organization: { id: ids.organization, name: 'TapTim.e' },
    customers: [{ id: ids.customer, displayName: 'Werkstatt', active: true }],
    nfcTags: [{
      id: ids.tag,
      displayName: 'Eingang',
      validationFingerprint: 'A1B2C3D4E5F6',
      assignmentState: 'assigned',
      targetCustomerId: ids.customer,
    }],
    nextCursor: null,
  };
}

describe('AdminWebApiClient', () => {
  it('accepts only the exact session shape and keeps the request same-origin and credential-free', async () => {
    const calls: Array<{ readonly input: RequestInfo | URL; readonly init?: RequestInit }> = [];
    const fetchRequest: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return json({ userId: ids.user, membershipId: ids.membership, organizationId: ids.organization, role: 'administrator' });
    };
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.session('secret-token')).resolves.toEqual({
      status: 'succeeded', value: { membershipId: ids.membership, role: 'administrator' },
    });
    expect(calls[0]?.input).toBe('/v1/session');
    expect(calls[0]?.init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' });
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
  });

  it('invokes the default browser fetch with its required global receiver', async () => {
    const browserFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(json({
        userId: ids.user,
        membershipId: ids.membership,
        organizationId: ids.organization,
        role: 'administrator',
      }));
    });
    vi.stubGlobal('fetch', browserFetch);
    try {
      await expect(new AdminWebApiClient().session('secret-token')).resolves.toEqual({
        status: 'succeeded', value: { membershipId: ids.membership, role: 'administrator' },
      });
      expect(browserFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('serializes the bounded projection request and rejects malformed cursor or extra response fields', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => json(validProjection()));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.projection('token', ids.membership, null)).resolves.toEqual({
      status: 'succeeded',
      value: {
        organization: { id: ids.organization, name: 'TapTim.e' },
        customers: [{ id: ids.customer, displayName: 'Werkstatt', active: true }],
        nfcTags: [{
          id: ids.tag,
          displayName: 'Eingang',
          validationFingerprint: 'A1B2C3D4E5F6',
          assignmentState: 'assigned',
          targetCustomerId: ids.customer,
        }],
        nextCursor: null,
      },
    });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership, cursor: null, limit: 20,
    });

    fetchRequest.mockResolvedValueOnce(json({ ...validProjection(), nextCursor: 12 }));
    await expect(client.projection('token', ids.membership, null)).resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(json({ ...validProjection(), providerSubject: 'must-not-escape' }));
    await expect(client.projection('token', ids.membership, null)).resolves.toEqual({ status: 'unavailable' });

    await expect(client.projection('token', ids.membership, 'not-a-cursor')).resolves.toEqual({ status: 'unavailable' });
    expect(fetchRequest).toHaveBeenCalledTimes(3);
  });

  it('accepts an exact idempotent Customer result and sends no tenant or role selector', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'succeeded',
      idempotentRetry: true,
      customer: { id: ids.customer, displayName: 'Werkstatt', active: true },
    }));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.createCustomer('token', ids.membership, ids.command, 'Werkstatt'))
      .resolves.toEqual({ status: 'succeeded', value: true });
    expect(fetchRequest.mock.calls[0]?.[0]).toBe('/v1/administration/customers');
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      displayName: 'Werkstatt',
    });
  });

  it.each([401, 403])('maps HTTP %s to one disclosure-safe authority rejection', async (status) => {
    const client = new AdminWebApiClient(async () => new Response('provider detail', {
      status, headers: { 'Content-Type': 'text/plain' },
    }));
    await expect(client.session('token')).resolves.toEqual({ status: 'rejected' });
  });

  it('fails closed for malformed JSON, wrong content type, invalid length metadata, and redirects', async () => {
    const responses = [
      new Response('{', { headers: { 'Content-Type': 'application/json' } }),
      new Response('{}', { headers: { 'Content-Type': 'text/html' } }),
      new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': 'not-a-number' } }),
      new Response(null, { status: 302, headers: { Location: 'https://other-origin.example/' } }),
    ];
    const client = new AdminWebApiClient(async () => responses.shift()!);
    for (let index = 0; index < 4; index += 1) {
      await expect(client.session('token')).resolves.toEqual({ status: 'unavailable' });
    }
  });

  it('cancels an oversized streamed response before full buffering', async () => {
    const cancel = vi.fn();
    let chunkIndex = 0;
    const chunks = [new Uint8Array(8 * 1024), new Uint8Array(8 * 1024), new Uint8Array(1)];
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(chunks[chunkIndex++]!); },
      cancel,
    }, { highWaterMark: 0 }), { headers: { 'Content-Type': 'application/json' } });
    const text = vi.spyOn(response, 'text');
    const client = new AdminWebApiClient(async () => response);

    await expect(client.session('token')).resolves.toEqual({ status: 'unavailable' });
    expect(text).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunkIndex).toBe(3);
  });
});
