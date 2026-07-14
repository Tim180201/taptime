import {
  MembershipId,
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
  LifecycleEventResult,
  LifecycleEventSubmission,
} from '../transport/contracts';
import { isUuid } from '../transport/strictJson';
import type {
  LifecycleEvidenceOutbox,
  PendingLifecycleEvidence,
  StoredLifecycleEvidence,
} from './LifecycleEvidenceOutbox';
import type { ProductScanContextResolver } from './ProductScanContextResolver';
import type {
  PendingLifecycleBinding,
  ProductScanCapability,
  ProductScanOutcome,
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
  ProductScanState,
  SecureUuidGenerator,
} from './contracts';
import { sameProductScanSessionSnapshot } from './sessionSnapshot';

export class ProductScanOrchestrator implements ProductScanCapability {
  private state: ProductScanState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private started = false;
  private unsubscribeSession: (() => void) | null = null;
  private observedSession: ProductScanSessionSnapshot | null = null;
  private startGeneration = 0;
  private transitionVersion = 0;
  private operationVersion = 0;
  private operationFlight: Promise<void> | null = null;
  private pendingEvidence: StoredLifecycleEvidence | null = null;
  private secureStorageAvailable = true;

  constructor(
    private readonly nfcScan: NfcScanPort,
    private readonly nfcLifecycle: NfcCaptureLifecyclePort,
    private readonly scanContext: ProductScanContextResolver,
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
    const startGeneration = ++this.startGeneration;
    this.secureStorageAvailable = true;
    let restoredEvidence: StoredLifecycleEvidence | null;
    try {
      restoredEvidence = await this.outbox.read();
    } catch {
      if (!this.isCurrentStart(startGeneration)) {
        return;
      }
      this.secureStorageAvailable = false;
      this.setState({ status: 'secure_storage_unavailable' });
      return;
    }
    if (!this.isCurrentStart(startGeneration)) {
      return;
    }
    this.pendingEvidence = restoredEvidence;
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
    this.startGeneration += 1;
    this.transitionVersion += 1;
    this.operationVersion += 1;
    this.observedSession = null;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.scanContext.clear();
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
      || pending.kind !== 'replayable'
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
        session: snapshot,
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
    const pending: PendingLifecycleEvidence = Object.freeze({
      kind: 'replayable' as const,
      binding: Object.freeze({
        membershipId: MembershipId(snapshot.session.membershipId),
        organizationId: OrganizationId(snapshot.session.organizationId),
        userId: UserId(snapshot.session.userId),
      }),
      submission: freezeLifecycleSubmission({
        mode: resolution.source === 'live' ? 'canonical' : 'defer_only',
        expectedMembershipId: MembershipId(snapshot.session.membershipId),
        command: {
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
      result = await this.lifecycle.ingest(pending.submission);
    } catch {
      result = { status: 'unavailable' };
    }
    if (!isExactDurableAcknowledgement(pending.submission, result)) {
      if (this.isCurrent(operationVersion, snapshot)) {
        this.setState({ status: 'retry_pending' });
      }
      return;
    }

    // Only exact durable server proof closes local evidence, even if the UI session changed while
    // the old authenticated request was in flight. Clear before publishing so process death can
    // cause only an exact idempotent replay, never silent loss.
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
    if (result.status === 'deferred') {
      this.setReady({ status: 'server_review_pending' });
      return;
    }
    this.setReady(lifecycleOutcome(result));
  }

  private beginSessionTransition(): void {
    const next = this.sessionContext.capture();
    if (sameSnapshot(this.observedSession, next)) {
      return;
    }
    this.scanContext.clear();
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
    if (this.pendingEvidence?.kind === 'protected_v1') {
      this.setState({
        status: 'protected_pending',
        reason: 'legacy_membership_unknown',
      });
      return;
    }
    if (this.pendingEvidence !== null && !sameBinding(this.pendingEvidence.binding, current)) {
      // Retain the exact durable evidence for its original identity, but disclose no details and
      // allow neither retry nor a new scan while another identity is active.
      this.setState({ status: 'protected_pending', reason: 'identity_mismatch' });
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

  private isCurrentStart(startGeneration: number): boolean {
    return this.started && startGeneration === this.startGeneration;
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
  result: Extract<LifecycleEventResult, { status: 'synchronized' }>,
): ProductScanOutcome {
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

function freezeLifecycleSubmission(
  submission: LifecycleEventSubmission,
): LifecycleEventSubmission {
  return Object.freeze({
    mode: submission.mode,
    expectedMembershipId: submission.expectedMembershipId,
    command: Object.freeze({
      organizationId: submission.command.organizationId,
      workEvent: Object.freeze({
        ...submission.command.workEvent,
        target: Object.freeze({ ...submission.command.workEvent.target }),
      }),
      receipt: Object.freeze({ ...submission.command.receipt }),
    }),
  });
}

type DurableLifecycleAcknowledgement =
  | Extract<LifecycleEventResult, { status: 'synchronized' }>
  | Extract<LifecycleEventResult, { status: 'deferred'; evidenceStored: true }>;

function isExactDurableAcknowledgement(
  submission: LifecycleEventSubmission,
  result: LifecycleEventResult,
): result is DurableLifecycleAcknowledgement {
  if (result.status === 'synchronized') {
    return submission.mode === 'canonical'
      && result.workEventId === submission.command.workEvent.id
      && result.receiptId === submission.command.receipt.id;
  }
  return result.status === 'deferred'
    && result.evidenceStored
    && result.workEventId === submission.command.workEvent.id
    && result.receiptId === submission.command.receipt.id;
}

function sameBinding(
  binding: PendingLifecycleBinding,
  snapshot: ProductScanSessionSnapshot,
): boolean {
  return binding.organizationId === snapshot.session.organizationId
    && binding.userId === snapshot.session.userId
    && binding.membershipId === snapshot.session.membershipId;
}

function sameSnapshot(
  left: ProductScanSessionSnapshot | null,
  right: ProductScanSessionSnapshot | null,
): boolean {
  return left === right || (
    left !== null
    && right !== null
    && sameProductScanSessionSnapshot(left, right)
  );
}
