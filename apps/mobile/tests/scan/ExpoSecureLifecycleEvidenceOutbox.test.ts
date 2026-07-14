import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CustomerId,
  MembershipId,
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

const ids = {
  organization: '00000000-0000-4000-8000-000000000101',
  user: '10000000-0000-4000-8000-000000000101',
  membership: '12000000-0000-4000-8000-000000000101',
  event: '60000000-0000-4000-8000-000000000101',
  assignment: '20000000-0000-4000-8000-000000000101',
  tag: '30000000-0000-4000-8000-000000000101',
  customer: '40000000-0000-4000-8000-000000000101',
  receipt: '70000000-0000-4000-8000-000000000101',
};

const command = Object.freeze({
  organizationId: OrganizationId(ids.organization),
  workEvent: Object.freeze({
    id: WorkEventId(ids.event),
    assignmentId: NfcAssignmentId(ids.assignment),
    nfcTagId: NfcTagId(ids.tag),
    target: Object.freeze(customerAssignmentTarget(CustomerId(ids.customer))),
    occurredAt: createTimestamp('2026-07-14T08:30:00.000Z'),
  }),
  receipt: Object.freeze({
    id: ids.receipt,
    attemptNumber: 1,
  }),
});

const evidence: PendingLifecycleEvidence = Object.freeze({
  kind: 'replayable',
  binding: Object.freeze({
    organizationId: OrganizationId(ids.organization),
    userId: UserId(ids.user),
    membershipId: MembershipId(ids.membership),
  }),
  submission: Object.freeze({
    mode: 'canonical',
    expectedMembershipId: MembershipId(ids.membership),
    command,
  }),
});

function versionTwoJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 2,
    binding: evidence.binding,
    submission: evidence.submission,
    ...overrides,
  });
}

function versionOneJson(): string {
  return JSON.stringify({
    version: 1,
    binding: {
      organizationId: evidence.binding.organizationId,
      userId: evidence.binding.userId,
    },
    command,
  });
}

describe('ExpoSecureLifecycleEvidenceOutbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.getItemAsync.mockResolvedValue(null);
    secureStore.setItemAsync.mockResolvedValue(undefined);
    secureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  it('round-trips one exact version-2 Membership-bound submission', async () => {
    const outbox = new ExpoSecureLifecycleEvidenceOutbox();
    await outbox.write(evidence);
    const serialized = secureStore.setItemAsync.mock.calls[0]![1] as string;
    secureStore.getItemAsync.mockResolvedValue(serialized);
    const restored = await outbox.read();
    expect(restored?.kind).toBe('replayable');
    if (restored?.kind !== 'replayable') {
      throw new Error('Expected replayable evidence');
    }
    await outbox.clear(restored);

    expect(restored).toEqual(evidence);
    expect(JSON.stringify(restored.submission)).toBe(JSON.stringify(evidence.submission));
    expect(restored.submission.command.receipt.attemptNumber).toBe(1);
    expect(serialized).not.toContain('nfc:uid');
    expect(serialized).not.toMatch(/accessToken|refreshToken|time_entry_started/i);
    expect(serialized.length).toBeLessThan(2_048);
    expect(JSON.parse(serialized)).toMatchObject({ version: 2 });
    const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' };
    expect(LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY).toBe(
      'taptime.lifecycle-evidence-outbox.v1',
    );
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
      serialized,
      options,
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(
      LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
      options,
    );
  });

  it('preserves version-1 Membership-unknown evidence as protected and never infers context', async () => {
    secureStore.getItemAsync.mockResolvedValue(versionOneJson());
    const outbox = new ExpoSecureLifecycleEvidenceOutbox();
    await expect(outbox.read()).resolves.toEqual({
      kind: 'protected_v1',
      binding: {
        organizationId: evidence.binding.organizationId,
        userId: evidence.binding.userId,
      },
      command,
    });
    await expect(outbox.clear(evidence)).rejects.toThrow('different record');
    await expect(outbox.write(evidence)).rejects.toThrow('already occupied');
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown version', JSON.stringify({
      version: 3, binding: evidence.binding, submission: evidence.submission,
    })],
    ['cross-tenant binding', versionTwoJson({
      binding: { ...evidence.binding, organizationId: '00000000-0000-4000-8000-000000000202' },
    })],
    ['missing Membership', versionTwoJson({
      binding: {
        organizationId: evidence.binding.organizationId,
        userId: evidence.binding.userId,
      },
    })],
    ['Membership expectation mismatch', versionTwoJson({
      submission: {
        ...evidence.submission,
        expectedMembershipId: '12000000-0000-4000-8000-000000000202',
      },
    })],
    ['unknown submission mode', versionTwoJson({
      submission: { ...evidence.submission, mode: 'automatic_start' },
    })],
    ['changed retry attempt', versionTwoJson({
      submission: {
        ...evidence.submission,
        command: {
          ...command,
          receipt: { ...command.receipt, attemptNumber: 2 },
        },
      },
    })],
    ['additional authority field', versionTwoJson({
      submission: {
        ...evidence.submission,
        command: { ...command, decision: 'time_entry_started' },
      },
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
    secureStore.getItemAsync.mockResolvedValue(versionTwoJson());
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

  it('never clears evidence with a different Membership or submission mode', async () => {
    secureStore.getItemAsync.mockResolvedValue(versionTwoJson({
      submission: { ...evidence.submission, mode: 'defer_only' },
    }));
    await expect(new ExpoSecureLifecycleEvidenceOutbox().clear(evidence)).rejects.toThrow(
      'different record',
    );
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();

    secureStore.getItemAsync.mockResolvedValue(versionTwoJson({
      binding: {
        ...evidence.binding,
        membershipId: '12000000-0000-4000-8000-000000000202',
      },
      submission: {
        ...evidence.submission,
        expectedMembershipId: '12000000-0000-4000-8000-000000000202',
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
