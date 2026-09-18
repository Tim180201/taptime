import type { ProductScanCapability, ProductScanState } from '../scan/contracts';
import type { MobileWorkCapability } from '../work/contracts';

export const TAP_MOMENT_MILLISECONDS = 2_000;
export interface TapMoment { readonly title: string; readonly confirmed: boolean; }
export function tapMoment(state: ProductScanState): TapMoment | null {
  if (state.status === 'saved_locally') return { title: 'GESPEICHERT', confirmed: false };
  // ready carries the last outcome again during later capability/queue updates; that is not a tap.
  if (state.status !== 'server_decision') return null;
  switch (state.outcome.status) {
    case 'time_entry_started': return { title: 'GESTARTET', confirmed: true };
    case 'time_entry_stopped': return { title: 'GESTOPPT', confirmed: true };
    case 'break_started': return { title: 'PAUSE BEGONNEN', confirmed: true };
    case 'break_stopped': return { title: 'PAUSE BEENDET', confirmed: true };
    default: return null;
  }
}

/** Observe the shared capture signal before React batches it with later ready states. */
export function connectTapMoment(
  scan: ProductScanCapability,
  presenter: TapMomentPresenter,
  work?: MobileWorkCapability,
): () => void {
  let previous: ProductScanState | null = null;
  const update = () => {
    const state = scan.getState();
    if (state === previous) return;
    previous = state;
    presenter.observe(state);
    if (state.status !== 'server_decision' || !tapMoment(state)?.confirmed || !work) return;
    // Manual acknowledgements start their own refresh before publishing this shared signal.
    // Inspect synchronously: a later React effect could erase the manual confirmation again.
    const current = work.getState();
    if (current.status === 'loading' || current.status === 'ready'
      && (current.submitting || current.outcome === 'pending')) return;
    void work.refresh();
  };
  const unsubscribe = scan.subscribe(update);
  update();
  return unsubscribe;
}

/** Ephemeral scene only. Owns its timer and never invokes capture, retry or a persistence API. */
export class TapMomentPresenter {
  private value: TapMoment | null = null;
  private last: ProductScanState | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  getState = (): TapMoment | null => this.value;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  };
  observe(state: ProductScanState): void {
    if (state === this.last) return;
    const previous = this.last;
    this.last = state;
    if (state.status === 'ready' || state.status === 'offline_ready') return;
    if (state.status === 'saved_locally' && previous?.status === 'saved_locally') return;
    const next = tapMoment(state);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.publish(next);
    if (next !== null) this.timer = setTimeout(() => {
      this.timer = null; this.publish(null);
    }, TAP_MOMENT_MILLISECONDS);
  }
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.last = null; this.value = null; this.listeners.clear();
  }
  private publish(value: TapMoment | null): void {
    this.value = value; for (const listener of this.listeners) listener();
  }
}
