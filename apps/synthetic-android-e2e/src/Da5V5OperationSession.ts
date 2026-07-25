import {
  DA5_V5_INITIAL_STATUS,
  sameDa5V5Status,
  type Da5V5Status,
} from './Da5V5Database.js';
import type { Da5V5DedupePhase } from './Da5V5DedupeWindow.js';

export type Da5V5Checkpoint =
  | 'gate-a-setup-rejections'
  | 'gate-b-cold'
  | 'gate-b-duplicate'
  | 'gate-b-background'
  | 'gate-c-customer-first'
  | 'gate-c-customer-complete'
  | 'gate-c-project-first'
  | 'gate-c-project-complete'
  | 'gate-c-general-first'
  | 'gate-c-general-complete'
  | 'gate-e-accessibility'
  | 'gate-d-customer-first-pending'
  | 'gate-d-customer-complete-pending'
  | 'gate-d-project-first-pending'
  | 'gate-d-project-complete-pending'
  | 'gate-d-general-first-pending'
  | 'gate-d-general-complete-pending'
  | 'gate-d-ordinary-relaunch'
  | 'gate-d-ordinary-synchronized'
  | 'gate-d-cancellation'
  | 'gate-d-fixture-tag-b-activated'
  | 'gate-d-fixture-tag-b-started'
  | 'gate-d-fixture-pre-cutover-pending'
  | 'gate-d-fixture-cutover'
  | 'gate-d-fixture-all-pending'
  | 'gate-d-protected-terminal'
  | 'gate-d-protected-relaunch'
  | 'gate-f-final';

export interface Da5V5CheckpointStep {
  readonly checkpoint: Da5V5Checkpoint;
  readonly expectedQueueItems: number;
  readonly status: Da5V5Status;
}

const gateA = expected({
  activeAssignments: 1,
  adminSetupReceipts: 1,
  auditEvents: 3,
  fixtureAuditEvents: 1,
  tags: 2,
  totalAssignments: 1,
});
const gateBCold = from(gateA, {
  activeTimeEntries: 1,
  auditEvents: 4,
  canonicalDecisions: 1,
  nfcWorkEvents: 1,
  syncReceipts: 1,
  timeEntries: 1,
  workEvents: 1,
});
const gateBDuplicate = from(gateBCold, {
  auditEvents: 5,
  canonicalDecisions: 2,
  duplicateDecisions: 1,
  nfcWorkEvents: 2,
  syncReceipts: 2,
  workEvents: 2,
});
const gateBBackground = from(gateBDuplicate, {
  activeTimeEntries: 0,
  auditEvents: 6,
  canonicalDecisions: 3,
  nfcWorkEvents: 3,
  stoppedTimeEntries: 1,
  syncReceipts: 3,
  workEvents: 3,
});
const gateCCustomerFirst = from(gateBBackground, {
  activeTimeEntries: 1,
  auditEvents: 7,
  canonicalDecisions: 4,
  nfcWorkEvents: 4,
  syncReceipts: 4,
  timeEntries: 2,
  workEvents: 4,
});
const gateCCustomerComplete = from(gateCCustomerFirst, {
  activeTimeEntries: 0,
  auditEvents: 8,
  canonicalDecisions: 5,
  manualWorkEvents: 1,
  stoppedTimeEntries: 2,
  syncReceipts: 5,
  workEvents: 5,
});
const gateCProjectFirst = from(gateCCustomerComplete, {
  activeTimeEntries: 1,
  auditEvents: 9,
  canonicalDecisions: 6,
  manualWorkEvents: 2,
  syncReceipts: 6,
  timeEntries: 3,
  workEvents: 6,
});
const gateCProjectComplete = from(gateCProjectFirst, {
  activeTimeEntries: 0,
  auditEvents: 10,
  canonicalDecisions: 7,
  manualWorkEvents: 3,
  stoppedTimeEntries: 3,
  syncReceipts: 7,
  workEvents: 7,
});
const gateCGeneralFirst = from(gateCProjectComplete, {
  activeTimeEntries: 1,
  auditEvents: 11,
  canonicalDecisions: 8,
  manualWorkEvents: 4,
  syncReceipts: 8,
  timeEntries: 4,
  workEvents: 8,
});
const gateCGeneralComplete = from(gateCGeneralFirst, {
  activeTimeEntries: 0,
  auditEvents: 12,
  canonicalDecisions: 9,
  manualWorkEvents: 5,
  stoppedTimeEntries: 4,
  syncReceipts: 9,
  workEvents: 9,
});
const ordinarySynchronized = from(gateCGeneralComplete, {
  auditEvents: 18,
  canonicalDecisions: 15,
  manualWorkEvents: 10,
  nfcWorkEvents: 5,
  offlineReconciliations: 6,
  stoppedTimeEntries: 7,
  syncReceipts: 15,
  timeEntries: 7,
  workEvents: 15,
});
const fixtureTagBActivated = from(ordinarySynchronized, {
  activeAssignments: 2,
  auditEvents: 19,
  fixtureAuditEvents: 2,
  totalAssignments: 2,
});
const fixtureTagBStarted = from(fixtureTagBActivated, {
  activeTimeEntries: 1,
  auditEvents: 20,
  canonicalDecisions: 16,
  nfcWorkEvents: 6,
  syncReceipts: 16,
  timeEntries: 8,
  workEvents: 16,
});
const fixtureCutover = from(fixtureTagBStarted, {
  auditEvents: 22,
  fixtureAuditEvents: 4,
  totalAssignments: 3,
});
const protectedTerminal = from(fixtureCutover, {
  activeOtherTargetDecisions: 1,
  auditEvents: 25,
  canonicalDecisions: 17,
  nfcWorkEvents: 9,
  offlineReconciliations: 9,
  reviewHistoricalConfiguration: 1,
  reviewMarkers: 1,
  reviewPredecessors: 1,
  syncReceipts: 19,
  workEvents: 19,
});

export const DA5_V5_CHECKPOINT_PLAN: readonly Da5V5CheckpointStep[] = Object.freeze([
  step('gate-a-setup-rejections', gateA, 0),
  step('gate-b-cold', gateBCold, 0),
  step('gate-b-duplicate', gateBDuplicate, 0),
  step('gate-b-background', gateBBackground, 0),
  step('gate-c-customer-first', gateCCustomerFirst, 0),
  step('gate-c-customer-complete', gateCCustomerComplete, 0),
  step('gate-c-project-first', gateCProjectFirst, 0),
  step('gate-c-project-complete', gateCProjectComplete, 0),
  step('gate-c-general-first', gateCGeneralFirst, 0),
  step('gate-c-general-complete', gateCGeneralComplete, 0),
  step('gate-e-accessibility', gateCGeneralComplete, 0),
  step('gate-d-customer-first-pending', gateCGeneralComplete, 1),
  step('gate-d-customer-complete-pending', gateCGeneralComplete, 2),
  step('gate-d-project-first-pending', gateCGeneralComplete, 3),
  step('gate-d-project-complete-pending', gateCGeneralComplete, 4),
  step('gate-d-general-first-pending', gateCGeneralComplete, 5),
  step('gate-d-general-complete-pending', gateCGeneralComplete, 6),
  step('gate-d-ordinary-relaunch', gateCGeneralComplete, 6),
  step('gate-d-ordinary-synchronized', ordinarySynchronized, 0),
  step('gate-d-cancellation', ordinarySynchronized, 0),
  step('gate-d-fixture-tag-b-activated', fixtureTagBActivated, 0),
  step('gate-d-fixture-tag-b-started', fixtureTagBStarted, 0),
  step('gate-d-fixture-pre-cutover-pending', fixtureTagBStarted, 1),
  step('gate-d-fixture-cutover', fixtureCutover, 1),
  step('gate-d-fixture-all-pending', fixtureCutover, 3),
  step('gate-d-protected-terminal', protectedTerminal, 0),
  step('gate-d-protected-relaunch', protectedTerminal, 0),
  step('gate-f-final', protectedTerminal, 0),
]);

const baselinePrerequisite: Readonly<Record<Da5V5DedupePhase, Da5V5Checkpoint>> = Object.freeze({
  'gate-b-customer': 'gate-b-duplicate',
  'gate-c-customer': 'gate-c-customer-first',
  'gate-c-project': 'gate-c-project-first',
  'gate-c-general': 'gate-c-general-first',
  'gate-d-customer': 'gate-d-customer-first-pending',
  'gate-d-project': 'gate-d-project-first-pending',
  'gate-d-general': 'gate-d-general-first-pending',
  'gate-d-tag-a': 'gate-d-fixture-pre-cutover-pending',
  'gate-d-tag-b': 'gate-d-fixture-tag-b-started',
});

const checkBeforeCheckpoint: Readonly<Record<Da5V5DedupePhase, Da5V5Checkpoint>> = Object.freeze({
  'gate-b-customer': 'gate-b-background',
  'gate-c-customer': 'gate-c-customer-complete',
  'gate-c-project': 'gate-c-project-complete',
  'gate-c-general': 'gate-c-general-complete',
  'gate-d-customer': 'gate-d-customer-complete-pending',
  'gate-d-project': 'gate-d-project-complete-pending',
  'gate-d-general': 'gate-d-general-complete-pending',
  'gate-d-tag-a': 'gate-d-fixture-all-pending',
  'gate-d-tag-b': 'gate-d-fixture-all-pending',
});

const requiredDedupeChecksByCheckpoint: Readonly<
  Partial<Record<Da5V5Checkpoint, readonly Da5V5DedupePhase[]>>
> = Object.freeze({
  'gate-b-background': Object.freeze(['gate-b-customer'] as const),
  'gate-c-customer-complete': Object.freeze(['gate-c-customer'] as const),
  'gate-c-project-complete': Object.freeze(['gate-c-project'] as const),
  'gate-c-general-complete': Object.freeze(['gate-c-general'] as const),
  'gate-d-customer-complete-pending': Object.freeze(['gate-d-customer'] as const),
  'gate-d-project-complete-pending': Object.freeze(['gate-d-project'] as const),
  'gate-d-general-complete-pending': Object.freeze(['gate-d-general'] as const),
  'gate-d-fixture-all-pending': Object.freeze(['gate-d-tag-a', 'gate-d-tag-b'] as const),
});

export interface Da5V5OperationState {
  readonly checkedDedupePhases: readonly Da5V5DedupePhase[];
  readonly confirmedCheckpoint: Da5V5Checkpoint | null;
  readonly failed: boolean;
  readonly issuedDedupeBaselines: readonly Da5V5DedupePhase[];
  readonly observedCheckpoint: Da5V5Checkpoint | null;
  readonly nextCheckpoint: Da5V5Checkpoint | null;
  readonly step: number;
  readonly terminal: boolean;
}

export class Da5V5OperationSession {
  private readonly checkedDedupePhases = new Set<Da5V5DedupePhase>();
  private confirmedCheckpoint: Da5V5Checkpoint | null = null;
  private failed = false;
  private readonly issuedDedupeBaselines = new Set<Da5V5DedupePhase>();
  private nextStep = 0;
  private observedCheckpoint: Da5V5Checkpoint | null = null;

  constructor(initial: Da5V5Status) {
    if (!sameDa5V5Status(initial, DA5_V5_INITIAL_STATUS)) {
      this.failed = true;
    }
  }

  observeCheckpoint(
    checkpoint: Da5V5Checkpoint,
    current: Da5V5Status,
    deviceQueueItems: number,
  ): 'match' | 'mismatch' {
    const expectedStep = DA5_V5_CHECKPOINT_PLAN[this.nextStep];
    const requiredDedupeChecks = requiredDedupeChecksByCheckpoint[checkpoint] ?? [];
    if (
      this.failed
      || this.observedCheckpoint !== null
      || expectedStep?.checkpoint !== checkpoint
      || expectedStep.expectedQueueItems !== deviceQueueItems
      || !sameDa5V5Status(current, expectedStep.status)
      || requiredDedupeChecks.some((phase) => !this.checkedDedupePhases.has(phase))
    ) {
      return this.fail();
    }
    this.observedCheckpoint = checkpoint;
    return 'match';
  }

  confirmCheckpoint(
    checkpoint: Da5V5Checkpoint,
    result: 'pass' | 'fail' | 'ambiguous',
  ): 'match' | 'mismatch' {
    const expectedStep = DA5_V5_CHECKPOINT_PLAN[this.nextStep];
    if (
      this.failed
      || result !== 'pass'
      || expectedStep?.checkpoint !== checkpoint
      || this.observedCheckpoint !== checkpoint
    ) {
      return this.fail();
    }
    this.observedCheckpoint = null;
    this.confirmedCheckpoint = checkpoint;
    this.nextStep += 1;
    return 'match';
  }

  authorizeDedupeBaseline(phase: Da5V5DedupePhase): 'match' | 'mismatch' {
    if (
      this.failed
      || this.confirmedCheckpoint !== baselinePrerequisite[phase]
      || this.issuedDedupeBaselines.has(phase)
    ) {
      return this.fail();
    }
    this.issuedDedupeBaselines.add(phase);
    return 'match';
  }

  authorizeDedupeCheck(phase: Da5V5DedupePhase): 'match' | 'mismatch' {
    const next = DA5_V5_CHECKPOINT_PLAN[this.nextStep]?.checkpoint;
    if (
      this.failed
      || next !== checkBeforeCheckpoint[phase]
      || !this.issuedDedupeBaselines.has(phase)
      || this.checkedDedupePhases.has(phase)
      || (phase === 'gate-d-tag-b' && !this.checkedDedupePhases.has('gate-d-tag-a'))
    ) {
      return this.fail();
    }
    this.checkedDedupePhases.add(phase);
    return 'match';
  }

  fail(): 'mismatch' {
    this.failed = true;
    this.observedCheckpoint = null;
    return 'mismatch';
  }

  state(): Da5V5OperationState {
    const next = DA5_V5_CHECKPOINT_PLAN[this.nextStep];
    return Object.freeze({
      checkedDedupePhases: Object.freeze([...this.checkedDedupePhases].sort()),
      confirmedCheckpoint: this.confirmedCheckpoint,
      failed: this.failed,
      issuedDedupeBaselines: Object.freeze([...this.issuedDedupeBaselines].sort()),
      observedCheckpoint: this.observedCheckpoint,
      nextCheckpoint: next?.checkpoint ?? null,
      step: this.nextStep,
      terminal: next === undefined,
    });
  }
}

function expected(overrides: Partial<Da5V5Status>): Da5V5Status {
  return Object.freeze({ ...DA5_V5_INITIAL_STATUS, ...overrides });
}

function from(
  status: Da5V5Status,
  overrides: Partial<Da5V5Status>,
): Da5V5Status {
  return Object.freeze({ ...status, ...overrides });
}

function step(
  checkpoint: Da5V5Checkpoint,
  status: Da5V5Status,
  expectedQueueItems: number,
): Da5V5CheckpointStep {
  return Object.freeze({ checkpoint, expectedQueueItems, status });
}
