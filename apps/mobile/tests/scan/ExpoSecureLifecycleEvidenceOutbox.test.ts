import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  UserId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import type { PendingLifecycleEvidence } from '../../src/scan/LifecycleEvidenceOutbox';

const secureStore = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

vi.mock('expo-secure-store', () => secureStore);

const {
  ExpoSecureLifecycleEvidenceOutbox,
  LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
} = await import('../../src/scan/ExpoSecureLifecycleEvidenceOutbox');

const evidence: PendingLifecycleEvidence = Object.freeze({
  binding: Object.freeze({
    organizationId: OrganizationId('00000000-0000-4000-8000-000000000101'),
    userId: UserId('10000000-0000-4000-8000-000000000101'),
  }),
  command: Object.freeze({
    organizationId: OrganizationId('00000000-0000-4000-8000-000000000101'),
    workEvent: Object.freeze({
      id: WorkEventId('60000000-0000-4000-8000-000000000101'),
      assignmentId: NfcAssignmentId('20000000-0000-4000-8000-000000000101'),
      nfcTagId: NfcTagId('30000000-0000-4000-8000-000000000101'),
      target: Object.freeze(customerAssignmentTarget(
        CustomerId('40000000-0000-4000-8000-000000000101'),
      )),
      occurredAt: createTimestamp('2026-07-14T08:30:00.000Z'),
    }),
    receipt: Object.freeze({
      id: '70000000-0000-4000-8000-000000000101',
      attemptNumber: 1,
    }),
  }),
});

describe('ExpoSecureLifecycleEvidenceOutbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockResolvedValue(undefined);
    secureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  it('round-trips one exact lifecycle record with the configured native options', async () => {
    const outbox = new ExpoSecureLifecycleEvidenceOutbox();
    await outbox.write(evidence);
    const serialized = secureStore.setItemAsync.mock.calls[0]![1] as string;
    secureStore.getItemAsync.mockResolvedValue(serialized);
    const restored = await outbox.read();
    await outbox.clear(restored!);

    expect(restored).toEqual(evidence);
    expect(JSON.stringify(restored!.command)).toBe(JSON.stringify(evidence.command));
    expect(restored!.command.receipt.attemptNumber).toBe(1);
    expect(serialized).not.toContain('nfc:uid');
    expect(serialized).not.toMatch(/accessToken|refreshToken|time_entry_started/i);
    expect(serialized.length).toBeLessThan(2_048);
    const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' };
    expect(LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY).toBe(
      'taptime.lifecycle-evidence-outbox.v1',
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
      serialized,
      options,
    );
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(
      LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
      options,
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
      LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
      options,
    );
  });

  it.each([
    ['unknown version', JSON.stringify({ version: 2, binding: evidence.binding, command: evidence.command })],
    ['cross-tenant binding', JSON.stringify({
      version: 1,
      binding: { ...evidence.binding, organizationId: '00000000-0000-4000-8000-000000000202' },
      command: evidence.command,
    })],
    ['changed retry attempt', JSON.stringify({
      version: 1,
      binding: evidence.binding,
      command: { ...evidence.command, receipt: { ...evidence.command.receipt, attemptNumber: 2 } },
    })],
    ['additional authority field', JSON.stringify({
      version: 1,
      binding: evidence.binding,
      command: { ...evidence.command, decision: 'time_entry_started' },
    })],
  ])('rejects corrupt or widened stored evidence: %s', async (_label, serialized) => {
    secureStore.getItemAsync.mockResolvedValue(serialized);
    await expect(new ExpoSecureLifecycleEvidenceOutbox().read()).rejects.toThrow(
      'Stored lifecycle evidence is invalid',
    );
  });

  it('fails closed when native secure storage is unavailable', async () => {
    secureStore.isAvailableAsync.mockResolvedValue(false);
    const outbox = new ExpoSecureLifecycleEvidenceOutbox();
    await expect(outbox.read()).rejects.toThrow('unavailable');
    await expect(outbox.write(evidence)).rejects.toThrow('unavailable');
    await expect(outbox.clear(evidence)).rejects.toThrow('unavailable');
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('never replaces an existing unresolved lifecycle record', async () => {
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify({
      version: 1,
      binding: evidence.binding,
      command: evidence.command,
    }));
    await expect(new ExpoSecureLifecycleEvidenceOutbox().write(evidence)).rejects.toThrow(
      'already occupied',
    );
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('serializes occupancy checks across adapter instances in one JavaScript runtime', async () => {
    let stored: string | null = null;
    secureStore.getItemAsync.mockImplementation(async () => stored);
    secureStore.setItemAsync.mockImplementation(async (_key: string, value: string) => {
      stored = value;
    });
    const first = new ExpoSecureLifecycleEvidenceOutbox();
    const second = new ExpoSecureLifecycleEvidenceOutbox();

    const [firstResult, secondResult] = await Promise.allSettled([
      first.write(evidence),
      second.write(evidence),
    ]);

    expect(firstResult.status).toBe('fulfilled');
    expect(secondResult.status).toBe('rejected');
    expect(secondResult).toMatchObject({
      reason: expect.objectContaining({ message: 'Lifecycle evidence outbox is already occupied' }),
    });
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('never clears a different unresolved lifecycle record', async () => {
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify({
      version: 1,
      binding: evidence.binding,
      command: {
        ...evidence.command,
        receipt: {
          ...evidence.command.receipt,
          id: '70000000-0000-4000-8000-000000000202',
        },
      },
    }));
    await expect(new ExpoSecureLifecycleEvidenceOutbox().clear(evidence)).rejects.toThrow(
      'different record',
    );
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('rejects oversized stored evidence before parsing', async () => {
    secureStore.getItemAsync.mockResolvedValue('x'.repeat(2_049));
    await expect(new ExpoSecureLifecycleEvidenceOutbox().read()).rejects.toThrow('permitted size');
  });
});
