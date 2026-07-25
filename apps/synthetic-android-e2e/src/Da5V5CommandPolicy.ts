import {
  type Da5V5Checkpoint,
  type Da5V5OperationSession,
} from './Da5V5OperationSession.js';

const NON_FATAL_SAFE_EVENTS = new Set<string>([
  'da5_v5_tag_b_registration_armed',
  'da5_v5_tag_b_registered_unassigned',
]);

export class Da5V5SafeEventLatch {
  private failed = false;

  observe(event: string): 'continue' | 'failed' {
    if (this.failed || !NON_FATAL_SAFE_EVENTS.has(event)) {
      this.failed = true;
      return 'failed';
    }
    return 'continue';
  }

  commandAllowed(): boolean {
    return !this.failed;
  }
}

export class Da5V5CommandExecutionGuard {
  constructor(private readonly safeEvents: Da5V5SafeEventLatch) {}

  async wait<T>(operation: Promise<T>): Promise<T> {
    const result = await operation;
    this.ensure();
    return result;
  }

  ensure(): void {
    if (!this.safeEvents.commandAllowed()) {
      throw new Error('DA5 V5 command invalidated by a safe failure');
    }
  }
}

export function da5V5SessionBoundaryMatches(
  session: Da5V5OperationSession,
  confirmedCheckpoint: Da5V5Checkpoint | null,
  nextCheckpoint: Da5V5Checkpoint,
): boolean {
  const state = session.state();
  return !state.failed
    && state.observedCheckpoint === null
    && state.confirmedCheckpoint === confirmedCheckpoint
    && state.nextCheckpoint === nextCheckpoint;
}

export function da5V5TagBRegistrationArmIsAuthorized(options: {
  readonly commandAllowed: boolean;
  readonly credentialsCompleted: number;
  readonly credentialsRequired: number;
  readonly session: Da5V5OperationSession;
  readonly tagRegistrationState: 'armed' | 'disarmed' | 'failed' | 'registered' | 'registering';
}): boolean {
  return options.commandAllowed
    && options.credentialsCompleted === options.credentialsRequired
    && da5V5SessionBoundaryMatches(
      options.session,
      null,
      'gate-a-setup-rejections',
    )
    && options.tagRegistrationState === 'disarmed';
}
