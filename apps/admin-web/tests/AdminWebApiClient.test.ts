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
  project: '90000000-0000-4000-8000-000000000001',
  location: '91000000-0000-4000-8000-000000000001',
};

function validSession() {
  return {
    userId: ids.user,
    membershipId: ids.membership,
    organizationId: ids.organization,
    locationsEnabled: false,
    availableSections: ['setup', 'employees', 'time_records', 'time_export', 'review_items'],
    managementScope: { kind: 'organization' },
  };
}

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
    rowVersion: 1,
    location: null,
  }));
}

describe('AdminWebApiClient', () => {
  it('parses named Location setup pages and sends lifecycle mutations as closed DTOs', async () => {
    const fetchRequest = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        status: 'succeeded',
        locationsEnabled: false,
        kind: 'activation_gaps',
        items: [{ kind: 'membership', id: ids.employeeMembership, displayName: 'Employee Alpha' }],
        nextCursor: null,
      }))
      .mockResolvedValueOnce(json({ status: 'succeeded', idempotentRetry: false }));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.locationSetupPage(
      'token', ids.membership, 'activation_gaps', null,
    )).resolves.toEqual({
      status: 'succeeded',
      value: {
        locationsEnabled: false,
        items: [{ kind: 'membership', id: ids.employeeMembership,
          displayName: 'Employee Alpha' }],
        nextCursor: null,
      },
    });
    await expect(client.mutateLocationSetup(
      'token', ids.membership, ids.command,
      { action: 'set_home_location', membershipId: ids.employeeMembership,
        locationId: ids.location },
    )).resolves.toEqual({ status: 'succeeded', value: true });

    expect(fetchRequest.mock.calls[0]?.[0])
      .toBe('/v1/administration/location-setup/query');
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      kind: 'activation_gaps',
      cursor: null,
      limit: 100,
    });
    expect(JSON.parse(String(fetchRequest.mock.calls[1]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      action: 'set_home_location',
      membershipId: ids.employeeMembership,
      locationId: ids.location,
    });
  });

  it('records a password reset with an exact credential-free POST body and response', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => json({ status: 'succeeded' }));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.recordPasswordReset('recovery-token')).resolves.toEqual({
      status: 'succeeded', value: true,
    });
    expect(fetchRequest.mock.calls[0]?.[0]).toBe('/v1/auth/password-reset/audit');
    expect(fetchRequest.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST', body: '{}', credentials: 'omit', redirect: 'manual',
    });
    expect(fetchRequest.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer recovery-token', 'Content-Type': 'application/json',
    });

    fetchRequest.mockResolvedValueOnce(json({ status: 'succeeded', userId: ids.user }));
    await expect(client.recordPasswordReset('recovery-token')).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('accepts only the exact session shape and keeps the request same-origin and credential-free', async () => {
    const calls: Array<{ readonly input: RequestInfo | URL; readonly init?: RequestInit }> = [];
    const fetchRequest: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return json(validSession());
    };
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.session('secret-token')).resolves.toEqual({
      status: 'succeeded', value: {
        membershipId: ids.membership,
        organizationId: ids.organization,
        locationsEnabled: false,
        availableSections: ['setup', 'employees', 'time_records', 'time_export', 'review_items'],
        managementScope: { kind: 'organization' },
      },
    });
    expect(calls[0]?.input).toBe('/v2/session');
    expect(calls[0]?.init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' });
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
  });

  it('strictly accepts the located session contract without a role', async () => {
    const located = {
      ...validSession(),
      locationsEnabled: true,
      availableSections: ['employees'],
      managementScope: {
        kind: 'locations',
        locations: [{ id: ids.location, name: 'Berlin' }],
      },
    };
    const responses = [located, { ...located, role: 'standortleitung' }];
    const client = new AdminWebApiClient(async () => json(responses.shift()));

    await expect(client.session('token')).resolves.toEqual({
      status: 'succeeded',
      value: {
        membershipId: ids.membership,
        organizationId: ids.organization,
        locationsEnabled: true,
        availableSections: ['employees'],
        managementScope: {
          kind: 'locations',
          locations: [{ id: ids.location, name: 'Berlin' }],
        },
      },
    });
    await expect(client.session('token')).resolves.toEqual({ status: 'unavailable' });
  });

  it('bounds worst-case Location sessions at 488 entries', async () => {
    const sessionWithLocations = (count: number) => ({
      ...validSession(),
      locationsEnabled: true,
      managementScope: {
        kind: 'locations',
        locations: Array.from({ length: count }, (_, index) => ({
          id: `31000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          name: '😀'.repeat(120),
        })),
      },
    });
    const lastFitting = sessionWithLocations(488);
    const firstTooLarge = sessionWithLocations(489);
    expect(new TextEncoder().encode(JSON.stringify(lastFitting)).byteLength).toBe(261_890);
    expect(new TextEncoder().encode(JSON.stringify(firstTooLarge)).byteLength).toBe(262_426);
    const responses = [json(lastFitting), json(firstTooLarge)];
    const client = new AdminWebApiClient(async () => responses.shift()!);

    await expect(client.session('token')).resolves.toMatchObject({ status: 'succeeded' });
    await expect(client.session('token')).resolves.toEqual({ status: 'unavailable' });
  });

  it('invokes the default browser fetch with its required global receiver', async () => {
    const browserFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(json(validSession()));
    });
    vi.stubGlobal('fetch', browserFetch);
    try {
      await expect(new AdminWebApiClient().session('secret-token')).resolves.toEqual({
        status: 'succeeded', value: {
          membershipId: ids.membership,
          organizationId: ids.organization,
          locationsEnabled: false,
          availableSections: ['setup', 'employees', 'time_records', 'time_export', 'review_items'],
          managementScope: { kind: 'organization' },
        },
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
    const firstCursor = `v1:m:${firstPage.at(-1)!.id}`;
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'succeeded',
      organization: { id: ids.organization, name: 'TapTim.e' },
      employeeMemberships: firstPage,
      nextCursor: firstCursor,
    }));
    const client = new AdminWebApiClient(fetchRequest);
    await expect(client.employeeProjection('token', ids.membership, null, null)).resolves.toEqual({
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
      locationId: null,
    });
    expect(fetchRequest.mock.calls[0]?.[0])
      .toBe('/v2/administration/employee-memberships-projection');
    fetchRequest.mockResolvedValueOnce(json({
      status: 'succeeded',
      organization: { id: ids.organization, name: 'TapTim.e' },
      employeeMemberships: [{ id: ids.employeeMembership, displayName: 'Employee Alpha', role: 'administrator', active: true }],
      nextCursor: null,
    }));
    await expect(client.employeeProjection('token', ids.membership, null, null))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('sends the selected Location and exposes only its distinct scope rejection', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      error: { code: 'location_scope_forbidden' },
    }, 403));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.employeeProjection(
      'token', ids.membership, null, ids.location,
    )).resolves.toEqual({ status: 'conflict', code: 'location_scope_forbidden' });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      cursor: null,
      limit: 20,
      locationId: ids.location,
    });

    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'forbidden' } }, 403));
    await expect(client.employeeProjection(
      'token', ids.membership, null, ids.location,
    )).resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects unsafe Employee names, duplicates, ordering, and cursor discontinuity', async () => {
    const requestedCursor = 'v1:m:70000000-0000-4000-8000-000000000020';
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
        employeeMemberships: validPage, nextCursor: `v1:m:${validPage[18]!.id}`,
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
      await expect(client.employeeProjection('token', ids.membership, requestedCursor, null))
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
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
      .resolves.toEqual({
        status: 'succeeded',
        value: { value: secret, expiresAt: '2026-07-15T12:34:56.789Z' },
      });
    expect(fetchRequest.mock.calls[0]?.[0]).toBe('/v1/administration/employee-invitations');
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      displayName: 'Employee Alpha',
      role: 'employee',
    });

    fetchRequest.mockResolvedValueOnce(json({
      status: 'succeeded',
      membership: { id: ids.employeeMembership, role: 'administrator', active: true, rowVersion: 2 },
      idempotentRetry: false,
    }));
    await expect(client.changeMembershipRole(
      'token', ids.membership, ids.command, ids.employeeMembership, 1, 'administrator',
    )).resolves.toEqual({ status: 'succeeded', value: true });
    expect(fetchRequest.mock.calls.at(-1)?.[0]).toBe('/v1/administration/memberships/change-role');

    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'last_administrator' } }, 409));
    await expect(client.revokeMembership(
      'token', ids.membership, ids.command, ids.employeeMembership, 2,
    )).resolves.toEqual({ status: 'conflict', code: 'last_administrator' });

    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'invitation_limit_reached' } }, 409));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
      .resolves.toEqual({ status: 'conflict', code: 'invitation_limit_reached' });
    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'internal_detail' } }, 409));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invitation_limit_reached' },
    }), { status: 409, headers: { 'Content-Type': 'text/plain' } }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invitation_limit_reached' },
    }), { status: 409, headers: { 'Content-Type': 'application/jsonp' } }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'invitation_limit_reached' },
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', 'Content-Length': '16385' },
    }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
      .resolves.toEqual({ status: 'unavailable' });
    fetchRequest.mockResolvedValueOnce(json({
      status: 'succeeded',
      invitationSecret: `${secret.slice(0, -1)}B`,
      expiresAt: '2026-07-15T12:34:56.789Z',
    }));
    await expect(client.createEmployeeInvitation('token', ids.membership, ids.command, 'Employee Alpha', 'employee'))
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
    const chunks = [new Uint8Array(128 * 1024), new Uint8Array(128 * 1024), new Uint8Array(1)];
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

  it('strictly parses bounded effective records while discarding authority-only identifiers', async () => {
    const recordId = '90000000-0000-4000-8000-000000000001';
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'ready',
      records: [{
        timeRecordId: recordId,
        employeeMembershipId: ids.employeeMembership,
        employeeDisplayName: 'Employee Alpha',
        targetType: 'project',
        targetId: ids.customer,
        targetDisplayName: 'Werkstatt',
        source: 'canonical', status: 'stopped',
        startedVia: 'manual', stoppedVia: 'nfc',
        startedAt: '2026-07-20T08:00:00.000Z', stoppedAt: '2026-07-20T10:00:00.000Z',
        baseRowVersion: 1, effectiveRevisionNumber: 2, overlapsAnotherRecord: false,
      }],
      nextCursor: null,
    }));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.timeRecords(
      'token', ids.membership, '2026-07-01T00:00:00.000Z', '2026-07-21T00:00:00.000Z',
      null,
    )).resolves.toEqual({
      status: 'succeeded',
      value: {
        items: [{
          timeRecordId: recordId, employeeDisplayName: 'Employee Alpha',
          targetType: 'project', targetDisplayName: 'Werkstatt',
          source: 'canonical', status: 'stopped',
          startedVia: 'manual', stoppedVia: 'nfc',
          startedAt: '2026-07-20T08:00:00.000Z', stoppedAt: '2026-07-20T10:00:00.000Z',
          baseRowVersion: 1, effectiveRevisionNumber: 2, overlapsAnotherRecord: false,
        }],
        nextCursor: null,
      },
    });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toEqual({
      expectedMembershipId: ids.membership,
      fromInclusive: '2026-07-01T00:00:00.000Z',
      toExclusive: '2026-07-21T00:00:00.000Z', limit: 100, cursor: null,
    });
  });

  it('passes only bounded opaque TimeRecord and Review continuation cursors back to the server', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async (input) => json(
      String(input).includes('review-items')
        ? { status: 'ready', items: [], nextCursor: null }
        : { status: 'ready', records: [], nextCursor: null },
    ));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.timeRecords(
      'token',
      ids.membership,
      '2026-07-01T00:00:00.000Z',
      '2026-07-21T00:00:00.000Z',
      'time_page_2',
    )).resolves.toEqual({
      status: 'succeeded',
      value: { items: [], nextCursor: null },
    });
    await expect(client.reviewItems(
      'token', ids.membership, 'review_page_2',
    )).resolves.toEqual({
      status: 'succeeded',
      value: { items: [], nextCursor: null },
    });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body)).cursor).toBe('time_page_2');
    expect(JSON.parse(String(fetchRequest.mock.calls[1]?.[1]?.body)).cursor).toBe('review_page_2');

    await expect(client.timeRecords(
      'token',
      ids.membership,
      '2026-07-01T00:00:00.000Z',
      '2026-07-21T00:00:00.000Z',
      'contains whitespace',
    )).resolves.toEqual({ status: 'unavailable' });
    expect(fetchRequest).toHaveBeenCalledTimes(2);
  });

  it('submits exact correction/adjudication commands and maps only safe write conflicts', async () => {
    const record = {
      timeRecordId: '90000000-0000-4000-8000-000000000001',
      employeeDisplayName: 'Employee Alpha', targetType: 'customer' as const,
      targetDisplayName: 'Werkstatt', startedVia: 'nfc' as const, stoppedVia: 'nfc' as const,
      source: 'canonical' as const, status: 'stopped' as const,
      startedAt: '2026-07-20T08:00:00.000Z', stoppedAt: '2026-07-20T10:00:00.000Z',
      baseRowVersion: 1, effectiveRevisionNumber: 2, overlapsAnotherRecord: false,
    };
    const fetchRequest = vi.fn<typeof fetch>(async () => json({
      status: 'committed', timeRecordId: record.timeRecordId, revisionNumber: 3,
      startedAt: '2026-07-20T08:15:00.000Z', stoppedAt: '2026-07-20T10:15:00.000Z',
      idempotentRetry: false,
    }));
    const client = new AdminWebApiClient(fetchRequest);
    await expect(client.correctTimeRecord(
      'token', ids.membership, ids.command, record,
      '2026-07-20T08:15:00.000Z', '2026-07-20T10:15:00.000Z', 'Beleg geprüft',
    )).resolves.toEqual({ status: 'succeeded', value: true });
    expect(JSON.parse(String(fetchRequest.mock.calls[0]?.[1]?.body))).toMatchObject({
      expectedMembershipId: ids.membership, commandId: ids.command,
      timeRecordId: record.timeRecordId, expectedBaseRowVersion: 1,
      expectedRevisionNumber: 2, reason: 'Beleg geprüft',
    });

    fetchRequest.mockResolvedValueOnce(json({ error: { code: 'conflict' } }, 409));
    await expect(client.correctTimeRecord(
      'token', ids.membership, ids.command, record,
      '2026-07-20T08:15:00.000Z', '2026-07-20T10:15:00.000Z', 'Beleg geprüft',
    )).resolves.toEqual({ status: 'conflict', code: 'time_review_conflict' });
  });

  it('accepts only a bounded attachment response from the fixed payroll CSV v3 route', async () => {
    const fetchRequest = vi.fn<typeof fetch>(async () => new Response('schema_version\n1\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="taptime-time-entries_v3_20260701T000000Z_20260721T000000Z.csv"',
      },
    }));
    const client = new AdminWebApiClient(fetchRequest);
    const result = await client.exportTimeEntries(
      'token', ids.membership, '2026-07-01T00:00:00.000Z', '2026-07-21T00:00:00.000Z',
    );
    expect(result).toMatchObject({
      status: 'succeeded',
      value: { filename: 'taptime-time-entries_v3_20260701T000000Z_20260721T000000Z.csv' },
    });
    expect(fetchRequest.mock.calls[0]?.[0]).toBe('/v3/time-entries/export');
  });

  it('parses the closed Project projection and exposes active-use conflicts only', async () => {
    const fetchRequest = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        projects: [{
          projectId: ids.project,
          displayName: 'Innenausbau',
          active: true,
          rowVersion: 1,
        }],
        nextCursor: null,
      }))
      .mockResolvedValueOnce(json({ error: { code: 'project_in_use' } }, 409));
    const client = new AdminWebApiClient(fetchRequest);

    await expect(client.projects('token', ids.membership, null)).resolves.toEqual({
      status: 'succeeded',
      value: {
        items: [{
          projectId: ids.project,
          displayName: 'Innenausbau',
          active: true,
          rowVersion: 1,
        }],
        nextCursor: null,
      },
    });
    await expect(client.deactivateProject(
      'token',
      ids.membership,
      ids.command,
      {
        projectId: ids.project,
        displayName: 'Innenausbau',
        active: true,
        rowVersion: 1,
      },
    )).resolves.toEqual({ status: 'conflict', code: 'project_in_use' });
  });

  it('rejects an oversized CSV stream before returning a browser Blob', async () => {
    let chunkIndex = 0;
    const chunks = [new Uint8Array(8 * 1024 * 1024), new Uint8Array(1)];
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[chunkIndex++];
        if (chunk === undefined) controller.close(); else controller.enqueue(chunk);
      },
      cancel() { /* The client performs best-effort stream cancellation. */ },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="taptime-time-entries_v3_20260701T000000Z_20260721T000000Z.csv"',
      },
    });
    const client = new AdminWebApiClient(vi.fn<typeof fetch>(async () => response));
    await expect(client.exportTimeEntries(
      'token', ids.membership, '2026-07-01T00:00:00.000Z', '2026-07-21T00:00:00.000Z',
    )).resolves.toEqual({ status: 'unavailable' });
    expect(chunkIndex).toBeGreaterThanOrEqual(2);
  });
});
