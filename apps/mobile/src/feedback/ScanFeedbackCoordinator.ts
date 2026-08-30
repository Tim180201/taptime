import type {
  ProductScanCapability,
  ProductScanOutcome,
  ProductScanState,
} from '../scan/contracts';
import type { ScanFeedbackPort } from './NativeAndroidFeedback';
import type { ScanFeedbackKind } from './profiles';

export interface ScanFeedbackLifecycle {
  start(): void;
  stop(): void;
}

export class ScanFeedbackCoordinator implements ScanFeedbackLifecycle {
  private unsubscribe: (() => void) | null = null;
  private scanInProgress = false;

  constructor(
    private readonly scan: ProductScanCapability,
    private readonly feedback: ScanFeedbackPort,
  ) {}

  start(): void {
    if (this.unsubscribe !== null) return;
    this.scanInProgress = this.scan.getState().status === 'scanning';
    this.unsubscribe = this.scan.subscribe(() => this.onScanState());
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.resetScan();
  }

  private onScanState(): void {
    const state = this.scan.getState();
    if (state.status === 'scanning') {
      this.scanInProgress = true;
      return;
    }
    if (!this.scanInProgress) return;
    const kind = feedbackKindForState(state);
    if (kind !== null) {
      this.complete(kind);
    } else if (!scanFeedbackAwaitsLaterState(state)) {
      this.resetScan();
    }
  }

  private complete(kind: ScanFeedbackKind): void {
    this.resetScan();
    void this.feedback.perform(kind).catch(() => undefined);
  }

  private resetScan(): void {
    this.scanInProgress = false;
  }
}

export function feedbackKindForOutcome(
  outcome: ProductScanOutcome,
): ScanFeedbackKind | null {
  switch (outcome.status) {
    case 'time_entry_started':
      return 'work_started';
    case 'time_entry_stopped':
      return 'work_stopped';
    case 'break_started':
    case 'break_stopped':
      return 'break_changed';
    case 'server_review_pending':
    case 'escalation_required':
      // The server durably accepted the WorkEvent and the outbox was cleared; only the
      // BusinessEngine decision is still open. The hand must match the visible review state.
      return 'pending_confirmation';
    case 'duplicate_scan_ignored':
      return null;
    case 'unreadable':
    case 'timed_out':
    case 'cancelled':
    case 'nfc_unavailable':
    case 'tag_not_assigned':
    case 'scan_context_unavailable':
    case 'active_entry_for_other_target_rejected':
    case 'break_without_active_time_entry_rejected':
    case 'work_trigger_during_break_rejected':
    case 'session_rejected':
    case 'queue_full':
      return 'failed';
    default:
      return outcome satisfies never;
  }
}

export function feedbackKindForState(state: ProductScanState): ScanFeedbackKind | null {
  switch (state.status) {
    case 'ready':
    case 'offline_ready':
      return state.outcome === null ? null : feedbackKindForOutcome(state.outcome);
    case 'server_decision':
      return feedbackKindForOutcome(state.outcome);
    case 'saved_locally':
    case 'retry_pending':
    case 'server_review_pending':
      return 'pending_confirmation';
    case 'not_supported':
    case 'disabled':
    case 'unavailable':
    case 'secure_storage_unavailable':
    case 'protected_pending':
      return 'failed';
    case 'inactive':
    case 'checking':
    case 'scanning':
    case 'submitting':
    case 'synchronizing':
      return null;
    default:
      return state satisfies never;
  }
}

function scanFeedbackAwaitsLaterState(state: ProductScanState): boolean {
  return state.status === 'submitting' || state.status === 'synchronizing';
}
