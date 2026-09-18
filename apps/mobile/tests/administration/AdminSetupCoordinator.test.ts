import { describe, expect, it, vi } from 'vitest';
import { TAG_URI } from '../../src/nfc/tagAddress';
import { createCanonicalNfcUidPayload, createTimestamp } from '@taptime/core';
import { AdminSetupCoordinator } from '../../src/administration/AdminSetupCoordinator';
import type { AdminSessionSnapshot, AdminSetupApiPort } from '../../src/administration/contracts';

const snapshot: AdminSessionSnapshot = { generation: 1, session: { userId: '10000000-0000-4000-8000-000000000001', membershipId: '20000000-0000-4000-8000-000000000001', organizationId: '30000000-0000-4000-8000-000000000001', role: 'administrator' } };
const projection = { status: 'succeeded' as const, organization: { id: snapshot.session.organizationId, name: 'TapTim.e' }, customers: [{ id: '40000000-0000-4000-8000-000000000001', displayName: 'Werkstatt', active: true }], nfcTags: [], nextCursor: null };

function setup(role: 'administrator' | 'employee' = 'administrator') {
  let current = { ...snapshot, session: { ...snapshot.session, role } } as AdminSessionSnapshot; let listener: () => void = () => undefined;
  const session = { capture: vi.fn(() => current), isCurrent: vi.fn((candidate: AdminSessionSnapshot) => candidate === current), subscribe: vi.fn((next: () => void) => { listener = next; return () => undefined; }) };
  const nfc = { checkCapability: vi.fn(async () => 'ready' as const), scan: vi.fn(async () => ({ status: 'captured' as const, payload: createCanonicalNfcUidPayload('B55E8B6AEB30'), capturedAt: createTimestamp('2026-07-15T07:00:00.000Z') })), cancelCapture: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
  const api: AdminSetupApiPort = {
    readProjection: vi.fn(async () => projection),
    provisionTag: vi.fn(async () => ({ status: 'succeeded' as const, validationFingerprint: 'A1B2C3D4E5F6' })),
    provisionBreakTag: vi.fn(async () => ({ status: 'succeeded' as const, validationFingerprint: 'A1B2C3D4E5F6' })),
  };
  const writer = { write: vi.fn(async (_payload: string, _uri: string): Promise<{ status: 'written' } | { status: 'failed'; reason: 'write_failed' }> => ({ status: 'written' })), cancel: vi.fn(async () => undefined) };
  const coordinator = new AdminSetupCoordinator(session, nfc, api, () => '50000000-0000-4000-8000-000000000001', writer);
  return { coordinator, session, nfc, api, writer, replace(value: AdminSessionSnapshot) { current = value; listener(); } };
}

describe('AdminSetupCoordinator', () => {
  const provisions = [
    { name: 'work', run: (coordinator: AdminSetupCoordinator) => coordinator.provision(projection.customers[0]!.id, 'Eingang'), method: 'provisionTag' },
    { name: 'break', run: (coordinator: AdminSetupCoordinator) => coordinator.provisionBreak('Pause'), method: 'provisionBreakTag' },
  ] as const;

  it.each(provisions)('writes the dispatch URI before registering the captured UID ($name)', async ({ run, method }) => {
    const context = setup();
    let finishWrite!: (value: { status: 'written' }) => void;
    context.writer.write.mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }));
    await context.coordinator.start();
    const pending = run(context.coordinator);
    await vi.waitFor(() => expect(context.writer.write).toHaveBeenCalledWith('nfc:uid:v1:B55E8B6AEB30', TAG_URI));
    expect(context.api.provisionTag).not.toHaveBeenCalled();
    expect(context.api.provisionBreakTag).not.toHaveBeenCalled();
    finishWrite({ status: 'written' });
    await pending;
    expect(context.api[method]).toHaveBeenCalledWith(expect.objectContaining({ canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30' }));
    await run(context.coordinator);
    expect(context.writer.write.mock.calls).toEqual([
      ['nfc:uid:v1:B55E8B6AEB30', TAG_URI],
      ['nfc:uid:v1:B55E8B6AEB30', TAG_URI],
    ]);
  });

  it.each(provisions)('registers nothing and reports tag_write_failed on a write error ($name)', async ({ run }) => {
    const context = setup();
    context.writer.write.mockResolvedValueOnce({ status: 'failed', reason: 'write_failed' });
    await context.coordinator.start();
    await run(context.coordinator);
    expect(context.api.provisionTag).not.toHaveBeenCalled();
    expect(context.api.provisionBreakTag).not.toHaveBeenCalled();
    expect(context.coordinator.getState()).toMatchObject({ status: 'ready', outcome: { status: 'tag_write_failed', reason: 'write_failed' } });
  });

  it.each(provisions)('does not register after cancellation during writing ($name)', async ({ run }) => {
    const context = setup();
    let finishWrite!: (value: { status: 'written' }) => void;
    context.writer.write.mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }));
    await context.coordinator.start();
    const pending = run(context.coordinator);
    await vi.waitFor(() => expect(context.writer.write).toHaveBeenCalled());
    await context.coordinator.cancel();
    finishWrite({ status: 'written' });
    await pending;
    expect(context.writer.cancel).toHaveBeenCalled();
    expect(context.api.provisionTag).not.toHaveBeenCalled();
    expect(context.api.provisionBreakTag).not.toHaveBeenCalled();
  });

  it.each(provisions)('does not register after membership changes during writing ($name)', async ({ run }) => {
    const context = setup();
    let finishWrite!: (value: { status: 'written' }) => void;
    context.writer.write.mockImplementationOnce(() => new Promise((resolve) => { finishWrite = resolve; }));
    await context.coordinator.start();
    const pending = run(context.coordinator);
    await vi.waitFor(() => expect(context.writer.write).toHaveBeenCalled());
    context.replace({ ...snapshot, generation: 2 });
    finishWrite({ status: 'written' });
    await pending;
    expect(context.api.provisionTag).not.toHaveBeenCalled();
    expect(context.api.provisionBreakTag).not.toHaveBeenCalled();
  });

  it.each(provisions)('maps a thrown write failure without registering ($name)', async ({ run }) => {
    const context = setup();
    context.writer.write.mockRejectedValueOnce(new Error('private native error'));
    await context.coordinator.start();
    await run(context.coordinator);
    expect(context.api.provisionTag).not.toHaveBeenCalled();
    expect(context.api.provisionBreakTag).not.toHaveBeenCalled();
    expect(context.coordinator.getState()).toMatchObject({ outcome: { status: 'tag_write_failed', reason: 'write_failed' } });
    expect(JSON.stringify(context.coordinator.getState())).not.toContain('private');
  });

  it('keeps raw capture private and exposes only the safe fingerprint', async () => {
    const context = setup(); await context.coordinator.start();
    await context.coordinator.provision(projection.customers[0]!.id, 'Eingang');
    expect(context.api.provisionTag).toHaveBeenCalledWith(expect.objectContaining({ canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30' }));
    expect(JSON.stringify(context.coordinator.getState())).not.toContain('nfc:uid');
    expect(JSON.stringify(context.coordinator.getState())).toContain('A1B2C3D4E5F6');
  });

  it('captures one Pausen-Tag command without a customer or boundary direction', async () => {
    const context = setup();
    await context.coordinator.start();
    await context.coordinator.provisionBreak('Pause');
    expect(context.api.provisionBreakTag).toHaveBeenCalledWith({
      expectedMembershipId: snapshot.session.membershipId,
      commandId: '50000000-0000-4000-8000-000000000001',
      displayName: 'Pause',
      canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30',
    });
    expect(JSON.stringify(vi.mocked(context.api.provisionBreakTag!).mock.calls[0])).not.toMatch(
      /customer|start|stop/i,
    );
  });

  it('never offers capture to an employee', async () => {
    const context = setup('employee'); await context.coordinator.start();
    expect(context.coordinator.getState()).toEqual({ status: 'not_administrator' });
    await context.coordinator.provision(projection.customers[0]!.id, 'Eingang'); expect(context.nfc.scan).not.toHaveBeenCalled();
  });

  it('invalidates an in-flight operation when exact Membership changes', async () => {
    const context = setup(); let resolve!: (value: Awaited<ReturnType<AdminSetupApiPort['provisionTag']>>) => void;
    vi.mocked(context.api.provisionTag).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await context.coordinator.start(); const provisioning = context.coordinator.provision(projection.customers[0]!.id, 'Eingang');
    await vi.waitFor(() => expect(context.api.provisionTag).toHaveBeenCalled());
    context.replace({ ...snapshot, generation: 2, session: { ...snapshot.session, membershipId: '60000000-0000-4000-8000-000000000001' } });
    resolve({ status: 'succeeded', validationFingerprint: 'A1B2C3D4E5F6' }); await provisioning;
    expect(JSON.stringify(context.coordinator.getState())).not.toContain('A1B2C3D4E5F6');
  });

  it.each([
    [{ status: 'authority_rejected' as const }, 'session_rejected'],
    [{ status: 'tag_payload_already_registered' as const }, 'tag_already_registered'],
    [{ status: 'assignment_target_unavailable' as const }, 'customer_unavailable'],
    [{ status: 'invalid_request' as const }, 'invalid_input'],
    [{ status: 'command_id_conflict' as const }, 'request_failed'],
    [{ status: 'transient_failure' as const }, 'request_failed'],
    [{ status: 'unavailable' as const }, 'request_failed'],
  ])('maps a safe administration error %# to %s without exposing capture data', async (result, expected) => {
    const context = setup();
    vi.mocked(context.api.provisionTag).mockResolvedValueOnce(result);
    await context.coordinator.start();

    await context.coordinator.provision(projection.customers[0]!.id, 'Eingang');

    expect(context.coordinator.getState()).toEqual({
      status: 'ready', projection: {
        organization: projection.organization,
        customers: projection.customers,
        nfcTags: projection.nfcTags,
        nextCursor: null,
      }, outcome: { status: expected },
    });
    expect(JSON.stringify(context.coordinator.getState())).not.toContain('nfc:uid');
  });

  it('loads and merges exactly one bounded cursor page', async () => {
    const context = setup();
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    vi.mocked(context.api.readProjection).mockResolvedValueOnce({ ...projection, nextCursor: cursor });
    await context.coordinator.start();
    vi.mocked(context.api.readProjection).mockResolvedValueOnce({
      ...projection,
      customers: [{ id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true }],
      nextCursor: null,
    });

    await context.coordinator.loadMore();

    expect(context.api.readProjection).toHaveBeenLastCalledWith(snapshot.session.membershipId, cursor);
    expect(context.coordinator.getState()).toEqual({
      status: 'ready', outcome: null,
      projection: {
        organization: projection.organization,
        customers: [...projection.customers, { id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true }],
        nfcTags: [],
        nextCursor: null,
      },
    });
  });

  it('fails closed for cross-Organization or duplicate pagination data', async () => {
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    const invalidPages = [
      {
        ...projection,
        organization: { id: '30000000-0000-4000-8000-000000000002', name: 'Andere Organisation' },
        customers: [{ id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true }],
        nextCursor: null,
      },
      {
        ...projection,
        nextCursor: null,
      },
    ];

    for (const invalidPage of invalidPages) {
      const context = setup();
      vi.mocked(context.api.readProjection).mockResolvedValueOnce({ ...projection, nextCursor: cursor });
      await context.coordinator.start();
      vi.mocked(context.api.readProjection).mockResolvedValueOnce(invalidPage);

      await context.coordinator.loadMore();

      expect(context.coordinator.getState()).toEqual({
        status: 'ready',
        projection: {
          organization: projection.organization,
          customers: projection.customers,
          nfcTags: projection.nfcTags,
          nextCursor: cursor,
        },
        outcome: { status: 'request_failed' },
      });
    }
  });
});
