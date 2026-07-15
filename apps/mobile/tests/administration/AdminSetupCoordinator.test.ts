import { describe, expect, it, vi } from 'vitest';
import { createCanonicalNfcUidPayload, createTimestamp } from '@taptime/core';
import { AdminSetupCoordinator } from '../../src/administration/AdminSetupCoordinator';
import type { AdminSessionSnapshot, AdminSetupApiPort } from '../../src/administration/contracts';

const snapshot: AdminSessionSnapshot = { generation: 1, session: { userId: '10000000-0000-4000-8000-000000000001', membershipId: '20000000-0000-4000-8000-000000000001', organizationId: '30000000-0000-4000-8000-000000000001', role: 'administrator' } };
const projection = { status: 'succeeded' as const, organization: { id: snapshot.session.organizationId, name: 'TapTim.e' }, customers: [{ id: '40000000-0000-4000-8000-000000000001', displayName: 'Werkstatt', active: true }], nfcTags: [] };

function setup(role: 'administrator' | 'employee' = 'administrator') {
  let current = { ...snapshot, session: { ...snapshot.session, role } } as AdminSessionSnapshot; let listener: () => void = () => undefined;
  const session = { capture: vi.fn(() => current), isCurrent: vi.fn((candidate: AdminSessionSnapshot) => candidate === current), subscribe: vi.fn((next: () => void) => { listener = next; return () => undefined; }) };
  const nfc = { checkCapability: vi.fn(async () => 'ready' as const), scan: vi.fn(async () => ({ status: 'captured' as const, payload: createCanonicalNfcUidPayload('B55E8B6AEB30'), capturedAt: createTimestamp('2026-07-15T07:00:00.000Z') })), cancelCapture: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
  const api: AdminSetupApiPort = { readProjection: vi.fn(async () => projection), provisionTag: vi.fn(async () => ({ status: 'succeeded' as const, validationFingerprint: 'A1B2C3D4E5F6' })) };
  const coordinator = new AdminSetupCoordinator(session, nfc, api, () => '50000000-0000-4000-8000-000000000001');
  return { coordinator, session, nfc, api, replace(value: AdminSessionSnapshot) { current = value; listener(); } };
}

describe('AdminSetupCoordinator', () => {
  it('keeps raw capture private and exposes only the safe fingerprint', async () => {
    const context = setup(); await context.coordinator.start();
    await context.coordinator.provision(projection.customers[0]!.id, 'Eingang');
    expect(context.api.provisionTag).toHaveBeenCalledWith(expect.objectContaining({ canonicalPayload: 'nfc:uid:v1:B55E8B6AEB30' }));
    expect(JSON.stringify(context.coordinator.getState())).not.toContain('nfc:uid');
    expect(JSON.stringify(context.coordinator.getState())).toContain('A1B2C3D4E5F6');
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
});
