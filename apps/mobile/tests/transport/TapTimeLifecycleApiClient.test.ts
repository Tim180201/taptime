import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import { describe, expect, it } from 'vitest';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';
import { TapTimeLifecycleApiClient } from '../../src/transport/TapTimeLifecycleApiClient';
import type { LifecycleEventCommand } from '../../src/transport/contracts';

const ids = {
  organization: '00000000-0000-4000-8000-000000000101',
  assignment: '40000000-0000-4000-8000-000000000101',
  tag: '30000000-0000-4000-8000-000000000101',
  customer: '20000000-0000-4000-8000-000000000101',
  event: '50000000-0000-4000-8000-000000000101',
  previousEvent: '50000000-0000-4000-8000-000000000102',
  receipt: '60000000-0000-4000-8000-000000000101',
  timeEntry: '70000000-0000-4000-8000-000000000101',
};

function command(clientTimeEntryId?: string): LifecycleEventCommand {
  return {
    organizationId: OrganizationId(ids.organization),
    workEvent: {
      id: WorkEventId(ids.event),
      assignmentId: NfcAssignmentId(ids.assignment),
      nfcTagId: NfcTagId(ids.tag),
      target: customerAssignmentTarget(CustomerId(ids.customer)),
      occurredAt: createTimestamp('2026-07-14T08:00:00.000Z'),
    },
    receipt: {
      id: ids.receipt,
      attemptNumber: 1,
      ...(clientTimeEntryId === undefined
        ? {}
        : { clientTimeEntryId: TimeEntryId(clientTimeEntryId) }),
    },
  };
}

class FakeJsonPost implements AuthenticatedJsonPostPort {
  readonly calls: Array<{ readonly endpoint: string; readonly body: string }> = [];
  result: AuthenticatedHttpResult = synchronized({
    status: 'time_entry_started', timeEntryId: ids.timeEntry,
  }, ids.timeEntry);

  async post(endpoint: URL, body: string): Promise<AuthenticatedHttpResult> {
    this.calls.push({ endpoint: endpoint.href, body });
    return this.result;
  }
}

function synchronized(decision: unknown, serverTimeEntryId: string | null): AuthenticatedHttpResult {
  return {
    status: 'response',
    statusCode: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({
      status: 'synchronized',
      idempotentRetry: false,
      decision,
      workEventId: ids.event,
      receiptId: ids.receipt,
      serverTimeEntryId,
    }),
  };
}

function setup() {
  const request = new FakeJsonPost();
  const client = new TapTimeLifecycleApiClient('https://api.example/base/', request);
  return { request, client };
}

describe('TapTimeLifecycleApiClient', () => {
  it('serializes only authorized evidence and the one optional client TimeEntry field', async () => {
    const { request, client } = setup();
    const input = {
      ...command(ids.timeEntry),
      role: 'administrator',
      decision: { status: 'time_entry_stopped' },
      triggeredBy: 'forged-user',
      workEvent: {
        ...command(ids.timeEntry).workEvent,
        triggeredBy: 'forged-user',
        organizationId: 'forged-organization',
      },
      receipt: {
        ...command(ids.timeEntry).receipt,
        result: 'synchronized',
      },
    };

    await expect(client.ingest(input)).resolves.toMatchObject({ status: 'synchronized' });
    expect(request.calls).toHaveLength(1);
    expect(request.calls[0]?.endpoint).toBe('https://api.example/base/v1/lifecycle-events');
    expect(JSON.parse(request.calls[0]!.body)).toEqual({
      organizationId: ids.organization,
      workEvent: {
        id: ids.event,
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        target: { targetType: 'customer', targetId: ids.customer },
        occurredAt: '2026-07-14T08:00:00.000Z',
      },
      receipt: {
        id: ids.receipt,
        attemptNumber: 1,
        clientTimeEntryId: ids.timeEntry,
      },
    });
    expect(request.calls[0]?.body).not.toMatch(/triggeredBy|role|result|forged/);
  });

  it('omits rather than invents an absent client TimeEntry ID', async () => {
    const { request, client } = setup();
    await client.ingest(command());
    expect(JSON.parse(request.calls[0]!.body).receipt).toEqual({
      id: ids.receipt, attemptNumber: 1,
    });
  });

  it.each([
    [{ status: 'time_entry_started', timeEntryId: ids.timeEntry }, ids.timeEntry],
    [{ status: 'time_entry_stopped', timeEntryId: ids.timeEntry }, ids.timeEntry],
    [{ status: 'duplicate_scan_ignored', previousWorkEventId: ids.previousEvent }, null],
    [{ status: 'active_entry_for_other_target_rejected', activeTimeEntryId: ids.timeEntry }, ids.timeEntry],
    [{ status: 'escalation_required', reason: 'work_event_precedes_active_time_entry' }, null],
  ] as const)('accepts the exact server-canonical decision variant %#', async (decision, timeEntryId) => {
    const { request, client } = setup();
    request.result = synchronized(decision, timeEntryId);
    await expect(client.ingest(command())).resolves.toEqual({
      status: 'synchronized',
      idempotentRetry: false,
      decision,
      workEventId: ids.event,
      receiptId: ids.receipt,
      serverTimeEntryId: timeEntryId,
    });
  });

  it('preserves the fixed idempotent-retry result without changing evidence', async () => {
    const { request, client } = setup();
    const body = JSON.parse((request.result as Extract<AuthenticatedHttpResult, {
      status: 'response';
    }>).body);
    body.idempotentRetry = true;
    request.result = {
      status: 'response', statusCode: 200, contentType: 'application/json', body: JSON.stringify(body),
    };
    await expect(client.ingest(command())).resolves.toMatchObject({
      status: 'synchronized', idempotentRetry: true, workEventId: ids.event, receiptId: ids.receipt,
    });
  });

  it.each([
    ['deferred', 202, 'configuration_unavailable_or_inactive'],
    ['conflict', 409, 'work_event_content_conflict'],
    ['conflict', 409, 'receipt_metadata_conflict'],
  ] as const)('maps exact HTTP %s vocabulary', async (status, statusCode, reason) => {
    const { request, client } = setup();
    request.result = {
      status: 'response',
      statusCode,
      contentType: 'application/json',
      body: JSON.stringify({ status, reason }),
    };
    await expect(client.ingest(command())).resolves.toEqual({ status, reason });
  });

  it.each([
    synchronized({ status: 'time_entry_started', timeEntryId: ids.timeEntry }, null),
    synchronized({ status: 'time_entry_stopped', timeEntryId: ids.timeEntry }, ids.previousEvent),
    synchronized({ status: 'duplicate_scan_ignored', previousWorkEventId: ids.previousEvent }, ids.timeEntry),
    synchronized({ status: 'active_entry_for_other_target_rejected', activeTimeEntryId: ids.timeEntry }, null),
    synchronized({ status: 'escalation_required', reason: 'invented_reason' }, null),
    synchronized({ status: 'time_entry_started', timeEntryId: ids.timeEntry, role: 'administrator' }, ids.timeEntry),
  ])('rejects inconsistent or over-broad synchronized result %#', async (result) => {
    const { request, client } = setup();
    request.result = result;
    await expect(client.ingest(command())).resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects response evidence that belongs to another WorkEvent or Receipt', async () => {
    const { request, client } = setup();
    const response = synchronized({
      status: 'time_entry_started', timeEntryId: ids.timeEntry,
    }, ids.timeEntry) as Extract<AuthenticatedHttpResult, { status: 'response' }>;
    const body = JSON.parse(response.body);
    body.workEventId = ids.previousEvent;
    request.result = { ...response, body: JSON.stringify(body) };
    await expect(client.ingest(command())).resolves.toEqual({ status: 'unavailable' });

    body.workEventId = ids.event;
    body.receiptId = '60000000-0000-4000-8000-000000000999';
    request.result = { ...response, body: JSON.stringify(body) };
    await expect(client.ingest(command())).resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects wrong status/body pairings, non-JSON success and additional top-level fields', async () => {
    const { request, client } = setup();
    request.result = {
      status: 'response',
      statusCode: 202,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'synchronized', reason: 'configuration_unavailable_or_inactive' }),
    };
    await expect(client.ingest(command())).resolves.toEqual({ status: 'unavailable' });

    const valid = synchronized({
      status: 'time_entry_started', timeEntryId: ids.timeEntry,
    }, ids.timeEntry) as Extract<AuthenticatedHttpResult, { status: 'response' }>;
    request.result = { ...valid, contentType: 'text/html' };
    await expect(client.ingest(command())).resolves.toEqual({ status: 'unavailable' });

    request.result = {
      ...valid,
      body: JSON.stringify({ ...JSON.parse(valid.body), providerSubject: 'must-not-escape' }),
    };
    await expect(client.ingest(command())).resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects invalid local evidence before any authenticated request', async () => {
    const { request, client } = setup();
    const invalidAttempt = { ...command(), receipt: { ...command().receipt, attemptNumber: 0 } };
    const invalidTimestamp = {
      ...command(), workEvent: { ...command().workEvent, occurredAt: createTimestamp('2026-07-14') },
    };
    const invalidOrganization = {
      ...command(), organizationId: OrganizationId('not-a-uuid'),
    };
    await expect(client.ingest(invalidAttempt)).resolves.toEqual({ status: 'unavailable' });
    await expect(client.ingest(invalidTimestamp)).resolves.toEqual({ status: 'unavailable' });
    await expect(client.ingest(invalidOrganization)).resolves.toEqual({ status: 'unavailable' });
    expect(request.calls).toEqual([]);
  });

  it('propagates only fixed authority and availability outcomes', async () => {
    const { request, client } = setup();
    for (const status of ['authority_rejected', 'transient_failure', 'unavailable'] as const) {
      request.result = { status };
      await expect(client.ingest(command())).resolves.toEqual({ status });
    }
  });
});
