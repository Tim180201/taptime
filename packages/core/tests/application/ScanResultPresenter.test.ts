import { describe, expect, it } from 'vitest';
import { ScanResultPresenter } from '../../src/application/ScanResultPresenter';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { authenticatedCaller } from '../../src/domain/CallerContext';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { TimeEntry } from '../../src/domain/TimeEntry';
import type { QueuedWorkEventRecord } from '../../src/domain/QueuedWorkEventRecord';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';
import type { Customer } from '../../src/domain/Customer';
import type { ScanPipelineOutcome } from '../../src/application/ScanPipelineOutcome';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const assignment: NfcAssignment = {
  id: NfcAssignmentId('assignment-1'),
  organizationId,
  nfcTagId: NfcTagId('tag-1'),
  target,
  active: true,
};
const customer: Customer = { id: CustomerId('customer-1'), organizationId, active: true };
const caller = authenticatedCaller(UserId('user-1'), organizationId);

const workEvent: WorkEvent = {
  id: WorkEventId('work-event-1'),
  organizationId,
  assignmentId: assignment.id,
  nfcTagId: assignment.nfcTagId,
  target,
  triggeredBy: UserId('user-1'),
  occurredAt: createTimestamp('2026-07-05T09:00:00.000Z'),
};

const timeEntry: TimeEntry = {
  id: TimeEntryId('time-entry-1'),
  workEventId: workEvent.id,
  organizationId,
  target,
  status: 'started',
  startedAt: createTimestamp('2026-07-05T09:00:01.000Z'),
};

function queuedRecord(decision: QueuedWorkEventRecord['decision'], syncState: QueuedWorkEventRecord['syncState'] = 'pending'): QueuedWorkEventRecord {
  return { workEvent, decision, syncState, queuedAt: createTimestamp('2026-07-05T09:00:02.000Z') };
}

describe('ScanResultPresenter (DT-011, TS-001 ScanResultPresenter)', () => {
  describe('presentScanOutcome', () => {
    it('renders an unreadable capture outcome', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = { stage: 'capture', status: 'unreadable' };

      expect(presenter.presentScanOutcome(outcome)).toBe('Scan rejected: unreadable NFC payload.');
    });

    it('renders an unknown_tag resolution rejection', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = {
        stage: 'resolution',
        status: 'rejected',
        reason: 'unknown_tag',
      };

      expect(presenter.presentScanOutcome(outcome)).toBe(
        'Scan rejected: the scanned tag is not known to this organization.',
      );
    });

    it('renders an inactive_assignment resolution rejection', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = {
        stage: 'resolution',
        status: 'rejected',
        reason: 'inactive_assignment',
      };

      expect(presenter.presentScanOutcome(outcome)).toBe('Scan rejected: the tag has no active assignment.');
    });

    it.each([
      ['employee_not_authenticated', 'the employee is not authenticated'],
      ['employee_lacks_organization_access', 'the employee does not have access to this organization'],
      ['missing_assignment_target', 'the assignment target could not be found'],
      ['assignment_target_disabled', 'the assignment target is disabled'],
    ] as const)('renders a %s validation rejection', (reason, description) => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = {
        stage: 'validation',
        result: { status: 'rejected', assignment, reason },
      };

      expect(presenter.presentScanOutcome(outcome)).toBe(`Scan rejected: ${description}.`);
    });

    it('renders an accepted validation outcome', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = {
        stage: 'validation',
        result: { status: 'accepted', assignment, target: customer, caller },
      };

      expect(presenter.presentScanOutcome(outcome)).toBe(
        'Scan accepted: assignment validated, awaiting Business Engine decision.',
      );
    });
  });

  describe('presentEvent', () => {
    it('renders WorkEventCreated', () => {
      const presenter = new ScanResultPresenter();

      expect(presenter.presentEvent({ type: 'WorkEventCreated', workEvent })).toBe(
        `WorkEvent ${workEvent.id} created for organization ${organizationId}.`,
      );
    });

    it('renders TimeEntryStarted', () => {
      const presenter = new ScanResultPresenter();

      expect(presenter.presentEvent({ type: 'TimeEntryStarted', timeEntry })).toBe(
        `TimeEntry ${timeEntry.id} started.`,
      );
    });

    it('renders WorkEventQueuedForSync distinctly for the time_entry_started decision branch', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord({
        status: 'time_entry_started',
        timeEntry,
        event: { type: 'TimeEntryStarted', timeEntry },
      });

      expect(presenter.presentEvent({ type: 'WorkEventQueuedForSync', record })).toBe(
        `WorkEvent ${workEvent.id} accepted and started (TimeEntry ${timeEntry.id}); queued for synchronization.`,
      );
    });

    it('renders WorkEventQueuedForSync distinctly for the escalation_required decision branch (accepted+escalated)', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord({
        status: 'escalation_required',
        reason: 'duplicate_scan_rule_undefined',
        workEvent,
      });

      expect(presenter.presentEvent({ type: 'WorkEventQueuedForSync', record })).toBe(
        `WorkEvent ${workEvent.id} accepted but escalated (duplicate_scan_rule_undefined); queued for synchronization.`,
      );
    });

    it('renders WorkEventQueuedForSync generically when no decision is present', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null);

      expect(presenter.presentEvent({ type: 'WorkEventQueuedForSync', record })).toBe(
        `WorkEvent ${workEvent.id} queued for synchronization (state: pending).`,
      );
    });

    it('renders WorkEventSynchronized', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null, 'synchronized');

      expect(presenter.presentEvent({ type: 'WorkEventSynchronized', record })).toBe(
        `WorkEvent ${workEvent.id} synchronized successfully.`,
      );
    });

    it('renders a retryable WorkEventSyncFailed, distinct from a conflict', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null, 'pending');

      expect(
        presenter.presentEvent({
          type: 'WorkEventSyncFailed',
          record,
          outcome: 'retryable_failure',
          reason: 'network timeout',
        }),
      ).toBe(`WorkEvent ${workEvent.id} synchronization failed (retryable, reason: network timeout).`);
    });

    it('renders a conflict WorkEventSyncFailed, distinct from a retryable failure', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null, 'failed');

      expect(
        presenter.presentEvent({
          type: 'WorkEventSyncFailed',
          record,
          outcome: 'conflict',
          reason: 'remote record already modified',
        }),
      ).toBe(`WorkEvent ${workEvent.id} has a synchronization conflict: remote record already modified.`);
    });
  });

  // DT-009: additive coverage only - presentScanOutcome()/presentEvent() above are untouched.
  describe('presentScanOutcomeWithCategory', () => {
    it('pairs the unchanged rejection message with its recoverable category for an unreadable capture', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = { stage: 'capture', status: 'unreadable' };

      expect(presenter.presentScanOutcomeWithCategory(outcome)).toEqual({
        message: 'Scan rejected: unreadable NFC payload.',
        category: 'recoverable',
      });
    });

    it('pairs a fatal validation rejection with its unchanged message', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = {
        stage: 'validation',
        result: { status: 'rejected', assignment, reason: 'assignment_target_disabled' },
      };

      expect(presenter.presentScanOutcomeWithCategory(outcome)).toEqual({
        message: 'Scan rejected: the assignment target is disabled.',
        category: 'fatal',
      });
    });

    it('pairs an accepted outcome with a null category (not an error)', () => {
      const presenter = new ScanResultPresenter();
      const outcome: ScanPipelineOutcome = {
        stage: 'validation',
        result: { status: 'accepted', assignment, target: customer, caller },
      };

      expect(presenter.presentScanOutcomeWithCategory(outcome)).toEqual({
        message: 'Scan accepted: assignment validated, awaiting Business Engine decision.',
        category: null,
      });
    });
  });

  describe('presentEventWithCategory', () => {
    it('pairs a fact event (WorkEventCreated) with a null category', () => {
      const presenter = new ScanResultPresenter();

      expect(presenter.presentEventWithCategory({ type: 'WorkEventCreated', workEvent })).toEqual({
        message: `WorkEvent ${workEvent.id} created for organization ${organizationId}.`,
        category: null,
      });
    });

    it('pairs a queued-for-sync event carrying an escalation_required decision with deferred', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord({
        status: 'escalation_required',
        reason: 'duplicate_scan_rule_undefined',
        workEvent,
      });

      expect(presenter.presentEventWithCategory({ type: 'WorkEventQueuedForSync', record })).toEqual({
        message: `WorkEvent ${workEvent.id} accepted but escalated (duplicate_scan_rule_undefined); queued for synchronization.`,
        category: 'deferred',
      });
    });

    it('pairs a queued-for-sync event carrying a time_entry_started decision with a null category', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord({
        status: 'time_entry_started',
        timeEntry,
        event: { type: 'TimeEntryStarted', timeEntry },
      });

      expect(presenter.presentEventWithCategory({ type: 'WorkEventQueuedForSync', record }).category).toBeNull();
    });

    it('pairs a successful synchronization with a null category', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null, 'synchronized');

      expect(presenter.presentEventWithCategory({ type: 'WorkEventSynchronized', record })).toEqual({
        message: `WorkEvent ${workEvent.id} synchronized successfully.`,
        category: null,
      });
    });

    it('pairs a retryable sync failure with retryable, distinct from a conflict', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null, 'pending');

      expect(
        presenter.presentEventWithCategory({
          type: 'WorkEventSyncFailed',
          record,
          outcome: 'retryable_failure',
          reason: 'network timeout',
        }).category,
      ).toBe('retryable');
    });

    it('pairs a sync conflict with conflict, distinct from a retryable failure', () => {
      const presenter = new ScanResultPresenter();
      const record = queuedRecord(null, 'failed');

      expect(
        presenter.presentEventWithCategory({
          type: 'WorkEventSyncFailed',
          record,
          outcome: 'conflict',
          reason: 'remote record already modified',
        }).category,
      ).toBe('conflict');
    });
  });
});
