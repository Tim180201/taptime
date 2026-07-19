import {
  OFFLINE_RETRY_BASE_MILLISECONDS,
  OFFLINE_RETRY_CAP_MILLISECONDS,
  type OfflineCanonicalDecision,
  type OfflineDurableResultIdentity,
} from '@taptime/offline-sync-contract';
import type {
  LifecycleEventApiPort,
  LifecycleEventResult,
  LifecycleEventSubmission,
} from '../transport/contracts';
import {
  OfflineCaptureDatabase,
  type LegacyOfflineQueueHead,
  type OfflineQueueHead,
} from './OfflineCaptureDatabase';
import type {
  OfflineLifecycleApiPort,
  OfflineLifecycleTransportResult,
} from './OfflineLifecycleClient';

export type OfflineSyncTrigger =
  | 'runtime_start'
  | 'session_restored'
  | 'foreground'
  | 'event_append'
  | 'network_hint'
  | 'manual'
  | 'background';

export type OfflineSyncSchedulerState =
  | { readonly status: 'idle'; readonly queueCount: number }
  | { readonly status: 'synchronizing'; readonly queueCount: number }
  | { readonly status: 'retry_wait'; readonly queueCount: number }
  | { readonly status: 'review_pending'; readonly queueCount: number }
  | {
      readonly status: 'server_decision';
      readonly queueCount: number;
      readonly decision: OfflineCanonicalDecision;
    }
  | { readonly status: 'protected'; readonly queueCount: number }
  | { readonly status: 'authority_rejected'; readonly queueCount: number };

export interface OfflineAuthorityRejectionPort {
  rejectOfflineCapture(): Promise<void>;
}

export interface OfflineSchedulerTimerPort {
  schedule(callback: () => void, delayMilliseconds: number): unknown;
  cancel(handle: unknown): void;
}

const defaultTimer: OfflineSchedulerTimerPort = {
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class OfflineSyncScheduler {
  private state: OfflineSyncSchedulerState = Object.freeze({ status: 'idle', queueCount: 0 });
  private readonly listeners = new Set<() => void>();
  private flight: Promise<OfflineSyncSchedulerState> | null = null;
  private timerHandle: unknown | null = null;
  private stopped = false;

  constructor(
    private readonly database: OfflineCaptureDatabase,
    private readonly offlineLifecycle: OfflineLifecycleApiPort,
    private readonly legacyLifecycle: LifecycleEventApiPort,
    private readonly authorityRejection: OfflineAuthorityRejectionPort,
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
    private readonly timer: OfflineSchedulerTimerPort = defaultTimer,
  ) {}

  getState(): OfflineSyncSchedulerState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  trigger(_trigger: OfflineSyncTrigger): Promise<OfflineSyncSchedulerState> {
    if (this.stopped) return Promise.resolve(this.state);
    this.cancelTimer();
    if (this.flight !== null) return this.flight;
    const operation = this.drain();
    let flight!: Promise<OfflineSyncSchedulerState>;
    flight = operation.finally(() => {
      if (this.flight === flight) this.flight = null;
    });
    this.flight = flight;
    return flight;
  }

  stop(): void {
    this.stopped = true;
    this.cancelTimer();
  }

  start(): void {
    this.stopped = false;
  }

  private async drain(): Promise<OfflineSyncSchedulerState> {
    let lastDurable:
      | { readonly status: 'review_pending' }
      | { readonly status: 'server_decision'; readonly decision: OfflineCanonicalDecision }
      | null = null;
    while (!this.stopped) {
      const queueCount = await this.safeQueueCount();
      if (queueCount === null) return this.publish({ status: 'protected', queueCount: 0 });
      if (queueCount === 0) {
        const reviewPendingSequence = await this.safeReviewPendingSequence();
        if (reviewPendingSequence === undefined) {
          return this.publish({ status: 'protected', queueCount: 0 });
        }
        if (
          lastDurable?.status === 'review_pending'
          || reviewPendingSequence !== null
        ) {
          return this.publish({ status: 'review_pending', queueCount: 0 });
        }
        if (lastDurable?.status === 'server_decision') {
          return this.publish({
            status: 'server_decision',
            queueCount: 0,
            decision: lastDurable.decision,
          });
        }
        return this.publish({ status: 'idle', queueCount: 0 });
      }
      this.publish({ status: 'synchronizing', queueCount });

      let legacy: LegacyOfflineQueueHead | null;
      try {
        legacy = await this.database.claimLegacyHead(this.now());
      } catch {
        return this.publish({ status: 'protected', queueCount });
      }
      if (legacy !== null) {
        const outcome = await this.submitLegacy(legacy, queueCount);
        if (outcome === null) continue;
        return outcome;
      }

      let head: OfflineQueueHead | null;
      try {
        head = await this.database.claimHead(this.now());
      } catch {
        return this.publish({ status: 'protected', queueCount });
      }
      if (head === null) {
        return this.publish({ status: 'retry_wait', queueCount });
      }
      const outcome = await this.submitOffline(head, queueCount);
      if (outcome.status === 'continue') {
        lastDurable = outcome.durable;
        continue;
      }
      return outcome.state;
    }
    return this.state;
  }

  private async submitLegacy(
    head: LegacyOfflineQueueHead,
    queueCount: number,
  ): Promise<OfflineSyncSchedulerState | null> {
    let result: LifecycleEventResult;
    try {
      result = await this.legacyLifecycle.ingest(head.submission);
    } catch {
      result = { status: 'transient_failure' };
    }
    if (isExactLegacyAcknowledgement(head.submission, result)) {
      try {
        await this.database.acknowledgeLegacyHead({
          workEventId: head.submission.command.workEvent.id,
          receiptId: head.submission.command.receipt.id,
        });
      } catch {
        return this.publish({ status: 'protected', queueCount });
      }
      return null;
    }
    const identity = {
      workEventId: head.submission.command.workEvent.id,
      receiptId: head.submission.command.receipt.id,
    };
    if (result.status === 'authority_rejected') {
      await this.protectLegacy(identity);
      await this.rejectAuthority();
      return this.publish({ status: 'authority_rejected', queueCount });
    }
    if (
      result.status === 'conflict'
      || result.status === 'deferred'
    ) {
      await this.protectLegacy(identity);
      return this.publish({ status: 'protected', queueCount });
    }
    return this.retryLegacy(head, identity, queueCount);
  }

  private async submitOffline(
    head: OfflineQueueHead,
    queueCount: number,
  ): Promise<
    | {
        readonly status: 'continue';
        readonly durable:
          | { readonly status: 'review_pending' }
          | { readonly status: 'server_decision'; readonly decision: OfflineCanonicalDecision };
      }
    | { readonly status: 'stop'; readonly state: OfflineSyncSchedulerState }
  > {
    const identity = commandIdentity(head);
    let reconciliation;
    try {
      reconciliation = await this.offlineLifecycle.reconcile([head.command.workEvent.id]);
    } catch {
      reconciliation = { status: 'unavailable' } as const;
    }
    if (reconciliation.status === 'authority_rejected') {
      await this.releaseOffline(identity);
      await this.rejectAuthority();
      return {
        status: 'stop',
        state: this.publish({ status: 'authority_rejected', queueCount }),
      };
    }
    if (reconciliation.status === 'unavailable') {
      return {
        status: 'stop',
        state: await this.retryOffline(
          head,
          identity,
          queueCount,
          'retryAfterSeconds' in reconciliation
            ? reconciliation.retryAfterSeconds
            : undefined,
        ),
      };
    }
    const recovered = reconciliation.records[0];
    if (recovered !== undefined) {
      if (
        recovered.workEventId !== identity.workEventId
        || recovered.receiptId !== identity.receiptId
        || recovered.deviceSequence !== identity.deviceSequence
      ) {
        await this.protectOffline(identity);
        return {
          status: 'stop',
          state: this.publish({ status: 'protected', queueCount }),
        };
      }
      try {
        await this.database.acknowledgeHead(identity, recovered.result.status);
      } catch {
        return {
          status: 'stop',
          state: this.publish({ status: 'protected', queueCount }),
        };
      }
      return recovered.result.status === 'review_pending'
        ? { status: 'continue', durable: { status: 'review_pending' } }
        : {
            status: 'continue',
            durable: {
              status: 'server_decision',
              decision: recovered.result.decision,
            },
          };
    }

    let result: OfflineLifecycleTransportResult;
    try {
      result = await this.offlineLifecycle.ingest(head.command);
    } catch {
      result = { status: 'unavailable' };
    }
    if (result.status === 'synchronized' || result.status === 'review_pending') {
      if (!sameDurableIdentity(identity, result)) {
        await this.protectOffline(identity);
        return {
          status: 'stop',
          state: this.publish({ status: 'protected', queueCount }),
        };
      }
      try {
        await this.database.acknowledgeHead(identity, result.status);
      } catch {
        return {
          status: 'stop',
          state: this.publish({ status: 'protected', queueCount }),
        };
      }
      return result.status === 'review_pending'
        ? { status: 'continue', durable: { status: 'review_pending' } }
        : {
            status: 'continue',
            durable: { status: 'server_decision', decision: result.decision },
          };
    }
    if (result.status === 'authority_rejected') {
      await this.releaseOffline(identity);
      await this.rejectAuthority();
      return {
        status: 'stop',
        state: this.publish({ status: 'authority_rejected', queueCount }),
      };
    }
    if (result.status === 'conflict') {
      await this.protectOffline(identity);
      return {
        status: 'stop',
        state: this.publish({ status: 'protected', queueCount }),
      };
    }
    return {
      status: 'stop',
      state: await this.retryOffline(
        head,
        identity,
        queueCount,
        result.retryAfterSeconds,
      ),
    };
  }

  private async retryOffline(
    head: OfflineQueueHead,
    identity: OfflineDurableResultIdentity,
    queueCount: number,
    retryAfterSeconds?: number,
  ): Promise<OfflineSyncSchedulerState> {
    const attemptCount = head.attemptCount + 1;
    const delay = retryDelay(
      head.attemptCount,
      retryAfterSeconds,
      this.random,
    );
    try {
      await this.database.retainHeadForRetry(
        identity,
        attemptCount,
        this.now() + delay,
      );
    } catch {
      return this.publish({ status: 'protected', queueCount });
    }
    this.scheduleRetry(delay);
    return this.publish({ status: 'retry_wait', queueCount });
  }

  private async retryLegacy(
    head: LegacyOfflineQueueHead,
    identity: { readonly workEventId: string; readonly receiptId: string },
    queueCount: number,
  ): Promise<OfflineSyncSchedulerState> {
    const delay = retryDelay(head.attemptCount, undefined, this.random);
    try {
      await this.database.retainLegacyHeadForRetry(
        identity,
        head.attemptCount + 1,
        this.now() + delay,
      );
    } catch {
      return this.publish({ status: 'protected', queueCount });
    }
    this.scheduleRetry(delay);
    return this.publish({ status: 'retry_wait', queueCount });
  }

  private scheduleRetry(delay: number): void {
    this.cancelTimer();
    this.timerHandle = this.timer.schedule(() => {
      this.timerHandle = null;
      void this.trigger('event_append');
    }, Math.max(1, delay));
  }

  private cancelTimer(): void {
    if (this.timerHandle !== null) {
      this.timer.cancel(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private async safeQueueCount(): Promise<number | null> {
    try {
      return await this.database.queueCount();
    } catch {
      return null;
    }
  }

  private async safeReviewPendingSequence(): Promise<number | null | undefined> {
    try {
      return await this.database.readReviewPendingSequence();
    } catch {
      return undefined;
    }
  }

  private async rejectAuthority(): Promise<void> {
    try {
      await this.authorityRejection.rejectOfflineCapture();
    } catch {
      // The scheduler already retained exact evidence and reports a closed state.
    }
  }

  private async releaseOffline(identity: OfflineDurableResultIdentity): Promise<void> {
    try {
      await this.database.releaseHead(identity);
    } catch {
      // A failed exact release is reported as protected by the caller's state transition.
    }
  }

  private async protectOffline(identity: OfflineDurableResultIdentity): Promise<void> {
    try {
      await this.database.protectHeadForReview(identity);
    } catch {
      // The immutable row remains durable even if the state transition failed.
    }
  }

  private async protectLegacy(
    identity: { readonly workEventId: string; readonly receiptId: string },
  ): Promise<void> {
    try {
      await this.database.protectLegacyHead(identity);
    } catch {
      // The imported immutable predecessor remains durable.
    }
  }

  private publish(state: OfflineSyncSchedulerState): OfflineSyncSchedulerState {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
    return this.state;
  }
}

function commandIdentity(head: OfflineQueueHead): OfflineDurableResultIdentity {
  return {
    workEventId: head.command.workEvent.id,
    receiptId: head.command.receipt.id,
    deviceSequence: head.command.deviceSequence,
  };
}

function sameDurableIdentity(
  expected: OfflineDurableResultIdentity,
  actual: OfflineDurableResultIdentity,
): boolean {
  return actual.workEventId === expected.workEventId
    && actual.receiptId === expected.receiptId
    && actual.deviceSequence === expected.deviceSequence;
}

function isExactLegacyAcknowledgement(
  submission: LifecycleEventSubmission,
  result: LifecycleEventResult,
): boolean {
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

export function retryDelay(
  priorAttemptCount: number,
  retryAfterSeconds: number | undefined,
  random: () => number,
): number {
  if (retryAfterSeconds !== undefined) return retryAfterSeconds * 1_000;
  if (
    !Number.isSafeInteger(priorAttemptCount)
    || priorAttemptCount < 0
  ) throw new TypeError('Invalid offline retry attempt');
  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new TypeError('Invalid offline jitter source');
  }
  const exponent = Math.min(priorAttemptCount, 30);
  const maximum = Math.min(
    OFFLINE_RETRY_CAP_MILLISECONDS,
    OFFLINE_RETRY_BASE_MILLISECONDS * (2 ** exponent),
  );
  return Math.floor(randomValue * (maximum + 1));
}
