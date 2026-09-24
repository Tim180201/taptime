import type { ProductSessionContext } from '../auth/contracts';
import type { ProductScanState } from '../scan/contracts';

export type ProductDestination = 'capture' | 'manual' | 'times' | 'employees' | 'setup';
export const destinationLabels: Record<ProductDestination, string> = {
  capture: 'Erfassen', manual: 'Manuell', times: 'Meine Zeiten', employees: 'Mitarbeiter', setup: 'Tags',
};
export function productDestinations(session: Pick<ProductSessionContext, 'role' | 'nfcSetupAvailable' | 'managementScope'>): readonly ProductDestination[] {
  const destinations: ProductDestination[] = ['capture', 'times'];
  if (session.managementScope != null) destinations.push('employees');
  if (session.nfcSetupAvailable === true) destinations.push('setup');
  return destinations;
}

export interface SyncIndicator {
  readonly kind: 'confirmed' | 'pending' | 'checking' | 'protected' | 'review';
  readonly count: number | null;
  readonly label: string;
}
export function syncIndicator(state: ProductScanState, lastCount: number | null = null): SyncIndicator {
  if (state.status === 'protected_pending' || state.status === 'secure_storage_unavailable') {
    return { kind: 'protected', count: null, label: 'Abgleich: Vorgänge geschützt' };
  }
  if (state.status === 'server_review_pending') {
    return { kind: 'review', count: state.queueCount, label: 'Abgleich: Prüfung erforderlich' };
  }
  // publishReady emits ready with no outcome only after reading an empty queue.
  const count = 'queueCount' in state ? state.queueCount
    : state.status === 'ready' && state.outcome === null ? 0 : lastCount;
  if (count !== null && count > 0) {
    return { kind: 'pending', count, label: `Abgleich: ${count} ${count === 1 ? 'Vorgang wartet' : 'Vorgänge warten'}` };
  }
  if (state.status === 'retry_pending' || state.status === 'checking' || state.status === 'inactive'
    || count === null) {
    return { kind: 'checking', count: null, label: 'Abgleich: Status noch nicht bestätigt' };
  }
  return { kind: 'confirmed', count: 0, label: 'Abgleich: alles bestätigt' };
}
