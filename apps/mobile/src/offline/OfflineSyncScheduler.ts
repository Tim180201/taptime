import {
  OFFLINE_RETRY_BASE_MILLISECONDS,
  OFFLINE_RETRY_CAP_MILLISECONDS,
  type OfflineCanonicalDecision,
  OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS,
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
  | {
      readonly status: 'review_pending';
      readonly queueCount: number;
      readonly workEventId?: string;
    }
  | {
      readonly status: 'server_decision';
      readonly queueCount: number;
      readonly decision: OfflineCanonicalDecision;
      readonly workEventId: string;
    }
  | { readonly status: 'protected'; readonly queueCount: number }
  | { readonly status: 'quarantined'; readonly queueCount: number; readonly workEventId: string }
  | { readonly status: 'update_required'; readonly queueCount: number }
  | { readonly status: 'transmission_paused'; readonly queueCount: number; readonly reason: 'system_failure' | 'quarantine' }
  | { readonly status: 'authority_rejected'; readonly queueCount: number };

export interface OfflineAuthorityRejectionPort {
  rejectOfflineCapture(): Promise<void>;
}

export interface OfflineSchedulerTimerPort {
  schedule(callback: () => void, delayMilliseconds: number): unknown;
  cancel(handle: unknown): void;
}

export const OFFLINE_ARCHIVE_POLL_MILLISECONDS = 60_000;

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
  private transmissionGeneration = 0;
  private archiveTimerHandle: unknown | null = null;
  private archiveFlight: Promise<void> | null = null;
  private archiveAfterSequence = 0;
  private archiveNextAttemptAt = 0;
  private archiveGeneration = 0;
  private retryClock: number | null = null;
  private updateRequired = false;
  private transmissionPause: 'system_failure' | 'quarantine' | null = null;

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

  trigger(trigger: OfflineSyncTrigger): Promise<OfflineSyncSchedulerState> {
    if (this.stopped) return Promise.resolve(this.state);
    if (this.updateRequired) return Promise.resolve(this.state);
    if (this.flight !== null) return this.flight;
    if (this.transmissionPause !== null) {
      if (this.transmissionPause !== 'system_failure' && !this.offlineLifecycle.skip
        || !['runtime_start','foreground','manual'].includes(trigger)) return Promise.resolve(this.state);
      this.transmissionPause = null;
      void this.reconcileArchives(true);
    }
    this.cancelTimer();
    const operation = this.prepareDrain(trigger, this.transmissionGeneration);
    let flight!: Promise<OfflineSyncSchedulerState>;
    flight = operation.finally(() => {
      if (this.flight === flight) this.flight = null;
    });
    this.flight = flight;
    return flight;
  }

  private async prepareDrain(trigger: OfflineSyncTrigger, generation: number): Promise<OfflineSyncSchedulerState> {
    const now = this.now();
    if (this.retryClock === null || trigger === 'manual' || trigger === 'runtime_start' || now < this.retryClock) {
      try { await this.database.resetRetryDeadlines(now); }
      catch { return this.publish(generation, {status:'protected',queueCount:await this.safeQueueCount() ?? 0}); }
    }
    this.retryClock = now;
    return this.drain(generation);
  }

  isBusy(): boolean { return this.flight !== null || this.archiveFlight !== null; }

  async whenIdle(): Promise<void> {
    await Promise.all([this.flight, this.archiveFlight]);
  }

  stop(): void {
    this.stopped = true;
    this.transmissionGeneration += 1;
    this.cancelTimer();
    this.archiveGeneration += 1;
    if (this.archiveTimerHandle !== null) this.timer.cancel(this.archiveTimerHandle);
    this.archiveTimerHandle = null;
  }

  start(): void {
    this.stopped = false;
    const generation = this.transmissionGeneration;
    if (this.flight !== null) void this.flight.then(() => {
      if (this.isTransmissionCurrent(generation)) void this.trigger('session_restored');
    }).catch(() => undefined);
    this.scheduleArchiveReconciliation();
  }

  // This flight never joins the transmission flight or publishes scan feedback.
  // Background execution uses the same deadline as the independent foreground timer.
  reconcileArchives(force = false): Promise<void> {
    if (this.stopped || this.updateRequired) return Promise.resolve();
    if (this.archiveFlight !== null) return this.archiveFlight;
    if (!force && this.now() < this.archiveNextAttemptAt) {
      this.scheduleArchiveReconciliation();
      return Promise.resolve();
    }
    if (this.archiveTimerHandle !== null) this.timer.cancel(this.archiveTimerHandle);
    this.archiveTimerHandle = null;
    const generation = this.archiveGeneration;
    const current = () => !this.stopped && generation === this.archiveGeneration;
    const operation = async () => {
      try {
        let rows = await this.database.readAwaitingArchive(
          this.archiveAfterSequence, OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS,
        );
        if (rows.length === 0 && this.archiveAfterSequence !== 0) {
          this.archiveAfterSequence = 0;
          rows = await this.database.readAwaitingArchive(0, OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS);
        }
        if (!current() || rows.length === 0) return;
        const result = await this.offlineLifecycle.reconcile(rows.map((row) => row.workEventId));
        if (!current()) return;
        if(result.status==='update_required') {
          this.updateRequired=true;
          this.publish(this.transmissionGeneration,{status:'update_required',queueCount:await this.safeQueueCount()??0});
          return;
        }
        if (result.status === 'system_failure') {
          this.transmissionPause = this.transmissionPause === 'quarantine' ? 'quarantine' : 'system_failure';
          this.cancelTimer();
          const queueCount = await this.safeQueueCount();
          if (current()) this.publish(this.transmissionGeneration, {
            status:'transmission_paused', queueCount:queueCount ?? 0, reason:this.transmissionPause,
          });
          return;
        }
        if (result.status !== 'ready') {
          if ('retryAfterSeconds' in result && result.retryAfterSeconds !== undefined) {
            this.archiveNextAttemptAt = this.now() + result.retryAfterSeconds * 1_000;
          }
          return;
        }
        // Validate the entire reply before deleting anything, including duplicate/unrequested IDs.
        const seen = new Set<string>();
        for (const record of result.records) {
          const expected = rows.find((row) => row.workEventId === record.workEventId);
          if (expected === undefined || !sameDurableIdentity(expected, record)
            || seen.has(record.workEventId)) return;
          seen.add(record.workEventId);
        }
        for (const record of result.records) {
          if (!current()) return;
          if (record.archiveStatus === 'offsite_archived') {
            await this.database.acknowledgeArchived(record);
          }
        }
        this.archiveAfterSequence = rows[rows.length - 1]!.deviceSequence;
      } catch {
        // Preserve all evidence on transport/storage failure; retry without disturbing capture.
      }
    };
    let flight!: Promise<void>;
    flight = operation().finally(() => {
      if (this.archiveFlight === flight) this.archiveFlight = null;
      if (!this.stopped) {
        this.archiveNextAttemptAt = Math.max(this.archiveNextAttemptAt,
          this.now() + OFFLINE_ARCHIVE_POLL_MILLISECONDS);
        this.scheduleArchiveReconciliation();
      }
    });
    this.archiveFlight = flight;
    return flight;
  }

  private scheduleArchiveReconciliation(): void {
    if (this.stopped || this.updateRequired || this.archiveTimerHandle !== null || this.archiveFlight !== null) return;
    if (this.archiveNextAttemptAt <= this.now()) {
      this.archiveNextAttemptAt = this.now() + OFFLINE_ARCHIVE_POLL_MILLISECONDS;
    }
    this.archiveTimerHandle = this.timer.schedule(() => {
      this.archiveTimerHandle = null;
      void this.reconcileArchives();
    }, Math.max(1, this.archiveNextAttemptAt - this.now()));
  }

  private isTransmissionCurrent(generation: number): boolean {
    return !this.stopped && generation === this.transmissionGeneration;
  }

  private async drain(generation: number): Promise<OfflineSyncSchedulerState> {
    let lastDurable:
      | { readonly status: 'review_pending'; readonly workEventId: string }
      | {
          readonly status: 'server_decision';
          readonly decision: OfflineCanonicalDecision;
          readonly workEventId: string;
        }
      | null = null;
    while (this.isTransmissionCurrent(generation)) {
      const queueCount = await this.safeQueueCount();
      if (!this.isTransmissionCurrent(generation)) return this.state;
      if (queueCount === null) return this.publish(generation, { status: 'protected', queueCount: 0 });
      if (this.transmissionPause !== null) return this.publish(generation, {
        status:'transmission_paused', queueCount, reason:this.transmissionPause,
      });
      if (queueCount === 0) {
        let reviewPendingSequence = await this.safeReviewPendingSequence();
        if (reviewPendingSequence === undefined) {
          return this.publish(generation, { status: 'protected', queueCount: 0 });
        }
        if (reviewPendingSequence !== null && lastDurable?.status !== 'review_pending') {
          reviewPendingSequence = await this.reconcileReviewPendingSequence(
            reviewPendingSequence, generation,
          );
        }
        if (
          lastDurable?.status === 'review_pending'
          || reviewPendingSequence !== null
        ) {
          return this.publish(generation, {
            status: 'review_pending',
            queueCount: 0,
            ...(lastDurable?.status === 'review_pending'
              ? { workEventId: lastDurable.workEventId }
              : {}),
          });
        }
        if (lastDurable?.status === 'server_decision') {
          return this.publish(generation, {
            status: 'server_decision',
            queueCount: 0,
            decision: lastDurable.decision,
            workEventId: lastDurable.workEventId,
          });
        }
        return this.publish(generation, { status: 'idle', queueCount: 0 });
      }
      this.publish(generation, { status: 'synchronizing', queueCount });

      let legacy: LegacyOfflineQueueHead | null;
      try {
        legacy = await this.database.claimLegacyHead(this.now());
      } catch {
        return this.publish(generation, { status: 'protected', queueCount });
      }
      if (legacy !== null) {
        if (!this.isTransmissionCurrent(generation)) return this.state;
        const outcome = await this.submitLegacy(legacy, queueCount, generation);
        if (outcome === null) continue;
        return outcome;
      }

      let head: OfflineQueueHead | null;
      try {
        head = await this.database.claimHead(this.now());
      } catch {
        return this.publish(generation, { status: 'protected', queueCount });
      }
      if (head === null) {
        let nextRetryAt: number | null;
        try {
          nextRetryAt = await this.database.readNextRetryAt();
        } catch {
          return this.publish(generation, { status: 'protected', queueCount });
        }
        if (nextRetryAt !== null) {
          this.scheduleRetry(nextRetryAt - this.now());
        }
        return this.publish(generation, { status: 'retry_wait', queueCount });
      }
      if (!this.isTransmissionCurrent(generation)) { await this.releaseOffline(commandIdentity(head)); return this.state; }
      if (this.transmissionPause !== null) return (await this.pauseTransmission(
        commandIdentity(head), this.transmissionPause, queueCount, generation,
      )).state;
      const outcome = await this.submitOffline(head, queueCount, generation);
      if (outcome.status === 'continue') {
        if (outcome.durable !== null) {
          lastDurable = outcome.durable;
          this.publish(generation, { ...lastDurable, queueCount: Math.max(0, queueCount - 1) });
        }
        continue;
      }
      return outcome.state;
    }
    return this.state;
  }

  private async submitLegacy(
    head: LegacyOfflineQueueHead,
    queueCount: number,
    generation: number,
  ): Promise<OfflineSyncSchedulerState | null> {
    let result: LifecycleEventResult;
    try {
      result = await this.legacyLifecycle.ingest(head.submission);
    } catch {
      result = { status: 'transient_failure' };
    }
    if (!this.isTransmissionCurrent(generation)) return this.state;
    if (isExactLegacyAcknowledgement(head.submission, result)) {
      try {
        await this.database.acknowledgeLegacyHead({
          workEventId: head.submission.command.workEvent.id,
          receiptId: head.submission.command.receipt.id,
        });
      } catch {
        return this.publish(generation, { status: 'protected', queueCount });
      }
      return null;
    }
    const identity = {
      workEventId: head.submission.command.workEvent.id,
      receiptId: head.submission.command.receipt.id,
    };
    if (result.status === 'authority_rejected') {
      await this.protectLegacy(identity);
      await this.rejectAuthority(generation);
      return this.publish(generation, { status: 'authority_rejected', queueCount });
    }
    if (
      result.status === 'conflict'
      || result.status === 'deferred'
    ) {
      await this.protectLegacy(identity);
      return this.publish(generation, { status: 'protected', queueCount });
    }
    return this.retryLegacy(head, identity, queueCount, generation);
  }

  private async submitOffline(
    head: OfflineQueueHead,
    queueCount: number,
    generation: number,
  ): Promise<
    | {
        readonly status: 'continue';
        readonly durable:
          | null
          | { readonly status: 'review_pending'; readonly workEventId: string }
          | {
              readonly status: 'server_decision';
              readonly decision: OfflineCanonicalDecision;
              readonly workEventId: string;
            };
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
    if (!this.isTransmissionCurrent(generation)) {
      await this.releaseOffline(identity);
      return { status: 'stop', state: this.state };
    }
    if (reconciliation.status === 'authority_rejected') {
      await this.releaseOffline(identity);
      await this.rejectAuthority(generation);
      return {
        status: 'stop',
        state: this.publish(generation, { status: 'authority_rejected', queueCount }),
      };
    }
    if(reconciliation.status==='update_required') {
      await this.releaseOffline(identity);this.updateRequired=true;
      return {status:'stop',state:this.publish(generation,{status:'update_required',queueCount})};
    }
    if(reconciliation.status==='permanent_failure') {
      return this.quarantineOrPause(identity, reconciliation.reason, queueCount, generation);
    }
    if (reconciliation.status === 'system_failure') {
      return this.pauseTransmission(identity, 'system_failure', queueCount, generation);
    }
    if (reconciliation.status === 'unavailable') {
      return {
        status: 'stop',
        state: await this.retryOffline(
          head,
          identity,
          queueCount,
          generation,
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
          state: this.publish(generation, { status: 'protected', queueCount }),
        };
      }
      try {
        if (recovered.archiveStatus === 'archive_pending') {
          await this.database.confirmHead(identity, recovered.result.status);
          this.scheduleArchiveReconciliation();
        } else {
          await this.database.acknowledgeHead(identity, recovered.result.status);
        }
      } catch {
        return {
          status: 'stop',
          state: this.publish(generation, { status: 'protected', queueCount }),
        };
      }
      return recovered.result.status === 'review_pending'
        ? {
            status: 'continue',
            durable: { status: 'review_pending', workEventId: identity.workEventId },
          }
        : {
            status: 'continue',
            durable: {
              status: 'server_decision',
              decision: recovered.result.decision,
              workEventId: identity.workEventId,
            },
          };
    }

    let result: OfflineLifecycleTransportResult;
    try {
      result = await this.offlineLifecycle.ingest(head.command);
    } catch {
      result = { status: 'unavailable' };
    }
    if (!this.isTransmissionCurrent(generation)) {
      await this.releaseOffline(identity);
      return { status: 'stop', state: this.state };
    }
    if (result.status === 'synchronized' || result.status === 'review_pending') {
      if (!sameDurableIdentity(identity, result)) {
        await this.protectOffline(identity);
        return {
          status: 'stop',
          state: this.publish(generation, { status: 'protected', queueCount }),
        };
      }
      try {
        if (result.archiveStatus === 'archive_pending') {
          await this.database.confirmHead(identity, result.status);
          this.scheduleArchiveReconciliation();
        } else {
          await this.database.acknowledgeHead(identity, result.status);
        }
      } catch {
        return {
          status: 'stop',
          state: this.publish(generation, { status: 'protected', queueCount }),
        };
      }
      return result.status === 'review_pending'
        ? {
            status: 'continue',
            durable: { status: 'review_pending', workEventId: identity.workEventId },
          }
        : {
            status: 'continue',
            durable: {
              status: 'server_decision',
              decision: result.decision,
              workEventId: identity.workEventId,
            },
          };
    }
    if (result.status === 'authority_rejected') {
      await this.releaseOffline(identity);
      await this.rejectAuthority(generation);
      return {
        status: 'stop',
        state: this.publish(generation, { status: 'authority_rejected', queueCount }),
      };
    }
    if (result.status === 'update_required') {
      await this.releaseOffline(identity);
      this.updateRequired = true;
      return {
        status: 'stop',
        state: this.publish(generation, { status: 'update_required', queueCount }),
      };
    }
    if (result.status === 'conflict' || result.status === 'permanent_failure') {
      return this.quarantineOrPause(identity, result.reason, queueCount, generation);
    }
    if (result.status === 'system_failure') {
      return this.pauseTransmission(identity, 'system_failure', queueCount, generation);
    }
    if (result.status === 'pending' && result.reason === 'sequence_gap') {
      try {
        const issues = await this.database.readUntransferredCaptures();
        if (!this.isTransmissionCurrent(generation)) {
          await this.releaseOffline(identity);
          return {status:'stop',state:this.state};
        }
        if (issues.some(issue=>!issue.reported)) {
          const report=await this.database.readQuarantineReport();
          if(report && report.deviceSequence<head.command.deviceSequence && this.offlineLifecycle.skip) {
            let reported;
            try {reported=await this.offlineLifecycle.skip(report);} catch {reported={status:'unavailable'} as const;}
            if(!this.isTransmissionCurrent(generation)) {await this.releaseOffline(identity);return {status:'stop',state:this.state};}
            if(reported.status==='reported' && sameDurableIdentity(report,reported) && reported.evidenceSha256===report.evidenceSha256) {
              await this.database.confirmQuarantineReport(report);
              await this.database.releaseHead(identity);
              this.publish(generation,{status:'quarantined',queueCount,workEventId:report.workEventId});
              return {status:'continue',durable:null};
            }
          }
          return this.pauseTransmission(identity, 'quarantine', queueCount, generation);
        }
      } catch {
        return {status:'stop',state:this.publish(generation,{status:'protected',queueCount})};
      }
    }
    return {
      status: 'stop',
      state: await this.retryOffline(
        head,
        identity,
        queueCount,
        generation,
        'retryAfterSeconds' in result ? result.retryAfterSeconds : undefined,
      ),
    };
  }

  private async quarantineOrPause(
    identity: OfflineDurableResultIdentity, reason: string, queueCount: number, generation: number,
  ): Promise<{readonly status:'continue'; readonly durable:null} | {readonly status:'stop'; readonly state:OfflineSyncSchedulerState}> {
    try {
      const quarantined = await this.database.quarantineHead(identity, reason);
      if (!quarantined) return this.pauseTransmission(identity, 'quarantine', queueCount, generation);
    } catch {
      return {status:'stop',state:this.publish(generation,{status:'protected',queueCount})};
    }
    this.publish(generation, {status:'quarantined',queueCount:Math.max(0,queueCount-1),workEventId:identity.workEventId});
    return {status:'continue',durable:null};
  }

  private async pauseTransmission(
    identity: OfflineDurableResultIdentity, reason: 'system_failure' | 'quarantine', queueCount: number, generation: number,
  ): Promise<{readonly status:'stop'; readonly state:OfflineSyncSchedulerState}> {
    try { await this.database.releaseHead(identity); }
    catch { return {status:'stop',state:this.publish(generation,{status:'protected',queueCount})}; }
    if (!this.isTransmissionCurrent(generation)) return {status:'stop',state:this.state};
    this.transmissionPause = reason;
    return {status:'stop',state:this.publish(generation,{status:'transmission_paused',queueCount,reason})};
  }

  private async retryOffline(
    head: OfflineQueueHead,
    identity: OfflineDurableResultIdentity,
    queueCount: number,
    generation: number,
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
      return this.publish(generation, { status: 'protected', queueCount });
    }
    if (!this.isTransmissionCurrent(generation)) return this.state;
    this.scheduleRetry(delay);
    return this.publish(generation, { status: 'retry_wait', queueCount });
  }

  private async retryLegacy(
    head: LegacyOfflineQueueHead,
    identity: { readonly workEventId: string; readonly receiptId: string },
    queueCount: number,
    generation: number,
  ): Promise<OfflineSyncSchedulerState> {
    const delay = retryDelay(head.attemptCount, undefined, this.random);
    try {
      await this.database.retainLegacyHeadForRetry(
        identity,
        head.attemptCount + 1,
        this.now() + delay,
      );
    } catch {
      return this.publish(generation, { status: 'protected', queueCount });
    }
    if (!this.isTransmissionCurrent(generation)) return this.state;
    this.scheduleRetry(delay);
    return this.publish(generation, { status: 'retry_wait', queueCount });
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

  private async reconcileReviewPendingSequence(
    expectedSequence: number,
    generation: number,
  ): Promise<number | null> {
    try {
      const context = await this.database.readActiveCaptureContext();
      if (context === null || !this.isTransmissionCurrent(generation)) return expectedSequence;
      const state = await this.offlineLifecycle.readReviewState({
        expectedMembershipId: context.membershipId,
        installationId: context.installationId,
      });
      if (
        !this.isTransmissionCurrent(generation) || state.status !== 'clear'
        || state.expectedMembershipId !== context.membershipId
        || state.installationId !== context.installationId
        || state.confirmedThroughSequence < expectedSequence
      ) return expectedSequence;
      return await this.database.clearReviewPendingSequence(
        expectedSequence,
        state.confirmedThroughSequence,
      ) ? null : expectedSequence;
    } catch {
      return expectedSequence;
    }
  }

  private async rejectAuthority(generation: number): Promise<void> {
    if (!this.isTransmissionCurrent(generation)) return;
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

  private publish(generation: number, state: OfflineSyncSchedulerState): OfflineSyncSchedulerState {
    if (!this.isTransmissionCurrent(generation)) return this.state;
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
