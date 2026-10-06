import type { ProductSessionContext } from '../auth/contracts';
import type { ProductScanState } from '../scan/contracts';

export type ProductDestination = 'capture' | 'manual' | 'times' | 'customers' | 'employees' | 'setup';
export const destinationLabels: Record<ProductDestination, string> = {
  customers: 'Kunden', capture: 'Erfassen', manual: 'Manuell', times: 'Meine Zeiten', employees: 'Mitarbeiter', setup: 'Karten',
};
export function productDestinations(session: Pick<ProductSessionContext, 'role' | 'nfcSetupAvailable' | 'managementScope'>): readonly ProductDestination[] {
  const destinations: ProductDestination[] = ['capture', 'times', 'customers'];
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
  if(state.transmissionPaused)return {kind:'protected',count:state.untransferred?.length??null,label:'Übertragung: Übertragung angehalten'};
  if (state.updateRequired) return {kind:'protected',count:null,label:'Übertragung: Bitte App aktualisieren'};
  if (state.untransferred?.length) {
    const unresolved=state.untransferred.filter(entry=>!entry.reported).length;
    return unresolved ? {kind:'protected',count:unresolved,label:`Übertragung: ${unresolved} Erfassung nicht übertragen`}
      : {kind:'review',count:state.untransferred.length,label:`Übertragung: ${state.untransferred.length} Erfassung · Wird von der Verwaltung geprüft`};
  }
  if (state.status === 'protected_pending' || state.status === 'secure_storage_unavailable') {
    return { kind: 'protected', count: null, label: 'Übertragung: Vorgänge geschützt' };
  }
  if (state.status === 'server_review_pending') {
    return { kind: 'review', count: state.queueCount, label: 'Übertragung: Wird von der Verwaltung geprüft' };
  }
  // publishReady emits ready with no outcome only after reading an empty queue.
  const count = 'queueCount' in state ? state.queueCount
    : state.status === 'ready' && state.outcome === null ? 0 : lastCount;
  if (count !== null && count > 0) {
    return { kind: 'pending', count, label: `Übertragung: ${count} ${count === 1 ? 'Vorgang wartet' : 'Vorgänge warten'}` };
  }
  if (state.status === 'retry_pending' || state.status === 'checking' || state.status === 'inactive'
    || count === null) {
    return { kind: 'checking', count: null, label: 'Übertragung: Status noch nicht bestätigt' };
  }
  return { kind: 'confirmed', count: 0, label: 'Übertragung: alles bestätigt' };
}
