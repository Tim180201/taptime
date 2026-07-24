import type { Da4V5Status } from './Da4V5Database.js';

export type Da4V5WriteBrowser = 'safari' | 'chromium';
export type Da4V5WriteOperation =
  | 'create-customer'
  | 'create-invitation'
  | 'reassign-tag'
  | 'correct-time-record'
  | 'export-time-entries'
  | 'adjudicate-review';

interface Da4V5WriteStep {
  readonly browser: Da4V5WriteBrowser;
  readonly operation: Da4V5WriteOperation;
  readonly delta: Partial<Record<keyof Da4V5Status, number>>;
}

export const DA4_V5_WRITE_PLAN: readonly Da4V5WriteStep[] = Object.freeze([
  Object.freeze({
    browser: 'safari',
    operation: 'create-customer',
    delta: Object.freeze({ auditEvents: 1, customerReceipts: 1, customers: 1 }),
  }),
  Object.freeze({
    browser: 'safari',
    operation: 'create-invitation',
    delta: Object.freeze({
      activeInvitations: 1,
      auditEvents: 1,
      employeeInvitationReceipts: 1,
      unconsumedInvitations: 1,
    }),
  }),
  Object.freeze({
    browser: 'safari',
    operation: 'reassign-tag',
    delta: Object.freeze({
      auditEvents: 2,
      reassignmentReceipts: 1,
      totalAssignments: 1,
    }),
  }),
  Object.freeze({
    browser: 'chromium',
    operation: 'correct-time-record',
    delta: Object.freeze({
      auditEvents: 1,
      timeRecordRevisions: 1,
      timeReviewCommandReceipts: 1,
    }),
  }),
  Object.freeze({
    browser: 'chromium',
    operation: 'export-time-entries',
    delta: Object.freeze({ auditEvents: 1, exportAudits: 1 }),
  }),
  Object.freeze({
    browser: 'chromium',
    operation: 'adjudicate-review',
    delta: Object.freeze({
      auditEvents: 1,
      reviewAdjudications: 1,
      timeReviewCommandReceipts: 1,
      unresolvedReviews: -1,
    }),
  }),
]);

export type Da4V5WritePlanState =
  | Readonly<{
      readonly browser: Da4V5WriteBrowser;
      readonly operation: Da4V5WriteOperation;
      readonly state: 'awaiting';
      readonly step: number;
    }>
  | Readonly<{ readonly state: 'complete'; readonly step: 6 }>;

export class Da4V5OperationSession {
  private failed = false;
  private invitationExpired = false;
  private nextStep = 0;

  constructor(private readonly initial: Da4V5Status) {}

  checkpoint(
    browser: Da4V5WriteBrowser,
    operation: Da4V5WriteOperation,
    current: Da4V5Status,
  ): 'match' | 'mismatch' {
    const step = DA4_V5_WRITE_PLAN[this.nextStep];
    if (
      this.failed
      || step === undefined
      || step.browser !== browser
      || step.operation !== operation
    ) {
      this.failed = true;
      return 'mismatch';
    }
    const invitationState = classifyCheckpointStatus(
      current,
      expectedStatus(this.initial, this.nextStep),
      this.nextStep,
    );
    if (
      invitationState === 'mismatch'
      || (this.invitationExpired && invitationState === 'active')
    ) {
      this.failed = true;
      return 'mismatch';
    }
    if (invitationState === 'expired') {
      this.invitationExpired = true;
    }
    this.nextStep += 1;
    return 'match';
  }

  state(): Da4V5WritePlanState {
    const step = DA4_V5_WRITE_PLAN[this.nextStep];
    return step === undefined
      ? Object.freeze({ state: 'complete', step: 6 })
      : Object.freeze({
          state: 'awaiting',
          step: this.nextStep + 1,
          browser: step.browser,
          operation: step.operation,
        });
  }
}

export function expectedDa4V5Status(
  initial: Da4V5Status,
  completedSteps: number,
): Da4V5Status {
  if (!Number.isSafeInteger(completedSteps) || completedSteps < 0 || completedSteps > 6) {
    throw new Error('DA4 V5 completed step count is invalid');
  }
  return expectedStatus(initial, completedSteps - 1);
}

function expectedStatus(initial: Da4V5Status, throughStep: number): Da4V5Status {
  const values = { ...initial };
  for (let index = 0; index <= throughStep; index += 1) {
    const step = DA4_V5_WRITE_PLAN[index];
    if (step === undefined) {
      break;
    }
    for (const [key, delta] of Object.entries(step.delta)) {
      values[key as keyof Da4V5Status] += delta;
    }
  }
  return Object.freeze(values);
}

function sameStatus(left: Da4V5Status, right: Da4V5Status): boolean {
  return (Object.keys(right) as Array<keyof Da4V5Status>).every((key) => left[key] === right[key])
    && Object.keys(left).length === Object.keys(right).length;
}

function classifyCheckpointStatus(
  current: Da4V5Status,
  expected: Da4V5Status,
  step: number,
): 'active' | 'expired' | 'mismatch' {
  if (step <= 1) {
    return sameStatus(current, expected) ? 'active' : 'mismatch';
  }
  if (
    Object.keys(current).length !== Object.keys(expected).length
    || !(Object.keys(expected) as Array<keyof Da4V5Status>).every((key) => (
      isInvitationStateKey(key) || current[key] === expected[key]
    ))
  ) {
    return 'mismatch';
  }
  const invitationRemainsActive = (
    current.unconsumedInvitations === expected.unconsumedInvitations
    && current.activeInvitations === expected.activeInvitations
    && current.expiredUnconsumedInvitations === expected.expiredUnconsumedInvitations
  );
  const invitationExpiredNaturally = (
    current.unconsumedInvitations === expected.unconsumedInvitations
    && current.activeInvitations === expected.activeInvitations - 1
    && current.expiredUnconsumedInvitations === expected.expiredUnconsumedInvitations + 1
  );
  if (invitationRemainsActive) {
    return 'active';
  }
  return invitationExpiredNaturally ? 'expired' : 'mismatch';
}

function isInvitationStateKey(key: keyof Da4V5Status): boolean {
  return key === 'activeInvitations'
    || key === 'expiredUnconsumedInvitations'
    || key === 'unconsumedInvitations';
}
