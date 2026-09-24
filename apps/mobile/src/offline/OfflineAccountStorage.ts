import type { SecureStoreOptions } from 'expo-secure-store';
import { WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';
import { OfflineCaptureDatabase, OFFLINE_DATABASE_NAME, type OfflineDatabaseOwner } from './OfflineCaptureDatabase';
import { OfflineInstallationIdentityStore, type OfflineInstallationSecrets, type OfflineInstallationSecretsResult, type OfflineSecureStorePort } from './OfflineInstallationIdentityStore';
import { decodeBase64Url32, encodeBase64Url } from './encoding';
import { mobileSha256Hex } from './MobileLookupHmac';

const KEY = 'taptime.offline.generations.v1';
const options: SecureStoreOptions = { keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY };
interface Generation {
  name: string;
  installationBinding: string;
  lookupKey: string | null;
  databaseKey: string;
}
interface Generations { version: 1; active: Generation; retired: Generation[]; prepared: Generation | null }
export interface OfflineDatabaseFiles {
  list(): Promise<string[]>;
  remove(name: string): Promise<void>;
}
export type AccountDatabaseFactory = (key: Uint8Array, name?: string) => OfflineCaptureDatabase;
interface Opened { database: OfflineCaptureDatabase; secrets: OfflineInstallationSecrets }
const protectedStorage = () => new Error('Offline account storage protected');
const suffixes = ['', '-wal', '-shm', '-journal'];

/** One instance per process. Reopening capture is not a cold start and never permits cleanup. */
export class OfflineAccountStorage {
  private readonly legacy: OfflineInstallationIdentityStore;
  private firstOpen = true;
  private wrote = false;
  private tail: Promise<void> = Promise.resolve();
  constructor(private readonly secure: OfflineSecureStorePort,
    private readonly random: (length: number) => Promise<Uint8Array>,
    private readonly factory: AccountDatabaseFactory,
    private readonly files: OfflineDatabaseFiles) {
    this.legacy = new OfflineInstallationIdentityStore(secure, random);
  }

  open(): Promise<Opened> {
    return this.serialized(async () => {
      const cold = this.firstOpen; this.firstOpen = false;
      let state = await this.read();
      const names = await this.files.list();
      this.checkFiles(names, state);
      if (state === null) await this.checkLegacyKeys(names);
      if (state?.prepared) throw protectedStorage();
      const secrets = await this.load(state);
      state = await this.read(); // load may have renewed a removed lookup key
      const name = state?.active.name ?? OFFLINE_DATABASE_NAME;
      if (state !== null && !names.includes(name)) throw protectedStorage();
      const database = this.factory(secrets.databaseKey, name);
      if ((await database.initialize()).status !== 'ready') throw protectedStorage();
      if (state !== null) {
        const owner = await database.readOwner();
        if (owner === null || owner.installationBindingDigest !== digest(secrets)) throw protectedStorage();
      }
      if (cold && !this.wrote && state !== null && state.retired.length > 0) {
        // The active pointer was read in a new process, and its database was just verified.
        for (const old of state.retired) await this.files.remove(old.name);
        const remaining = await this.files.list();
        if (state.retired.some(g => suffixes.some(s => remaining.includes(g.name + s)))) throw protectedStorage();
        if (state.retired.some(g => g.name === OFFLINE_DATABASE_NAME)) {
          for (const key of ['installation-binding', 'lookup-key', 'database-key']) {
            await this.secure.deleteItemAsync(`taptime.offline.${key}.v1`, options);
          }
          // Keep initialized.v1: loss of the generation value must not create a fresh installation.
        }
        await this.write({ ...state, retired: [] });
      }
      return { database, secrets };
    });
  }

  loadOrCreate(): Promise<OfflineInstallationSecretsResult> {
    return this.serialized(async () => {
      try {
        const state = await this.read();
        const names = await this.files.list();
        this.checkFiles(names, state);
        if (state === null) await this.checkLegacyKeys(names);
        if (state?.prepared) throw protectedStorage();
        return { status: 'ready', secrets: await this.load(state) };
      } catch { return { status: 'protected', reason: 'missing_key' }; }
    });
  }

  removeActiveLookupKey(): Promise<void> {
    return this.serialized(async () => {
      const state = await this.read();
      if (state === null) return this.legacy.removeActiveLookupKey();
      await this.write({ ...state, active: { ...state.active, lookupKey: null } });
    });
  }

  switchOwner(database: OfflineCaptureDatabase, secrets: OfflineInstallationSecrets,
    owner: Omit<OfflineDatabaseOwner, 'installationBindingDigest'>,
    allowed: () => Promise<boolean>): Promise<Opened | null> {
    return this.serialized(async () => {
      const state = await this.read();
      this.checkFiles(await this.files.list(), state);
      if (state?.prepared) throw protectedStorage();
      const oldOwner = await database.readOwner();
      if (!oldOwner || oldOwner.installationBindingDigest !== digest(secrets)) throw protectedStorage();
      if (!await allowed() || !await database.canReleaseOwner(oldOwner)) return null;
      const active: Generation = state?.active ?? {
        name: OFFLINE_DATABASE_NAME, installationBinding: secrets.installationBinding,
        lookupKey: encodeBase64Url(secrets.lookupKey), databaseKey: encodeBase64Url(secrets.databaseKey),
      };
      if (active.installationBinding !== secrets.installationBinding
        || active.databaseKey !== encodeBase64Url(secrets.databaseKey)) throw protectedStorage();
      const next: Generation = {
        name: `taptime-offline-g-${await this.generate()}.db`,
        installationBinding: await this.generate(), lookupKey: await this.generate(), databaseKey: await this.generate(),
      };
      const staged: Generations = { version: 1, active, retired: state?.retired ?? [], prepared: next };
      await this.write(staged);
      const nextSecrets = decode(next);
      const fresh = this.factory(nextSecrets.databaseKey, next.name);
      try {
        if ((await fresh.initialize()).status !== 'ready') throw protectedStorage();
        const nextOwner = { organizationId: owner.organizationId, userId: owner.userId,
          membershipId: owner.membershipId, installationBindingDigest: digest(nextSecrets) };
        if ((await fresh.bindOwner(nextOwner)).status !== 'ready') throw protectedStorage();
        await fresh.close();
        if ((await fresh.initialize()).status !== 'ready'
          || JSON.stringify(await fresh.readOwner()) !== JSON.stringify(nextOwner)) throw protectedStorage();
        if (!await allowed() || !await database.canReleaseOwner(oldOwner)) throw protectedStorage();
        await this.write({ version: 1, active: next, retired: [...staged.retired, active], prepared: null });
        await database.close();
        return { database: fresh, secrets: nextSecrets };
      } catch (error) {
        await fresh.close().catch(() => undefined);
        throw error;
      }
    });
  }

  private async read(): Promise<Generations | null> {
    if (!await this.secure.isAvailableAsync()) throw protectedStorage();
    const raw = await this.secure.getItemAsync(KEY, options);
    if (raw === null) return null;
    let state: Generations;
    try { state = JSON.parse(raw); } catch { throw protectedStorage(); }
    if (!state || state.version !== 1 || !Array.isArray(state.retired)
      || !validGeneration(state.active) || !state.retired.every(validGeneration)
      || (state.prepared !== null && !validGeneration(state.prepared))) throw protectedStorage();
    const all = [state.active, ...state.retired, ...(state.prepared ? [state.prepared] : [])];
    if (new Set(all.map(g => g.name)).size !== all.length) throw protectedStorage();
    return state;
  }

  private async load(state: Generations | null): Promise<OfflineInstallationSecrets> {
    if (state === null) {
      const result = await this.legacy.loadOrCreate();
      if (result.status !== 'ready') throw protectedStorage();
      return result.secrets;
    }
    if (state.active.lookupKey === null) {
      state = { ...state, active: { ...state.active, lookupKey: await this.generate() } };
      await this.write(state);
    }
    return decode(state.active);
  }

  private checkFiles(names: string[], state: Generations | null): void {
    const known = state === null ? [OFFLINE_DATABASE_NAME]
      : [state.active.name, ...state.retired.map(g => g.name), ...(state.prepared ? [state.prepared.name] : [])];
    if (names.some(name => (name.startsWith('taptime-offline') || /\.db(?:-wal|-shm|-journal)?$/.test(name))
      && !known.some(base => suffixes.some(suffix => base + suffix === name)))) throw protectedStorage();
    const activeNames = [state?.active.name ?? OFFLINE_DATABASE_NAME];
    if (names.some(name => activeNames.some(base => name !== base && suffixes.some(s => s && base + s === name)
      && !names.includes(base)))) throw protectedStorage();
  }

  private async checkLegacyKeys(names: string[]): Promise<void> {
    if (!names.includes(OFFLINE_DATABASE_NAME)) return;
    const initialized = await this.secure.getItemAsync('taptime.offline.initialized.v1', options);
    const binding = await this.secure.getItemAsync('taptime.offline.installation-binding.v1', options);
    const databaseKey = await this.secure.getItemAsync('taptime.offline.database-key.v1', options);
    if (initialized !== 'initialized' || binding === null || databaseKey === null
      || decodeBase64Url32(binding) === null || decodeBase64Url32(databaseKey) === null) throw protectedStorage();
  }

  private async generate(): Promise<string> {
    const bytes = await this.random(32);
    if (bytes.length !== 32) throw protectedStorage();
    return encodeBase64Url(bytes);
  }
  private async write(state: Generations): Promise<void> {
    this.wrote = true;
    const raw = JSON.stringify(state);
    await this.secure.setItemAsync(KEY, raw, options);
    if (await this.secure.getItemAsync(KEY, options) !== raw) throw protectedStorage();
  }
  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const flight = this.tail.then(operation); this.tail = flight.then(() => undefined, () => undefined); return flight;
  }
}
function validGeneration(g: Generation): boolean {
  return g !== null && typeof g === 'object' && typeof g.name === 'string'
    && (g.name === OFFLINE_DATABASE_NAME || /^taptime-offline-g-[A-Za-z0-9_-]{43}\.db$/.test(g.name))
    && typeof g.installationBinding === 'string' && decodeBase64Url32(g.installationBinding) !== null
    && typeof g.databaseKey === 'string' && decodeBase64Url32(g.databaseKey) !== null
    && (g.lookupKey === null || (typeof g.lookupKey === 'string' && decodeBase64Url32(g.lookupKey) !== null));
}
function decode(g: Generation): OfflineInstallationSecrets {
  if (!validGeneration(g) || g.lookupKey === null) throw protectedStorage();
  return { installationBinding: g.installationBinding, lookupKey: decodeBase64Url32(g.lookupKey)!, databaseKey: decodeBase64Url32(g.databaseKey)! };
}
function digest(secrets: OfflineInstallationSecrets): string { return mobileSha256Hex(decodeBase64Url32(secrets.installationBinding)!); }
