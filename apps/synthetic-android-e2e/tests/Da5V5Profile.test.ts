import { readFile } from 'node:fs/promises';
import type { Interface } from 'node:readline';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_ACCESSIBILITY_SURFACE_PLAN,
  DA5_V5_DEDUPE_PHASES,
  DA5_V5_CHECKPOINT_PLAN,
  DA5_V5_INITIAL_STATUS,
  DA5_V5_PROFILE,
  DA5_V5_PUBLIC_MANIFEST,
  DA5_V5_TAG_B_REGISTRATION_ARM_STATUS,
  DA4_V5_PROFILE,
  Da5V5AccessibilitySession,
  Da5V5DedupeWindowController,
  Da5V5InputOwnership,
  Da5V5MemoryOnlyPasswordBinding,
  Da5V5OperationSession,
  Da5V5OperatorLifecycle,
  Da5V5ProtectedReviewFixture,
  Da5V5CommandExecutionGuard,
  Da5V5SafeEventLatch,
  Da5V5SignalController,
  Da5V5StartupSettlement,
  Da5V5StartupInterrupted,
  cleanSyntheticDatabase,
  da5V5StartupCleanupIncomplete,
  da5V5Ids,
  da5V5TagBRegistrationArmIsAuthorized,
  da5V5TagBRegistrationPreconditionMatches,
  da5V5DedupeBinding,
  readDa5V5InvariantStatus,
  rejectDa5V5OperationalInputs,
  requireDa5V5Profile,
  runDa5V5StrictCleanup,
  settleDa5V5BackgroundOperation,
  syntheticIds,
  validateDa5V5TagBinding,
  type Da5V5Checkpoint,
  type Da5V5DedupePhase,
} from '../src/index.js';

describe('DA5 V5 explicit profile and disclosure boundaries', () => {
  it('accepts only the exact opt-in profile', () => {
    expect(requireDa5V5Profile(DA5_V5_PROFILE)).toBe('da5-v5');
    expect(() => requireDa5V5Profile(undefined)).toThrow(/exact explicit/);
    expect(() => requireDa5V5Profile('default')).toThrow(/exact explicit/);
    expect(() => requireDa5V5Profile('DA5-V5')).toThrow(/exact explicit/);
  });

  it('rejects operational database credentials, URL environment and argv', () => {
    expect(() => rejectDa5V5OperationalInputs({}, ['node', 'da5V5Main.js'])).not.toThrow();
    expect(() => rejectDa5V5OperationalInputs(
      { TAPTIME_SYNTHETIC_E2E_DATABASE_URL: 'hidden' },
      ['node', 'da5V5Main.js'],
    )).toThrow(/database input is rejected/);
    expect(() => rejectDa5V5OperationalInputs(
      { PGPASSWORD: 'hidden' },
      ['node', 'da5V5Main.js'],
    )).toThrow(/database input is rejected/);
    expect(() => rejectDa5V5OperationalInputs(
      { TAPTIME_DA5_V5_CI_OWNER_RECORD: '/private/ci-only-owner.json' },
      ['node', 'da5V5Main.js'],
    )).toThrow(/database input is rejected/);
    expect(() => rejectDa5V5OperationalInputs(
      {},
      ['node', 'da5V5Main.js', '--database-url=hidden'],
    )).toThrow(/database input is rejected/);
  });

  it('validates only three distinct safe fingerprints and the packaged technology', () => {
    expect(DA5_V5_PUBLIC_MANIFEST.setupPreviewLabel).toBe('DA5 V5 Preview 2');
    expect(validateDa5V5TagBinding({
      tagA: '0123456789AB',
      tagB: '111111111111',
      tagX: 'ABCDEF012345',
      technology: 'NfcA',
    })).toEqual({
      tagA: '0123456789AB',
      tagB: '111111111111',
      tagX: 'ABCDEF012345',
      technology: 'NfcA',
    });
    expect(() => validateDa5V5TagBinding({
      tagA: '0123456789ab',
      tagB: '111111111111',
      tagX: 'ABCDEF012345',
      technology: 'NfcA',
    })).toThrow(/uppercase 12-hex/);
    expect(() => validateDa5V5TagBinding({
      tagA: '0123456789AB',
      tagB: '0123456789AB',
      tagX: 'ABCDEF012345',
      technology: 'NfcA',
    })).toThrow(/distinct/);
    expect(() => validateDa5V5TagBinding({
      tagA: '0123456789AB',
      tagB: '111111111111',
      tagX: 'ABCDEF012345',
      technology: 'MifareUltralight',
    })).toThrow(/manifest boundary/);
  });

  it('retains only a memory digest and reports match or mismatch', () => {
    const password = Buffer.from('a'.repeat(64), 'ascii');
    const binding = new Da5V5MemoryOnlyPasswordBinding(password);
    expect(binding.compare(Buffer.from(password))).toBe('match');
    expect(binding.compare(Buffer.from('b'.repeat(64), 'ascii'))).toBe('mismatch');
    binding.destroy();
    expect(binding.compare(Buffer.from(password))).toBe('mismatch');
    password.fill(0);
  });

  it('binds every terminal offline sequence to the exact target and NFC provenance',
    async () => {
      const binding = validateDa5V5TagBinding({
        tagA: '0123456789AB',
        tagB: '111111111111',
        tagX: 'ABCDEF012345',
        technology: 'NfcA',
      });
      const generalWorkTargetId = '22000000-0000-4000-8000-000000000705';
      const actualTagAId = '33000000-0000-4000-8000-000000000705';
      const actualAssignmentAId = '44000000-0000-4000-8000-000000000705';
      const manual = (
        deviceSequence: number,
        targetType: 'customer' | 'general_work' | 'project',
        targetId: string,
        decisionType: string,
      ) => ({
        assignment_id: null,
        decision_type: decisionType,
        device_sequence: String(deviceSequence),
        nfc_tag_id: null,
        review_reason: null,
        server_time_entry_id: '50000000-0000-4000-8000-000000000705',
        tag_fingerprint: null,
        target_id: targetId,
        target_type: targetType,
        time_entry_mutations: '1',
        trigger_type: 'manual',
      });
      const nfc = (
        deviceSequence: number,
        targetId: string,
        assignmentId: string,
        nfcTagId: string,
        tagFingerprint: string,
        decisionType: string | null,
        reviewReason: string | null,
      ) => ({
        assignment_id: assignmentId,
        decision_type: decisionType,
        device_sequence: String(deviceSequence),
        nfc_tag_id: nfcTagId,
        review_reason: reviewReason,
        server_time_entry_id: reviewReason === null
          ? '50000000-0000-4000-8000-000000000705'
          : null,
        tag_fingerprint: tagFingerprint,
        target_id: targetId,
        target_type: 'customer',
        time_entry_mutations: reviewReason === null ? '1' : '0',
        trigger_type: 'nfc',
      });
      const exactSequence = [
        nfc(
          1,
          syntheticIds.customer,
          actualAssignmentAId,
          actualTagAId,
          binding.tagA,
          'time_entry_started',
          null,
        ),
        manual(2, 'customer', syntheticIds.customer, 'time_entry_stopped'),
        manual(3, 'project', da5V5Ids.project, 'time_entry_started'),
        manual(4, 'project', da5V5Ids.project, 'time_entry_stopped'),
        manual(5, 'general_work', generalWorkTargetId, 'time_entry_started'),
        manual(6, 'general_work', generalWorkTargetId, 'time_entry_stopped'),
        nfc(
          7,
          syntheticIds.customer,
          actualAssignmentAId,
          actualTagAId,
          binding.tagA,
          'active_entry_for_other_target_rejected',
          null,
        ),
        nfc(
          8,
          syntheticIds.customer,
          actualAssignmentAId,
          actualTagAId,
          binding.tagA,
          null,
          'historical_configuration_not_valid',
        ),
        nfc(
          9,
          syntheticIds.reassignmentCustomer,
          da5V5Ids.assignmentB,
          da5V5Ids.tagB,
          binding.tagB,
          null,
          'predecessor_requires_review',
        ),
      ];
      const read = async (sequence: readonly Record<string, unknown>[]) => {
        const query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              installation_id: '82000000-0000-4000-8000-000000000705',
              last_durable_sequence: '9',
              review_predecessor_sequence: '8',
            }],
          })
          .mockResolvedValueOnce({ rows: [{ target_id: generalWorkTargetId }] })
          .mockResolvedValueOnce({
            rows: [{
              assignment_id: actualAssignmentAId,
              tag_id: actualTagAId,
            }],
          })
          .mockResolvedValueOnce({ rows: sequence })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] });
        const status = await readDa5V5InvariantStatus(
          { query } as unknown as Pick<Pool, 'query'>,
          binding,
        );
        return { query, status };
      };

      await expect(read(exactSequence)).resolves.toMatchObject({
        status: {
          ordinaryOfflineOrder: 'match',
          protectedReviewOrder: 'match',
          reviewPendingHasNoTimeMutation: 'match',
          tagBActiveEntryRetained: 'match',
          terminalFifoDrained: 'match',
        },
      });
      const targetDrift = exactSequence.map((row, index) => (
        index === 2 ? { ...row, target_id: syntheticIds.customer } : row
      ));
      await expect(read(targetDrift)).resolves.toMatchObject({
        status: { ordinaryOfflineOrder: 'mismatch' },
      });
      const tagDrift = exactSequence.map((row, index) => (
        index === 8 ? { ...row, tag_fingerprint: binding.tagA } : row
      ));
      await expect(read(tagDrift)).resolves.toMatchObject({
        status: { protectedReviewOrder: 'mismatch' },
      });
    });
});

describe('DA5 V5 serial Human checkpoints', () => {
  it('keeps the exact lean functional-to-accessibility checkpoint order', () => {
    expect(DA5_V5_CHECKPOINT_PLAN.map(({ checkpoint }) => checkpoint)).toEqual([
      'gate-a-setup-rejections',
      'gate-b-cold',
      'gate-b-duplicate',
      'gate-b-background',
      'gate-c-customer-first',
      'gate-c-customer-complete',
      'gate-c-project-first',
      'gate-c-project-complete',
      'gate-c-general-first',
      'gate-c-general-complete',
      'gate-d-customer-first-pending',
      'gate-d-customer-complete-pending',
      'gate-d-project-first-pending',
      'gate-d-project-complete-pending',
      'gate-d-general-first-pending',
      'gate-d-general-complete-pending',
      'gate-d-ordinary-relaunch',
      'gate-d-ordinary-synchronized',
      'gate-d-cancellation',
      'gate-d-fixture-tag-b-activated',
      'gate-d-fixture-tag-b-started',
      'gate-d-fixture-pre-cutover-pending',
      'gate-d-fixture-cutover',
      'gate-d-fixture-all-pending',
      'gate-d-protected-terminal',
      'gate-d-protected-relaunch',
      'gate-e-accessibility',
      'gate-f-final',
    ]);
  });

  it('binds the complete read-only Gate-E surface and reauthentication order', () => {
    expect(DA5_V5_ACCESSIBILITY_SURFACE_PLAN).toEqual([
      'protected-review-error',
      'auth-login',
      'administrator-setup',
      'employee-navigation',
      'employee-scan',
      'employee-manual-target',
      'employee-own-time',
      'employee-sync-pending',
    ]);
    const accessibility = new Da5V5AccessibilitySession();
    expect(accessibility.prepareProfileChange()).toBe('match');
    expect(accessibility.state().phase).toBe('profile-change-prepared');
    expect(accessibility.cleanupAllowed()).toBe(false);
    expect(accessibility.confirmAccessibilityProfile()).toBe('match');
    expect(accessibility.confirmSurface('protected-review-error', 'pass')).toBe('match');
    expect(accessibility.confirmSurface('auth-login', 'pass')).toBe('match');
    expect(accessibility.beginReauthentication('administrator')).toBe('match');
    expect(accessibility.reauthenticationIsInProgress('administrator')).toBe(true);
    expect(accessibility.completeReauthentication('administrator')).toBe('match');
    expect(accessibility.confirmSurface('administrator-setup', 'pass')).toBe('match');
    expect(accessibility.beginReauthentication('employee')).toBe('match');
    expect(accessibility.completeReauthentication('employee')).toBe('match');
    for (const surface of DA5_V5_ACCESSIBILITY_SURFACE_PLAN.slice(3)) {
      expect(accessibility.confirmSurface(surface, 'pass')).toBe('match');
    }
    expect(accessibility.surfacesComplete()).toBe(true);
    expect(accessibility.recordGateOutcome('pass')).toBe('match');
    expect(accessibility.restoreOnly()).toBe(true);
    expect(accessibility.cleanupAllowed()).toBe(false);
    expect(accessibility.confirmRestoreProof('match')).toBe('match');
    expect(accessibility.canProceedToGateF()).toBe(true);
    expect(accessibility.cleanupAllowed()).toBe(true);
    expect(accessibility.state()).toMatchObject({
      completedReauthentications: ['administrator', 'employee'],
      completedSurfaces: DA5_V5_ACCESSIBILITY_SURFACE_PLAN,
      gateOutcome: 'pass',
      nextSurface: null,
      phase: 'restored-pass',
      restoreProven: true,
    });
  });

  it('keeps a prepared Gate-E entry-boundary mismatch restore-only', () => {
    const accessibility = new Da5V5AccessibilitySession();
    expect(accessibility.prepareProfileChange()).toBe('match');
    expect(accessibility.requiresRestoreProof()).toBe(true);
    expect(accessibility.cleanupAllowed()).toBe(false);

    expect(accessibility.fail()).toBe('mismatch');
    expect(accessibility.state()).toMatchObject({
      completedSurfaces: [],
      gateOutcome: 'fail',
      phase: 'restore-required',
      restoreProven: false,
    });
    expect(accessibility.restoreOnly()).toBe(true);
    expect(accessibility.cleanupAllowed()).toBe(false);
    expect(accessibility.confirmRestoreProof('match')).toBe('match');
    expect(accessibility.terminalFailureRestored()).toBe(true);
    expect(accessibility.cleanupAllowed()).toBe(true);
  });

  it('keeps a pre-check accessibility cancel restore-only without retry or resume', () => {
    const accessibility = new Da5V5AccessibilitySession();
    expect(accessibility.prepareProfileChange()).toBe('match');
    expect(accessibility.profileChangePrepared()).toBe(true);

    expect(accessibility.fail()).toBe('mismatch');
    expect(accessibility.restoreOnly()).toBe(true);
    expect(accessibility.confirmAccessibilityProfile()).toBe('mismatch');
    expect(accessibility.restoreOnly()).toBe(true);
    expect(accessibility.cleanupAllowed()).toBe(false);
    expect(accessibility.confirmRestoreProof('match')).toBe('match');
    expect(accessibility.terminalFailureRestored()).toBe(true);
    expect(accessibility.canProceedToGateF()).toBe(false);
  });

  it.each(['fail', 'ambiguous', 'cancel'] as const)(
    'keeps %s terminal and recovery-only until exact standard restore proof',
    (outcome) => {
      const accessibility = new Da5V5AccessibilitySession();
      expect(accessibility.prepareProfileChange()).toBe('match');
      expect(accessibility.confirmAccessibilityProfile()).toBe('match');
      expect(accessibility.confirmSurface('protected-review-error', 'pass')).toBe('match');
      const result = outcome === 'cancel'
        ? accessibility.fail()
        : accessibility.recordGateOutcome(outcome);
      expect(result).toBe('mismatch');
      expect(accessibility.restoreOnly()).toBe(true);
      expect(accessibility.cleanupAllowed()).toBe(false);
      expect(accessibility.prepareProfileChange()).toBe('mismatch');
      expect(accessibility.confirmRestoreProof('mismatch')).toBe('mismatch');
      expect(accessibility.restoreOnly()).toBe(true);
      expect(accessibility.cleanupAllowed()).toBe(false);
      expect(accessibility.confirmRestoreProof('match')).toBe('match');
      expect(accessibility.terminalFailureRestored()).toBe(true);
      expect(accessibility.canProceedToGateF()).toBe(false);
      expect(accessibility.cleanupAllowed()).toBe(true);
    },
  );

  it('fails Gate E before Administrator Setup when its required reauth is absent', () => {
    const accessibility = new Da5V5AccessibilitySession();
    expect(accessibility.prepareProfileChange()).toBe('match');
    expect(accessibility.confirmAccessibilityProfile()).toBe('match');
    expect(accessibility.confirmSurface('protected-review-error', 'pass')).toBe('match');
    expect(accessibility.confirmSurface('auth-login', 'pass')).toBe('match');
    expect(accessibility.confirmSurface('administrator-setup', 'pass')).toBe('mismatch');
    expect(accessibility.state()).toMatchObject({
      gateOutcome: 'fail',
      phase: 'restore-required',
    });
  });

  it('converts a Gate-E PASS to terminal failure when the first restore proof is incomplete',
    () => {
      const accessibility = new Da5V5AccessibilitySession();
      expect(accessibility.prepareProfileChange()).toBe('match');
      expect(accessibility.confirmAccessibilityProfile()).toBe('match');
      for (const surface of DA5_V5_ACCESSIBILITY_SURFACE_PLAN) {
        if (surface === 'administrator-setup') {
          expect(accessibility.beginReauthentication('administrator')).toBe('match');
          expect(accessibility.completeReauthentication('administrator')).toBe('match');
        }
        if (surface === 'employee-navigation') {
          expect(accessibility.beginReauthentication('employee')).toBe('match');
          expect(accessibility.completeReauthentication('employee')).toBe('match');
        }
        expect(accessibility.confirmSurface(surface, 'pass')).toBe('match');
      }
      expect(accessibility.recordGateOutcome('pass')).toBe('match');
      expect(accessibility.confirmRestoreProof('mismatch')).toBe('mismatch');
      expect(accessibility.state().gateOutcome).toBe('fail');
      expect(accessibility.confirmRestoreProof('match')).toBe('match');
      expect(accessibility.terminalFailureRestored()).toBe(true);
    });

  it('requires Tag A to be actively assigned to exact Customer A before Tag B can be armed',
    () => {
      const exactRoles = {
        activeTagAAssignments: 1,
        activeTagACustomerAAssignments: 1,
        activeTagBAssignments: 0,
        tagAExactRecords: 1,
        tagARecords: 1,
        tagBExactRecords: 0,
        tagBRecords: 0,
        tagBTotalAssignments: 0,
        tagXRecords: 0,
      };
      expect(da5V5TagBRegistrationPreconditionMatches(
        DA5_V5_TAG_B_REGISTRATION_ARM_STATUS,
        exactRoles,
      )).toBe(true);
      expect(da5V5TagBRegistrationPreconditionMatches(
        DA5_V5_TAG_B_REGISTRATION_ARM_STATUS,
        { ...exactRoles, activeTagACustomerAAssignments: 0 },
      )).toBe(false);
    });

  it('uses the exact Main-command boundary for Tag B and permanently blocks fatal safe events',
    () => {
      const session = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
      const latch = new Da5V5SafeEventLatch();
      expect(latch.observe('da5_v5_tag_b_registration_armed')).toBe('continue');
      expect(latch.observe('da5_v5_tag_b_registered_unassigned')).toBe('continue');
      expect(da5V5TagBRegistrationArmIsAuthorized({
        commandAllowed: latch.commandAllowed(),
        credentialsCompleted: 3,
        credentialsRequired: 3,
        session,
        tagRegistrationState: 'disarmed',
      })).toBe(true);
      expect(da5V5TagBRegistrationArmIsAuthorized({
        commandAllowed: latch.commandAllowed(),
        credentialsCompleted: 2,
        credentialsRequired: 3,
        session,
        tagRegistrationState: 'disarmed',
      })).toBe(false);

      expect(latch.observe('api_session_unavailable')).toBe('failed');
      expect(latch.commandAllowed()).toBe(false);
      expect(latch.observe('da5_v5_tag_b_registration_armed')).toBe('failed');
      expect(da5V5TagBRegistrationArmIsAuthorized({
        commandAllowed: latch.commandAllowed(),
        credentialsCompleted: 3,
        credentialsRequired: 3,
        session,
        tagRegistrationState: 'disarmed',
      })).toBe(false);
    });

  it('invalidates an awaited command before it can report success after a fatal safe event',
    async () => {
      const latch = new Da5V5SafeEventLatch();
      const guard = new Da5V5CommandExecutionGuard(latch);
      let completeOperation: () => void = () => undefined;
      const operation = new Promise<void>((resolve) => {
        completeOperation = resolve;
      });
      const guarded = guard.wait(operation);

      expect(latch.observe('api_session_unavailable')).toBe('failed');
      completeOperation();

      await expect(guarded).rejects.toThrow(/invalidated by a safe failure/);
      expect(() => guard.ensure()).toThrow(/invalidated by a safe failure/);
    });

  it('invalidates an awaited command after external abort even without a safe event',
    async () => {
      const abort = new AbortController();
      const guard = new Da5V5CommandExecutionGuard(
        new Da5V5SafeEventLatch(),
        abort.signal,
      );
      let completeOperation = (): void => undefined;
      const operation = new Promise<void>((resolvePromise) => {
        completeOperation = resolvePromise;
      });
      const guarded = guard.wait(operation);

      abort.abort();
      completeOperation();

      await expect(guarded).rejects.toThrow(/invalidated by a safe failure/);
      expect(() => guard.ensure()).toThrow(/invalidated by a safe failure/);
    });

  it('observes exact aggregate/queue state before Human PASS advances every checkpoint', () => {
    const session = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    for (const step of DA5_V5_CHECKPOINT_PLAN) {
      for (const phase of dedupeChecksBefore[step.checkpoint] ?? []) {
        expect(session.authorizeDedupeCheck(phase)).toBe('match');
      }
      expect(session.state()).toMatchObject({
        failed: false,
        nextCheckpoint: step.checkpoint,
      });
      expect(session.observeCheckpoint(
        step.checkpoint,
        step.status,
        step.expectedQueueItems,
      )).toBe('match');
      expect(session.state().observedCheckpoint).toBe(step.checkpoint);
      expect(session.confirmCheckpoint(step.checkpoint, 'pass')).toBe('match');
      for (const phase of dedupeBaselinesAfter[step.checkpoint] ?? []) {
        expect(session.authorizeDedupeBaseline(phase)).toBe('match');
      }
    }
    const allDedupePhases = Object.keys(DA5_V5_DEDUPE_PHASES).sort();
    expect(session.state()).toEqual({
      checkedDedupePhases: allDedupePhases,
      confirmedCheckpoint: 'gate-f-final',
      failed: false,
      issuedDedupeBaselines: allDedupePhases,
      observedCheckpoint: null,
      nextCheckpoint: null,
      step: DA5_V5_CHECKPOINT_PLAN.length,
      terminal: true,
    });
  });

  it('latches failure on premature confirmation, FAIL/AMBIGUOUS, queue drift or reordering', () => {
    const missing = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    const first = DA5_V5_CHECKPOINT_PLAN[0]!;
    expect(missing.confirmCheckpoint(first.checkpoint, 'pass')).toBe('mismatch');
    expect(missing.state().failed).toBe(true);

    for (const result of ['fail', 'ambiguous'] as const) {
      const rejected = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
      expect(rejected.observeCheckpoint(
        first.checkpoint,
        first.status,
        first.expectedQueueItems,
      )).toBe('match');
      expect(rejected.confirmCheckpoint(first.checkpoint, result)).toBe('mismatch');
      expect(rejected.state().failed).toBe(true);
    }

    const reordered = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    expect(reordered.observeCheckpoint(
      DA5_V5_CHECKPOINT_PLAN[1]!.checkpoint,
      DA5_V5_CHECKPOINT_PLAN[1]!.status,
      DA5_V5_CHECKPOINT_PLAN[1]!.expectedQueueItems,
    )).toBe('mismatch');
    expect(reordered.state().failed).toBe(true);

    const queueDrift = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    expect(queueDrift.observeCheckpoint(
      first.checkpoint,
      first.status,
      first.expectedQueueItems + 1,
    )).toBe('mismatch');
    expect(queueDrift.state().failed).toBe(true);

    const missingDedupe = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    for (const step of DA5_V5_CHECKPOINT_PLAN.slice(0, 3)) {
      expect(missingDedupe.observeCheckpoint(
        step.checkpoint,
        step.status,
        step.expectedQueueItems,
      )).toBe('match');
      expect(missingDedupe.confirmCheckpoint(step.checkpoint, 'pass')).toBe('match');
    }
    expect(missingDedupe.observeCheckpoint(
      DA5_V5_CHECKPOINT_PLAN[3]!.checkpoint,
      DA5_V5_CHECKPOINT_PLAN[3]!.status,
      DA5_V5_CHECKPOINT_PLAN[3]!.expectedQueueItems,
    )).toBe('mismatch');
    expect(missingDedupe.state().failed).toBe(true);
  });

  it('phase-gates each dedupe baseline/check behind the exact confirmed Product step', () => {
    const valid = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    for (const step of DA5_V5_CHECKPOINT_PLAN.slice(0, 3)) {
      expect(valid.observeCheckpoint(
        step.checkpoint,
        step.status,
        step.expectedQueueItems,
      )).toBe('match');
      expect(valid.confirmCheckpoint(step.checkpoint, 'pass')).toBe('match');
    }
    expect(valid.authorizeDedupeBaseline('gate-b-customer')).toBe('match');
    expect(valid.authorizeDedupeCheck('gate-b-customer')).toBe('match');

    const early = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    expect(early.authorizeDedupeBaseline('gate-b-customer')).toBe('mismatch');
    expect(early.state().failed).toBe(true);

    const wrongPhase = new Da5V5OperationSession(DA5_V5_INITIAL_STATUS);
    for (const step of DA5_V5_CHECKPOINT_PLAN.slice(0, 3)) {
      wrongPhase.observeCheckpoint(step.checkpoint, step.status, step.expectedQueueItems);
      wrongPhase.confirmCheckpoint(step.checkpoint, 'pass');
    }
    expect(wrongPhase.authorizeDedupeBaseline('gate-c-customer')).toBe('mismatch');
    expect(wrongPhase.state().failed).toBe(true);
  });
});

const dedupeBaselinesAfter: Readonly<
  Partial<Record<Da5V5Checkpoint, readonly Da5V5DedupePhase[]>>
> = Object.freeze({
  'gate-b-duplicate': Object.freeze(['gate-b-customer'] as const),
  'gate-c-customer-first': Object.freeze(['gate-c-customer'] as const),
  'gate-c-project-first': Object.freeze(['gate-c-project'] as const),
  'gate-c-general-first': Object.freeze(['gate-c-general'] as const),
  'gate-d-customer-first-pending': Object.freeze(['gate-d-customer'] as const),
  'gate-d-project-first-pending': Object.freeze(['gate-d-project'] as const),
  'gate-d-general-first-pending': Object.freeze(['gate-d-general'] as const),
  'gate-d-fixture-tag-b-started': Object.freeze(['gate-d-tag-b'] as const),
  'gate-d-fixture-pre-cutover-pending': Object.freeze(['gate-d-tag-a'] as const),
});

const dedupeChecksBefore: Readonly<
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

describe('DA5 V5 PostgreSQL-server-clock dedupe slots', () => {
  it('supports the independent Tag-A and Tag-B slots concurrently and consumes each once',
    async () => {
      const query = vi.fn()
        .mockResolvedValueOnce({ rows: [{ now: '2026-07-25 08:00:00.000001+00' }] })
        .mockResolvedValueOnce({ rows: [{ now: '2026-07-25 08:00:01.000002+00' }] })
        .mockResolvedValueOnce({ rows: [{ elapsed: true }] })
        .mockResolvedValueOnce({ rows: [{ elapsed: true }] });
      const controller = new Da5V5DedupeWindowController(
        { query } as unknown as Pick<Pool, 'query'>,
      );

      await expect(controller.capture(
        'gate-d-tag-b',
        da5V5DedupeBinding('gate-d-tag-b'),
      )).resolves.toBe('match');
      await expect(controller.capture(
        'gate-d-tag-a',
        da5V5DedupeBinding('gate-d-tag-a'),
      )).resolves.toBe('match');
      expect(controller.state().activeSlots).toEqual([
        'gate-d-tag-a',
        'gate-d-tag-b',
      ]);

      await expect(controller.check(
        'gate-d-tag-a',
        da5V5DedupeBinding('gate-d-tag-a'),
      )).resolves.toBe('match');
      await expect(controller.check(
        'gate-d-tag-b',
        da5V5DedupeBinding('gate-d-tag-b'),
      )).resolves.toBe('match');
      expect(controller.state()).toMatchObject({
        activeSlots: [],
        consumedSlots: ['gate-d-tag-a', 'gate-d-tag-b'],
        failed: false,
  });
});

describe('DA5 V5 fixture, lifecycle and startup fail-stop boundaries', () => {
  it('arms the protected fixture only from the exact ordinary-terminal aggregate once', () => {
    const binding = validateDa5V5TagBinding({
      tagA: '0123456789AB',
      tagB: '111111111111',
      tagX: 'ABCDEF012345',
      technology: 'NfcA',
    });
    const ordinary = DA5_V5_CHECKPOINT_PLAN.find(
      ({ checkpoint }) => checkpoint === 'gate-d-cancellation',
    )!.status;
    const fixture = new Da5V5ProtectedReviewFixture({} as Pool, binding);
    expect(fixture.arm(ordinary, 0)).toBe('match');
    expect(fixture.state()).toBe('armed');
    expect(fixture.arm(ordinary, 0)).toBe('mismatch');
    expect(fixture.state()).toBe('failed');

    const drift = new Da5V5ProtectedReviewFixture({} as Pool, binding);
    expect(drift.arm({ ...ordinary, auditEvents: ordinary.auditEvents + 1 }, 0))
      .toBe('mismatch');
    expect(drift.state()).toBe('failed');

    const queued = new Da5V5ProtectedReviewFixture({} as Pool, binding);
    expect(queued.arm(ordinary, 1)).toBe('mismatch');

    const outOfOrder = new Da5V5ProtectedReviewFixture({} as Pool, binding);
    expect(outOfOrder.arm(DA5_V5_INITIAL_STATUS, 0)).toBe('mismatch');
  });

  it('refuses Tag-B activation when Tag A is not actively bound to exact Customer A',
    async () => {
      const binding = validateDa5V5TagBinding({
        tagA: '0123456789AB',
        tagB: '111111111111',
        tagX: 'ABCDEF012345',
        technology: 'NfcA',
      });
      const query = vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            active_entries: '0',
            review_markers: '0',
            tag_a_active: '1',
            tag_a_customer_a_active: '0',
            tag_b_active: '0',
            tag_b_assignments: '0',
            tag_b_exact_records: '1',
            tag_b_records: '1',
            tag_x_records: '0',
          }],
        })
        .mockResolvedValueOnce({ rows: [] });
      const release = vi.fn();
      const pool = {
        connect: vi.fn(async () => ({ query, release })),
      } as unknown as Pool;
      const fixture = new Da5V5ProtectedReviewFixture(pool, binding);
      const ordinary = DA5_V5_CHECKPOINT_PLAN.find(
        ({ checkpoint }) => checkpoint === 'gate-d-cancellation',
      )!.status;

      expect(fixture.arm(ordinary, 0)).toBe('match');
      await expect(fixture.activateTagB()).resolves.toBe('mismatch');
      expect(fixture.state()).toBe('failed');
      expect(query).toHaveBeenCalledTimes(3);
      expect(String(query.mock.calls[1]?.[0])).toContain(
        "assignment.target_customer_id = $5",
      );
      expect(release).toHaveBeenCalledTimes(1);
    });

  it('attempts every strict-cleanup stage serially and exposes only a generic failure',
    async () => {
      for (const failingStage of [0, 1, 2]) {
        const calls: string[] = [];
        await expect(runDa5V5StrictCleanup({
          closeResources: [
            async () => {
              calls.push('resource-1');
              if (failingStage === 0) {
                throw new Error('private first resource detail');
              }
            },
            async () => {
              calls.push('resource-2');
              if (failingStage === 1) {
                throw new Error('private second resource detail');
              }
            },
          ],
          closeCapabilityOwner: async () => {
            calls.push('capability-owner');
            if (failingStage === 2) {
              throw new Error('private database detail');
            }
          },
        })).rejects.toThrow('DA5 V5 cleanup failed');
        expect(calls).toEqual(['resource-1', 'resource-2', 'capability-owner']);
      }
    });

  it('retains completed stages and the terminal Product cleanup flight',
    async () => {
      const [main, environment, owner] = await Promise.all([
        readFile(new URL('../src/da5V5Main.ts', import.meta.url), 'utf8'),
        readFile(
          new URL('../src/SyntheticAndroidE2eEnvironment.ts', import.meta.url),
          'utf8',
        ),
        readFile(
          new URL('../src/Da5V5PostgresRuntimeGuard.ts', import.meta.url),
          'utf8',
        ),
      ]);

      expect(main).toContain('const completedCleanupStages = new Set<string>()');
      expect(main).toContain('completedCleanupStages.add(name)');
      expect(main).toContain(
        'cleanupResourcesPromise = startupAcquisitionSettlement.wait().then(',
      );
      expect(main).not.toContain('cleanupResourcesPromise = null;');
      expect(environment).toContain(
        'const completedDa5CloseStages = new Set<string>()',
      );
      expect(environment).toContain('completedDa5CloseStages.add(name)');
      expect(environment).toContain('da5ClosePromise = null');
      expect(owner).toContain('cleanupInFlight = null');
      expect(owner).toContain('firstFailure ??= error');
      expect(owner).toContain('stopAttempted = true');
    });

  it('preserves only the primary startup message with a generic cleanup marker', () => {
    const cleanupDetail = 'private-cleanup-detail';
    const result = da5V5StartupCleanupIncomplete(
      new Error('primary-startup-failure', {
        cause: new Error(cleanupDetail),
      }),
    );

    expect(result.message).toBe('primary-startup-failure;cleanup-incomplete');
    expect(result.cause).toBeUndefined();
    expect(JSON.stringify(result, Object.getOwnPropertyNames(result)))
      .not.toContain(cleanupDetail);
  });

  it.each([
    ['default', undefined],
    ['da4-v5', DA4_V5_PROFILE],
  ] as const)('preserves %s cleanup without the DA5 destructive re-guard',
    async (_label, cleanupProfile) => {
      const query = vi.fn().mockResolvedValue({ rows: [] });

      await expect(cleanSyntheticDatabase(
        { query } as unknown as Pool,
        cleanupProfile,
      )).resolves.toBeUndefined();

      const statements = query.mock.calls.map(([statement]) => String(statement));
      expect(statements[0]).toMatch(/\bDROP SCHEMA IF EXISTS\b/u);
      expect(statements).not.toEqual(expect.arrayContaining([
        expect.stringMatching(/\bcurrent_database\(\)/u),
      ]));
    });

  it('latches concurrent command failure, cleans once and never runs later work', async () => {
    const events: string[] = [];
    const firstCommand = deferred<{ readonly state: 'continue' }>();
    let operationSettled = false;
    const cleanup = vi.fn(async () => {
      expect(operationSettled).toBe(true);
    });
    const markFailed = vi.fn();
    const abort = vi.fn(() => {
      firstCommand.resolve({ state: 'continue' });
    });
    const lifecycle = new Da5V5OperatorLifecycle(
      cleanup,
      (event) => events.push(event),
      markFailed,
      abort,
    );
    const first = lifecycle.submit(async () => {
      try {
        return await firstCommand.promise;
      } finally {
        operationSettled = true;
      }
    });
    const concurrent = lifecycle.submit(async () => ({ state: 'continue' }));
    await Promise.all([first, concurrent]);

    const later = vi.fn(async () => ({ state: 'continue' as const }));
    await lifecycle.submit(later);
    expect(events).toEqual(['operator_command_rejected']);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(abort).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });

  it('aborts and settles an active command before external failure cleanup', async () => {
    const events: string[] = [];
    const operation = deferred<{ readonly state: 'continue' }>();
    let operationSettled = false;
    const abort = vi.fn(() => {
      operation.resolve({ state: 'continue' });
    });
    const closeInput = vi.fn();
    const cleanup = vi.fn(async () => {
      expect(operationSettled).toBe(true);
      expect(abort).toHaveBeenCalledTimes(1);
      expect(closeInput).toHaveBeenCalledTimes(1);
    });
    const lifecycle = new Da5V5OperatorLifecycle(
      cleanup,
      (event) => events.push(event),
      vi.fn(),
      abort,
      closeInput,
    );
    const command = lifecycle.submit(async () => {
      try {
        return await operation.promise;
      } finally {
        operationSettled = true;
      }
    });

    await Promise.all([
      command,
      lifecycle.abortAndFail('operator_command_failed'),
    ]);

    expect(events).toEqual(['operator_command_failed']);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('registers command settlement before a synchronous safe-event callback can fail it',
    async () => {
      const events: string[] = [];
      let commandSettled = false;
      const cleanup = vi.fn(async () => {
        expect(commandSettled).toBe(true);
      });
      const lifecycle = new Da5V5OperatorLifecycle(
        cleanup,
        (event) => events.push(event),
        vi.fn(),
        vi.fn(),
        vi.fn(),
      );

      await lifecycle.submit(async () => {
        void lifecycle.abortAndFail('operator_command_failed');
        commandSettled = true;
        return { state: 'continue' };
      });

      expect(events).toEqual(['operator_command_failed']);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

  it('latches startup and post-readiness signals without duplicate cleanup or stopped output',
    async () => {
      const startupEvents: string[] = [];
      const startupFailed = vi.fn();
      const startupSignal = new Da5V5SignalController(
        (event) => startupEvents.push(event),
        startupFailed,
      );
      await expect(startupSignal.handleSignal()).resolves.toBeUndefined();
      expect(() => startupSignal.checkpoint()).toThrow(Da5V5StartupInterrupted);
      expect(startupEvents).toEqual(['da5_v5_interrupted']);
      expect(startupFailed).toHaveBeenCalledTimes(1);

      const events: string[] = [];
      const startupSettlement = new Da5V5StartupSettlement();
      const cleanupAttempt = vi.fn(async () => undefined);
      let cleanupFlight: Promise<void> | null = null;
      const cleanup = (): Promise<void> => {
        cleanupFlight ??= startupSettlement.wait().then(() => cleanupAttempt());
        return cleanupFlight;
      };
      const failed = vi.fn();
      const lifecycle = new Da5V5OperatorLifecycle(
        cleanup,
        (event) => events.push(event),
        failed,
      );
      const signal = new Da5V5SignalController((event) => events.push(event), failed);
      signal.bind(lifecycle);
      startupSettlement.settle();
      startupSettlement.settle();
      const first = signal.handleSignal();
      const repeated = signal.handleSignal();
      expect(first).toBe(repeated);
      await Promise.all([first, repeated]);
      expect(events).toEqual(['da5_v5_interrupted']);
      expect(cleanupAttempt).toHaveBeenCalledTimes(1);
      expect(failed).toHaveBeenCalledTimes(1);
    });

  it.each([
    'runtime-guard',
    'postgres-capability',
    'environment',
  ] as const)(
    'waits for a late %s startup acquisition before coalesced signal cleanup',
    async (acquisitionStage) => {
      const startupSettlement = new Da5V5StartupSettlement();
      const acquisition = deferred<void>();
      const guard = fakeStartupResource();
      const capability = fakeStartupResource();
      const environmentResource = fakeStartupResource(() => capability.close());
      const guardRevalidate = vi.fn(async () => undefined);
      let runtimeGuard = acquisitionStage === 'runtime-guard' ? null : guard;
      let postgresCapability = acquisitionStage === 'environment' ? capability : null;
      let environment: ReturnType<typeof fakeStartupResource> | null = null;
      const cleanupAttempt = vi.fn(async () => {
        const activeEnvironment = environment;
        if (activeEnvironment !== null) {
          await activeEnvironment.close();
          environment = null;
        }
        const activeCapability = postgresCapability;
        if (activeCapability !== null) {
          await activeCapability.close();
          postgresCapability = null;
        }
        const activeGuard = runtimeGuard;
        if (activeGuard !== null) {
          await guardRevalidate();
          await activeGuard.close();
          runtimeGuard = null;
        }
      });
      let cleanupFlight: Promise<void> | null = null;
      const cleanupResources = (): Promise<void> => {
        cleanupFlight ??= startupSettlement.wait().then(() => cleanupAttempt());
        return cleanupFlight;
      };
      const events: string[] = [];
      const failed = vi.fn();
      const backgroundFailed = vi.fn();
      const mutationAbort = vi.fn();
      const closeInput = vi.fn();
      const signal = new Da5V5SignalController(
        (event) => events.push(event),
        failed,
      );
      let startupError: unknown;
      const startup = (async () => {
        try {
          await acquisition.promise;
          if (acquisitionStage === 'runtime-guard') {
            runtimeGuard = guard;
          } else if (acquisitionStage === 'postgres-capability') {
            postgresCapability = capability;
          } else {
            environment = environmentResource;
            postgresCapability = null;
          }
          signal.checkpoint();
        } catch (error: unknown) {
          startupError = error;
          startupSettlement.settle();
          await cleanupResources();
        }
      })();
      const terminate = (): Promise<void> => {
        mutationAbort();
        closeInput();
        return settleDa5V5BackgroundOperation(
          signal.handleSignal().finally(cleanupResources),
          backgroundFailed,
        );
      };

      const firstSignal = terminate();
      const repeatedSignal = terminate();
      await Promise.resolve();
      await Promise.resolve();

      expect(signal.isInterrupted()).toBe(true);
      expect(events).toEqual(['da5_v5_interrupted']);
      expect(failed).toHaveBeenCalledTimes(1);
      expect(mutationAbort).toHaveBeenCalledTimes(2);
      expect(closeInput).toHaveBeenCalledTimes(2);
      expect(cleanupAttempt).not.toHaveBeenCalled();

      acquisition.resolve();
      await expect(Promise.all([
        startup,
        firstSignal,
        repeatedSignal,
      ])).resolves.toEqual([undefined, undefined, undefined]);

      expect(startupError).toBeInstanceOf(Da5V5StartupInterrupted);
      expect(cleanupAttempt).toHaveBeenCalledTimes(1);
      expect(runtimeGuard).toBeNull();
      expect(postgresCapability).toBeNull();
      expect(environment).toBeNull();
      expect(guardRevalidate).toHaveBeenCalledTimes(1);
      expect(guard.close).toHaveBeenCalledTimes(1);
      expect(guard.isOpen()).toBe(false);
      expect(guard.listenerCount()).toBe(0);
      const capabilityWasAcquired = acquisitionStage !== 'runtime-guard';
      expect(capability.close).toHaveBeenCalledTimes(capabilityWasAcquired ? 1 : 0);
      expect(capability.isOpen()).toBe(!capabilityWasAcquired);
      expect(capability.listenerCount()).toBe(capabilityWasAcquired ? 0 : 1);
      const environmentWasAcquired = acquisitionStage === 'environment';
      expect(environmentResource.close).toHaveBeenCalledTimes(
        environmentWasAcquired ? 1 : 0,
      );
      expect(environmentResource.isOpen()).toBe(!environmentWasAcquired);
      expect(environmentResource.listenerCount()).toBe(
        environmentWasAcquired ? 0 : 1,
      );
      expect(backgroundFailed).not.toHaveBeenCalled();
    },
  );

  it('terminally settles signal and EOF paths when their persistent cleanup flight rejects',
    async () => {
      const events: string[] = [];
      const lifecycleFailed = vi.fn();
      const backgroundFailed = vi.fn();
      const cleanupAttempt = vi.fn(async () => {
        throw new Error('private persistent cleanup detail');
      });
      let cleanupFlight: Promise<void> | null = null;
      const cleanupResources = (): Promise<void> => {
        cleanupFlight ??= cleanupAttempt();
        return cleanupFlight;
      };
      const lifecycle = new Da5V5OperatorLifecycle(
        cleanupResources,
        (event) => events.push(event),
        lifecycleFailed,
      );
      const signal = new Da5V5SignalController(
        (event) => events.push(event),
        lifecycleFailed,
      );
      signal.bind(lifecycle);

      const signalPath = settleDa5V5BackgroundOperation(
        signal.handleSignal().finally(cleanupResources),
        backgroundFailed,
      );
      const repeatedSignalPath = settleDa5V5BackgroundOperation(
        signal.handleSignal().finally(cleanupResources),
        backgroundFailed,
      );
      const eofPath = settleDa5V5BackgroundOperation(
        lifecycle.abortAndFail('operator_command_failed').finally(cleanupResources),
        backgroundFailed,
      );

      await expect(Promise.all([
        signalPath,
        repeatedSignalPath,
        eofPath,
      ])).resolves.toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(cleanupAttempt).toHaveBeenCalledTimes(1);
      expect(backgroundFailed).toHaveBeenCalledTimes(3);
      expect(events.filter((event) => event === 'da5_v5_cleanup_failed'))
        .toHaveLength(1);
    });

  it('never rejects from the terminal background sink even when failure marking throws',
    async () => {
      await expect(settleDa5V5BackgroundOperation(
        Promise.reject(new Error('private background detail')),
        () => {
          throw new Error('private failure-marker detail');
        },
      )).resolves.toBeUndefined();
      await expect(settleDa5V5BackgroundOperation(
        undefined,
        vi.fn(),
      )).resolves.toBeUndefined();
    });

  it('keeps command and hidden credential input under one exclusive owner', () => {
    const ownership = new Da5V5InputOwnership();
    const command = fakeInterface();
    const secret = fakeInterface();
    ownership.attachCommand(command);
    const transferred = ownership.transferCommandToSecret(() => secret);
    expect(transferred).toBe(secret);
    expect(command.removeAllListeners).not.toHaveBeenCalled();
    expect(command.close).toHaveBeenCalledTimes(1);
    expect(ownership.mode()).toBe('secret');
    expect(() => ownership.attachCommand(command)).toThrow(/already has an owner/);
    ownership.releaseSecret(secret);
    expect(ownership.mode()).toBe('none');
    ownership.attachCommand(command);
    ownership.transferCommandToSecret(() => secret);
    ownership.closeAll();
    expect(ownership.mode()).toBe('secret');
    expect(() => ownership.attachCommand(command)).toThrow(/already has an owner/);
    expect(() => ownership.releaseSecret(secret)).not.toThrow();
    expect(ownership.mode()).toBe('none');
  });

  it('keeps profile and signal guards ahead of configuration and resource creation',
    async () => {
      const source = await readFile(new URL('../src/da5V5Main.ts', import.meta.url), 'utf8');
      const secretInputSource = await readFile(
        new URL('../src/Da5V5SecretInput.ts', import.meta.url),
        'utf8',
      );
      const rejection = 'rejectDa5V5OperationalInputs(process.env, process.argv);';
      const profileRequirement =
        'const profile = requireDa5V5Profile(process.env.TAPTIME_SYNTHETIC_E2E_PROFILE);';
      expect(source.indexOf(rejection)).toBeGreaterThanOrEqual(0);
      expect(source.indexOf(profileRequirement)).toBeGreaterThanOrEqual(0);
      expect(source.indexOf(rejection)).toBeLessThan(
        source.indexOf(profileRequirement),
      );
      expect(source.indexOf('verifyDa5V5RuntimeGuardArtifact({')).toBeLessThan(
        source.indexOf('createDa5V5LocalPostgresCapability({'),
      );
      expect(source.indexOf('createDa5V5LocalPostgresCapability({')).toBeLessThan(
        source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
      );
      expect(source).toContain('guardArtifactBinding: runtimeGuardArtifact');
      expect(source).not.toContain(
        'guardBinaryPath: runtimeGuardArtifact.manifest.binary.path',
      );
      expect(source).not.toContain('TAPTIME_SYNTHETIC_E2E_DATABASE_URL');
      expect(source).not.toContain('Da5V5CiPostgresAdapter');
      expect(source).not.toContain('produceDa5V5RuntimeGuardArtifact');
      expect(source.indexOf("process.on('SIGINT'")).toBeLessThan(
        source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
      );
      expect(source.indexOf("process.on('SIGTERM'")).toBeLessThan(
        source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
      );
      expect(source.indexOf("process.on('SIGHUP'")).toBeLessThan(
        source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
      );
      expect(source.indexOf("process.on('uncaughtException'")).toBeLessThan(
        source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
      );
      expect(source.indexOf("process.on('unhandledRejection'")).toBeLessThan(
        source.indexOf('environment = await createSyntheticAndroidE2eEnvironment('),
      );
      expect(source.indexOf('if (!safeEventLatch.commandAllowed())')).toBeLessThan(
        source.indexOf("if (normalized === 'status')"),
      );
      expect(source).toContain(
        'commandExecutionGuard.wait(activeEnvironment.armDa5V5TagBRegistration())',
      );
      expect(source).toContain(
        'activeEnvironment.da5V5FixtureArm(humanObservedQueueItems)',
      );
      expect(source).toContain(
        '/^protected-review-arm ([0-9]+)$/u.exec(normalized)',
      );
      expect(source).not.toContain('activeEnvironment.da5V5FixtureArm(0)');
      expect(source).toContain(
        "source: 'human-visible-product-observation'",
      );
      expect(source).toContain('mutationAbortController.abort()');
      expect(source).toContain(
        "operatorLifecycle?.abortAndFail('operator_command_failed')",
      );
      expect(source).toContain(
        'signalController.handleSignal().finally(() => cleanupResources())',
      );
      expect(source).toContain(
        'const startupAcquisitionSettlement = new Da5V5StartupSettlement()',
      );
      expect(source).toContain(
        'cleanupResourcesPromise = startupAcquisitionSettlement.wait().then(',
      );
      const lifecycleBinding = source.indexOf('signalController.bind(operatorLifecycle);');
      const successfulSettlement = source.indexOf(
        'startupAcquisitionSettlement.settle();',
        lifecycleBinding,
      );
      const postBindingSafeEvent = source.indexOf(
        'if (!safeEventLatch.commandAllowed())',
        lifecycleBinding,
      );
      expect(lifecycleBinding).toBeGreaterThanOrEqual(0);
      expect(successfulSettlement).toBeGreaterThan(lifecycleBinding);
      expect(successfulSettlement).toBeLessThan(postBindingSafeEvent);
      expect(source).toContain(
        "} catch {\n  startupAcquisitionSettlement.settle();\n  password = '';",
      );
      expect(source).toContain(
        'void settleDa5V5BackgroundOperation(operation, () => {',
      );
      expect(source).not.toMatch(/void\s+signalController\.handleSignal\(\)/u);
      expect(source).not.toMatch(/void\s+operatorLifecycle\?\.abortAndFail/u);
      expect(source).toContain('reverseState: offline.cleanupProofState()');
      expect(source).toContain("if (offline.arm() !== 'match')");
      expect(source.indexOf('await installDa5V5AndroidFromPackageZero({')).toBeLessThan(
        source.indexOf("if (offline.arm() !== 'match')"),
      );
      expect(source.match(/da5V5AndroidInstallFailureReceipt\(error\)/gu)).toHaveLength(2);
      expect(source).not.toContain('error.message');
      expect(source).not.toContain('String(error)');
      expect(source.indexOf("if (offline.arm() !== 'match')")).toBeLessThan(
        source.indexOf('androidInstalled = true'),
      );
      expect(source.match(/serialBinding: deviceLock/gu)).toHaveLength(6);
      expect(source).toContain(
        'let androidInstallTransaction = new Da5V5AndroidInstallTransaction({',
      );
      expect(source.match(/transaction: androidInstallTransaction/gu)).toHaveLength(2);
      expect(source).toContain(
        'const mobileInstallStreamAdb = mobileAdb.createInstallStreamRunner()',
      );
      expect(source).toContain(
        'new Da5V5ApiOfflineController(\n  adb,\n  standardBinding,\n  deviceLock,',
      );
      expect(source).toContain(
        'new Da5V5DeviceCheckpointController(\n  adb,\n  standardBinding,\n  accessibilityBinding,\n  deviceLock,',
      );
      expect(source).toContain(
        'employee-installation-transition-confirm <PASS|FAIL|AMBIGUOUS>',
      );
      expect(source).toContain(
        '/^employee-installation-transition-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized)',
      );
      expect(source).toContain(
        'const employeeInstallationTransition = new Da5V5EmployeeInstallationTransition()',
      );
      expect(source).toContain(
        'da5_v5_employee_installation_transition=${result}',
      );
      expect(source).toContain(
        'employeeInstallationTransition: employeeInstallationTransition.getState()',
      );
      expect(source).toContain(
        "nextCredentialPhase !== 2\n    || credentialState.phase !== null\n    || credentialState.state !== 'idle'",
      );
      expect(source).toContain(
        "activeEnvironment.da5V5TagRegistrationState() !== 'disarmed'",
      );
      expect(source).toContain(
        'sameDa5V5Status(status, DA5_V5_TAG_B_REGISTRATION_ARM_STATUS)',
      );
      expect(source).toContain(
        'da5V5TagBRegistrationPreconditionMatches(status, tagRoles)',
      );
      expect(source).toContain(
        'employeeInstallationBoundarySnapshotsMatch(preBoundary, postBoundary)',
      );
      expect(source).toContain(
        "phase !== 'employee' || employeeInstallationTransition.matched()",
      );
      expect(source).toContain(
        "phase === 'employee' && !employeeInstallationTransition.matched()",
      );
      expect(source).toContain(
        "case 'gate-a-setup-rejections': {\n      const tagRoles = await activeEnvironment.da5V5TagRoleState();\n      return employeeInstallationTransition.matched()",
      );
      const employeeTransitionStart = source.indexOf(
        'const employeeInstallationConfirmation =',
      );
      const transitionClose = source.indexOf(
        'closeOldOffline: async () => oldOffline.close()',
        employeeTransitionStart,
      );
      const transitionCleanup = source.indexOf(
        'cleanupOldInstallation: async () => {',
        employeeTransitionStart,
      );
      const transactionSwap = source.indexOf(
        'androidInstallTransaction = replacementTransaction;',
        employeeTransitionStart,
      );
      const replacementInstall = source.indexOf(
        'await installDa5V5AndroidFromPackageZero({',
        transactionSwap,
      );
      const replacementInstallFailureReceipt = source.indexOf(
        'process.stdout.write(da5V5AndroidInstallFailureReceipt(error));',
        replacementInstall,
      );
      const replacementInstallFailureStop = source.indexOf(
        "throw new Error('DA5 V5 Android replacement install command failed');",
        replacementInstallFailureReceipt,
      );
      const replacementArm = source.indexOf(
        "if (replacementOffline.arm() !== 'match')",
        replacementInstall,
      );
      const transitionPostcheck = source.indexOf(
        'postcheck: async () => {',
        replacementArm,
      );
      expect(employeeTransitionStart).toBeGreaterThanOrEqual(0);
      expect(transitionClose).toBeGreaterThan(employeeTransitionStart);
      expect(transitionCleanup).toBeGreaterThan(transitionClose);
      expect(transactionSwap).toBeGreaterThan(transitionCleanup);
      expect(replacementInstall).toBeGreaterThan(transactionSwap);
      expect(replacementInstallFailureReceipt).toBeGreaterThan(replacementInstall);
      expect(replacementInstallFailureStop).toBeGreaterThan(replacementInstallFailureReceipt);
      expect(replacementInstallFailureStop).toBeLessThan(replacementArm);
      expect(replacementArm).toBeGreaterThan(replacementInstall);
      expect(transitionPostcheck).toBeGreaterThan(replacementArm);
      const employeeTransitionBlock = source.slice(
        employeeTransitionStart,
        source.indexOf('const fieldReady =', employeeTransitionStart),
      );
      expect(employeeTransitionBlock).not.toMatch(/pm clear|--remove-all|backup|restore/iu);
      expect(employeeTransitionBlock).not.toContain(
        'androidInstallTransaction = oldTransaction',
      );
      expect(source).toContain(
        'credential-field-ready <administrator|enrollment|employee> EMPTY_ACTIVE',
      );
      expect(source).toContain(
        'credential-field-confirm <administrator|enrollment|employee> <VISIBLE|EMPTY|AMBIGUOUS>',
      );
      expect(source).toContain(
        "const credentialPhases = Object.freeze([\n  'administrator',\n  'enrollment',\n  'employee',\n] as const);",
      );
      const standardCredentialStart = source.indexOf(
        'const credential = /^credential-check',
      );
      const accessibilityFieldStart = source.indexOf(
        'const accessibilityFieldReady =',
      );
      const accessibilityCredentialStart = source.indexOf(
        'const accessibilityCredentialCheck =',
      );
      const accessibilityConfirmationStart = source.indexOf(
        'const accessibilityFieldConfirmation =',
      );
      const standardCredentialBlock = source.slice(
        standardCredentialStart,
        accessibilityFieldStart,
      );
      const accessibilityCredentialBlock = source.slice(
        accessibilityCredentialStart,
        accessibilityConfirmationStart,
      );
      expect(standardCredentialBlock).toContain(
        "process.stdout.write('synthetic_password_binding=match\\n')",
      );
      expect(standardCredentialBlock).not.toContain(
        'da5_v5_accessibility_password_binding=match',
      );
      expect(accessibilityCredentialBlock).toContain(
        "process.stdout.write('da5_v5_accessibility_password_binding=match\\n')",
      );
      expect(accessibilityCredentialBlock).not.toContain(
        "process.stdout.write('synthetic_password_binding=match\\n')",
      );
      expect(source.match(/synthetic_password_input_ready/gu)).toHaveLength(1);
      expect(source).toContain(
        "() => process.stdout.write('synthetic_password_input_ready\\n')",
      );
      expect(secretInputSource).not.toContain('removeAllListeners');
      expect(secretInputSource).not.toContain('setTimeout');
      expect(secretInputSource.indexOf('ownership.transferCommandToSecret('))
        .toBeLessThan(secretInputSource.indexOf('captureCredential(secretInput, input)'));
      expect(secretInputSource.indexOf('captureCredential(secretInput, input)'))
        .toBeLessThan(secretInputSource.indexOf('publishReady();'));
      expect(secretInputSource).toContain('observed.fill(0)');
      expect(secretInputSource).toContain(
        'if (Buffer.isBuffer(chunk)) chunk.fill(0);',
      );
      expect(source).toContain('da5_v5_accessibility_surface_plan=');
      expect(source).toContain('accessibility-prepare | accessibility-check');
      expect(source).toContain("if (normalized === 'accessibility-prepare')");
      expect(source).toContain(
        'da5_v5_accessibility_prepare=match restore_required=armed',
      );
      expect(source).toContain('accessibilitySession.prepareProfileChange()');
      expect(source).toContain('device.prepareAccessibilityProfileChange()');
      expect(source).toContain('accessibilitySession.profileChangePrepared()');
      expect(source).toContain('accessibilityGateCheckBoundaryMatches(');
      expect(source).toContain('accessibilitySession.confirmAccessibilityProfile()');
      expect(source).toContain(
        "if (!accessibilityGateCheckBoundaryMatches(activeSession, activeEnvironment)) {\n      return fail(activeSession, 'da5_v5_device_checkpoint=mismatch');\n    }",
      );
      expect(source).toContain('if (accessibilitySession.requiresRestoreProof())');
      expect(source).toContain('da5_v5_accessibility_restore_required=match');
      expect(source).toContain(
        'accessibility-credential-field-ready <administrator|employee> EMPTY_ACTIVE',
      );
      expect(source).toContain(
        'accessibility-credential-field-confirm <administrator|employee> <VISIBLE|EMPTY|AMBIGUOUS>',
      );
      expect(source).toContain('accessibility-surface-confirm <surface>');
      expect(source).toContain("if (normalized === 'accessibility-cancel')");
      expect(source).toContain("if (normalized !== 'standard-profile-check')");
      expect(source).toContain("await stage('accessibility-restore-proof'");
      expect(source).toContain('accessibilitySession.cleanupAllowed()');
      expect(source).toContain('accessibilitySession.canProceedToGateF()');
      expect(source.indexOf("if (normalized === 'accessibility-prepare')"))
        .toBeLessThan(source.indexOf("if (normalized === 'accessibility-check')"));
      expect(source).not.toContain('credential-paste-confirm');
      expect(source).not.toContain('Da5V5WebCredentialTransfer');
      expect(source.indexOf("'gate-d-protected-relaunch',")).toBeLessThan(
        source.indexOf("'gate-e-accessibility',"),
      );
      expect(source).toContain(
        "requiredEnvironmentValue('TAPTIME_DA5_V5_TALKBACK_PACKAGE')",
      );
      expect(source).toContain('requireDa5V5TalkBackPackage(');
      expect(source).toContain(
        "requiredEnvironmentValue('TAPTIME_DA5_V5_TALKBACK_VERSION')",
      );
      expect(source).not.toContain('TAPTIME_SYNTHETIC_E2E_PASSWORD=match');
    });
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function fakeStartupResource(
  closeOwned: () => Promise<void> = async () => undefined,
): {
  readonly close: () => Promise<void>;
  isOpen(): boolean;
  listenerCount(): number;
} {
  let open = true;
  let listeners = 1;
  const close = vi.fn(async () => {
    open = false;
    listeners = 0;
    await closeOwned();
  });
  return {
    close,
    isOpen: () => open,
    listenerCount: () => listeners,
  };
}

function fakeInterface(): Interface {
  return {
    close: vi.fn(),
    removeAllListeners: vi.fn(),
  } as unknown as Interface;
}

  it('uses only fresh server-clock queries and never a WorkEvent age query', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ now: '2026-07-25 08:00:00.999999+00' }] })
      .mockResolvedValueOnce({ rows: [{ elapsed: true }] });
    const controller = new Da5V5DedupeWindowController(
      { query } as unknown as Pick<Pool, 'query'>,
    );
    const binding = da5V5DedupeBinding('gate-c-project');

    await expect(controller.capture('gate-c-project', binding)).resolves.toBe('match');
    await expect(controller.check('gate-c-project', binding)).resolves.toBe('match');

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('transaction_timestamp');
    expect(query.mock.calls[1]?.[0]).toContain("interval '5 seconds'");
    expect(query.mock.calls[1]?.[1]).toEqual(['2026-07-25 08:00:00.999999+00']);
    expect(query.mock.calls.flat().join(' ')).not.toMatch(/work_events|occurred_at/i);
  });

  it.each([
    { name: 'exactly five seconds', elapsed: false },
    { name: 'less than five seconds', elapsed: false },
  ])('latches $name mismatch and destroys the slot', async ({ elapsed }) => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ now: '2026-07-25 08:00:00.000001+00' }] })
      .mockResolvedValueOnce({ rows: [{ elapsed }] });
    const controller = new Da5V5DedupeWindowController(
      { query } as unknown as Pick<Pool, 'query'>,
    );
    const binding = da5V5DedupeBinding('gate-b-customer');

    await controller.capture('gate-b-customer', binding);
    await expect(controller.check('gate-b-customer', binding)).resolves.toBe('mismatch');
    expect(controller.state()).toMatchObject({ activeSlots: [], failed: true });
    await expect(controller.capture('gate-c-customer',
      da5V5DedupeBinding('gate-c-customer'))).resolves.toBe('mismatch');
  });

  it('fails permanently for missing, reused or wrong target slots without querying a clock',
    async () => {
      const query = vi.fn();
      const controller = new Da5V5DedupeWindowController(
        { query } as unknown as Pick<Pool, 'query'>,
      );
      const wrong = { user: 'employee', target: 'project' } as const;
      await expect(controller.capture('gate-b-customer', wrong)).resolves.toBe('mismatch');
      await expect(controller.check(
        'gate-b-customer',
        DA5_V5_DEDUPE_PHASES['gate-b-customer'],
      )).resolves.toBe('mismatch');
      expect(query).not.toHaveBeenCalled();
    });

  it('converts server-clock failures and malformed results to mismatch without disclosure',
    async () => {
      const captureFailure = new Da5V5DedupeWindowController({
        query: vi.fn().mockRejectedValue(new Error('sensitive database detail')),
      } as unknown as Pick<Pool, 'query'>);
      await expect(captureFailure.capture(
        'gate-c-general',
        da5V5DedupeBinding('gate-c-general'),
      )).resolves.toBe('mismatch');
      expect(captureFailure.state().failed).toBe(true);

      const checkFailure = new Da5V5DedupeWindowController({
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ now: '2026-07-25 08:00:00.000001+00' }] })
          .mockRejectedValueOnce(new Error('sensitive database detail')),
      } as unknown as Pick<Pool, 'query'>);
      await checkFailure.capture('gate-c-project', da5V5DedupeBinding('gate-c-project'));
      await expect(checkFailure.check(
        'gate-c-project',
        da5V5DedupeBinding('gate-c-project'),
      )).resolves.toBe('mismatch');
      expect(checkFailure.state()).toMatchObject({
        activeSlots: [],
        consumedSlots: ['gate-c-project'],
        failed: true,
      });

      const malformed = new Da5V5DedupeWindowController({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as Pick<Pool, 'query'>);
      await expect(malformed.capture(
        'gate-b-customer',
        da5V5DedupeBinding('gate-b-customer'),
      )).resolves.toBe('mismatch');
      expect(malformed.state().failed).toBe(true);
    });
});
