import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineCaptureDatabase, type OfflineDatabaseOwner } from '../../src/offline/OfflineCaptureDatabase';
import { OfflineAccountStorage } from '../../src/offline/OfflineAccountStorage';
import { NodeSqliteOfflineConnection } from '../support/NodeSqliteOfflineConnection';
import { memorySecureStore } from '../support/MemoryOfflinePlatform';
import { mobileSha256Hex } from '../../src/offline/MobileLookupHmac';
import { decodeBase64Url32 } from '../../src/offline/encoding';

vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' }));
vi.mock('expo-crypto', () => ({ getRandomBytesAsync: vi.fn() }));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const account = (membership = '30000000-0000-4000-8000-000000000001') => ({
  organizationId: '10000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000001', membershipId: membership,
});
function harness() {
  const root = mkdtempSync(join(tmpdir(), 't076-')); roots.push(root);
  const secure = memorySecureStore();
  const values = new Map<string, string>();
  let fault: ((key: string, value: string) => void) | null = null;
  const port = { ...secure.port,
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { values.set(key, value); fault?.(key, value); },
    deleteItemAsync: async (key: string) => { values.delete(key); },
  };
  const connections: OfflineCaptureDatabase[] = [];
  const files = { list: async () => readdirSync(root), remove: vi.fn(async (name: string) => {
    for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(join(root, name + suffix), { force: true });
  }) };
  let seed = 0;
  const factory = (key: Uint8Array, name?: string) => {
    const db = new OfflineCaptureDatabase(async filename => new NodeSqliteOfflineConnection(join(root, filename)), key, name);
    connections.push(db); return db;
  };
  const boot = () => new OfflineAccountStorage(port, async n => new Uint8Array(n).fill(++seed), factory, files);
  const bind = async (store: OfflineAccountStorage) => {
    const opened = await store.open();
    await opened.database.bindOwner({ ...account(), installationBindingDigest: mobileSha256Hex(decodeBase64Url32(opened.secrets.installationBinding)!) });
    return opened;
  };
  return { boot, bind, files, values, factory, root, fault: (f: typeof fault) => { fault = f; },
    close: async () => { for (const db of connections) await db.close(); } };
}
const newAccount = account('30000000-0000-4000-8000-000000000002');

describe('T-076 generations on real SQLite', () => {
  it('does not assign ownerless Legacy evidence to the current account', async () => {
    const h = harness(); const opened = await h.boot().open();
    const native = new NodeSqliteOfflineConnection(join(h.root, 'taptime-offline-v1.db'));
    try {
      const raw = JSON.stringify({ mode: 'canonical', expectedMembershipId: account().membershipId,
        command: { organizationId: account().organizationId,
          workEvent: { id: '40000000-0000-4000-8000-000000000001', assignmentId: '50000000-0000-4000-8000-000000000001',
            nfcTagId: '60000000-0000-4000-8000-000000000001', target: {targetType:'customer', targetId:'70000000-0000-4000-8000-000000000001'}, occurredAt:'2026-09-24T10:00:00.000Z' },
          receipt: {id:'80000000-0000-4000-8000-000000000001', attemptNumber:1} } });
      await native.runAsync(`INSERT INTO offline_legacy_queue (work_event_id, receipt_id, submission_json, serialized_bytes, queue_state)
        VALUES (?, ?, ?, ?, 'pending')`, ['40000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', raw, raw.length]);
      const before = await native.getAllAsync('SELECT * FROM offline_legacy_queue');
      expect(await opened.database.bindOwner({ ...newAccount,
        installationBindingDigest: mobileSha256Hex(decodeBase64Url32(opened.secrets.installationBinding)!) })).toMatchObject({status: 'protected'});
      expect(await native.getFirstAsync('SELECT * FROM offline_owner')).toBeNull();
      expect(await native.getAllAsync('SELECT * FROM offline_legacy_queue')).toEqual(before);
      expect(h.files.remove).not.toHaveBeenCalled();
    } finally { await native.closeAsync(); await h.close(); }
  });

  it('switches an empty owner to a fresh identity and only cleans at a later cold start', async () => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    const next = await process.switchOwner(old.database, old.secrets, newAccount, async () => true);
    expect(next).not.toBeNull();
    expect(next!.secrets.installationBinding).not.toBe(old.secrets.installationBinding);
    expect(next!.secrets.databaseKey).not.toEqual(old.secrets.databaseKey);
    expect(next!.secrets.lookupKey).not.toEqual(old.secrets.lookupKey);
    expect(await next!.database.readOwner()).toMatchObject(newAccount);
    expect(await next!.database.queueCount()).toBe(0);
    expect(h.files.remove).not.toHaveBeenCalled();
    await next!.database.close(); await process.open(); // scanner restart is NOT a cold start
    expect(h.files.remove).not.toHaveBeenCalled();
    await h.close(); await h.boot().open();
    expect(h.files.remove).toHaveBeenCalledWith('taptime-offline-v1.db');
    await h.close();
  });

  it('keeps the old database when Android returns the new RAM value but loses the activation on restart', async () => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    const disk = new Map(h.values);
    await process.switchOwner(old.database, old.secrets, newAccount, async () => true);
    expect(h.files.remove).not.toHaveBeenCalled();
    await h.close(); h.values.clear(); for (const [key, value] of disk) h.values.set(key, value);
    await expect(h.boot().open()).rejects.toThrow(/protected/i);
    expect(readdirSync(h.root)).toContain('taptime-offline-v1.db');
    expect(h.files.remove).not.toHaveBeenCalled();
  });

  it('protects a retained preparation after a lost activation, without deleting either generation', async () => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    let prepared: [string, string] | undefined;
    h.fault((key, value) => { if (value.includes('"prepared":{')) prepared = [key, value]; });
    await process.switchOwner(old.database, old.secrets, newAccount, async () => true);
    await h.close(); h.values.set(...prepared!);
    await expect(h.boot().open()).rejects.toThrow(/protected/i);
    expect(h.files.remove).not.toHaveBeenCalled();
  });

  it.each(['before_write', 'after_write', 'missing_secrets', 'unreadable_directory', 'unreadable_database'])(
    'preserves the original generation on %s', async failure => {
      const h = harness(); const process = h.boot(); const old = await h.bind(process);
      const disk = new Map(h.values);
      h.fault((key, value) => {
        if (!value.includes('"prepared":{')) return;
        if (failure === 'before_write') { h.values.clear(); for (const [k,v] of disk) h.values.set(k,v); throw new Error('write failed'); }
        if (failure === 'after_write') throw new Error('process died');
        if (failure === 'missing_secrets') h.values.set(key, value.replace(/"databaseKey":"[^"]+"/, '"databaseKey":null'));
      });
      if (failure === 'unreadable_directory') h.files.list = async () => { throw new Error('protected directory'); };
      if (failure === 'unreadable_database') vi.spyOn(old.database, 'canReleaseOwner').mockRejectedValue(new Error('protected database'));
      await expect(process.switchOwner(old.database, old.secrets, newAccount, async () => true)).rejects.toThrow();
      expect(readdirSync(h.root)).toContain('taptime-offline-v1.db');
      expect(h.files.remove).not.toHaveBeenCalled(); await h.close();
    },
  );

  it.each(['unknown.db', 'taptime-offline-g-orphan.db-wal'])('protects an unreferenced file %s', async name => {
    const h = harness(); const process = h.boot(); await h.bind(process); await h.close();
    writeFileSync(join(h.root, name), 'retained evidence');
    await expect(h.boot().open()).rejects.toThrow(/protected/i);
    expect(h.files.remove).not.toHaveBeenCalled();
  });

  it('does not generate replacement secrets for an existing legacy database', async () => {
    const h = harness(); await h.bind(h.boot()); await h.close(); h.values.clear();
    await expect(h.boot().open()).rejects.toThrow(/protected/i);
    expect(h.values.size).toBe(0); expect(h.files.remove).not.toHaveBeenCalled();
  });

  it.each(['missing_active_key', 'missing_active_file', 'corrupt_active_database', 'cleanup_failure'])(
    'does not remove the old database on cold-start %s', async failure => {
      const h = harness(); const process = h.boot(); const old = await h.bind(process);
      await process.switchOwner(old.database, old.secrets, newAccount, async () => true); await h.close();
      const [key, raw] = [...h.values].find(([key]) => key.includes('generations'))!;
      const state = JSON.parse(raw);
      if (failure === 'missing_active_key') { state.active.databaseKey = null; h.values.set(key, JSON.stringify(state)); }
      if (failure === 'missing_active_file') rmSync(join(h.root, state.active.name));
      if (failure === 'corrupt_active_database') writeFileSync(join(h.root, state.active.name), 'broken');
      if (failure === 'cleanup_failure') h.files.remove.mockRejectedValueOnce(new Error('protected file'));
      await expect(h.boot().open()).rejects.toThrow();
      expect(readdirSync(h.root)).toContain('taptime-offline-v1.db'); await h.close();
    },
  );

  it.each(['schema', 'owner', 'owner_committed', 'reopen', 'activation_readback'])(
    'retains both generations across a failure at %s', async phase => {
      const h = harness(); const process = h.boot(); const old = await h.bind(process);
      const originalInitialize = OfflineCaptureDatabase.prototype.initialize;
      const originalBind = OfflineCaptureDatabase.prototype.bindOwner;
      let opens = 0;
      const init = vi.spyOn(OfflineCaptureDatabase.prototype, 'initialize').mockImplementation(function (this: OfflineCaptureDatabase, ...args) {
        opens++;
        if ((phase === 'schema' && opens === 1) || (phase === 'reopen' && opens === 2)) throw new Error('protected interrupted DB');
        return originalInitialize.apply(this, args);
      });
      const bind = vi.spyOn(OfflineCaptureDatabase.prototype, 'bindOwner').mockImplementation(async function (this: OfflineCaptureDatabase, ...args) {
        if (phase === 'owner') throw new Error('protected owner write');
        const result = await originalBind.apply(this, args);
        if (phase === 'owner_committed') throw new Error('protected process killed after owner commit');
        return result;
      });
      if (phase === 'activation_readback') h.fault((key, raw) => {
        if (raw.includes('"retired":[{')) h.values.set(key, raw + 'corrupted read');
      });
      try {
        await expect(process.switchOwner(old.database, old.secrets, newAccount, async () => true)).rejects.toThrow();
      } finally { init.mockRestore(); bind.mockRestore(); }
      await h.close();
      await expect(h.boot().open()).rejects.toThrow(/protected/i);
      expect(readdirSync(h.root)).toContain('taptime-offline-v1.db');
      expect(h.files.remove).not.toHaveBeenCalled(); await h.close();
    },
  );

  it('requires current authentication and does not prepare a generation for offline restoration', async () => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    const before = new Map(h.values);
    expect(await process.switchOwner(old.database, old.secrets, newAccount, async () => false)).toBeNull();
    expect(h.values).toEqual(before); await h.close();
  });

  it.each(['quarantine', 'legacy', 'corrupt_legacy'])('blocks retained %s without deleting it', async kind => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    const native = new NodeSqliteOfflineConnection(join(h.root, 'taptime-offline-v1.db'));
    if (kind === 'quarantine') {
      expect(await old.database.importProtectedLegacy('40000000-0000-4000-8000-000000000001', '{}', '2026-09-24T10:00:00.000Z')).toEqual({status:'ready'});
    } else {
      const submission = { mode: 'canonical', expectedMembershipId: account().membershipId,
        command: { organizationId: account().organizationId,
          workEvent: { id: '40000000-0000-4000-8000-000000000001', assignmentId: '50000000-0000-4000-8000-000000000001',
            nfcTagId: '60000000-0000-4000-8000-000000000001', target: {targetType:'customer', targetId:'70000000-0000-4000-8000-000000000001'}, occurredAt:'2026-09-24T10:00:00.000Z' },
          receipt: {id:'80000000-0000-4000-8000-000000000001', attemptNumber:1} } };
      const raw = kind === 'corrupt_legacy' ? '{broken' : JSON.stringify(submission);
      await native.runAsync(`INSERT INTO offline_legacy_queue (work_event_id, receipt_id, submission_json, serialized_bytes, queue_state)
        VALUES (?, ?, ?, ?, 'pending')`, [submission.command.workEvent.id, submission.command.receipt.id, raw, raw.length]);
    }
    const table = kind === 'quarantine' ? 'offline_protected_quarantine' : 'offline_legacy_queue';
    const before = await native.getAllAsync(`SELECT * FROM ${table}`);
    expect(await process.switchOwner(old.database, old.secrets, newAccount, async () => true)).toBeNull();
    expect(await native.getAllAsync(`SELECT * FROM ${table}`)).toEqual(before);
    if (kind === 'legacy') expect(await old.database.readOwner()).toMatchObject(account());
    expect(h.files.remove).not.toHaveBeenCalled(); await native.closeAsync(); await h.close();
  });

  it('can repeat a cold-start cleanup interrupted after removal of the old main file', async () => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    await process.switchOwner(old.database, old.secrets, newAccount, async () => true); await h.close();
    h.files.remove.mockImplementationOnce(async name => {
      rmSync(join(h.root, name)); writeFileSync(join(h.root, name + '-wal'), 'leftover sidecar');
      throw new Error('cleanup interrupted');
    });
    await expect(h.boot().open()).rejects.toThrow('cleanup interrupted'); await h.close();
    await h.boot().open();
    expect(readdirSync(h.root).some(name => name.startsWith('taptime-offline-v1.db'))).toBe(false);
    await h.close();
  });

  it('blocks a review sequence even when no queued event remains', async () => {
    const h = harness(); const process = h.boot(); const old = await h.bind(process);
    const native = new NodeSqliteOfflineConnection(join(h.root, 'taptime-offline-v1.db'));
    await native.execAsync('UPDATE offline_owner SET next_device_sequence = 1, review_pending_sequence = 1');
    await native.closeAsync();
    expect(await process.switchOwner(old.database, old.secrets, newAccount, async () => true)).toBeNull();
    expect(h.files.remove).not.toHaveBeenCalled(); await h.close();
  });
});
