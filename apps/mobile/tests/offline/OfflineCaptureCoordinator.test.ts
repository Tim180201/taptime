import { legacyOfflineSchemas } from '../support/LegacyOfflineSchemas';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OfflineAccountStorage } from '../../src/offline/OfflineAccountStorage';
import { decodeBase64Url32 } from '../../src/offline/encoding';
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' }));
vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn() }));
import { NodeSqliteOfflineConnection } from '../support/NodeSqliteOfflineConnection';
import { OfflineLifecycleClient } from '../../src/offline/OfflineLifecycleClient';
import { mobileLookupHmac, mobileManifestDigestV3, mobileSha256Hex } from '../../src/offline/MobileLookupHmac';
import { describe, expect, it, vi } from 'vitest';
import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
} from '@taptime/core';
import type {
  InternalOfflineRestorationSnapshot,
  MobileSessionState,
  ProductSessionContext,
} from '../../src/auth/contracts';
import type { NfcCaptureLifecyclePort } from '../../src/nfc/RnNfcScanAdapter';
import type { ProductScanSessionSnapshot, ProductScanState } from '../../src/scan/contracts';
import type { LifecycleEvidenceOutbox } from '../../src/scan/LifecycleEvidenceOutbox';
import { ScanFeedbackCoordinator } from '../../src/feedback/ScanFeedbackCoordinator';
import { AndroidMonotonicClock } from '../../src/offline/AndroidMonotonicClock';
import {
  OfflineCaptureCoordinator,
  type OfflineCaptureSessionReader,
} from '../../src/offline/OfflineCaptureCoordinator';
import { OfflineCaptureDatabase, OFFLINE_SCHEMA_V4, OFFLINE_SCHEMA_V5 } from '../../src/offline/OfflineCaptureDatabase';
import { OfflineCaptureLeaseClient, type OfflineCaptureLeaseApiPort } from '../../src/offline/OfflineCaptureLeaseClient';
import { OfflineInstallationIdentityStore } from '../../src/offline/OfflineInstallationIdentityStore';
import {
  OfflineSyncScheduler,
  OFFLINE_ARCHIVE_POLL_MILLISECONDS,
  type OfflineSyncSchedulerState,
} from '../../src/offline/OfflineSyncScheduler';
import { encodeBase64Url } from '../../src/offline/encoding';
import { MemoryOfflineDatabase } from '../support/MemoryOfflinePlatform';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  command: '40000000-0000-4000-8000-000000000001',
  event: '50000000-0000-4000-8000-000000000001',
  receipt: '60000000-0000-4000-8000-000000000001',
  lease: '70000000-0000-4000-8000-000000000001',
  installation: '80000000-0000-4000-8000-000000000001',
  identity: '90000000-0000-4000-8000-000000000001',
  item: 'a0000000-0000-4000-8000-000000000001',
  assignment: 'b0000000-0000-4000-8000-000000000001',
  tag: 'c0000000-0000-4000-8000-000000000001',
  customer: 'd0000000-0000-4000-8000-000000000001',
} as const;

const session: ProductSessionContext = {
  userId: ids.user,
  organizationId: ids.organization,
  membershipId: ids.membership,
  nfcSetupAvailable: false, role: 'employee',
};
const snapshot: ProductScanSessionSnapshot = { generation: 1, session };
const binding = encodeBase64Url(new Uint8Array(32).fill(6));

describe('OfflineCaptureCoordinator', () => {
  it.each([...legacyOfflineSchemas, OFFLINE_SCHEMA_V4, OFFLINE_SCHEMA_V5].map((schema, version) => ({ schema, version })))(
    'T-080 migrates historical SQLite V$version to V6 and reopens unchanged', async ({ schema, version }) => {
      const root = mkdtempSync(join(tmpdir(), 't080-schema-'));
      const filename = join(root, 'offline.db');
      const setup = new NodeSqliteOfflineConnection(filename);
      await setup.execAsync(schema + `PRAGMA user_version = ${version};`);
      if (version !== 0) {
        // The upgrade path has a different physical column order than fresh V4/V5.
        await setup.runAsync(`INSERT INTO offline_lease_generations (
          lease_id, installation_id, identity_binding_id, organization_id, user_id, membership_id,
          membership_row_version, membership_role, issued_at, expires_at, configuration_revision,
          item_count, serialized_bytes, manifest_digest, activation_boot_marker,
          activation_monotonic_milliseconds, generation_state
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 'employee', ?, ?, ?, 0, 2, ?, 'boot-1', 100, 'retired')`,
        [ids.lease, ids.installation, ids.identity, ids.organization, ids.user, ids.membership,
          '2026-07-18T10:00:00.000Z', '2026-07-18T22:00:00.000Z', '2'.repeat(64), '3'.repeat(64)]);
      }
      await setup.closeAsync();
      let connection = new NodeSqliteOfflineConnection(filename);
      let database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
      try {
        await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
        expect(await connection.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
        expect(await connection.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
        if (version !== 0) expect(await connection.getFirstAsync(`SELECT membership_role,
          generation_state, lease_schema_version, manifest_version FROM offline_lease_generations`))
          .toEqual({ membership_role: 'employee', generation_state: 'retired', lease_schema_version: 1, manifest_version: 1 });
        const before = await sqliteSnapshot(connection);
        const schemaBefore = await connection.getAllAsync('SELECT * FROM sqlite_master ORDER BY name');
        await database.close();
        connection = new NodeSqliteOfflineConnection(filename);
        database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
        await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
        expect(await sqliteSnapshot(connection)).toEqual(before);
        expect(await connection.getAllAsync('SELECT * FROM sqlite_master ORDER BY name')).toEqual(schemaBefore);
      } finally { await database.close(); rmSync(root, { recursive: true, force: true }); }
    });

  it('T-080 preserves every table, JSON byte, sequence and constraint from a populated V5 file', async () => {
    const root = mkdtempSync(join(tmpdir(), 't080-preservation-'));
    const filename = join(root, 'offline.db');
    const setup = new NodeSqliteOfflineConnection(filename);
    const lease = await leaseClient().issueCompleteV3!({ commandId: ids.command,
      installationBinding: binding, lookupKey: encodeBase64Url(new Uint8Array(32).fill(7)) });
    if (lease.status !== 'ready') throw new Error('Invalid fixture');
    await seedV5PendingRoleChange(setup, lease.page);
    const queued = await setup.getFirstAsync<{ command_json: string }>('SELECT command_json FROM offline_event_queue');
    const command = JSON.parse(queued!.command_json);
    const legacy = JSON.stringify({ mode: 'canonical', expectedMembershipId: ids.membership,
      command: { organizationId: ids.organization, workEvent: command.workEvent, receipt: command.receipt } });
    await setup.runAsync(`INSERT INTO offline_legacy_queue VALUES (7, ?, ?, ?, ?, 'retry_wait', 2, 30000)`,
      [ids.event, ids.receipt, legacy, new TextEncoder().encode(legacy).length]);
    await setup.execAsync(`INSERT INTO offline_scheduler_metadata VALUES (1, 'manual', 12345);`);
    await setup.runAsync('INSERT INTO offline_protected_quarantine VALUES (?, ?, ?, ?)',
      [ids.item, 'legacy_membership_unknown', '{ "original": "unverändert" }', lease.page.issuedAt]);
    const before = await sqliteSnapshot(setup);
    expect(Object.values(before).every(rows => rows.length > 0)).toBe(true);
    await setup.closeAsync();
    const connection = new NodeSqliteOfflineConnection(filename);
    const database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
    try {
      await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
      expect(await connection.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
      expect(await sqliteSnapshot(connection)).toEqual(before);
      expect(await connection.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
      await expect(connection.runAsync("UPDATE offline_lease_generations SET membership_role = 'standortleitung'", []))
        .rejects.toThrow('immutable');
      await expect(connection.runAsync("UPDATE offline_lease_items SET display_name = 'changed'", []))
        .rejects.toThrow('immutable');
      await expect(connection.runAsync("DELETE FROM offline_lease_items", []))
        .rejects.toThrow('immutable');
      await expect(connection.runAsync("UPDATE offline_event_queue SET command_json = '{}'", []))
        .rejects.toThrow('immutable');
      await expect(connection.runAsync(`INSERT INTO offline_lease_generations SELECT ?, installation_id,
        identity_binding_id, organization_id, user_id, membership_id, membership_row_version,
        'standortleitung', issued_at, expires_at, configuration_revision, item_count, serialized_bytes,
        manifest_digest, activation_boot_marker, activation_monotonic_milliseconds,
        lease_schema_version, manifest_version, generation_state FROM offline_lease_generations`, [ids.command]))
        .rejects.toThrow('UNIQUE');
      const schemaAfter = await connection.getAllAsync('SELECT * FROM sqlite_master ORDER BY name');
      await database.close();
      const reopened = new NodeSqliteOfflineConnection(filename);
      const replay = new OfflineCaptureDatabase(async () => reopened, new Uint8Array(32).fill(8));
      try {
        await expect(replay.initialize()).resolves.toEqual({ status: 'ready' });
        expect(await sqliteSnapshot(reopened)).toEqual(before);
        expect(await reopened.getAllAsync('SELECT * FROM sqlite_master ORDER BY name')).toEqual(schemaAfter);
      } finally { await replay.close(); }
    } finally { await database.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it.each(['rollback', 'future_version'] as const)('T-080 preserves the V5 file on %s', async mode => {
    const root = mkdtempSync(join(tmpdir(), 't080-protection-'));
    const filename = join(root, 'offline.db');
    const setup = new NodeSqliteOfflineConnection(filename);
    const lease = await leaseClient().issueCompleteV3!({ commandId: ids.command,
      installationBinding: binding, lookupKey: encodeBase64Url(new Uint8Array(32).fill(7)) });
    if (lease.status !== 'ready') throw new Error('Invalid fixture');
    await seedV5PendingRoleChange(setup, lease.page);
    if (mode === 'future_version') await setup.execAsync('PRAGMA user_version = 7;');
    const before = await sqliteSnapshot(setup);
    const schemaBefore = await setup.getAllAsync('SELECT * FROM sqlite_master ORDER BY name');
    await setup.closeAsync();
    const connection = new NodeSqliteOfflineConnection(filename);
    await connection.execAsync('PRAGMA foreign_keys = ON;');
    const execute = connection.execAsync.bind(connection);
    const failure = new Error('Simulated interruption after parent table replacement');
    if (mode === 'rollback') connection.execAsync = async sql => {
      await execute(sql);
      if (sql.includes('DROP TABLE offline_lease_generations;')) throw failure;
    };
    const database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
    const diagnostic = vi.fn();
    try {
      await expect(database.initialize(diagnostic)).resolves.toEqual(mode === 'rollback'
        ? { status: 'migration_failed' } : { status: 'protected', reason: 'unknown_schema' });
      if (mode === 'rollback') expect(diagnostic).toHaveBeenCalledWith(failure);
      const reopened = new NodeSqliteOfflineConnection(filename);
      try {
        expect(await sqliteSnapshot(reopened)).toEqual(before);
        expect(await reopened.getAllAsync('SELECT * FROM sqlite_master ORDER BY name')).toEqual(schemaBefore);
        expect(await reopened.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: mode === 'rollback' ? 5 : 7 });
      } finally { await reopened.closeAsync(); }
    } finally { await database.close(); rmSync(root, { recursive: true, force: true }); }
  });

  it.each(['fresh', 'employee_promotion'] as const)(
    'T-080 activates a standortleitung through the HTTP lease client and real SQLite (%s)', async kind => {
      const root = mkdtempSync(join(tmpdir(), 't080-role-'));
      const filename = join(root, 'offline.db');
      const connection = new NodeSqliteOfflineConnection(filename);
      let current: ProductScanSessionSnapshot = { generation: 1,
        session: { ...session, role: kind === 'fresh' ? 'standortleitung' : 'employee' } };
      const listeners = new Set<() => void>();
      const reader: OfflineCaptureSessionReader = {
        ...sessionReader({ status: 'authenticated', session: current.session }, current),
        capture: () => current, isCurrent: candidate => candidate === current,
        getState: () => ({ status: 'authenticated', session: current.session }),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      };
      const original = await leaseClient().issueCompleteV3!({ commandId: ids.command,
        installationBinding: binding, lookupKey: encodeBase64Url(new Uint8Array(32).fill(7)) });
      if (original.status !== 'ready') throw new Error('Invalid fixture');
      if (kind === 'employee_promotion') await seedV5PendingRoleChange(connection, original.page);
      const database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
      const issuedRoles: string[] = [];
      const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), {
        async post() {
          issuedRoles.push(current.session.role);
          return { status: 'response', statusCode: 200, contentType: 'application/json',
            body: JSON.stringify({ ...original, page: { ...original.page,
              role: current.session.role, membershipRowVersion: current.generation,
              leaseId: current.session.role === 'employee' ? ids.lease : ids.command } }) };
        },
      });
      const scheduler = controllableScheduler();
      const coordinator = new OfflineCaptureCoordinator({ async scan() {
        return { status: 'captured', payload: createCanonicalNfcUidPayload('04AABBCC'),
          capturedAt: createTimestamp('2026-07-18T10:05:00.000Z') };
      } }, nfcLifecycle(), reader, identityStore(), () => database, client,
      new AndroidMonotonicClock({ async sample() { return { bootMarker: 'boot-1',
        elapsedRealtimeMilliseconds: 100, wallClockMilliseconds: Date.parse(original.page.issuedAt) }; } }),
      () => scheduler.scheduler, emptyOutbox(), (() => { let n = 0; return () => `f0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; })());
      try {
        await coordinator.start();
        if (kind === 'employee_promotion') {
          expect(coordinator.getState().status).toBe('saved_locally');
          const evidenceBefore = await connection.getAllAsync('SELECT * FROM offline_event_queue');
          const ownerBefore = await connection.getAllAsync('SELECT * FROM offline_owner');
          current = { generation: 2, session: { ...session, role: 'standortleitung' } };
          for (const listener of listeners) listener();
          await vi.waitFor(() => expect(coordinator.getState().status).toBe('saved_locally'));
          expect(await connection.getAllAsync('SELECT * FROM offline_event_queue')).toEqual(evidenceBefore);
          expect(await connection.getAllAsync('SELECT * FROM offline_owner')).toEqual(ownerBefore);
          expect(await connection.getFirstAsync(`SELECT membership_role, generation_state
            FROM offline_lease_generations WHERE lease_id = ?`, [ids.lease]))
            .toEqual({ membership_role: 'employee', generation_state: 'retired' });
          expect(issuedRoles).toEqual(['employee', 'standortleitung']);
        } else expect(coordinator.getState().status).toBe('ready');
        expect(await database.readActiveCaptureContext()).toMatchObject({ role: 'standortleitung' });
        expect(await database.lookupActiveItem(mobileLookupHmac(new Uint8Array(32).fill(7), 'nfc:uid:v1:04AABBCC')))
          .toMatchObject({ leaseId: ids.command, nfcTagId: ids.tag });
        await coordinator.scan();
        expect(coordinator.getState().status).toBe('synchronizing');
        const captured = await connection.getFirstAsync<{ device_sequence: number; lease_id: string }>(
          'SELECT device_sequence, lease_id FROM offline_event_queue ORDER BY device_sequence DESC LIMIT 1');
        expect(captured).toEqual({ device_sequence: kind === 'fresh' ? 1 : 2, lease_id: ids.command });
      } finally { await coordinator.stop(); await database.close(); rmSync(root, {recursive: true, force: true}); }
    });

  it.each(['other_account', 'new_membership'] as const)('T-076 gives %s a fresh lease and no old evidence', async kind => {
    const h = await accountHarness();
    try {
      const oldBinding = h.bindings[0];
      h.change(kind === 'other_account' ? { ...session, userId: ids.event, membershipId: ids.receipt } : { ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.bindings).toHaveLength(2));
      await vi.waitFor(() => expect(h.coordinator.getState().status).toBe('ready'));
      expect(h.bindings[1]).not.toBe(oldBinding);
      expect(await h.database().queueCount()).toBe(0);
      const result = await h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      expect(result.status).toBe('saved');
      await h.scheduler().trigger('manual');
      expect(h.sent.at(-1)).toMatchObject({ deviceSequence: 1, expectedMembershipId: ids.receipt });
    } finally { await h.close(); }
  });

  it.each(['unconfirmed', 'unarchived', 'review_pending'] as const)('T-076 blocks %s and lets the original account return', async kind => {
    const h = await accountHarness();
    try {
      h.mode = kind;
      await h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      await h.scheduler().trigger('manual');
      if (kind !== 'unconfirmed') expect(await h.database().queueCount()).toBe(0);
      const sent = h.sent.length;
      h.change({ ...session, userId: ids.event, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      await h.coordinator.retry();
      await h.scheduler().reconcileArchives();
      expect(h.sent).toHaveLength(sent);
      expect(h.bindings).toHaveLength(1);
      h.change(session);
      await vi.waitFor(() => expect(h.bindings).toHaveLength(2));
      expect(h.bindings[1]).toBe(h.bindings[0]);
      h.mode = 'archived'; h.advance();
      await h.scheduler().trigger('manual');
      await h.scheduler().reconcileArchives();
      // Review confirmation is a separate authoritative server response.
      if (kind === 'review_pending') await h.database().clearReviewPendingSequence(1, 1);
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.bindings).toHaveLength(3));
      expect(h.bindings[2]).not.toBe(h.bindings[0]);
    } finally { await h.close(); }
  });

  it('T-076 blocks even an empty queue while its scheduler flight is unfinished', async () => {
    const h = await accountHarness(); const count = deferred<number>();
    const read = vi.spyOn(h.database(), 'queueCount').mockReturnValueOnce(count.promise);
    try {
      const sync = h.scheduler().trigger('manual');
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      expect(h.bindings).toHaveLength(1);
      count.resolve(0); await sync;
    } finally { count.resolve(0); read.mockRestore(); await h.close(); }
  });

  it('T-076 blocks an outstanding Legacy SecureStore outbox independently of SQLite', async () => {
    const h = await accountHarness();
    try {
      h.legacyBlocked = true;
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      expect(h.bindings).toHaveLength(1); expect(await h.database().queueCount()).toBe(0);
    } finally { await h.close(); }
  });

  it('T-076 keeps the foreign-account protection when an old upload later rejects authority', async () => {
    const h = await accountHarness(); const upload = deferred<void>();
    try {
      h.mode = 'authority_rejected'; h.ingestGate = upload.promise;
      await h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      await vi.waitFor(() => expect(h.sent).toHaveLength(1));
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      upload.resolve(); await h.scheduler().whenIdle();
      expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' });
      expect(h.bindings).toHaveLength(1);
    } finally { upload.resolve(); await h.close(); }
  });

  it('T-076 blocks an archive flight and ignores its completion under another account', async () => {
    const h = await accountHarness(); const archive = deferred<void>();
    try {
      h.mode = 'unarchived';
      await h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer }); await h.scheduler().whenIdle();
      h.reconcileGate = archive.promise; h.advance();
      const flight = h.scheduler().reconcileArchives();
      await vi.waitFor(() => expect(h.reconcileWaiting).toBe(true));
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      h.mode = 'archived'; archive.resolve(); await flight;
      expect(await h.database().readAwaitingArchive(0, 10)).toHaveLength(1);
      expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' });
    } finally { archive.resolve(); await h.close(); }
  });

  it('T-076 ignores old authority rejection after its database release was paused', async () => {
    const h = await accountHarness(); const released = deferred<void>();
    const original = h.database().releaseHead.bind(h.database());
    const release = vi.spyOn(h.database(), 'releaseHead').mockImplementation(async identity => {
      await released.promise; return original(identity);
    });
    try {
      h.mode = 'authority_rejected';
      await h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      await vi.waitFor(() => expect(release).toHaveBeenCalled());
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      released.resolve(); await h.scheduler().whenIdle();
      expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' });
    } finally { released.resolve(); release.mockRestore(); await h.close(); }
  });

  it('T-076 keeps an in-progress authority invalidation from changing the next session', async () => {
    const h = await accountHarness(); const cancelled = deferred<void>();
    const cancel = vi.spyOn(h.lifecycle, 'cancelCapture').mockReturnValueOnce(cancelled.promise);
    const invalidate = vi.spyOn(h.database(), 'invalidateCapture');
    try {
      h.mode = 'authority_rejected';
      await h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      cancelled.resolve(); await h.scheduler().whenIdle();
      expect(invalidate).not.toHaveBeenCalled();
      expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' });
    } finally { cancelled.resolve(); cancel.mockRestore(); invalidate.mockRestore(); await h.close(); }
  });

  it('T-076 does not publish the old NFC count when the session changes after append', async () => {
    const h = await accountHarness(); const counted = deferred<number>();
    const original = h.database().appendEvent.bind(h.database());
    let count: ReturnType<typeof vi.spyOn> | undefined;
    const append = vi.spyOn(h.database(), 'appendEvent').mockImplementation(async draft => {
      const result = await original(draft);
      count = vi.spyOn(h.database(), 'queueCount').mockReturnValueOnce(counted.promise);
      return result;
    });
    let scan: Promise<void> | undefined;
    try {
      scan = h.coordinator.scan();
      await vi.waitFor(() => expect(count).toHaveBeenCalled());
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      counted.resolve(1); await scan;
      expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' });
      expect(h.coordinator.getState()).not.toHaveProperty('queueCount');
      expect(h.sent).toHaveLength(0);
    } finally { counted.resolve(1); await scan; count?.mockRestore(); append.mockRestore(); await h.close(); }
  });

  it('T-076 blocks a manual capture that is still sampling and ignores its stale completion', async () => {
    const h = await accountHarness();
    try {
      const sample = deferred<void>(); h.sampleGate = sample.promise;
      const manual = h.coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      await vi.waitFor(() => expect(h.sampleWaiting).toBe(true));
      h.change({ ...session, membershipId: ids.receipt });
      await vi.waitFor(() => expect(h.coordinator.getState()).toMatchObject({ status: 'protected_pending', reason: 'identity_mismatch' }));
      sample.resolve(); await manual;
      expect(h.sent).toHaveLength(0);
      expect(h.bindings).toHaveLength(1);
    } finally { await h.close(); }
  });

  it.each([
    ['time_entry_started', 'work_started'], ['time_entry_stopped', 'work_stopped'],
    ['break_started', 'break_changed'], ['break_stopped', 'break_changed'],
  ] as const)('shows and feels %s while retaining the event in real SQLite until archived', async (decisionStatus, feedbackKind) => {
    const database = new OfflineCaptureDatabase(
      async () => new NodeSqliteOfflineConnection(), new Uint8Array(32).fill(8),
    );
    let now = 20_000;
    let archiveStatus = 'archive_pending';
    let received: { workEventId: string; receiptId: string; deviceSequence: number } | null = null;
    const decision = { status: decisionStatus, timeEntryId: ids.event,
      ...(decisionStatus.startsWith('break_') ? { breakIntervalId: ids.receipt } : {}) };
    let scheduler!: OfflineSyncScheduler;
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), {
      async post(endpoint, requestBody) {
        const command = JSON.parse(requestBody);
        const reconciliation = endpoint.pathname.endsWith('/reconcile');
        if (!reconciliation) received = { workEventId: command.workEvent.id,
          receiptId: command.receipt.id, deviceSequence: command.deviceSequence };
        const body = reconciliation
          ? { status: 'ready', records: received !== null && command.workEventIds.includes(received.workEventId)
              ? [{ ...received, archiveStatus, result: { status: 'synchronized', decision } }] : [] }
          : { status: 'synchronized', archiveStatus, idempotentRetry: false, ...received, decision };
        return { status: 'response', statusCode: 200, contentType: 'application/json',
          body: JSON.stringify(body) };
      },
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'captured',
        payload: createCanonicalNfcUidPayload('04AABBCC'),
        capturedAt: createTimestamp('2026-07-18T10:00:00.000Z') }; } },
      nfcLifecycle(), sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(), () => database, leaseClient(true),
      new AndroidMonotonicClock({ async sample() {
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100,
          wallClockMilliseconds: Date.parse('2026-07-18T10:00:00.000Z') };
      } }),
      (db, authority) => {
        scheduler = new OfflineSyncScheduler(db, client,
          { async ingest() { return { status: 'unavailable' }; } }, authority,
          () => now, () => 0.5,
          { schedule() { return 1; }, cancel() {} });
        return scheduler;
      },
      emptyOutbox(), sequentialUuid([ids.command, ids.event, ids.receipt, ids.assignment, ids.tag]),
      { bind() {} }, () => new Date('2026-07-18T10:00:00.000Z'),
    );
    const feedback = { perform: vi.fn(async () => undefined) };
    const scanFeedback = new ScanFeedbackCoordinator(coordinator, feedback);
    try {
      await coordinator.start();
      await vi.waitFor(() => expect(coordinator.getState().status).toBe('ready'));
      scanFeedback.start();
      await coordinator.scan();
      await scheduler.trigger('network_hint');
      // D-051 protects the row; D-052 gives the hand the actual engine decision now.
      await expect(database.queueCount()).resolves.toBe(0);
      await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(1);
      expect(coordinator.getState()).toMatchObject({
        status: 'server_decision', queueCount: 0,
        outcome: { status: decisionStatus },
      });
      expect(feedback.perform).toHaveBeenCalledExactlyOnceWith(feedbackKind);
      now += OFFLINE_ARCHIVE_POLL_MILLISECONDS;
      archiveStatus = 'offsite_archived';
      await scheduler.reconcileArchives();
      await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(0);
      await expect(database.queueCount()).resolves.toBe(0);
      // Archival completion does not produce a second impulse.
      expect(feedback.perform).toHaveBeenCalledTimes(1);
      archiveStatus = 'archive_pending';
      const manual = await coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      expect(manual).toEqual({ status: 'saved', workEventId: ids.assignment });
      await scheduler.trigger('manual');
      expect(coordinator.readManualAcknowledgement(ids.assignment)).toEqual({
        status: 'server_decision', outcome: decisionStatus,
      });
      await expect(database.queueCount()).resolves.toBe(0);
    } finally {
      scanFeedback.stop();
      await coordinator.stop();
    }
  });

  it('emits work-start feedback for the real successful online state sequence', async () => {
    const harness = await feedbackProductionHarness();

    await harness.coordinator.scan();
    harness.setQueueCount(0);
    harness.scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_started', timeEntryId: ids.event },
    });

    expect(harness.states).toEqual(['scanning', 'synchronizing', 'server_decision']);
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('work_started');
  });

  it('waits for this tap’s decision and haptic while a preceding event is confirmed', async () => {
    const h = await feedbackProductionHarness();
    await h.coordinator.scan();
    h.scheduler.publish({ status: 'server_decision', queueCount: 1,
      workEventId: ids.assignment,
      decision: { status: 'time_entry_started', timeEntryId: ids.event } });
    expect(h.feedback.perform).not.toHaveBeenCalled();
    expect(h.coordinator.getState().status).toBe('synchronizing');
    h.setQueueCount(0);
    h.scheduler.publish({ status: 'server_decision', queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_stopped', timeEntryId: ids.event } });
    expect(h.feedback.perform).toHaveBeenCalledExactlyOnceWith('work_stopped');
    expect(h.coordinator.getState()).toMatchObject({ status: 'server_decision',
      outcome: { status: 'time_entry_stopped' } });
    await h.coordinator.stop();
  });

  it('emits pending feedback for the real online review state sequence', async () => {
    const harness = await feedbackProductionHarness();

    await harness.coordinator.scan();
    harness.setQueueCount(0);
    harness.scheduler.publish({
      status: 'review_pending',
      queueCount: 0,
      workEventId: ids.event,
    });

    expect(harness.states).toEqual(['scanning', 'synchronizing', 'server_review_pending']);
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('pending_confirmation');
  });

  it('emits the same pending pattern for real online escalation and review states', async () => {
    const escalation = await feedbackProductionHarness();

    await escalation.coordinator.scan();
    escalation.setQueueCount(0);
    escalation.scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: {
        status: 'escalation_required',
        reason: 'business_engine_could_not_decide',
      },
    });

    const review = await feedbackProductionHarness();
    await review.coordinator.scan();
    review.setQueueCount(0);
    review.scheduler.publish({
      status: 'review_pending',
      queueCount: 0,
      workEventId: ids.event,
    });

    expect(escalation.states).toEqual(['scanning', 'synchronizing', 'server_decision']);
    expect(escalation.feedback.perform).toHaveBeenCalledTimes(1);
    expect(escalation.feedback.perform).toHaveBeenCalledWith('pending_confirmation');
    expect(review.feedback.perform.mock.calls).toEqual(escalation.feedback.perform.mock.calls);
  });

  it('emits pending once for the real no-network sequence and stays silent later', async () => {
    const harness = await feedbackProductionHarness();

    await harness.coordinator.scan();
    harness.scheduler.publish({ status: 'retry_wait', queueCount: 1 });
    expect(harness.states).toEqual(['scanning', 'synchronizing', 'saved_locally']);
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('pending_confirmation');

    harness.scheduler.publish({ status: 'synchronizing', queueCount: 1 });
    harness.setQueueCount(0);
    harness.scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_started', timeEntryId: ids.event },
    });
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
  });

  it('emits failure for the real queue-full state sequence without storing the scan', async () => {
    const harness = await feedbackProductionHarness('full');

    await harness.coordinator.scan();

    expect(harness.states).toEqual(['scanning', 'ready']);
    expect(harness.coordinator.getState()).toEqual({
      status: 'ready',
      outcome: { status: 'queue_full' },
    });
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('failed');
  });

  it('persists a changed-boot scan as review-only before triggering synchronization', async () => {
    const order: string[] = [];
    const appendEvent = vi.fn(async (draft) => {
      order.push('append');
      return { status: 'ready', command: { ...draft, deviceSequence: 1 } };
    });
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValue(1),
      lookupActiveItem: vi.fn(async () => ({
        itemType: 'nfc_assignment' as const,
        leaseId: ids.lease,
        leaseItemId: ids.item,
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        targetType: 'customer',
        targetId: ids.customer,
        displayName: 'Kunde',
        issuedAt: '2026-07-18T10:00:00.000Z',
        expiresAt: '2026-07-18T22:00:00.000Z',
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 100,
      })),
      readActiveCaptureContext: vi.fn(async () => activeContext()),
      appendEvent,
      invalidateCapture: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    const scheduler = schedulerFake(order);
    const monotonicSamples = [
      { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 },
      { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 200 },
      { bootMarker: 'boot-2', elapsedRealtimeMilliseconds: 50 },
    ];
    const coordinator = new OfflineCaptureCoordinator(
      {
        async scan(): Promise<NfcScanCaptureResult> {
          return {
            status: 'captured',
            payload: createCanonicalNfcUidPayload('04AABBCC'),
            capturedAt: createTimestamp('2026-07-18T10:05:00.000Z'),
          };
        },
      },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() { return monotonicSamples.shift()!; },
      }),
      () => scheduler,
      emptyOutbox(),
      sequentialUuid([ids.command, ids.event, ids.receipt]),
    );

    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'ready', outcome: null });
    const ingressAuthority = await coordinator.captureNativeNfcIngressAuthority({
      bootMarker: 'boot-1',
      intentOrigin: 'activity_delivery_intent',
      processStartElapsedRealtimeMilliseconds: 0,
      elapsedRealtimeMilliseconds: 201,
    });
    expect(ingressAuthority).not.toBeNull();
    expect(coordinator.isNativeNfcIngressAuthorityCurrent(ingressAuthority!)).toBe(true);
    await coordinator.scan();
    const draft = appendEvent.mock.calls[0]![0];
    expect(draft.clock).toMatchObject({
      bootMarker: 'boot-2',
      monotonicDeltaMilliseconds: 0,
      clockProofStatus: 'review_only',
    });
    expect(draft.workEvent).toMatchObject({
      id: ids.event,
      trigger: {
        type: 'nfc',
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
      },
    });
    expect(draft.provenanceVersion).toBe(3);
    expect(order.indexOf('append')).toBeLessThan(order.lastIndexOf('trigger'));
    expect(coordinator.getState()).toEqual({ status: 'synchronizing', queueCount: 1 });
    await coordinator.onExplicitLogout();
    expect(coordinator.isNativeNfcIngressAuthorityCurrent(ingressAuthority!)).toBe(false);
    await expect(coordinator.captureNativeNfcIngressAuthority({
      bootMarker: 'boot-1',
      intentOrigin: 'activity_delivery_intent',
      processStartElapsedRealtimeMilliseconds: 0,
      elapsedRealtimeMilliseconds: 201,
    })).resolves.toBeNull();
  });

  it('keeps a durable review warning dominant across authenticated lease restoration', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 0),
      readReviewPendingSequence: vi.fn(async () => 12),
      close: vi.fn(async () => undefined),
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
        },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([ids.command]),
    );

    await coordinator.start();

    expect(coordinator.getState()).toEqual({
      status: 'server_review_pending',
      queueCount: 0,
    });
  });

  it('keeps a rejected server decision visible across later idle scheduler hints', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const scheduler = controllableScheduler();
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
        },
      }),
      () => scheduler.scheduler,
      emptyOutbox(),
      sequentialUuid([ids.command]),
    );

    await coordinator.start();
    scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: ids.event,
      },
    });
    expect(coordinator.getState()).toEqual({
      status: 'server_decision',
      queueCount: 0,
      outcome: { status: 'active_entry_for_other_target_rejected' },
    });

    scheduler.publish({ status: 'idle', queueCount: 0 });
    await vi.waitFor(() => {
      expect(coordinator.getState()).toEqual({
        status: 'ready',
        outcome: { status: 'active_entry_for_other_target_rejected' },
      });
    });
  });

  it('restores a persisted queue as visibly saved after an app or device restart', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 1),
      close: vi.fn(async () => undefined),
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
        },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([ids.command]),
    );

    await coordinator.start();

    expect(coordinator.getState()).toEqual({ status: 'saved_locally', queueCount: 1 });
  });

  it('opens cold-start capture only for a typed transient context failure and same-boot lease',
    async () => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => activeContext()),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const issueCompleteV3 = vi.fn();
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'context_unavailable' }, null, true),
        identityStore(),
        () => database,
        { issueCompleteV3 },
        new AndroidMonotonicClock({
          async sample() {
            return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );

      await coordinator.start();
      expect(coordinator.getState()).toEqual({
        status: 'offline_ready',
        queueCount: 0,
        outcome: null,
      });
      const ingressAuthority = await coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 0,
        elapsedRealtimeMilliseconds: 600_101,
      });
      expect(ingressAuthority).not.toBeNull();
      expect(coordinator.isNativeNfcIngressAuthorityCurrent(ingressAuthority!)).toBe(true);
      expect(issueCompleteV3).not.toHaveBeenCalled();
    });

  it('accepts the process-start Intent under the authority created by that runtime start',
    async () => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        bindOwner: vi.fn(async () => ({ status: 'ready' })),
        activateLease: vi.fn(async () => ({ status: 'ready' })),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'authenticated', session }, snapshot),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return {
              bootMarker: 'boot-1',
              processStartElapsedRealtimeMilliseconds: 10,
              elapsedRealtimeMilliseconds: 100,
            };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([ids.command]),
      );

      await coordinator.start();
      coordinator.bindNativeNfcIngressRuntimeStart();

      // A just-created process has no older local authority; runtime startup binds this generation.
      const authority = await coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      });
      expect(authority).not.toBeNull();
      expect(coordinator.isNativeNfcIngressAuthorityCurrent(authority!)).toBe(true);
    });

  it('rejects foreign identity/Membership, previous boot, process mismatch, and old non-start delivery because later authority must not adopt them',
    async () => {
      let sessionState: MobileSessionState = { status: 'authenticated', session };
      let authenticatedSnapshot: ProductScanSessionSnapshot | null = snapshot;
      const sessionSubscription: { listener?: () => void } = {};
      let cancelCount = 0;
      const delayedCancel = deferred<void>();
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        bindOwner: vi.fn(async () => ({ status: 'ready' })),
        activateLease: vi.fn(async () => ({ status: 'ready' })),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        {
          async checkCapability() { return 'ready'; },
          async cancelCapture() {
            cancelCount += 1;
            if (cancelCount === 2) await delayedCancel.promise;
          },
          async stop() {},
        },
        {
          getState: () => sessionState,
          isOfflineCaptureRestorationAllowed: () => false,
          captureOfflineRestorationSnapshot: () => null,
          isOfflineRestorationSnapshotCurrent: () => false,
          capture: () => authenticatedSnapshot,
          isCurrent: (candidate) => candidate === authenticatedSnapshot,
          subscribe: (listener) => {
            sessionSubscription.listener = listener;
            return () => undefined;
          },
          retryContext: vi.fn(async () => undefined),
        },
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return {
              bootMarker: 'boot-1',
              processStartElapsedRealtimeMilliseconds: 10,
              elapsedRealtimeMilliseconds: 100,
            };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([ids.command]),
      );
      await coordinator.start();
      coordinator.bindNativeNfcIngressRuntimeStart();
      expect(coordinator.getState()).toEqual({ status: 'ready', outcome: null });

      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-2',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      })).resolves.toBeNull();
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 9,
        elapsedRealtimeMilliseconds: 50,
      })).resolves.toBeNull();
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      })).resolves.toBeNull();
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 100,
      })).resolves.toBeNull();
      const normalAuthority = await coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 101,
      });
      expect(normalAuthority).not.toBeNull();

      const foreignSession = {
        ...session,
        userId: '10000000-0000-4000-8000-000000000002',
        membershipId: '30000000-0000-4000-8000-000000000002',
      } as const;
      sessionState = { status: 'authenticated', session: foreignSession };
      authenticatedSnapshot = { generation: 2, session: foreignSession };
      expect(sessionSubscription.listener).toBeDefined();
      sessionSubscription.listener!();
      const authorityPromise = coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      });
      let settled = false;
      void authorityPromise.then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false);

      delayedCancel.resolve();
      const authority = await authorityPromise;
      expect(authority).toBeNull();
    });

  it.each([
    [{ status: 'context_unavailable' }, null],
    [{ status: 'context_unavailable' }, activeContext()],
    [
      { status: 'runtime_unavailable', reason: 'authentication_unavailable' },
      activeContext(),
    ],
    [
      { status: 'runtime_unavailable', reason: 'storage_unavailable' },
      activeContext(),
    ],
  ] satisfies Array<[MobileSessionState, ReturnType<typeof activeContext> | null]>)(
    'keeps cold-start capture closed for session $status without an eligible local context',
    async (sessionState, localContext) => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => localContext),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader(sessionState, null),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );

      await coordinator.start();
      expect(coordinator.getState()).toEqual({ status: 'inactive' });
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 0,
        elapsedRealtimeMilliseconds: 600_100,
      })).resolves.toBeNull();
    },
  );

  it('retries a suspended session before scheduling work on a network hint', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      readActiveCaptureContext: vi.fn(async () => activeContext()),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const scheduler = schedulerFake([]);
    const trigger = vi.mocked(scheduler.trigger);
    const retryComplete = deferred<void>();
    const retryContext = vi.fn(() => retryComplete.promise);
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      {
        ...sessionReader({ status: 'context_unavailable' }, null, true),
        retryContext,
      },
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
        },
      }),
      () => scheduler,
      emptyOutbox(),
      sequentialUuid([]),
      { bind() {} },
      () => new Date('2026-07-18T10:10:00.000Z'),
    );
    await coordinator.start();
    trigger.mockClear();

    coordinator.triggerNetworkHint();
    expect(retryContext).toHaveBeenCalledTimes(1);
    expect(trigger).not.toHaveBeenCalled();
    retryComplete.resolve();

    await vi.waitFor(() => expect(trigger).toHaveBeenCalledWith('network_hint'));
  });

  it('reads only the exact still-valid offline manual-target lease projection', async () => {
    const context = activeContext();
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      readActiveCaptureContext: vi.fn(async () => context),
      listActiveManualTargets: vi.fn(async () => [{
        targetType: 'project',
        targetId: ids.customer,
        displayName: 'Projekt',
      }]),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'context_unavailable' }, null, true),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
        },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([]),
      { bind() {} },
      () => new Date('2026-07-18T10:10:00.000Z'),
    );
    await coordinator.start();

    await expect(coordinator.readOfflineManualTargets()).resolves.toEqual({
      status: 'ready',
      targets: [{
        targetType: 'project',
        targetId: ids.customer,
        displayName: 'Projekt',
      }],
    });
    expect(database.listActiveManualTargets).toHaveBeenCalledWith(ids.lease);
  });

  it.each(['stale_clock', 'mismatched_lease'] as const)(
    'fails the offline manual-target projection closed for %s',
    async (scenario) => {
      let sampleCount = 0;
      let contextCount = 0;
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => {
          contextCount += 1;
          return scenario === 'mismatched_lease' && contextCount > 1
            ? { ...activeContext(), leaseId: '70000000-0000-4000-8000-000000000099' }
            : activeContext();
        }),
        listActiveManualTargets: vi.fn(async () => []),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'context_unavailable' }, null, true),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            sampleCount += 1;
            return {
              bootMarker: scenario === 'stale_clock' && sampleCount > 1 ? 'boot-2' : 'boot-1',
              elapsedRealtimeMilliseconds: 600_100,
            };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );
      await coordinator.start();
      await expect(coordinator.readOfflineManualTargets()).resolves.toEqual({
        status: 'protected',
      });
      expect(database.listActiveManualTargets).not.toHaveBeenCalled();
    },
  );

  it('invalidates capture and removes only the active lookup key on explicit logout', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      queueCount: vi.fn(async () => 0),
      invalidateCapture: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    const removeActiveLookupKey = vi.fn(async () => undefined);
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'unauthenticated', reason: 'not_signed_in' }, null),
      identityStore(removeActiveLookupKey),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() { return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 }; },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([]),
    );
    await coordinator.start();
    await coordinator.onExplicitLogout();
    expect(database.invalidateCapture).toHaveBeenCalledTimes(1);
    expect(removeActiveLookupKey).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({ status: 'inactive' });
  });

  it.each([
    ['secure_identity', 'P01', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['database_initialization', 'P02', {
      status: 'secure_storage_unavailable',
    }],
    ['database_integrity', 'P03', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['database_migration', 'P04', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['legacy_import', 'P05', {
      status: 'protected_pending',
      reason: 'legacy_membership_unknown',
    }],
    ['owner_binding', 'P06', {
      status: 'protected_pending',
      reason: 'identity_mismatch',
    }],
    ['lease_completeness', 'P07', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['lease_activation', 'P08', {
      status: 'unavailable',
    }],
    ['scheduler_durable', 'P09', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
  ] as const)('classifies the exact %s pre-scan origin opaquely', async (
    origin,
    protection,
    state,
  ) => {
    const coordinator = protectedOriginCoordinator(origin);

    await coordinator.start();

    expect(coordinator.getState()).toEqual(state);
    expect(coordinator.getState().protection).toEqual([protection]);
  });

  it('logs the P04 class with only the sanitized SQLite code and message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const native = new MemoryOfflineDatabase();
      const execute = native.execAsync.bind(native);
      native.execAsync = async (source) => {
        if (source.includes('CREATE TABLE offline_owner')) {
          throw Object.assign(new Error(
            "Call to function 'NativeDatabase.execAsync' has been rejected.\n"
            + '→ Caused by: near "generation_state": syntax error',
          ), { code: 'ERR_INTERNAL_SQLITE_ERROR' });
        }
        await execute(source);
      };
      const database = new OfflineCaptureDatabase(
        async () => native,
        new Uint8Array(32).fill(8),
      );
      const coordinator = protectedOriginCoordinator('database_migration', database);

      await coordinator.start();

      expect(consoleError).toHaveBeenCalledTimes(1);
      const [serialized] = consoleError.mock.calls[0]!;
      expect(JSON.parse(String(serialized))).toEqual({
        protectionClass: 'P04',
        sqliteErrorCode: 'ERR_INTERNAL_SQLITE_ERROR',
        message: 'near "generation_state": syntax error',
      });
      expect(coordinator.getState().protection).toEqual(['P04']);
    } finally {
      consoleError.mockRestore();
    }
  });
});

function protectedOriginCoordinator(
  origin:
    | 'secure_identity'
    | 'database_initialization'
    | 'database_integrity'
    | 'database_migration'
    | 'legacy_import'
    | 'owner_binding'
    | 'lease_completeness'
    | 'lease_activation'
    | 'scheduler_durable',
  databaseOverride?: OfflineCaptureDatabase,
): OfflineCaptureCoordinator {
  const initialized = origin === 'database_integrity'
    ? { status: 'protected' as const, reason: 'cipher_integrity_failed' as const }
    : origin === 'database_migration'
      ? { status: 'migration_failed' as const }
      : { status: 'ready' as const };
  const database = databaseOverride ?? databaseFake({
    initialize: vi.fn(async () => initialized),
    hasProtectedLegacy: vi.fn(async () => origin === 'legacy_import'),
    bindOwner: vi.fn(async () => origin === 'owner_binding'
      ? { status: 'protected' as const, reason: 'identity_mismatch' as const }
      : { status: 'ready' as const }),
    activateLease: vi.fn(async () => origin === 'lease_activation'
      ? { status: 'protected' as const, reason: 'corrupt_row' as const }
      : { status: 'ready' as const }),
    readActiveCaptureContext: vi.fn(async () => null),
    queueCount: vi.fn(async () => 0),
    close: vi.fn(async () => undefined),
  });
  const protectedIdentity = {
    async loadOrCreate() {
      return { status: 'protected' as const, reason: 'missing_key' as const };
    },
    async removeActiveLookupKey() {},
  } as unknown as OfflineInstallationIdentityStore;
  const completeLease = leaseClient();
  const lease = origin === 'lease_completeness'
    ? {
        ...completeLease,
        async issueCompleteV3() {
          return { status: 'incomplete_or_oversize' as const };
        },
      }
    : completeLease;
  return new OfflineCaptureCoordinator(
    { async scan() { return { status: 'cancelled' }; } },
    nfcLifecycle(),
    sessionReader({ status: 'authenticated', session }, snapshot),
    origin === 'secure_identity' ? protectedIdentity : identityStore(),
    () => {
      if (origin === 'database_initialization') {
        throw new Error('closed database initialization failure');
      }
      return database;
    },
    lease,
    new AndroidMonotonicClock({
      async sample() {
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
      },
    }),
    () => {
      if (origin === 'scheduler_durable') {
        throw new Error('closed scheduler durable failure');
      }
      return schedulerFake([]);
    },
    emptyOutbox(),
    sequentialUuid([ids.command]),
  );
}

async function feedbackProductionHarness(appendStatus: 'ready' | 'full' = 'ready') {
  let queueCount = 0;
  const database = databaseFake({
    initialize: vi.fn(async () => ({ status: 'ready' })),
    hasProtectedLegacy: vi.fn(async () => false),
    bindOwner: vi.fn(async () => ({ status: 'ready' })),
    activateLease: vi.fn(async () => ({ status: 'ready' })),
    queueCount: vi.fn(async () => queueCount),
    lookupActiveItem: vi.fn(async () => ({
      itemType: 'nfc_assignment' as const,
      leaseId: ids.lease,
      leaseItemId: ids.item,
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      targetType: 'customer',
      targetId: ids.customer,
      displayName: 'Kunde',
      issuedAt: '2026-07-18T10:00:00.000Z',
      expiresAt: '2026-07-18T22:00:00.000Z',
      activationBootMarker: 'boot-1',
      activationMonotonicMilliseconds: 100,
    })),
    readActiveCaptureContext: vi.fn(async () => activeContext()),
    appendEvent: vi.fn(async (draft) => {
      if (appendStatus === 'full') return { status: 'full' as const };
      queueCount = 1;
      return {
        status: 'ready' as const,
        command: { ...draft, deviceSequence: 1 },
      };
    }),
    invalidateCapture: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  });
  const scheduler = controllableScheduler();
  let monotonicMilliseconds = 100;
  const coordinator = new OfflineCaptureCoordinator(
    {
      async scan(): Promise<NfcScanCaptureResult> {
        return {
          status: 'captured',
          payload: createCanonicalNfcUidPayload('04AABBCC'),
          capturedAt: createTimestamp('2026-07-18T10:05:00.000Z'),
        };
      },
    },
    nfcLifecycle(),
    sessionReader({ status: 'authenticated', session }, snapshot),
    identityStore(),
    () => database,
    leaseClient(),
    new AndroidMonotonicClock({
      async sample() {
        monotonicMilliseconds += 100;
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: monotonicMilliseconds };
      },
    }),
    () => scheduler.scheduler,
    emptyOutbox(),
    sequentialUuid([ids.command, ids.event, ids.receipt]),
  );
  const states: ProductScanState['status'][] = [];
  const feedback = { perform: vi.fn(async () => undefined) };
  const scanFeedback = new ScanFeedbackCoordinator(coordinator, feedback);
  await coordinator.start();
  coordinator.subscribe(() => states.push(coordinator.getState().status));
  scanFeedback.start();
  return {
    coordinator,
    scheduler,
    feedback,
    states,
    setQueueCount(value: number) { queueCount = value; },
  };
}

function databaseFake(
  methods: Record<string, ReturnType<typeof vi.fn>>,
): OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>> {
  return {
    readReviewPendingSequence: vi.fn(async () => null),
    ...methods,
  } as unknown as OfflineCaptureDatabase
    & Record<string, ReturnType<typeof vi.fn>>;
}

function schedulerFake(order: string[]): OfflineSyncScheduler {
  const listeners = new Set<() => void>();
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getState: vi.fn(() => ({ status: 'idle', queueCount: 0 })),
    trigger: vi.fn(async () => {
      order.push('trigger');
      return { status: 'idle', queueCount: 0 };
    }),
  };
  return scheduler as unknown as OfflineSyncScheduler;
}

function controllableScheduler(): {
  readonly scheduler: OfflineSyncScheduler;
  readonly publish: (state: OfflineSyncSchedulerState) => void;
} {
  const listeners = new Set<() => void>();
  let state: OfflineSyncSchedulerState = { status: 'idle', queueCount: 0 };
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getState: vi.fn(() => state),
    trigger: vi.fn(async () => state),
  } as unknown as OfflineSyncScheduler;
  return {
    scheduler,
    publish(next) {
      state = Object.freeze(next);
      for (const listener of listeners) listener();
    },
  };
}

function identityStore(removeActiveLookupKey = vi.fn(async () => undefined)) {
  return {
    async loadOrCreate() {
      return {
        status: 'ready',
        secrets: {
          installationBinding: binding,
          lookupKey: new Uint8Array(32).fill(7),
          databaseKey: new Uint8Array(32).fill(8),
        },
      };
    },
    removeActiveLookupKey,
  } as unknown as OfflineInstallationIdentityStore;
}

function leaseClient(withManual = false): OfflineCaptureLeaseApiPort {
  const issueCompleteV3 = async () => {
    const items = [{
      itemType: 'nfc_assignment' as const,
      subjectType: 'work' as const,
      itemId: ids.item,
      lookup: mobileLookupHmac(new Uint8Array(32).fill(7), 'nfc:uid:v1:04AABBCC'),
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      targetType: 'customer' as const,
      targetId: ids.customer,
      displayName: 'Kunde',
      assignmentRowVersion: 1,
      targetRowVersion: 1,
    }, ...(withManual ? [{
      itemId: 'a0000000-0000-4000-8000-000000000002', itemType: 'manual_target' as const,
      subjectType: 'work' as const, targetType: 'customer' as const, targetId: ids.customer,
      displayName: 'Kunde', targetRowVersion: 1,
    }] : [])];
    return {
      status: 'ready' as const,
      idempotentRetry: false,
      page: {
        leaseSchemaVersion: 3 as const,
        manifestVersion: 3 as const,
        leaseId: ids.lease,
        installationId: ids.installation,
        identityBindingId: ids.identity,
        userId: ids.user,
        organizationId: ids.organization,
        membershipId: ids.membership,
        membershipRowVersion: 1,
        role: 'employee' as const,
        issuedAt: '2026-07-18T10:00:00.000Z',
        expiresAt: '2026-07-18T22:00:00.000Z',
        configurationRevision: '2'.repeat(64),
        itemCount: items.length,
        serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
        manifestDigest: mobileManifestDigestV3(items),
        items,
        nextCursor: null,
      },
    };
  };
  return { issueCompleteV3 };
}

function sessionReader(
  state: MobileSessionState,
  authenticatedSnapshot: ProductScanSessionSnapshot | null,
  offlineCaptureRestorationAllowed = false,
): OfflineCaptureSessionReader {
  const offlineSnapshot: InternalOfflineRestorationSnapshot | null =
    state.status === 'context_unavailable' && offlineCaptureRestorationAllowed
      ? {
          generation: 1,
          restorationRevision: 1,
          source: 'provider_suspended',
        }
      : null;
  return {
    getState: () => state,
    isOfflineCaptureRestorationAllowed: () => offlineCaptureRestorationAllowed,
    captureOfflineRestorationSnapshot: () => offlineSnapshot,
    isOfflineRestorationSnapshotCurrent: (candidate) => candidate === offlineSnapshot,
    capture: () => authenticatedSnapshot,
    isCurrent: (candidate) => candidate === authenticatedSnapshot,
    subscribe: () => () => undefined,
    retryContext: vi.fn(async () => undefined),
  };
}

function nfcLifecycle(): NfcCaptureLifecyclePort {
  return {
    async checkCapability() { return 'ready'; },
    async cancelCapture() {},
    async stop() {},
  };
}

function emptyOutbox(): LifecycleEvidenceOutbox {
  return {
    async read() { return null; },
    async write() {},
    async clear() {},
  };
}

function sequentialUuid(values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++] ?? 'ffffffff-ffff-4fff-8fff-ffffffffffff';
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function activeContext() {
  return {
    organizationId: ids.organization,
    userId: ids.user,
    membershipId: ids.membership,
    role: 'employee' as const,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    activationBootMarker: 'boot-1',
    activationMonotonicMilliseconds: 100,
  };
}

async function accountHarness() {
  const root = mkdtempSync(join(tmpdir(), 't076-coordinator-'));
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  let active: ProductScanSessionSnapshot = { generation: 1, session };
  const reader: OfflineCaptureSessionReader = {
    ...sessionReader({ status: 'authenticated', session }, active),
    capture: () => active, isCurrent: candidate => candidate === active,
    getState: () => ({ status: 'authenticated', session: active.session }),
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  let seed = 0, time = Date.parse('2026-07-18T10:00:00.000Z');
  const databases: OfflineCaptureDatabase[] = [];
  let currentDb!: OfflineCaptureDatabase, scheduler!: OfflineSyncScheduler;
  const factory = (key: Uint8Array, name?: string) => {
    const db = new OfflineCaptureDatabase(async filename => new NodeSqliteOfflineConnection(join(root, filename)), key, name);
    databases.push(db); return db;
  };
  const storage = new OfflineAccountStorage({
    isAvailableAsync: async () => true,
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  }, async length => new Uint8Array(length).fill(++seed), factory, {
    list: async () => readdirSync(root), remove: async () => { throw new Error('Same-process deletion forbidden'); },
  });
  const bindings: string[] = [];
  const sent: Array<{deviceSequence: number; expectedMembershipId: string}> = [];
  const records = new Map<string, {workEventId: string; receiptId: string; deviceSequence: number}>();
  const h = { mode: 'archived', bindings, sent, legacyBlocked: false, ingestGate: null as Promise<void> | null, reconcileGate: null as Promise<void> | null, reconcileWaiting: false, sampleGate: null as Promise<void> | null, sampleWaiting: false,
    advance: () => { time += OFFLINE_ARCHIVE_POLL_MILLISECONDS; },
    change: (next: ProductSessionContext) => { active = { generation: active.generation + 1, session: next }; for (const l of listeners) l(); },
    database: () => currentDb, scheduler: () => scheduler };
  const decision = { status: 'time_entry_started' as const, timeEntryId: ids.event };
  const client = {
    async reconcile(eventIds: readonly string[]) { if (h.reconcileGate) { h.reconcileWaiting = true; await h.reconcileGate; } return { status: 'ready' as const, records: eventIds.flatMap(id => {
      const record = records.get(id); return record ? [{ ...record, archiveStatus: h.mode === 'unarchived' ? 'archive_pending' as const : 'offsite_archived' as const,
        result: { status: 'synchronized' as const, decision } }] : [];
    }) }; },
    async ingest(command: import('@taptime/offline-sync-contract').OfflineLifecycleEventCommandV3) {
      sent.push(command);
      if (h.ingestGate) await h.ingestGate;
      if (h.mode === 'authority_rejected') return { status: 'authority_rejected' as const };
      if (h.mode === 'unconfirmed') return { status: 'unavailable' as const };
      const identity = { workEventId: command.workEvent.id, receiptId: command.receipt.id, deviceSequence: command.deviceSequence };
      records.set(identity.workEventId, identity);
      return h.mode === 'review_pending'
        ? { ...identity, status: 'review_pending' as const, idempotentRetry: false, archiveStatus: 'offsite_archived' as const, reason: 'capture_clock_unverified' as const }
        : { ...identity, status: 'synchronized' as const, idempotentRetry: false, archiveStatus: h.mode === 'unarchived' ? 'archive_pending' as const : 'offsite_archived' as const, decision };
    },
    async readReviewState() { return { status: 'unavailable' as const }; },
  };
  const lifecycle = nfcLifecycle();
  const coordinator = new OfflineCaptureCoordinator({ async scan() { return { status: 'captured',
    payload: createCanonicalNfcUidPayload('04AABBCC'), capturedAt: createTimestamp('2026-07-18T10:00:00.000Z') }; } }, lifecycle, reader,
    storage, factory, { async issueCompleteV3(request) {
      bindings.push(request.installationBinding);
      const result = await leaseClient(true).issueCompleteV3!(request);
      if (result.status !== 'ready') throw new Error('Invalid fixture');
      const items = result.page.items.map(item => item.itemType === 'nfc_assignment'
        ? { ...item, lookup: mobileLookupHmac(decodeBase64Url32(request.lookupKey)!, 'nfc:uid:v1:04AABBCC') } : item);
      return { ...result, page: { ...result.page, organizationId: active.session.organizationId, userId: active.session.userId, membershipId: active.session.membershipId,
        leaseId: `70000000-0000-4000-8000-${String(bindings.length).padStart(12, '0')}`,
        items, manifestDigest: mobileManifestDigestV3(items), serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength } };
    } }, new AndroidMonotonicClock({ async sample() {
      if (h.sampleGate) { h.sampleWaiting = true; await h.sampleGate; h.sampleGate = null; }
      return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100, wallClockMilliseconds: time };
    } }), (db, authority) => {
      currentDb = db;
      scheduler = new OfflineSyncScheduler(db, client as import('../../src/offline/OfflineLifecycleClient').OfflineLifecycleApiPort,
        { async ingest() { return { status: 'unavailable' }; } }, authority, () => time, () => 0.5,
        { schedule() { return 1; }, cancel() {} }); return scheduler;
    }, { ...emptyOutbox(), async read() {
      return h.legacyBlocked ? { kind: 'protected_v1', binding: {organizationId: ids.organization, userId: ids.user}, command: {} } as unknown as import('../../src/scan/LifecycleEvidenceOutbox').StoredLifecycleEvidence : null;
    } }, (() => { let id = 0; return () => `f0000000-0000-4000-8000-${String(++id).padStart(12, '0')}`; })(),
    { bind() {} }, () => new Date(time), storage);
  await coordinator.start(); await scheduler.whenIdle();
  return { ...h, get mode() { return h.mode; }, set mode(value: string) { h.mode = value; },
    get legacyBlocked() { return h.legacyBlocked; }, set legacyBlocked(value: boolean) { h.legacyBlocked = value; },
    get ingestGate() { return h.ingestGate; }, set ingestGate(value: Promise<void> | null) { h.ingestGate = value; },
    get reconcileGate() { return h.reconcileGate; }, set reconcileGate(value: Promise<void> | null) { h.reconcileGate = value; },
    get reconcileWaiting() { return h.reconcileWaiting; },
    get sampleWaiting() { return h.sampleWaiting; }, get sampleGate() { return h.sampleGate; }, set sampleGate(value: Promise<void> | null) { h.sampleGate = value; },
    coordinator, lifecycle, async close() { await coordinator.stop(); for (const db of databases) await db.close(); rmSync(root, {recursive: true, force: true}); } };
}

// Real V5 file as shipped before T-080, including an unsent employee event.
async function seedV5PendingRoleChange(
  connection: NodeSqliteOfflineConnection,
  page: import('@taptime/offline-sync-contract').OfflineCaptureLeasePageV3,
) {
  await connection.execAsync(OFFLINE_SCHEMA_V5 + 'PRAGMA user_version = 5;');
  await connection.runAsync('INSERT INTO offline_owner VALUES (1, ?, ?, ?, ?, ?, ?, 1, NULL, 0)',
    [ids.organization, ids.user, ids.membership, mobileSha256Hex(decodeBase64Url32(binding)!), ids.installation, ids.identity]);
  await connection.runAsync(`INSERT INTO offline_lease_generations VALUES
    (?, ?, ?, ?, ?, ?, 1, 'employee', ?, ?, ?, ?, ?, ?, 'boot-1', 100, 2, 2, 'active')`,
    [ids.lease, ids.installation, ids.identity, ids.organization, ids.user, ids.membership,
      page.issuedAt, page.expiresAt, page.configurationRevision, page.itemCount, page.serializedBytes, page.manifestDigest]);
  const item = page.items[0]!;
  if (item.itemType !== 'nfc_assignment' || item.subjectType !== 'work') throw new Error('Expected work tag');
  await connection.runAsync(`INSERT INTO offline_lease_items VALUES
    (?, ?, 'nfc_assignment', 'work', ?, ?, ?, 'customer', ?, ?, 1, 1)`,
    [ids.lease, item.itemId, item.lookup, ids.assignment, ids.tag, ids.customer, item.displayName]);
  const command = { organizationId: ids.organization, expectedMembershipId: ids.membership,
    leaseId: ids.lease, leaseItemId: ids.item, installationBinding: binding, deviceSequence: 1,
    provenanceVersion: 1, clock: { bootMarker: 'boot-1', monotonicAnchorMilliseconds: 100,
      monotonicDeltaMilliseconds: 200, wallClockAnchor: page.issuedAt,
      clockProofStatus: 'verified_same_boot', clockProofVersion: 1 },
    workEvent: { id: ids.event, assignmentId: ids.assignment, nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer }, occurredAt: '2026-07-18T10:00:00.200Z' },
    receipt: { id: ids.receipt, attemptNumber: 1 } };
  const evidence = JSON.stringify(command);
  await connection.runAsync(`INSERT INTO offline_event_queue VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL)`,
    [1, ids.event, ids.receipt, ids.lease, ids.item, evidence, new TextEncoder().encode(evidence).length]);
}

async function sqliteSnapshot(connection: NodeSqliteOfflineConnection): Promise<Record<string, unknown[]>> {
  const tables = await connection.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  return Object.fromEntries(await Promise.all(tables.map(async ({ name }) => [name,
    await connection.getAllAsync(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`)])));
}
