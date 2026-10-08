import type { OfflineSecureStorePort } from './OfflineInstallationIdentityStore';

/** A rejected native read/write, distinct from our own integrity checks. No raw error data. */
export class OfflineSecureStoreError extends Error {
  constructor() {
    super('Offline secure storage read/write unavailable');
    this.name = 'OfflineSecureStoreError';
  }
}

export function classifySecureStoreReadWriteErrors(port: OfflineSecureStorePort): OfflineSecureStorePort {
  return {
    isAvailableAsync: () => port.isAvailableAsync(),
    getItemAsync: async (key, options) => {
      try { return await port.getItemAsync(key, options); }
      catch { throw new OfflineSecureStoreError(); }
    },
    setItemAsync: async (key, value, options) => {
      try { await port.setItemAsync(key, value, options); }
      catch { throw new OfflineSecureStoreError(); }
    },
    deleteItemAsync: (key, options) => port.deleteItemAsync(key, options),
  };
}
