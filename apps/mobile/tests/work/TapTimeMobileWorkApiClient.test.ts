import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';
import { TapTimeMobileWorkApiClient } from '../../src/work/TapTimeMobileWorkApiClient';

const ids = {
  membership: '10000000-0000-4000-8000-000000000001',
  target: '20000000-0000-4000-8000-000000000001',
  event: '30000000-0000-4000-8000-000000000001',
  receipt: '40000000-0000-4000-8000-000000000001',
  record: '50000000-0000-4000-8000-000000000001',
} as const;

function response(body: unknown, statusCode = 200): AuthenticatedHttpResult {
  return {
    status: 'response',
    statusCode,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body),
  };
}

describe('TapTimeMobileWorkApiClient', () => {
  it('reads self-only time and safe targets without a user or Organization selector', async () => {
    const post = vi.fn<AuthenticatedJsonPostPort['post']>()
      .mockResolvedValueOnce(response({
        activeRecord: null,
        records: [],
        nextCursor: null,
        windowStartedAt: '2026-06-23T10:00:00.000Z',
        windowEndedAt: '2026-07-24T10:00:00.000Z',
      }))
      .mockResolvedValueOnce(response({
        targets: [{
          targetType: 'general_work',
          targetId: ids.target,
          displayName: 'Allgemeine Arbeitszeit',
        }],
        nextCursor: null,
      }));
    const client = new TapTimeMobileWorkApiClient(
      new URL('https://api.invalid'),
      { post },
      () => ids.event,
    );

    await expect(client.read(ids.membership)).resolves.toMatchObject({
      status: 'ready',
      targets: { targets: [{ targetType: 'general_work' }] },
    });
    expect(post.mock.calls.map(([endpoint]) => endpoint.pathname)).toEqual([
      '/v1/mobile/own-time/query',
      '/v1/mobile/work-targets/query',
    ]);
    expect(post.mock.calls.map(([, body]) => JSON.parse(body))).toEqual([
      { expectedMembershipId: ids.membership, cursor: null, limit: 20 },
      { expectedMembershipId: ids.membership, cursor: null, limit: 50 },
    ]);
  });

  it('sends one manual trigger without caller time or Start/Stop choice', async () => {
    const generated = [ids.event, ids.receipt];
    const post = vi.fn<AuthenticatedJsonPostPort['post']>().mockResolvedValue(response({
      status: 'synchronized',
      decision: { status: 'time_entry_started', timeEntryId: ids.record },
    }));
    const client = new TapTimeMobileWorkApiClient(
      new URL('https://api.invalid'),
      { post },
      () => generated.shift()!,
    );

    await expect(client.triggerManual(ids.membership, {
      targetType: 'project',
      targetId: ids.target,
      displayName: 'Innenausbau',
    })).resolves.toEqual({ status: 'accepted', outcome: 'time_entry_started' });
    const body = JSON.parse(post.mock.calls[0]![1]);
    expect(body).toEqual({
      expectedMembershipId: ids.membership,
      workEvent: {
        id: ids.event,
        target: { targetType: 'project', targetId: ids.target },
      },
      receipt: { id: ids.receipt, attemptNumber: 1 },
    });
    expect(JSON.stringify(body)).not.toContain('occurredAt');
    expect(JSON.stringify(body)).not.toContain('start');
  });

  it('loads every bounded target page and rejects a repeated cursor', async () => {
    const post = vi.fn<AuthenticatedJsonPostPort['post']>()
      .mockResolvedValueOnce(response({
        activeRecord: null, records: [], nextCursor: null,
        windowStartedAt: '2026-06-23T10:00:00.000Z',
        windowEndedAt: '2026-07-24T10:00:00.000Z',
      }))
      .mockResolvedValueOnce(response({
        targets: [{ targetType: 'customer', targetId: ids.target, displayName: 'Kunde' }],
        nextCursor: 'v1:next',
      }))
      .mockResolvedValueOnce(response({
        targets: [{
          targetType: 'general_work',
          targetId: '20000000-0000-4000-8000-000000000002',
          displayName: 'Allgemeine Arbeitszeit',
        }],
        nextCursor: null,
      }));
    const client = new TapTimeMobileWorkApiClient(
      new URL('https://api.invalid'), { post }, () => ids.event,
    );
    await expect(client.read(ids.membership)).resolves.toMatchObject({
      status: 'ready',
      targets: { targets: [{ displayName: 'Kunde' }, { displayName: 'Allgemeine Arbeitszeit' }] },
    });
    expect(JSON.parse(post.mock.calls[2]![1])).toEqual({
      expectedMembershipId: ids.membership, cursor: 'v1:next', limit: 50,
    });
  });

  it('loads one explicit own-time continuation page with the opaque cursor', async () => {
    const post = vi.fn<AuthenticatedJsonPostPort['post']>().mockResolvedValue(response({
      activeRecord: null,
      records: [],
      nextCursor: null,
      windowStartedAt: '2026-06-23T10:00:00.000Z',
      windowEndedAt: '2026-07-24T10:00:00.000Z',
    }));
    const client = new TapTimeMobileWorkApiClient(
      new URL('https://api.invalid'), { post }, () => ids.event,
    );

    await expect(client.readOwnTimePage(ids.membership, 'v1:own-next')).resolves.toEqual({
      status: 'ready',
      ownTime: expect.objectContaining({ nextCursor: null }),
    });
    expect(JSON.parse(post.mock.calls[0]![1])).toEqual({
      expectedMembershipId: ids.membership,
      cursor: 'v1:own-next',
      limit: 20,
    });
  });
});
