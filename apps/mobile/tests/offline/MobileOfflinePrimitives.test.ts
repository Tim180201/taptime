import {
  OFFLINE_HMAC_SHA256_VECTORS,
  OFFLINE_MANIFEST_VECTOR_ITEMS,
  OFFLINE_MANIFEST_VECTOR_SHA256,
} from '@taptime/offline-sync-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(),
}));

import {
  AndroidMonotonicClock,
  validateAndroidMonotonicSample,
} from '../../src/offline/AndroidMonotonicClock';
import {
  OfflineInstallationIdentityStore,
  type OfflineSecureStorePort,
} from '../../src/offline/OfflineInstallationIdentityStore';
import {
  mobileHmacSha256Hex,
  mobileLookupHmac,
  mobileManifestDigest,
} from '../../src/offline/MobileLookupHmac';
import { decodeBase64Url32, encodeBase64Url } from '../../src/offline/encoding';

describe('Mobile complete-offline primitives', () => {
  it.each(OFFLINE_HMAC_SHA256_VECTORS)(
    'matches the shared $name HMAC vector through pinned @noble/hashes',
    ({ keyHex, messageUtf8, expectedHex }) => {
      expect(mobileHmacSha256Hex(hexBytes(keyHex), messageUtf8)).toBe(expectedHex);
    },
  );

  it('matches the shared manifest vector and enforces a 256-bit production lookup key', () => {
    expect(mobileManifestDigest(OFFLINE_MANIFEST_VECTOR_ITEMS))
      .toBe(OFFLINE_MANIFEST_VECTOR_SHA256);
    expect(() => mobileLookupHmac(new Uint8Array(31), 'nfc:uid:v1:AABB'))
      .toThrow('Invalid Mobile offline lookup input');
    expect(mobileLookupHmac(new Uint8Array(32), 'nfc:uid:v1:AABB'))
      .toMatch(/^[0-9a-f]{64}$/);
  });

  it('round-trips canonical 32-byte base64url without Buffer or padding', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    const encoded = encodeBase64Url(bytes);
    expect(encoded).toHaveLength(43);
    expect(encoded).not.toContain('=');
    expect(decodeBase64Url32(encoded)).toEqual(bytes);
    expect(decodeBase64Url32(`${encoded.slice(0, -1)}+`)).toBeNull();
  });

  it('creates one stable installation/database key set and rotates only the logout lookup key',
    async () => {
      const secureStore = memorySecureStore();
      let seed = 0;
      const random = vi.fn(async (length: number) => (
        Uint8Array.from({ length }, () => ++seed & 0xff)
      ));
      const store = new OfflineInstallationIdentityStore(secureStore.port, random);
      const first = await store.loadOrCreate();
      expect(first.status).toBe('ready');
      const second = await store.loadOrCreate();
      expect(second).toEqual(first);
      await store.removeActiveLookupKey();
      const third = await store.loadOrCreate();
      expect(third.status).toBe('ready');
      if (
        first.status !== 'ready'
        || second.status !== 'ready'
        || third.status !== 'ready'
      ) {
        throw new Error('Synthetic key setup failed');
      }
      expect(third.secrets.installationBinding).toBe(first.secrets.installationBinding);
      expect(third.secrets.databaseKey).toEqual(first.secrets.databaseKey);
      expect(third.secrets.lookupKey).not.toEqual(first.secrets.lookupKey);
      expect(random).toHaveBeenCalledTimes(4);
    });

  it('fails protected for partial or malformed SecureStore state and never regenerates it',
    async () => {
      const secureStore = memorySecureStore({
        'taptime.offline.initialized.v1': 'initialized',
        'taptime.offline.installation-binding.v1': encodeBase64Url(new Uint8Array(32)),
      });
      const random = vi.fn(async (length: number) => new Uint8Array(length));
      await expect(new OfflineInstallationIdentityStore(secureStore.port, random).loadOrCreate())
        .resolves.toEqual({ status: 'protected', reason: 'missing_key' });
      expect(random).not.toHaveBeenCalled();
    });

  it('validates the native same-boot sample and rejects impossible native values', async () => {
    const sample = {
      bootMarker: 'a'.repeat(64),
      elapsedRealtimeMilliseconds: 123_456,
    };
    const clock = new AndroidMonotonicClock({ sample: vi.fn(async () => sample) });
    await expect(clock.sample()).resolves.toEqual(sample);
    expect(validateAndroidMonotonicSample({
      ...sample,
      elapsedRealtimeMilliseconds: -1,
    })).toBeNull();
    expect(validateAndroidMonotonicSample({
      ...sample,
      bootMarker: 'x'.repeat(257),
    })).toBeNull();
  });
});

function memorySecureStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const port: OfflineSecureStorePort = {
    isAvailableAsync: vi.fn(async () => true),
    getItemAsync: vi.fn(async (key) => values.get(key) ?? null),
    setItemAsync: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key) => {
      values.delete(key);
    }),
  };
  return { port, values };
}

function hexBytes(value: string): Uint8Array {
  return Uint8Array.from(
    value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
}
