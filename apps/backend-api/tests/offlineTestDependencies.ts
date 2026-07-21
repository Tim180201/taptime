import type { BackendApiDependencies } from '../src/types.js';

type OfflineBackendApiDependencies = Pick<
  BackendApiDependencies,
  | 'offlineCaptureLeaseIssuer'
  | 'offlineEventReconciliationReader'
  | 'offlineLifecycleIngestor'
  | 'timeEntryExporter'
  | 'timeReview'
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
      async readReviewState() {
        return { status: 'unavailable' };
      },
    },
    timeEntryExporter: {
      async exportTimeEntries() {
        return { status: 'service_unavailable' };
      },
    },
    timeReview: {
      async queryTimeRecords() { return { status: 'unavailable' }; },
      async correctTimeRecord() { return { status: 'unavailable' }; },
      async queryReviewItems() { return { status: 'unavailable' }; },
      async adjudicateReviewItems() { return { status: 'unavailable' }; },
    },
  };
}
