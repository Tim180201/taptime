import { OrganizationId } from '@taptime/core';
import { describe, expect, it } from 'vitest';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';
import { TapTimeScanContextApiClient } from '../../src/transport/TapTimeScanContextApiClient';

const ids = {
  organization: '00000000-0000-4000-8000-000000000101',
  assignment: '40000000-0000-4000-8000-000000000101',
  tag: '30000000-0000-4000-8000-000000000101',
  customer: '20000000-0000-4000-8000-000000000101',
};

class FakeJsonPost implements AuthenticatedJsonPostPort {
  readonly calls: Array<{ readonly endpoint: string; readonly body: string }> = [];
  result: AuthenticatedHttpResult = {
    status: 'response',
    statusCode: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer },
    }),
  };

  async post(endpoint: URL, body: string): Promise<AuthenticatedHttpResult> {
    this.calls.push({ endpoint: endpoint.href, body });
    return this.result;
  }
}

function setup() {
  const request = new FakeJsonPost();
  const client = new TapTimeScanContextApiClient('https://api.example/base/', request);
  return { request, client };
}

describe('TapTimeScanContextApiClient', () => {
  it('posts only the exact requested scope and opaque case-sensitive payload', async () => {
    const { request, client } = setup();
    const command = {
      organizationId: OrganizationId(ids.organization),
      payload: 'AbC-00-CaseSensitive',
      role: 'administrator',
      triggeredBy: 'must-not-leave',
    };

    await expect(client.resolve(command)).resolves.toEqual({
      status: 'resolved',
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer },
    });
    expect(request.calls).toEqual([{
      endpoint: 'https://api.example/base/v1/scan-context/resolve',
      body: JSON.stringify({
        organizationId: ids.organization,
        payload: 'AbC-00-CaseSensitive',
      }),
    }]);
    expect(request.calls[0]?.body).not.toContain('administrator');
    expect(request.calls[0]?.body).not.toContain('must-not-leave');
  });

  it('accepts the exact 1,024 UTF-8-byte boundary and rejects an oversized payload locally', async () => {
    const { request, client } = setup();
    const exact = 'é'.repeat(512);
    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: exact,
    })).resolves.toMatchObject({ status: 'resolved' });
    expect(request.calls).toHaveLength(1);

    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: `${exact}x`,
    })).resolves.toEqual({ status: 'unavailable' });
    expect(request.calls).toHaveLength(1);
  });

  it('rejects empty payload and malformed requested Organization without issuing a request', async () => {
    const { request, client } = setup();
    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: '',
    })).resolves.toEqual({ status: 'unavailable' });
    await expect(client.resolve({
      organizationId: OrganizationId('not-a-uuid'), payload: 'opaque',
    })).resolves.toEqual({ status: 'unavailable' });
    expect(request.calls).toEqual([]);
  });

  it('maps only the exact generic JSON 404 to one disclosure-safe not-resolved result', async () => {
    const { request, client } = setup();
    request.result = {
      status: 'response',
      statusCode: 404,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ error: { code: 'not_found' } }),
    };
    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: 'unknown',
    })).resolves.toEqual({ status: 'not_resolved' });
  });

  it.each([
    ['non-JSON response', 'text/html', '<h1>proxy route missing</h1>'],
    ['malformed JSON', 'application/json', '{'],
    ['wrong error code', 'application/json', JSON.stringify({ error: { code: 'unknown' } })],
    [
      'additional disclosure field',
      'application/json',
      JSON.stringify({ error: { code: 'not_found', object: 'nfc_tag' } }),
    ],
  ])('fails closed for a %s 404', async (_label, contentType, body) => {
    const { request, client } = setup();
    request.result = { status: 'response', statusCode: 404, contentType, body };
    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: 'unknown',
    })).resolves.toEqual({ status: 'unavailable' });
  });

  it.each([
    null,
    [],
    { assignmentId: ids.assignment, nfcTagId: ids.tag },
    {
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'project', targetId: ids.customer },
    },
    {
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer },
      customerName: 'must-not-escape',
    },
  ])('rejects malformed or over-broad success JSON %#', async (body) => {
    const { request, client } = setup();
    request.result = {
      status: 'response',
      statusCode: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    };
    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: 'opaque',
    })).resolves.toEqual({ status: 'unavailable' });
  });

  it('requires JSON on success and propagates only fixed transport failure outcomes', async () => {
    const { request, client } = setup();
    request.result = {
      status: 'response', statusCode: 200, contentType: 'text/html', body: '{}',
    };
    await expect(client.resolve({
      organizationId: OrganizationId(ids.organization), payload: 'opaque',
    })).resolves.toEqual({ status: 'unavailable' });

    for (const status of ['authority_rejected', 'transient_failure', 'unavailable'] as const) {
      request.result = { status };
      await expect(client.resolve({
        organizationId: OrganizationId(ids.organization), payload: 'opaque',
      })).resolves.toEqual({ status });
    }
  });
});
