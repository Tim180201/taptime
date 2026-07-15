import { describe, expect, it } from 'vitest';
import { TapTimeAdministrationApiClient } from '../../src/administration/TapTimeAdministrationApiClient';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostOptions,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';

const ids = {
  membership: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  customer: '30000000-0000-4000-8000-000000000001',
  tag: '40000000-0000-4000-8000-000000000001',
  command: '50000000-0000-4000-8000-000000000001',
  assignment: '60000000-0000-4000-8000-000000000001',
};

class FakeJsonPost implements AuthenticatedJsonPostPort {
  readonly calls: Array<{
    readonly endpoint: string;
    readonly body: string;
    readonly options: AuthenticatedJsonPostOptions | undefined;
  }> = [];
  result: AuthenticatedHttpResult = projectionResponse();

  async post(endpoint: URL, body: string, options?: AuthenticatedJsonPostOptions): Promise<AuthenticatedHttpResult> {
    this.calls.push({ endpoint: endpoint.href, body, options });
    return this.result;
  }
}

function projectionResponse(body: unknown = {
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
}): AuthenticatedHttpResult {
  return { status: 'response', statusCode: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) };
}

function provisionResponse(idempotentRetry = false): AuthenticatedHttpResult {
  return {
    status: 'response',
    statusCode: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'succeeded',
      idempotentRetry,
      nfcTag: {
        id: ids.tag,
        displayName: 'Eingang',
        validationFingerprint: 'A1B2C3D4E5F6',
        assignmentState: 'assigned',
        targetCustomerId: ids.customer,
      },
      assignmentId: ids.assignment,
    }),
  };
}

function setup() {
  const request = new FakeJsonPost();
  const client = new TapTimeAdministrationApiClient('https://api.example/base/', request);
  return { request, client };
}

describe('TapTimeAdministrationApiClient', () => {
  it('reads only the exact bounded setup projection for the compare-only Membership', async () => {
    const { request, client } = setup();

    await expect(client.readProjection(ids.membership, null)).resolves.toEqual({
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
    });
    expect(request.calls).toEqual([{
      endpoint: 'https://api.example/base/v1/administration/setup-projection',
      body: JSON.stringify({ expectedMembershipId: ids.membership, cursor: null, limit: 20 }),
      options: undefined,
    }]);
  });

  it('rejects malformed Membership/cursor and over-broad or malformed projection results', async () => {
    const { request, client } = setup();
    await expect(client.readProjection('not-a-uuid', null)).resolves.toEqual({ status: 'unavailable' });
    await expect(client.readProjection(ids.membership, 'not-a-cursor')).resolves.toEqual({ status: 'unavailable' });
    expect(request.calls).toEqual([]);

    for (const body of [
      { ...JSON.parse((projectionResponse() as Extract<AuthenticatedHttpResult, { status: 'response' }>).body), nextCursor: 12 },
      { ...JSON.parse((projectionResponse() as Extract<AuthenticatedHttpResult, { status: 'response' }>).body), providerSubject: 'must-not-escape' },
      { ...JSON.parse((projectionResponse() as Extract<AuthenticatedHttpResult, { status: 'response' }>).body), nfcTags: [{ id: ids.tag }] },
    ]) {
      request.result = projectionResponse(body);
      await expect(client.readProjection(ids.membership, null)).resolves.toEqual({ status: 'unavailable' });
    }
  });

  it.each([false, true])('maps an exact provision success including idempotent replay=%s', async (idempotentRetry) => {
    const { request, client } = setup();
    request.result = provisionResponse(idempotentRetry);
    const command = {
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      customerId: ids.customer,
      displayName: 'Eingang',
      canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30',
    };

    await expect(client.provisionTag(command)).resolves.toEqual({
      status: 'succeeded', validationFingerprint: 'A1B2C3D4E5F6',
    });
    expect(request.calls).toEqual([{
      endpoint: 'https://api.example/base/v1/administration/nfc-tags/provision',
      body: JSON.stringify(command),
      options: undefined,
    }]);
  });

  it('rejects malformed command IDs locally without exposing raw payload to a request', async () => {
    const { request, client } = setup();
    await expect(client.provisionTag({
      expectedMembershipId: ids.membership,
      commandId: 'not-a-uuid',
      customerId: ids.customer,
      displayName: 'Eingang',
      canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30',
    })).resolves.toEqual({ status: 'invalid_request' });
    expect(request.calls).toEqual([]);
  });

  it.each([
    'invalid_request',
    'assignment_target_unavailable',
    'tag_payload_already_registered',
    'command_id_conflict',
  ] as const)('maps only the closed administration error vocabulary: %s', async (code) => {
    const { request, client } = setup();
    request.result = {
      status: 'response', statusCode: 409, contentType: 'application/json',
      body: JSON.stringify({ error: { code } }),
    };
    await expect(client.provisionTag({
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      customerId: ids.customer,
      displayName: 'Eingang',
      canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30',
    })).resolves.toEqual({ status: code });
  });

  it('fails closed for over-broad success/error JSON, non-JSON, and unknown status codes', async () => {
    const { request, client } = setup();
    const command = {
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      customerId: ids.customer,
      displayName: 'Eingang',
      canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30',
    };
    const validSuccess = JSON.parse((provisionResponse() as Extract<AuthenticatedHttpResult, { status: 'response' }>).body);
    for (const response of [
      { status: 'response' as const, statusCode: 200, contentType: 'application/json', body: JSON.stringify({ ...validSuccess, providerSubject: 'must-not-escape' }) },
      { status: 'response' as const, statusCode: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unknown' } }) },
      { status: 'response' as const, statusCode: 200, contentType: 'text/html', body: '<h1>proxy</h1>' },
      { status: 'response' as const, statusCode: 418, contentType: 'application/json', body: '{}' },
    ]) {
      request.result = response;
      await expect(client.provisionTag(command)).resolves.toEqual({ status: 'unavailable' });
    }
  });

  it('propagates only fixed authority and availability outcomes', async () => {
    const { request, client } = setup();
    for (const status of ['authority_rejected', 'transient_failure', 'unavailable'] as const) {
      request.result = { status };
      await expect(client.readProjection(ids.membership, null)).resolves.toEqual({ status });
    }
    request.result = { status: 'response', statusCode: 403, contentType: null, body: 'detail' };
    await expect(client.readProjection(ids.membership, null)).resolves.toEqual({ status: 'authority_rejected' });
  });
});
