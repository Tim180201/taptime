import { requireNativeModule } from 'expo-modules-core';
export const OFFLINE_STORAGE_PLATFORM = 'ios';
export async function ensureOfflineBackupBoundary(directory: string): Promise<void> {
  await requireNativeModule<{excludeSQLiteFromBackup(path: string): Promise<void>}>('TapTimeOfflineStorage').excludeSQLiteFromBackup(directory);
}
