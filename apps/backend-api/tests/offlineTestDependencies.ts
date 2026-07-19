import type { BackendApiDependencies } from '../src/types.js';

type OfflineBackendApiDependencies = Pick<
  BackendApiDependencies,
  | 'offlineCaptureLeaseIssuer'
  | 'offlineEventReconciliationReader'
  | 'offlineLifecycleIngestor'
>;

export function unavailableOfflineDependencies(): OfflineBackendApiDependencies {
  return {
    offlineCaptureLeaseIssuer: {
      async issue() {
        return { status: 'unavailable' };
      },
      async readPage() {
        return { status: 'unavailable' };
      },
    },
    offlineLifecycleIngestor: {
      async ingest() {
        return {
          status: 'pending',
          reason: 'temporarily_unavailable',
        };
      },
    },
    offlineEventReconciliationReader: {
      async reconcile() {
        return { status: 'unavailable' };
      },
    },
  };
}
