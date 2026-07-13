import * as SecureStore from 'expo-secure-store';
import type { RefreshTokenStore } from './contracts';

export const REFRESH_TOKEN_STORAGE_KEY = 'taptime.auth.refresh-token.v1';

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
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY, secureStoreOptions);
  }
}
