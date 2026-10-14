import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ AppState: {}, Platform: { OS: 'android' } }));
vi.mock('expo-network', () => ({}));
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' }));
vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn() }));
vi.mock('../../src/offline/registerOfflineBackgroundTask', () => ({ registerOfflineBackgroundTask: async () => {} }));
const native = vi.hoisted(() => ({
  pending: null as null | {
    uid: number[]; wallClockMilliseconds: number; elapsedRealtimeMilliseconds: number;
    processStartElapsedRealtimeMilliseconds: number; bootMarker: string;
    intentOrigin: 'process_start_intent' | 'activity_delivery_intent';
  },
  hasPending() { return this.pending !== null; },
  readPendingEvidence() { return this.pending; },
  consume() { const capture = this.pending; this.pending = null; return capture; },
  clear() { this.pending = null; },
  closeProcessStartIntentWindow() {},
}));
vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => native }));

import { NativeNfcIngressCapturePort, NativeNfcIngressLifecycle } from '../../src/nfc/NativeNfcIngress';
import { ExclusiveNfcCaptureArbiter } from '../../src/nfc/ExclusiveNfcCaptureArbiter';
import { OfflineCaptureCoordinator } from '../../src/offline/OfflineCaptureCoordinator';
import { OfflineCaptureDatabase } from '../../src/offline/OfflineCaptureDatabase';
import { AndroidMonotonicClock } from '../../src/offline/AndroidMonotonicClock';
import type { OfflineInstallationIdentityStore } from '../../src/offline/OfflineInstallationIdentityStore';
import { OfflineSchedulingLifecycle } from '../../src/offline/OfflineSchedulingLifecycle';
import { OfflineSyncScheduler } from '../../src/offline/OfflineSyncScheduler';
import { DefaultProductMobileRuntime, type ProductSessionRuntimeOwner, type ProductAdministrationRuntimeOwner } from '../../src/runtime/DefaultProductMobileRuntime';
import type { ProductServerTransport } from '../../src/transport/contracts';
import { NodeSqliteOfflineConnection } from '../support/NodeSqliteOfflineConnection';
import { encodeBase64Url } from '../../src/offline/encoding';
import { mobileLookupHmac, mobileManifestDigestV3 } from '../../src/offline/MobileLookupHmac';
import { OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS } from '@taptime/offline-sync-contract';

const source = readFileSync(new URL(
  '../../modules/taptime-nfc-ingress/android/src/main/java/com/taptime/nfcingress/TapTimeNfcIngressModule.kt',
  import.meta.url,
), 'utf8');

// Source boundary checks, not a Kotlin/device execution claim. All entrances must share the
// same tag-required predicate; a normal web link must never turn into NFC time evidence.
describe('native NFC intent boundary', () => {
  it('T121 renews an expired grant before capturing the first warm Intent next morning', async () => {
    const h = ingressHarness();
    try {
      await h.runtime.start();
      await h.ready();
      const oldLease = h.latestLease();
      h.advanceHours(13);
      h.deliver('activity_delivery_intent', h.elapsed());
      h.resume();
      await vi.waitFor(() => expect(h.sent).toHaveLength(1));
      const command = h.sent[0];
      const lease = h.leases.get(command.leaseId)!;
      expect(command.leaseId).not.toBe(oldLease);
      expect(Date.parse(command.workEvent.occurredAt)).toBeGreaterThanOrEqual(Date.parse(lease.issuedAt));
      expect(Date.parse(command.workEvent.occurredAt)).toBeLessThanOrEqual(Date.parse(lease.expiresAt));
      expect(h.readerScan).not.toHaveBeenCalled();
    } finally { await h.close(); }
  });

  it('T121 retains an Intent delivered during the same-session foreground renewal', async () => {
    const h = ingressHarness();
    try {
      await h.runtime.start();
      await h.ready();
      const release = h.delayNextLease();
      const priorCalls = h.leaseCalls();
      h.resume();
      await vi.waitFor(() => expect(h.leaseCalls()).toBeGreaterThan(priorCalls));
      h.advance();
      h.deliver('activity_delivery_intent', h.elapsed());
      h.resume();
      release();
      await vi.waitFor(() => expect(h.sent).toHaveLength(1));
      expect(h.readerScan).not.toHaveBeenCalled();
    } finally { await h.close(); }
  });

  it.each(['open', 'closed'] as const)('T121 captures one system Intent with the app %s despite foreground grant renewal', async mode => {
    const h = ingressHarness();
    try {
      if (mode === 'closed') h.deliver('process_start_intent', 50);
      await h.runtime.start();
      if (mode === 'open') {
        await vi.waitFor(() => expect(h.leaseCalls()).toBeGreaterThan(1));
        await vi.waitFor(() => expect(h.capture.getState().status).toBe('ready'));
        h.advance();
        h.deliver('activity_delivery_intent', h.elapsed());
        // Android pauses a resumed Activity before onNewIntent and resumes it afterwards.
        // RN AppStateModule sends "active" from onHostResume, including this NFC delivery.
        // https://developer.android.com/reference/android/app/Activity#onNewIntent(android.content.Intent)
        h.resume();
      }
      await vi.waitFor(() => expect(h.sent).toHaveLength(1));
      expect(h.sent[0]).toMatchObject({
        expectedMembershipId: uuid(3),
        workEvent: { occurredAt: '2026-10-14T10:00:00.000Z',
          trigger: { type: 'nfc', nfcTagId: uuid(10), assignmentId: uuid(9) },
          target: { targetType: 'customer', targetId: uuid(11) } },
      });
      expect(h.readerScan).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(h.leaseCalls()).toBeGreaterThan(1));
      await vi.waitFor(() => expect(h.capture.getState().status).toBe('server_decision'));
      h.poll();
      await h.scheduler().whenIdle();
      expect(h.sent).toHaveLength(1);

      // D-043: an old ordinary delivery predating this runtime is not the launch Intent.
      // It must never be adopted by the newer authority, even after a grant refresh.
      h.deliver('activity_delivery_intent', 20);
      h.poll();
      await vi.waitFor(() => expect(native.hasPending()).toBe(false));
      expect(h.sent).toHaveLength(1);
      expect(h.readerScan).not.toHaveBeenCalled();
    } finally { await h.close(); }
  });

  it('requires EXTRA_TAG for TECH, NDEF and Android 16 VIEW, rejecting every other action', () => {
    const predicate = source.slice(source.indexOf('private fun isNfcIntent('), source.indexOf('private fun captureIntent('));
    expect(predicate).toMatch(/if \(intent == null \|\| !intent\.hasExtra\(NfcAdapter\.EXTRA_TAG\)\) return false/);
    expect(predicate).toMatch(/when \(intent\.action\)\s*\{\s*NfcAdapter\.ACTION_TECH_DISCOVERED,\s*NfcAdapter\.ACTION_NDEF_DISCOVERED,\s*Intent\.ACTION_VIEW -> true\s*else -> false/s);
  });

  it('applies the predicate to restored launches, capture and extras cleanup without changing UID evidence', () => {
    expect(source).toContain('val isNfcIntent = isNfcIntent(intent)');
    for (const method of ['captureIntent', 'stripNfcExtras']) {
      const body = source.slice(source.indexOf(`private fun ${method}(`));
      expect(body).toMatch(/\{\s*if \(intent == null \|\| !isNfcIntent\(intent\)\) return/);
    }
    expect(source).toContain('if (isHistoryLaunch || (isRestoredCreation && !isNfcIntent))');
    expect(source).toContain('val tag = intent.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)\n    stripNfcExtras(intent)');
    expect(source).toContain('val uid = tag?.id?.copyOf() ?: return');
    for (const extra of ['EXTRA_TAG', 'EXTRA_ID', 'EXTRA_NDEF_MESSAGES']) {
      expect(source).toContain(`intent.removeExtra(NfcAdapter.${extra})`);
    }
    expect(source).not.toContain('getData(');
    expect(source).not.toContain('NdefMessage');
  });
});

function uuid(value: number) { return `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`; }

function ingressHarness() {
  native.clear();
  let elapsed = 100, leaseCalls = 0, sequence = 100;
  let wallClock = Date.parse('2026-10-14T10:00:00.000Z');
  let leaseGate: Promise<void> | null = null;
  const leases = new Map<string, { issuedAt: string; expiresAt: string }>();
  let poll = () => {}, resume = () => {};
  const session = { userId: uuid(1), organizationId: uuid(2), membershipId: uuid(3), role: 'employee' as const, nfcSetupAvailable: false };
  const snapshot = { generation: 1, session };
  const sessionReader = {
    capture: () => snapshot, isCurrent: (candidate: object) => candidate === snapshot,
    getState: () => ({ status: 'authenticated' as const, session }), subscribe: () => () => {},
    isOfflineCaptureRestorationAllowed: () => false, captureOfflineRestorationSnapshot: () => null,
    isOfflineRestorationSnapshotCurrent: () => false, retryContext: async () => {},
  };
  const readerScan = vi.fn(async () => ({ status: 'cancelled' as const }));
  const ingress = new NativeNfcIngressCapturePort();
  const arbiter = new ExclusiveNfcCaptureArbiter({
    checkCapability: async () => 'ready', scan: readerScan, cancelCapture: async () => {}, stop: async () => {},
  }, ingress);
  const nfc = arbiter.scope('lifecycle');
  const database = new OfflineCaptureDatabase(async () => new NodeSqliteOfflineConnection(), new Uint8Array(32).fill(8));
  const sent: import('@taptime/offline-sync-contract').OfflineLifecycleEventCommandV3[] = [];
  let scheduler!: OfflineSyncScheduler;
  const capture = new OfflineCaptureCoordinator(nfc, nfc, sessionReader, {
    loadOrCreate: async () => ({ status: 'ready', secrets: { installationBinding: encodeBase64Url(new Uint8Array(32).fill(6)),
      lookupKey: new Uint8Array(32).fill(7), databaseKey: new Uint8Array(32).fill(8) } }),
  } as unknown as OfflineInstallationIdentityStore, () => database, {
    async issueCompleteV3() {
      leaseCalls++;
      const gate = leaseGate; leaseGate = null;
      await gate;
      elapsed += 10;
      const times = { issuedAt: new Date(wallClock).toISOString(), expiresAt: new Date(wallClock + OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS).toISOString() };
      leases.set(uuid(1000 + leaseCalls), times);
      const items = [{ itemType: 'nfc_assignment' as const, subjectType: 'work' as const, itemId: uuid(8),
        lookup: mobileLookupHmac(new Uint8Array(32).fill(7), 'nfc:uid:v1:04AABBCC'),
        assignmentId: uuid(9), nfcTagId: uuid(10), targetType: 'customer' as const, targetId: uuid(11),
        displayName: 'Kunde', assignmentRowVersion: 1, targetRowVersion: 1 }];
      return { status: 'ready', idempotentRetry: false, page: {
        leaseSchemaVersion: 3, manifestVersion: 3, leaseId: uuid(1000 + leaseCalls), installationId: uuid(6), identityBindingId: uuid(7),
        ...session, membershipRowVersion: 1, ...times,
        configurationRevision: '2'.repeat(64), itemCount: items.length, serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
        manifestDigest: mobileManifestDigestV3(items), items, nextCursor: null,
      } };
    },
  }, new AndroidMonotonicClock({ sample: async () => ({ bootMarker: 'boot-1', processStartElapsedRealtimeMilliseconds: 10,
    elapsedRealtimeMilliseconds: elapsed, wallClockMilliseconds: wallClock }) }), (db, authority) => {
    scheduler = new OfflineSyncScheduler(db, {
      async ingest(command) { sent.push(command as typeof sent[number]); return { status: 'synchronized', idempotentRetry: false,
        workEventId: command.workEvent.id, receiptId: command.receipt.id, deviceSequence: command.deviceSequence,
        archiveStatus: 'offsite_archived', decision: { status: 'time_entry_started', timeEntryId: uuid(12) } }; },
      async reconcile() { return { status: 'ready', records: [] }; }, async readReviewState() { return { status: 'unavailable' }; },
    }, { ingest: async () => ({ status: 'unavailable' }) }, authority, () => wallClock, () => 0.5,
    { schedule: () => 1, cancel() {} });
    return scheduler;
  }, { read: async () => null, write: async () => {}, clear: async () => {} }, () => uuid(++sequence), { bind() {} },
  () => new Date(wallClock));
  const lifecycle = new NativeNfcIngressLifecycle(ingress, capture, capture,
    ((callback: () => void) => { poll = callback; return 1; }) as unknown as typeof setInterval, (() => {}) as typeof clearInterval);
  const scheduling = new OfflineSchedulingLifecycle(capture, {
    currentState: 'active', addEventListener: (_event, listener) => { resume = () => listener('active'); return { remove() { resume = () => {}; } }; },
  }, { addNetworkStateListener: () => ({ remove() {} }) }, async () => {});
  const runtime = new DefaultProductMobileRuntime({ ...sessionReader, start: async () => {}, stop() {} } as unknown as ProductSessionRuntimeOwner,
    { start() {}, stop() {} }, {} as ProductServerTransport, capture,
    { start: async () => {}, stop: async () => {} } as unknown as ProductAdministrationRuntimeOwner,
    scheduling, undefined, lifecycle);
  return { runtime, capture, sent, readerScan, leases, latestLease: () => uuid(1000 + leaseCalls),
    ready: async () => { await vi.waitFor(() => expect(leaseCalls).toBeGreaterThan(1)); await vi.waitFor(() => expect(capture.getState().status).toBe('ready')); },
    delayNextLease: () => { let release!: () => void; leaseGate = new Promise<void>(resolve => { release = resolve; }); return release; },
    advanceHours: (hours: number) => { const delta = hours * 60 * 60 * 1000; elapsed += delta; wallClock += delta; },
    poll: () => poll(), resume: () => { resume(); poll(); },
    advance: () => { elapsed += 100; }, elapsed: () => elapsed, leaseCalls: () => leaseCalls, scheduler: () => scheduler,
    deliver(intentOrigin: 'process_start_intent' | 'activity_delivery_intent', time: number) {
      native.pending = { uid: [4, 0xaa, 0xbb, 0xcc], wallClockMilliseconds: wallClock,
        elapsedRealtimeMilliseconds: time, processStartElapsedRealtimeMilliseconds: 10, bootMarker: 'boot-1', intentOrigin };
    },
    async close() { scheduling.stop(); lifecycle.stop(); await capture.stop(); native.clear(); },
  };
}
