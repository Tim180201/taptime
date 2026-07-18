import { describe, expect, it, vi } from 'vitest';
import { AdminWebApiClient } from '../src/AdminWebApiClient';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  membership: '20000000-0000-4000-8000-000000000001',
  organization: '30000000-0000-4000-8000-000000000001',
  customer: '40000000-0000-4000-8000-000000000001',
  tag: '50000000-0000-4000-8000-000000000001',
  command: '60000000-0000-4000-8000-000000000001',
  assignment: '80000000-0000-4000-8000-000000000001',
  employeeMembership: '70000000-0000-4000-8000-000000000001',
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
      activeAssignmentId: ids.assignment,
    }],
    nextCursor: null,
  };
}

function employeeMemberships(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `70000000-0000-4000-8000-${(start + index).toString().padStart(12, '0')}`,
    displayName: `Employee ${start + index}`,
    role: 'employee' as const,
    active: true as const,
  }));
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
          activeAssignmentId: ids.assignment,
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

  it('sends the exact reassignment command and strictly maps success and safe conflicts', async () => {
    const targetCustomer = '40000000-0000-4000-8000-000000000002';
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: true,
      resultAssignmentId: '80000000-0000-4000-8000-000000000002',
      replacedAssignmentId: ids.assignment,
      targetCustomerId: targetCustomer,
      effectiveAt: '2026-07-18T12:34:56.789Z',
    }));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.reassignNfcTag(
      'token',
      ids.membership,
      ids.command,
      ids.tag,
      ids.assignment,
      targetCustomer,
    )).resolves.toEqual({ status: 'succeeded', value: { assignmentChanged: true } });
    expect(fetchRequest.mock.calls[0]?.[0]).toBe('/v1/administration/nfc-tags/reassign');
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      nfcTagId: ids.tag,
      expectedActiveAssignmentId: ids.assignment,
      targetCustomerId: targetCustomer,
    });

    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'assignment_in_use' } }, 409));
    await expect(client.reassignNfcTag(
      'token',
      ids.membership,
      ids.command,
      ids.tag,
      ids.assignment,
      targetCustomer,
    )).resolves.toEqual({ status: 'conflict', code: 'assignment_in_use' });
  });

  it('rejects reassignment successes that do not match the submitted Assignment and target', async () => {
    const targetCustomer = '40000000-0000-4000-8000-000000000002';
    const validResult = {
      status: 'succeeded',
      idempotentRetry: false,
      assignmentChanged: true,
      resultAssignmentId: '80000000-0000-4000-8000-000000000002',
      replacedAssignmentId: ids.assignment,
      targetCustomerId: targetCustomer,
      effectiveAt: '2026-07-18T12:34:56.789Z',
    };
    const fetchRequest = vi.fn<typeof fetch>();
    const client = new AdminWebApiClient(fetchRequest);
    const submit = () => client.reassignNfcTag(
      'token',
      ids.membership,
      ids.command,
      ids.tag,
      ids.assignment,
      targetCustomer,
    );

    for (const invalid of [
      { ...validResult, targetCustomerId: ids.customer },
      { ...validResult, replacedAssignmentId: ids.command },
      {
        ...validResult,
        assignmentChanged: false,
        resultAssignmentId: validResult.resultAssignmentId,
        replacedAssignmentId: null,
        effectiveAt: null,
      },
    ]) {
      fetchRequest.mockResolvedValueOnce(json(invalid));
      await expect(submit()).resolves.toEqual({ status: 'unavailable' });
    }

    fetchRequest.mockResolvedValueOnce(json({
      ...validResult,
      assignmentChanged: false,
      resultAssignmentId: ids.assignment,
      replacedAssignmentId: null,
      effectiveAt: null,
    }));
    await expect(submit()).resolves.toEqual({
      status: 'succeeded',
      value: { assignmentChanged: false },
    });
  });

  it('strictly parses the bounded Employee Membership projection', async () => {
    const firstPage = employeeMemberships(1, 20);
    const firstCursor = `v1:e:${firstPage.at(-1)!.id}`;
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'succeeded',
      organization: { id: ids.organization, name: 'TapTim.e' },
      employeeMemberships: firstPage,
      nextCursor: firstCursor,
    }));
    const client = new AdminWebApiClient(fetchRequest);
    await expect(client.employeeProjection('token', ids.membership, null)).resolves.toEqual({
      status: 'succeeded',
      value: {
        organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: firstPage,
        nextCursor: firstCursor,
      },
    });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      cursor: null,
      limit: 20,
    });
    fetchRequest.mockResolvedValueOnce(json({
      status: 'succeeded',
      organization: { id: ids.organization, name: 'TapTim.e' },
      employeeMemberships: [{ id: ids.employeeMembership, displayName: 'Employee Alpha', role: 'administrator', active: true }],
      nextCursor: null,
    }));
    await expect(client.employeeProjection('token', ids.membership, null))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects unsafe Employee names, duplicates, ordering, and cursor discontinuity', async () => {
    const requestedCursor = 'v1:e:70000000-0000-4000-8000-000000000020';
    const validPage = employeeMemberships(21, 20);
    const responses = [
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: [validPage[0], validPage[0]], nextCursor: null,
      },
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: [validPage[1], validPage[0]], nextCursor: null,
      },
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: [{ ...validPage[0], id: requestedCursor.slice(5) }], nextCursor: null,
      },
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: validPage, nextCursor: `v1:e:${validPage[18]!.id}`,
      },
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: [{ ...validPage[0], displayName: ' Employee 21' }], nextCursor: null,
      },
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: [{ ...validPage[0], displayName: 'E\u0301mployee 21' }], nextCursor: null,
      },
      {
        status: 'succeeded', organization: { id: ids.organization, name: 'TapTim.e' },
        employeeMemberships: [{ ...validPage[0], displayName: `Employee\u0000 21` }], nextCursor: null,
      },
    ];
    const client = new AdminWebApiClient(async () => json(responses.shift()!));
    for (let index = 0; index < 7; index += 1) {
      await expect(client.employeeProjection('token', ids.membership, requestedCursor))
        .resolves.toEqual({ status: 'unavailable' });
    }
  });

  it('accepts only a canonical one-time invitation secret and exposes only allowlisted conflicts', async () => {
    const secret = Buffer.alloc(32, 19).toString('base64url');
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'succeeded',
      invitationSecret: secret,
      expiresAt: '2026-07-15T12:34:56.789Z',
    }));
    const client = new AdminWebApiClient(fetchRequest);
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({
        status: 'succeeded',
        value: { value: secret, expiresAt: '2026-07-15T12:34:56.789Z' },
      });
    expect(fetchRequest.mock.calls[0]?.[0]).toBe('/v1/administration/employee-invitations');
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      displayName: 'Employee Alpha',
    });

    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'invitation_limit_reached' } }, 409));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({ status: 'conflict', code: 'invitation_limit_reached' });
    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'internal_detail' } }, 409));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invitation_limit_reached' },
    }), { status: 409, headers: { 'Content-Type': 'text/plain' } }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invitation_limit_reached' },
    }), { status: 409, headers: { 'Content-Type': 'application/jsonp' } }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invitation_limit_reached' },
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', 'Content-Length': '16385' },
    }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(json({
      status: 'succeeded',
      invitationSecret: `${secret.slice(0, -1)}B`,
      expiresAt: '2026-07-15T12:34:56.789Z',
    }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha'))
      .resolves.toEqual({ status: 'unavailable' });
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
