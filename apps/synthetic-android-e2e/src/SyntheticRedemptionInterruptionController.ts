export type SyntheticRedemptionInterruptionEvent =
  | 'redemption_interruption_armed'
  | 'redemption_interrupted'
  | 'redemption_paused';

export type SyntheticRedemptionInterruptionState = 'armed' | 'disarmed' | 'paused';

export interface SyntheticRedemptionInterruptionAttempt {
  beforeCommit(): Promise<void>;
  finish(): void;
}

const automaticAbortMilliseconds = 8_000;
const inactiveAttempt: SyntheticRedemptionInterruptionAttempt = Object.freeze({
  async beforeCommit(): Promise<void> {},
  finish(): void {},
});

/** Strictly local, credential-free latch for one real redemption attempt. */
export class SyntheticRedemptionInterruptionController {
  private state: SyntheticRedemptionInterruptionState = 'disarmed';
  private activeAttempt: symbol | null = null;
  private pendingRejection: ((error: Error) => void) | null = null;
  private automaticAbort: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onSafeEvent: (event: SyntheticRedemptionInterruptionEvent) => void,
  ) {}

  armNextRedemptionInterruption(): void {
    if (this.state !== 'disarmed') {
      throw new Error('Synthetic redemption interruption is already active');
    }
    this.state = 'armed';
    this.emitSafeEvent('redemption_interruption_armed');
  }

  beginRedemptionAttempt(): SyntheticRedemptionInterruptionAttempt {
    if (this.state !== 'armed' || this.activeAttempt !== null) {
      return inactiveAttempt;
    }
    const attemptToken = Symbol('synthetic-redemption-attempt');
    this.activeAttempt = attemptToken;
    let finished = false;
    return Object.freeze({
      beforeCommit: async () => {
        if (!finished) {
          await this.pauseClaimedAttempt(attemptToken);
        }
      },
      finish: () => {
        if (finished) {
          return;
        }
        finished = true;
        this.finishClaimedAttempt(attemptToken);
      },
    });
  }

  abortPausedRedemption(): void {
    if (this.state !== 'paused' || this.pendingRejection === null) {
      throw new Error('No synthetic redemption is paused');
    }
    this.abortPausedRedemptionInternal();
  }

  getState(): SyntheticRedemptionInterruptionState {
    return this.state;
  }

  close(): void {
    if (this.state === 'paused' && this.pendingRejection !== null) {
      this.abortPausedRedemptionInternal();
      return;
    }
    this.clearAutomaticAbort();
    this.activeAttempt = null;
    this.pendingRejection = null;
    this.state = 'disarmed';
  }

  private async pauseClaimedAttempt(attemptToken: symbol): Promise<void> {
    if (this.state !== 'armed' || this.activeAttempt !== attemptToken) {
      return;
    }
    this.state = 'paused';
    const paused = new Promise<void>((_resolve, reject) => {
      this.pendingRejection = reject;
      this.automaticAbort = setTimeout(() => {
        if (this.state === 'paused' && this.pendingRejection !== null) {
          this.abortPausedRedemptionInternal();
        }
      }, automaticAbortMilliseconds);
    });
    this.emitSafeEvent('redemption_paused');
    await paused;
  }

  private finishClaimedAttempt(attemptToken: symbol): void {
    if (this.activeAttempt !== attemptToken) {
      return;
    }
    if (this.state === 'paused' && this.pendingRejection !== null) {
      this.abortPausedRedemptionInternal();
      return;
    }
    this.clearAutomaticAbort();
    this.activeAttempt = null;
    this.pendingRejection = null;
    this.state = 'disarmed';
  }

  private abortPausedRedemptionInternal(): void {
    const reject = this.pendingRejection;
    if (reject === null) {
      return;
    }
    this.pendingRejection = null;
    this.clearAutomaticAbort();
    this.activeAttempt = null;
    this.state = 'disarmed';
    reject(new Error('Synthetic C3E1 redemption interrupted before commit'));
    this.emitSafeEvent('redemption_interrupted');
  }

  private emitSafeEvent(event: SyntheticRedemptionInterruptionEvent): void {
    try {
      this.onSafeEvent(event);
    } catch {
      // Diagnostics must never affect transaction rollback or environment cleanup.
    }
  }

  private clearAutomaticAbort(): void {
    if (this.automaticAbort !== null) {
      clearTimeout(this.automaticAbort);
      this.automaticAbort = null;
    }
  }
}
