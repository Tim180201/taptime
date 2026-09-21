import * as SecureStore from 'expo-secure-store';
import type { ConfirmedSessionIdentity, RefreshTokenStore } from './contracts';

export const REFRESH_TOKEN_STORAGE_KEY = 'taptime.auth.refresh-token.v1';

export const CONFIRMED_IDENTITY_STORAGE_KEY = 'taptime.auth.confirmed-identity.v1';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class ExpoRefreshTokenStore implements RefreshTokenStore {
  async isAvailable(): Promise<boolean> {
    return SecureStore.isAvailableAsync();
  }

  async read(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY, secureStoreOptions);
  }

  async write(refreshToken: string): Promise<void> {
    if (refreshToken.length === 0) {
      throw new TypeError('Refresh token must be non-empty');
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refreshToken, secureStoreOptions);
  }

  async clear(): Promise<void> {
    // Try both deletions even if one native operation fails.
    await Promise.all([
      this.writeIdentity(null),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY, secureStoreOptions),
    ]);
  }

  async readIdentity(): Promise<ConfirmedSessionIdentity | null> {
    const value = await SecureStore.getItemAsync(CONFIRMED_IDENTITY_STORAGE_KEY, secureStoreOptions);
    if (value === null) return null;
    try {
      const identity = JSON.parse(value);
      if (identity === null || typeof identity !== 'object' || Array.isArray(identity)
        || Object.keys(identity).sort().join(',') !== 'email,providerUserId'
        || typeof identity.providerUserId !== 'string' || !identity.providerUserId.trim()
        || typeof identity.email !== 'string' || !identity.email.trim()) return null;
      return { providerUserId: identity.providerUserId, email: identity.email };
    } catch { return null; }
  }

  async writeIdentity(identity: ConfirmedSessionIdentity | null): Promise<void> {
    if (identity === null) {
      await SecureStore.deleteItemAsync(CONFIRMED_IDENTITY_STORAGE_KEY, secureStoreOptions);
    } else {
      await SecureStore.setItemAsync(CONFIRMED_IDENTITY_STORAGE_KEY, JSON.stringify(identity), secureStoreOptions);
    }
  }
}
