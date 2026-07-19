import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {
  OFFLINE_BACKGROUND_MINIMUM_INTERVAL_MINUTES,
} from '@taptime/offline-sync-contract';
import type { OfflineBackgroundSchedulerBinding } from './OfflineCaptureCoordinator';
import type { OfflineSyncScheduler } from './OfflineSyncScheduler';

export const OFFLINE_BACKGROUND_TASK_NAME = 'taptime-offline-sync-v1';

let activeScheduler: OfflineSyncScheduler | null = null;

if (!TaskManager.isTaskDefined(OFFLINE_BACKGROUND_TASK_NAME)) {
  TaskManager.defineTask(OFFLINE_BACKGROUND_TASK_NAME, async ({ error }) => {
    if (error !== null || activeScheduler === null) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
    try {
      const result = await activeScheduler.trigger('background');
      return result.status === 'protected'
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export const offlineBackgroundSchedulerBinding: OfflineBackgroundSchedulerBinding = {
  bind(scheduler) {
    activeScheduler = scheduler;
  },
};

export async function registerOfflineBackgroundTask(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(OFFLINE_BACKGROUND_TASK_NAME)) return;
  await BackgroundTask.registerTaskAsync(OFFLINE_BACKGROUND_TASK_NAME, {
    minimumInterval: OFFLINE_BACKGROUND_MINIMUM_INTERVAL_MINUTES,
  });
}
