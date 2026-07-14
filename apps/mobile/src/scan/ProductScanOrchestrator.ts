import {
  OrganizationId,
  UserId,
  WorkEventId,
  isCanonicalNfcUidPayload,
  type NfcScanCaptureResult,
  type NfcScanPort,
} from '@taptime/core';
import type { NfcCaptureLifecyclePort } from '../nfc/RnNfcScanAdapter';
import type {
  LifecycleEventApiPort,
  LifecycleEventCommand,
  LifecycleEventResult,
  ScanContextApiPort,
} from '../transport/contracts';
import { isUuid } from '../transport/strictJson';
import type {
  LifecycleEvidenceOutbox,
  PendingLifecycleEvidence,
} from './LifecycleEvidenceOutbox';
import type {
  PendingLifecycleBinding,
  ProductScanCapability,
  ProductScanOutcome,
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
  ProductScanState,
  SecureUuidGenerator,
} from './contracts';

export class ProductScanOrchestrator implements ProductScanCapability {
  private state: ProductScanState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private started = false;
  private unsubscribeSession: (() => void) | null = null;
  private observedSession: ProductScanSessionSnapshot | null = null;
  private transitionVersion = 0;
  private operationVersion = 0;
  private operationFlight: Promise<void> | null = null;
  private pendingEvidence: PendingLifecycleEvidence | null = null;
  private secureStorageAvailable = true;

  constructor(
    private readonly nfcScan: NfcScanPort,
    private readonly nfcLifecycle: NfcCaptureLifecyclePort,
    private readonly scanContext: ScanContextApiPort,
    private readonly lifecycle: LifecycleEventApiPort,
    private readonly sessionContext: ProductScanSessionContextReader,
    private readonly createUuid: SecureUuidGenerator,
    private readonly outbox: LifecycleEvidenceOutbox,
  ) {}

  getState(): ProductScanState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.secureStorageAvailable = true;
    try {
      this.pendingEvidence = await this.outbox.read();
    } catch {
      this.secureStorageAvailable = false;
      this.setState({ status: 'secure_storage_unavailable' });
      return;
    }
    if (!this.started) {
      return;
    }
    // Recovery completes before session observation can activate NFC. Subscribing before the read
    // would permit a concurrent authenticated transition to expose a brief scan-ready window.
    this.unsubscribeSession = this.sessionContext.subscribe(() => {
      this.beginSessionTransition();
    });
    await this.transitionToSession(this.sessionContext.capture(), ++this.transitionVersion);
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.transitionVersion += 1;
    this.operationVersion += 1;
    this.observedSession = null;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.setState({ status: 'inactive' });
    await this.nfcLifecycle.stop();
  }

  scan(): Promise<void> {
    if (this.operationFlight !== null) {
      return this.operationFlight;
    }
    if (this.state.status !== 'ready' || this.pendingEvidence !== null) {
      return Promise.resolve();
    }
    const snapshot = this.sessionContext.capture();
    if (snapshot === null) {
      return Promise.resolve();
    }
    return this.startOperation((operationVersion) => this.performScan(snapshot, operationVersion));
  }

  async cancel(): Promise<void> {
    if (this.state.status !== 'scanning') {
      return;
    }
    await this.nfcLifecycle.cancelCapture();
  }

  retry(): Promise<void> {
    if (this.operationFlight !== null) {
      return this.operationFlight;
    }
    const pending = this.pendingEvidence;
    const snapshot = this.sessionContext.capture();
    if (
      pending === null
      || snapshot === null
      || !sameBinding(pending.binding, snapshot)
    ) {
      return Promise.resolve();
    }
    return this.startOperation(
      (operationVersion) => this.submitLifecycle(pending, snapshot, operationVersion),
    );
  }

  private startOperation(operation: (operationVersion: number) => Promise<void>): Promise<void> {
    const operationVersion = ++this.operationVersion;
    const work = operation(operationVersion);
    let flight!: Promise<void>;
    flight = work.finally(() => {
      if (this.operationFlight === flight) {
        this.operationFlight = null;
      }
    });
    this.operationFlight = flight;
    return flight;
  }

  private async performScan(
    snapshot: ProductScanSessionSnapshot,
    operationVersion: number,
  ): Promise<void> {
    this.setState({ status: 'scanning' });
    let capture: NfcScanCaptureResult;
    try {
      capture = await this.nfcScan.scan();
    } catch {
      capture = { status: 'unavailable' };
    }
    if (!this.isCurrent(operationVersion, snapshot)) {
      return;
    }
    if (capture.status !== 'captured') {
      this.setReady(captureOutcome(capture.status));
      return;
    }
    if (!isCanonicalNfcUidPayload(capture.payload)) {
      this.setReady({ status: 'unreadable' });
      return;
    }
    if (capture.capturedAt === undefined) {
      // Product lifecycle evidence must carry the physical discovery time. A port that cannot
      // provide it is not safe for the product submission path.
      this.setReady({ status: 'nfc_unavailable' });
      return;
    }
    const capturedAt = capture.capturedAt;

    this.setState({ status: 'submitting', phase: 'scan_context' });
    if (!this.isCurrent(operationVersion, snapshot)) {
      return;
    }
    let resolution;
    try {
      resolution = await this.scanContext.resolve({
        organizationId: OrganizationId(snapshot.session.organizationId),
        payload: capture.payload,
      });
    } catch {
      resolution = { status: 'unavailable' } as const;
    }
    if (!this.isCurrent(operationVersion, snapshot)) {
      return;
    }
    if (resolution.status === 'not_resolved') {
      this.setReady({ status: 'tag_not_assigned' });
      return;
    }
    if (resolution.status === 'authority_rejected') {
      this.setReady({ status: 'session_rejected' });
      return;
    }
    if (resolution.status !== 'resolved') {
      this.setReady({ status: 'scan_context_unavailable' });
      return;
    }

    let workEventId: string;
    let receiptId: string;
    try {
      workEventId = this.createUuid();
      receiptId = this.createUuid();
    } catch {
      this.setReady({ status: 'nfc_unavailable' });
      return;
    }
    if (!isUuid(workEventId) || !isUuid(receiptId) || workEventId === receiptId) {
      this.setReady({ status: 'nfc_unavailable' });
      return;
    }
    const pending = Object.freeze({
      binding: Object.freeze({
        organizationId: OrganizationId(snapshot.session.organizationId),
        userId: UserId(snapshot.session.userId),
      }),
      command: freezeLifecycleCommand({
        organizationId: OrganizationId(snapshot.session.organizationId),
        workEvent: {
          id: WorkEventId(workEventId),
          assignmentId: resolution.assignmentId,
          nfcTagId: resolution.nfcTagId,
          target: resolution.target,
          occurredAt: capturedAt,
        },
        receipt: {
          id: receiptId,
          attemptNumber: 1,
        },
      }),
    });
    this.pendingEvidence = pending;
    try {
      await this.outbox.write(pending);
    } catch {
      this.pendingEvidence = null;
      this.secureStorageAvailable = false;
      if (this.isCurrent(operationVersion, snapshot)) {
        this.setState({ status: 'secure_storage_unavailable' });
      }
      return;
    }
    if (!this.isCurrent(operationVersion, snapshot)) {
      return;
    }
    await this.submitLifecycle(pending, snapshot, operationVersion);
  }

  private async submitLifecycle(
    pending: PendingLifecycleEvidence,
    snapshot: ProductScanSessionSnapshot,
    operationVersion: number,
  ): Promise<void> {
    if (!this.isCurrent(operationVersion, snapshot) || !sameBinding(pending.binding, snapshot)) {
      return;
    }
    this.setState({ status: 'submitting', phase: 'lifecycle' });
    let result: LifecycleEventResult;
    try {
      result = await this.lifecycle.ingest(pending.command);
    } catch {
      result = { status: 'unavailable' };
    }
    if (result.status === 'transient_failure' || result.status === 'unavailable') {
      if (this.isCurrent(operationVersion, snapshot)) {
        this.setState({ status: 'retry_pending' });
      }
      return;
    }

    // A definitive response closes the durable evidence even if the UI session changed while the
    // old authenticated request was in flight. Clear before publishing so a process death can only
    // cause an exact idempotent replay, never silent loss.
    try {
      await this.outbox.clear(pending);
    } catch {
      if (this.isCurrent(operationVersion, snapshot)) {
        this.setState({ status: 'retry_pending' });
      }
      return;
    }
    this.pendingEvidence = null;
    if (!this.isCurrent(operationVersion, snapshot)) {
      return;
    }
    if (result.status === 'authority_rejected') {
      this.setReady({ status: 'session_rejected' });
      return;
    }
    this.setReady(lifecycleOutcome(result));
  }

  private beginSessionTransition(): void {
    const next = this.sessionContext.capture();
    if (sameSnapshot(this.observedSession, next)) {
      return;
    }
    const transitionVersion = ++this.transitionVersion;
    this.operationVersion += 1;
    this.setState(next === null ? { status: 'inactive' } : { status: 'checking' });
    void this.transitionToSession(next, transitionVersion);
  }

  private async transitionToSession(
    next: ProductScanSessionSnapshot | null,
    transitionVersion: number,
  ): Promise<void> {
    this.observedSession = next;
    await this.nfcLifecycle.cancelCapture();
    const previousOperation = this.operationFlight;
    if (previousOperation !== null) {
      await previousOperation.catch(() => undefined);
    }
    if (!this.started || transitionVersion !== this.transitionVersion) {
      return;
    }
    const current = this.sessionContext.capture();
    if (!this.secureStorageAvailable) {
      this.setState({ status: 'secure_storage_unavailable' });
      return;
    }
    if (next === null || current === null || !sameSnapshot(next, current)) {
      this.setState({ status: 'inactive' });
      return;
    }
    if (this.pendingEvidence !== null && !sameBinding(this.pendingEvidence.binding, current)) {
      // Retain the exact durable evidence for its original identity, but disclose no details and
      // allow neither retry nor a new scan while another identity is active.
      this.setState({ status: 'protected_pending' });
      return;
    }
    if (this.pendingEvidence !== null) {
      this.setState({ status: 'retry_pending' });
      return;
    }
    this.setState({ status: 'checking' });
    try {
      const capability = await this.nfcLifecycle.checkCapability();
      if (
        !this.started
        || transitionVersion !== this.transitionVersion
        || !this.sessionContext.isCurrent(current)
      ) {
        return;
      }
      this.setState(capability === 'ready'
        ? { status: 'ready', outcome: null }
        : { status: capability });
    } catch {
      if (
        this.started
        && transitionVersion === this.transitionVersion
        && this.sessionContext.isCurrent(current)
      ) {
        this.setState({ status: 'unavailable' });
      }
    }
  }

  private isCurrent(
    operationVersion: number,
    snapshot: ProductScanSessionSnapshot,
  ): boolean {
    return this.started
      && operationVersion === this.operationVersion
      && this.sessionContext.isCurrent(snapshot);
  }

  private setReady(outcome: ProductScanOutcome): void {
    this.setState({ status: 'ready', outcome: Object.freeze(outcome) });
  }

  private setState(state: ProductScanState): void {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function captureOutcome(status: Exclude<NfcScanCaptureResult['status'], 'captured'>): ProductScanOutcome {
  switch (status) {
    case 'unreadable':
      return { status: 'unreadable' };
    case 'timed_out':
      return { status: 'timed_out' };
    case 'cancelled':
      return { status: 'cancelled' };
    case 'unavailable':
      return { status: 'nfc_unavailable' };
    default:
      return status satisfies never;
  }
}

function lifecycleOutcome(
  result: Exclude<LifecycleEventResult, { status: 'authority_rejected' | 'transient_failure' | 'unavailable' }>,
): ProductScanOutcome {
  if (result.status === 'deferred') {
    return { status: 'deferred' };
  }
  if (result.status === 'conflict') {
    return { status: 'conflict' };
  }
  switch (result.decision.status) {
    case 'time_entry_started':
      return { status: 'time_entry_started' };
    case 'time_entry_stopped':
      return { status: 'time_entry_stopped' };
    case 'duplicate_scan_ignored':
      return { status: 'duplicate_scan_ignored' };
    case 'active_entry_for_other_target_rejected':
      return { status: 'active_entry_for_other_target_rejected' };
    case 'escalation_required':
      return { status: 'escalation_required' };
    default:
      return result.decision satisfies never;
  }
}

function freezeLifecycleCommand(command: LifecycleEventCommand): LifecycleEventCommand {
  return Object.freeze({
    organizationId: command.organizationId,
    workEvent: Object.freeze({
      ...command.workEvent,
      target: Object.freeze({ ...command.workEvent.target }),
    }),
    receipt: Object.freeze({ ...command.receipt }),
  });
}

function sameBinding(
  binding: PendingLifecycleBinding,
  snapshot: ProductScanSessionSnapshot,
): boolean {
  return binding.organizationId === snapshot.session.organizationId
    && binding.userId === snapshot.session.userId;
}

function sameSnapshot(
  left: ProductScanSessionSnapshot | null,
  right: ProductScanSessionSnapshot | null,
): boolean {
  return left === right || (
    left !== null
    && right !== null
    && left.generation === right.generation
    && left.session.userId === right.session.userId
    && left.session.organizationId === right.session.organizationId
    && left.session.membershipId === right.session.membershipId
    && left.session.role === right.session.role
  );
}
