import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStore = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

vi.mock('expo-secure-store', () => secureStore);

const { ExpoRefreshTokenStore, REFRESH_TOKEN_STORAGE_KEY } = await import(
  '../../src/auth/ExpoRefreshTokenStore'
);

describe('ExpoRefreshTokenStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureStore.isAvailableAsync.mockResolvedValue(true);
    secureStore.getItemAsync.mockResolvedValue('stored-refresh');
    secureStore.setItemAsync.mockResolvedValue(undefined);
    secureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  it('uses one fixed native key and device-only unlocked accessibility', async () => {
    const store = new ExpoRefreshTokenStore();
    await expect(store.isAvailable()).resolves.toBe(true);
    await expect(store.read()).resolves.toBe('stored-refresh');
    await store.write('rotated-refresh');
    await store.clear();

    const options = { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' };
    expect(REFRESH_TOKEN_STORAGE_KEY).toBe('taptime.auth.refresh-token.v1');
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_STORAGE_KEY, options);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      REFRESH_TOKEN_STORAGE_KEY,
      'rotated-refresh',
      options,
    );
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_STORAGE_KEY, options);
  });

  it('rejects an empty refresh token before native storage', async () => {
    await expect(new ExpoRefreshTokenStore().write('')).rejects.toThrow('non-empty');
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
