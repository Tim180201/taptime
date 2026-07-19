import { getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  OFFLINE_INSTALLATION_BINDING_BYTES,
  OFFLINE_LOOKUP_KEY_BYTES,
  isOfflineBase64Url32Bytes,
} from '@taptime/offline-sync-contract';
import { decodeBase64Url32, encodeBase64Url } from './encoding';

const INSTALLATION_BINDING_KEY = 'taptime.offline.installation-binding.v1';
const LOOKUP_KEY = 'taptime.offline.lookup-key.v1';
const DATABASE_KEY = 'taptime.offline.database-key.v1';
const INITIALIZED_KEY = 'taptime.offline.initialized.v1';
const INITIALIZED_VALUE = 'initialized';
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface OfflineSecureStorePort {
  isAvailableAsync(): Promise<boolean>;
  getItemAsync(key: string, options: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options: SecureStore.SecureStoreOptions,
  ): Promise<void>;
  deleteItemAsync(key: string, options: SecureStore.SecureStoreOptions): Promise<void>;
}

export interface OfflineInstallationSecrets {
  readonly installationBinding: string;
  readonly lookupKey: Uint8Array;
  readonly databaseKey: Uint8Array;
}

export type OfflineInstallationSecretsResult =
  | { readonly status: 'ready'; readonly secrets: OfflineInstallationSecrets }
  | { readonly status: 'protected'; readonly reason: 'missing_key' | 'wrong_key' }
  | { readonly status: 'unavailable' };

let secureIdentityOperationTail: Promise<void> = Promise.resolve();

export class OfflineInstallationIdentityStore {
  constructor(
    private readonly secureStore: OfflineSecureStorePort = SecureStore,
    private readonly randomBytes: (length: number) => Promise<Uint8Array> = getRandomBytesAsync,
  ) {}

  loadOrCreate(): Promise<OfflineInstallationSecretsResult> {
    return this.serialized(async () => {
      if (!await this.secureStore.isAvailableAsync()) {
        return { status: 'unavailable' };
      }
      const [initialized, installationBinding, lookupKey, databaseKey] = await Promise.all([
        this.secureStore.getItemAsync(INITIALIZED_KEY, secureStoreOptions),
        this.secureStore.getItemAsync(INSTALLATION_BINDING_KEY, secureStoreOptions),
        this.secureStore.getItemAsync(LOOKUP_KEY, secureStoreOptions),
        this.secureStore.getItemAsync(DATABASE_KEY, secureStoreOptions),
      ]);
      if (initialized !== null && initialized !== INITIALIZED_VALUE) {
        return { status: 'protected', reason: 'wrong_key' };
      }
      if (initialized === INITIALIZED_VALUE) {
        if (
          installationBinding === null
          || databaseKey === null
          || !isOfflineBase64Url32Bytes(installationBinding)
          || decodeBase64Url32(databaseKey) === null
        ) {
          return { status: 'protected', reason: 'missing_key' };
        }
        const activeLookup = lookupKey === null
          ? await this.generateAndPersist(LOOKUP_KEY, OFFLINE_LOOKUP_KEY_BYTES)
          : decodeBase64Url32(lookupKey);
        if (activeLookup === null) {
          return { status: 'protected', reason: 'wrong_key' };
        }
        return {
          status: 'ready',
          secrets: Object.freeze({
            installationBinding,
            lookupKey: activeLookup,
            databaseKey: decodeBase64Url32(databaseKey)!,
          }),
        };
      }
      if (installationBinding !== null || lookupKey !== null || databaseKey !== null) {
        return { status: 'protected', reason: 'missing_key' };
      }
      const generatedBinding = await this.generate(OFFLINE_INSTALLATION_BINDING_BYTES);
      const generatedLookup = await this.generate(OFFLINE_LOOKUP_KEY_BYTES);
      const generatedDatabaseKey = await this.generate(32);
      await this.secureStore.setItemAsync(
        INSTALLATION_BINDING_KEY,
        encodeBase64Url(generatedBinding),
        secureStoreOptions,
      );
      await this.secureStore.setItemAsync(
        LOOKUP_KEY,
        encodeBase64Url(generatedLookup),
        secureStoreOptions,
      );
      await this.secureStore.setItemAsync(
        DATABASE_KEY,
        encodeBase64Url(generatedDatabaseKey),
        secureStoreOptions,
      );
      await this.secureStore.setItemAsync(
        INITIALIZED_KEY,
        INITIALIZED_VALUE,
        secureStoreOptions,
      );
      return {
        status: 'ready',
        secrets: Object.freeze({
          installationBinding: encodeBase64Url(generatedBinding),
          lookupKey: generatedLookup,
          databaseKey: generatedDatabaseKey,
        }),
      };
    });
  }

  removeActiveLookupKey(): Promise<void> {
    return this.serialized(async () => {
      if (!await this.secureStore.isAvailableAsync()) {
        throw new Error('Offline secure storage is unavailable');
      }
      await this.secureStore.deleteItemAsync(LOOKUP_KEY, secureStoreOptions);
    });
  }

  private async generateAndPersist(key: string, bytes: number): Promise<Uint8Array> {
    const value = await this.generate(bytes);
    await this.secureStore.setItemAsync(key, encodeBase64Url(value), secureStoreOptions);
    return value;
  }

  private async generate(bytes: number): Promise<Uint8Array> {
    const value = await this.randomBytes(bytes);
    if (value.length !== bytes) throw new Error('Secure random source returned an invalid length');
    return value;
  }

  private serialized<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = secureIdentityOperationTail.then(operation);
    secureIdentityOperationTail = result.then(() => undefined, () => undefined);
    return result;
  }
}
