import { B3_SCHEMA } from '@taptime/backend-schema';
import type { Pool, PoolClient } from 'pg';
import {
  DA5_V5_PUBLIC_MANIFEST,
  type Da5V5TagBinding,
} from './Da5V5Profile.js';
import { appendFixtureAudit } from './Da5V5ScanContextResolver.js';
import { da5V5Ids, syntheticIds } from './constants.js';

export interface Da5V5Status {
  readonly activeAssignments: number;
  readonly activeOtherTargetDecisions: number;
  readonly activeTimeEntries: number;
  readonly adminSetupReceipts: number;
  readonly auditEvents: number;
  readonly canonicalDecisions: number;
  readonly customers: number;
  readonly duplicateDecisions: number;
  readonly fixtureAuditEvents: number;
  readonly generalWorkTargets: number;
  readonly manualWorkEvents: number;
  readonly nfcWorkEvents: number;
  readonly offlineReconciliations: number;
  readonly projectReceipts: number;
  readonly projects: number;
  readonly reviewHistoricalConfiguration: number;
  readonly reviewMarkers: number;
  readonly reviewPredecessors: number;
  readonly stoppedTimeEntries: number;
  readonly syncReceipts: number;
  readonly tags: number;
  readonly timeEntries: number;
  readonly totalAssignments: number;
  readonly workEvents: number;
}

export type Da5V5NamedInvariant = 'match' | 'mismatch' | 'pending';

export interface Da5V5InvariantStatus {
  readonly ordinaryOfflineOrder: Da5V5NamedInvariant;
  readonly protectedReviewOrder: Da5V5NamedInvariant;
  readonly reviewPendingHasNoTimeMutation: Da5V5NamedInvariant;
  readonly tagBActiveEntryRetained: Da5V5NamedInvariant;
  readonly terminalFifoDrained: Da5V5NamedInvariant;
}

export interface Da5V5TagASetupIdentity {
  readonly assignmentId: string;
  readonly tagId: string;
}

export const DA5_V5_INITIAL_STATUS = Object.freeze<Da5V5Status>({
  activeAssignments: 0,
  activeOtherTargetDecisions: 0,
  activeTimeEntries: 0,
  adminSetupReceipts: 0,
  auditEvents: 0,
  canonicalDecisions: 0,
  customers: 2,
  duplicateDecisions: 0,
  fixtureAuditEvents: 0,
  generalWorkTargets: 1,
  manualWorkEvents: 0,
  nfcWorkEvents: 0,
  offlineReconciliations: 0,
  projectReceipts: 0,
  projects: 1,
  reviewHistoricalConfiguration: 0,
  reviewMarkers: 0,
  reviewPredecessors: 0,
  stoppedTimeEntries: 0,
  syncReceipts: 0,
  tags: 0,
  timeEntries: 0,
  totalAssignments: 0,
  workEvents: 0,
});

export const DA5_V5_TAG_B_REGISTRATION_ARM_STATUS = Object.freeze<Da5V5Status>({
  activeAssignments: 1,
  activeOtherTargetDecisions: 0,
  activeTimeEntries: 0,
  adminSetupReceipts: 1,
  auditEvents: 2,
  canonicalDecisions: 0,
  customers: 2,
  duplicateDecisions: 0,
  fixtureAuditEvents: 0,
  generalWorkTargets: 1,
  manualWorkEvents: 0,
  nfcWorkEvents: 0,
  offlineReconciliations: 0,
  projectReceipts: 0,
  projects: 1,
  reviewHistoricalConfiguration: 0,
  reviewMarkers: 0,
  reviewPredecessors: 0,
  stoppedTimeEntries: 0,
  syncReceipts: 0,
  tags: 1,
  timeEntries: 0,
  totalAssignments: 1,
  workEvents: 0,
});

export async function seedDa5V5Fixture(pool: Pool): Promise<void> {
  await pool.query(
    `INSERT INTO ${B3_SCHEMA}.projects
       (id, organization_id, display_name, active)
     VALUES ($1, $2, $3, true)`,
    [
      da5V5Ids.project,
      syntheticIds.organization,
      DA5_V5_PUBLIC_MANIFEST.projectLabel,
    ],
  );
  const status = await readDa5V5Status(pool);
  assertDa5V5InitialStatus(status);
}

export async function readDa5V5Status(pool: Pick<Pool, 'query'>): Promise<Da5V5Status> {
  const result = await pool.query<Record<keyof Da5V5Status, string>>(`
    SELECT
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_assignments WHERE active)
        AS "activeAssignments",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions
       WHERE decision_type = 'active_entry_for_other_target_rejected')
        AS "activeOtherTargetDecisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries WHERE status = 'started')
        AS "activeTimeEntries",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.admin_setup_command_receipts)
        AS "adminSetupReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS "auditEvents",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions)
        AS "canonicalDecisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.customers) AS "customers",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions
       WHERE decision_type = 'duplicate_scan_ignored') AS "duplicateDecisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events
       WHERE payload ->> 'fixture' = 'da5-v5-protected-review')
        AS "fixtureAuditEvents",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.work_targets
       WHERE target_type = 'general_work' AND active) AS "generalWorkTargets",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events
       WHERE trigger_type = 'manual') AS "manualWorkEvents",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events
       WHERE trigger_type = 'nfc') AS "nfcWorkEvents",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_event_reconciliations)
        AS "offlineReconciliations",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.project_command_receipts)
        AS "projectReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.projects) AS "projects",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_event_reconciliations
       WHERE result_status = 'review_pending'
         AND review_reason = 'historical_configuration_not_valid')
        AS "reviewHistoricalConfiguration",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_sync_cursors
       WHERE review_predecessor_sequence IS NOT NULL) AS "reviewMarkers",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_event_reconciliations
       WHERE result_status = 'review_pending'
         AND review_reason = 'predecessor_requires_review')
        AS "reviewPredecessors",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries WHERE status = 'stopped')
        AS "stoppedTimeEntries",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.sync_receipts) AS "syncReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_tags) AS "tags",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries) AS "timeEntries",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_assignments) AS "totalAssignments",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS "workEvents"
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('DA5 V5 status query returned no result');
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)]),
  ) as unknown as Da5V5Status);
}

export async function readDa5V5InvariantStatus(
  pool: Pick<Pool, 'query'>,
  binding: Da5V5TagBinding,
): Promise<Da5V5InvariantStatus> {
  const installation = await pool.query<{
    installation_id: string;
    last_durable_sequence: string;
    review_predecessor_sequence: string | null;
  }>(
    `SELECT installation_id, last_durable_sequence::text,
            review_predecessor_sequence::text
     FROM ${B3_SCHEMA}.offline_sync_cursors
     WHERE organization_id = $1 AND user_id = $2
     ORDER BY last_durable_sequence DESC`,
    [syntheticIds.organization, syntheticIds.user],
  );
  if (installation.rows.length === 0) {
    return pendingDa5V5Invariants();
  }
  if (installation.rows.length !== 1 || installation.rows[0] === undefined) {
    return mismatchDa5V5Invariants();
  }
  const cursor = installation.rows[0];
  const generalWorkTarget = await pool.query<{ target_id: string }>(
    `SELECT target_id::text
     FROM ${B3_SCHEMA}.work_targets
     WHERE organization_id = $1
       AND target_type = 'general_work'
       AND display_name = $2
       AND active
       AND built_in`,
    [
      syntheticIds.organization,
      DA5_V5_PUBLIC_MANIFEST.generalWorkLabel,
    ],
  );
  const generalWorkTargetId = generalWorkTarget.rows.length === 1
    ? generalWorkTarget.rows[0]?.target_id
    : undefined;
  const tagASetupIdentity = await readDa5V5TagASetupIdentity(pool, binding);
  const sequence = await pool.query<{
    assignment_id: string | null;
    decision_type: string | null;
    device_sequence: string;
    nfc_tag_id: string | null;
    review_reason: string | null;
    server_time_entry_id: string | null;
    target_id: string;
    target_type: string;
    tag_fingerprint: string | null;
    trigger_type: string;
    time_entry_mutations: string;
  }>(
    `SELECT reconciliation.device_sequence::text,
            reconciliation.review_reason,
            reconciliation.server_time_entry_id,
            work_event.assignment_id::text,
            work_event.nfc_tag_id::text,
            work_event.target_customer_id::text AS target_id,
            work_event.target_type,
            work_event.trigger_type,
            nfc_tag.validation_fingerprint AS tag_fingerprint,
            decision.decision_type,
            (
              SELECT count(*)::text
              FROM ${B3_SCHEMA}.time_entries AS entry
              WHERE entry.organization_id = reconciliation.organization_id
                AND (
                  entry.start_work_event_id = reconciliation.work_event_id
                  OR entry.stop_work_event_id = reconciliation.work_event_id
                )
            ) AS time_entry_mutations
     FROM ${B3_SCHEMA}.offline_event_reconciliations AS reconciliation
     JOIN ${B3_SCHEMA}.work_events AS work_event
       ON work_event.organization_id = reconciliation.organization_id
      AND work_event.id = reconciliation.work_event_id
     LEFT JOIN ${B3_SCHEMA}.nfc_tags AS nfc_tag
       ON nfc_tag.organization_id = work_event.organization_id
      AND nfc_tag.id = work_event.nfc_tag_id
     LEFT JOIN ${B3_SCHEMA}.canonical_decisions AS decision
       ON decision.organization_id = reconciliation.organization_id
      AND decision.work_event_id = reconciliation.work_event_id
     WHERE reconciliation.organization_id = $1
       AND reconciliation.installation_id = $2
       AND reconciliation.user_id = $3
     ORDER BY reconciliation.device_sequence`,
    [
      syntheticIds.organization,
      cursor.installation_id,
      syntheticIds.user,
    ],
  );
  const ordinary = sequence.rows.slice(0, 6);
  const protectedRows = sequence.rows.slice(6, 9);
  const ordinaryState = sequence.rows.length < 6
    ? 'pending'
    : generalWorkTargetId !== undefined
      && tagASetupIdentity !== null
      && sequenceMatches(ordinary, [
        expectedNfcSequence(
          '1',
          syntheticIds.customer,
          tagASetupIdentity.assignmentId,
          tagASetupIdentity.tagId,
          binding.tagA,
          'time_entry_started',
        ),
        expectedManualSequence(
          '2',
          'customer',
          syntheticIds.customer,
          'time_entry_stopped',
        ),
        expectedManualSequence(
          '3',
          'project',
          da5V5Ids.project,
          'time_entry_started',
        ),
        expectedManualSequence(
          '4',
          'project',
          da5V5Ids.project,
          'time_entry_stopped',
        ),
        expectedManualSequence(
          '5',
          'general_work',
          generalWorkTargetId,
          'time_entry_started',
        ),
        expectedManualSequence(
          '6',
          'general_work',
          generalWorkTargetId,
          'time_entry_stopped',
        ),
      ])
      ? 'match'
      : 'mismatch';
  const protectedState = sequence.rows.length < 9
    ? 'pending'
    : tagASetupIdentity !== null && sequenceMatches(protectedRows, [
        expectedNfcSequence(
          '7',
          syntheticIds.customer,
          tagASetupIdentity.assignmentId,
          tagASetupIdentity.tagId,
          binding.tagA,
          'active_entry_for_other_target_rejected',
        ),
        expectedNfcReviewSequence(
          '8',
          syntheticIds.customer,
          tagASetupIdentity.assignmentId,
          tagASetupIdentity.tagId,
          binding.tagA,
          'historical_configuration_not_valid',
        ),
        expectedNfcReviewSequence(
          '9',
          syntheticIds.reassignmentCustomer,
          da5V5Ids.assignmentB,
          da5V5Ids.tagB,
          binding.tagB,
          'predecessor_requires_review',
        ),
      ])
      ? 'match'
      : 'mismatch';
  const reviewRows = protectedRows.slice(1);
  const reviewNoMutation = sequence.rows.length < 9
    ? 'pending'
    : reviewRows.length === 2 && reviewRows.every((row) => (
        row.server_time_entry_id === null && row.time_entry_mutations === '0'
      ))
      ? 'match'
      : 'mismatch';
  const activeTagB = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM ${B3_SCHEMA}.time_entries AS entry
     JOIN ${B3_SCHEMA}.work_events AS event
       ON event.organization_id = entry.organization_id
      AND event.id = entry.start_work_event_id
     JOIN ${B3_SCHEMA}.nfc_tags AS tag
       ON tag.organization_id = event.organization_id
      AND tag.id = event.nfc_tag_id
     WHERE entry.organization_id = $1
       AND entry.user_id = $2
       AND entry.status = 'started'
       AND entry.target_type = 'customer'
       AND entry.target_customer_id = $3
       AND entry.started_via = 'nfc'
       AND event.nfc_tag_id = $4
       AND event.assignment_id = $5
       AND tag.validation_fingerprint = $6`,
    [
      syntheticIds.organization,
      syntheticIds.user,
      syntheticIds.reassignmentCustomer,
      da5V5Ids.tagB,
      da5V5Ids.assignmentB,
      binding.tagB,
    ],
  );
  const tagBState = sequence.rows.length < 7
    ? 'pending'
    : activeTagB.rows[0]?.count === '1' ? 'match' : 'mismatch';
  const fifoState = sequence.rows.length < 9
    ? 'pending'
    : (
      sequence.rows.length === 9
      && cursor.last_durable_sequence === '9'
      && cursor.review_predecessor_sequence === '8'
    )
      ? 'match'
      : 'mismatch';
  return Object.freeze({
    ordinaryOfflineOrder: ordinaryState,
    protectedReviewOrder: protectedState,
    reviewPendingHasNoTimeMutation: reviewNoMutation,
    tagBActiveEntryRetained: tagBState,
    terminalFifoDrained: fifoState,
  });
}

export async function readDa5V5TagASetupIdentity(
  pool: Pick<Pool, 'query'>,
  binding: Da5V5TagBinding,
): Promise<Da5V5TagASetupIdentity | null> {
  const result = await pool.query<{
    assignment_id: string;
    tag_id: string;
  }>(
    `SELECT assignment.id::text AS assignment_id, tag.id::text AS tag_id
     FROM ${B3_SCHEMA}.nfc_tags AS tag
     JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
       ON assignment.organization_id = tag.organization_id
      AND assignment.nfc_tag_id = tag.id
     WHERE tag.organization_id = $1
       AND tag.validation_fingerprint = $2
       AND tag.display_name = $3
       AND assignment.target_type = 'customer'
       AND assignment.target_customer_id = $4`,
    [
      syntheticIds.organization,
      binding.tagA,
      DA5_V5_PUBLIC_MANIFEST.tagALabel,
      syntheticIds.customer,
    ],
  );
  const row = result.rows.length === 1 ? result.rows[0] : undefined;
  return row === undefined
    ? null
    : Object.freeze({
        assignmentId: row.assignment_id,
        tagId: row.tag_id,
      });
}

export function assertDa5V5InitialStatus(status: Da5V5Status): void {
  if (!sameDa5V5Status(status, DA5_V5_INITIAL_STATUS)) {
    throw new Error('DA5 V5 initial aggregate invariant failed');
  }
}

export function sameDa5V5Status(left: Da5V5Status, right: Da5V5Status): boolean {
  const keys = Object.keys(DA5_V5_INITIAL_STATUS) as Array<keyof Da5V5Status>;
  return Object.keys(left).length === keys.length
    && Object.keys(right).length === keys.length
    && keys.every((key) => left[key] === right[key]);
}

export type Da5V5ProtectedFixtureState =
  | 'disarmed'
  | 'armed'
  | 'tag-b-active'
  | 'cutover-complete'
  | 'terminal'
  | 'failed';

export class Da5V5ProtectedReviewFixture {
  private currentState: Da5V5ProtectedFixtureState = 'disarmed';

  constructor(
    private readonly pool: Pool,
    private readonly binding: Da5V5TagBinding,
  ) {}

  state(): Da5V5ProtectedFixtureState {
    return this.currentState;
  }

  arm(status: Da5V5Status, deviceQueueItems: number): 'match' | 'mismatch' {
    if (
      this.currentState !== 'disarmed'
      || deviceQueueItems !== 0
      || !sameDa5V5Status(status, DA5_V5_PROTECTED_FIXTURE_ARM_STATUS)
    ) {
      return this.fail();
    }
    this.currentState = 'armed';
    return 'match';
  }

  async activateTagB(): Promise<'match' | 'mismatch'> {
    if (this.currentState !== 'armed') {
      return this.fail();
    }
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      transactionOpen = true;
      const precondition = await client.query<{
        active_entries: string;
        review_markers: string;
        tag_a_active: string;
        tag_a_customer_a_active: string;
        tag_b_active: string;
        tag_b_assignments: string;
        tag_b_exact_records: string;
        tag_b_records: string;
        tag_x_records: string;
      }>(
        `SELECT
           (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries WHERE status = 'started')
             AS active_entries,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_sync_cursors
            WHERE review_predecessor_sequence IS NOT NULL) AS review_markers,
           (SELECT count(*)::text
            FROM ${B3_SCHEMA}.nfc_tags AS tag
            JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
              ON assignment.organization_id = tag.organization_id
             AND assignment.nfc_tag_id = tag.id
             AND assignment.active
           WHERE tag.organization_id = $1 AND tag.validation_fingerprint = $2)
             AS tag_a_active,
           (SELECT count(*)::text
            FROM ${B3_SCHEMA}.nfc_tags AS tag
            JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
              ON assignment.organization_id = tag.organization_id
             AND assignment.nfc_tag_id = tag.id
             AND assignment.active
            WHERE tag.organization_id = $1
              AND tag.validation_fingerprint = $2
              AND assignment.target_type = 'customer'
              AND assignment.target_customer_id = $5)
             AS tag_a_customer_a_active,
           (SELECT count(*)::text
            FROM ${B3_SCHEMA}.nfc_tags AS tag
            JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
              ON assignment.organization_id = tag.organization_id
             AND assignment.nfc_tag_id = tag.id
             AND assignment.active
            WHERE tag.organization_id = $1 AND tag.validation_fingerprint = $3)
             AS tag_b_active,
           (SELECT count(*)::text
            FROM ${B3_SCHEMA}.nfc_tags AS tag
            JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
              ON assignment.organization_id = tag.organization_id
             AND assignment.nfc_tag_id = tag.id
            WHERE tag.organization_id = $1 AND tag.validation_fingerprint = $3)
             AS tag_b_assignments,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_tags
            WHERE organization_id = $1
              AND validation_fingerprint = $3
              AND id = $6
              AND display_name = $7) AS tag_b_exact_records,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_tags
            WHERE organization_id = $1 AND validation_fingerprint = $3) AS tag_b_records,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_tags
            WHERE organization_id = $1 AND validation_fingerprint = $4) AS tag_x_records`,
        [
          syntheticIds.organization,
          this.binding.tagA,
          this.binding.tagB,
          this.binding.tagX,
          syntheticIds.customer,
          da5V5Ids.tagB,
          DA5_V5_PUBLIC_MANIFEST.tagBLabel,
        ],
      );
      const row = precondition.rows[0];
      if (
        row === undefined
        || row.active_entries !== '0'
        || row.review_markers !== '0'
        || row.tag_a_active !== '1'
        || row.tag_a_customer_a_active !== '1'
        || row.tag_b_active !== '0'
        || row.tag_b_assignments !== '0'
        || row.tag_b_exact_records !== '1'
        || row.tag_b_records !== '1'
        || row.tag_x_records !== '0'
      ) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return this.fail();
      }
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.nfc_assignments (
           id, organization_id, nfc_tag_id, target_type, target_customer_id, active
         ) VALUES ($1, $2, $3, 'customer', $4, true)`,
        [
          da5V5Ids.assignmentB,
          syntheticIds.organization,
          da5V5Ids.tagB,
          syntheticIds.reassignmentCustomer,
        ],
      );
      await appendFixtureAudit(
        client,
        'Da5V5FixtureTagBActivated',
        'NfcAssignment',
        da5V5Ids.assignmentB,
      );
      await client.query('COMMIT');
      transactionOpen = false;
      this.currentState = 'tag-b-active';
      return 'match';
    } catch {
      if (transactionOpen) {
        await rollback(client);
      }
      return this.fail();
    } finally {
      client.release();
    }
  }

  async cutoverTagA(): Promise<'match' | 'mismatch'> {
    if (this.currentState !== 'tag-b-active') {
      return this.fail();
    }
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      transactionOpen = true;
      const activeEntry = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM ${B3_SCHEMA}.time_entries
         WHERE organization_id = $1 AND user_id = $2 AND status = 'started'
           AND target_type = 'customer' AND target_customer_id = $3`,
        [
          syntheticIds.organization,
          syntheticIds.user,
          syntheticIds.reassignmentCustomer,
        ],
      );
      const assignment = await client.query<{
        assignment_id: string;
        tag_id: string;
      }>(
        `SELECT assignment.id AS assignment_id, tag.id AS tag_id
         FROM ${B3_SCHEMA}.nfc_tags AS tag
         JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
           ON assignment.organization_id = tag.organization_id
          AND assignment.nfc_tag_id = tag.id
          AND assignment.active
         WHERE tag.organization_id = $1
           AND tag.validation_fingerprint = $2
           AND assignment.target_type = 'customer'
           AND assignment.target_customer_id = $3
         FOR UPDATE OF assignment`,
        [
          syntheticIds.organization,
          this.binding.tagA,
          syntheticIds.customer,
        ],
      );
      if (
        activeEntry.rows[0]?.count !== '1'
        || assignment.rowCount !== 1
        || assignment.rows[0] === undefined
      ) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return this.fail();
      }
      const cutover = await client.query<{ cutover: Date }>(
        'SELECT pg_catalog.transaction_timestamp() AS cutover',
      );
      const cutoverAt = cutover.rows[0]?.cutover;
      if (!(cutoverAt instanceof Date)) {
        throw new Error('DA5 V5 cutover clock unavailable');
      }
      await client.query(
        `UPDATE ${B3_SCHEMA}.nfc_assignments
         SET active = false, valid_to = $3, row_version = row_version + 1
         WHERE organization_id = $1 AND id = $2`,
        [
          syntheticIds.organization,
          assignment.rows[0].assignment_id,
          cutoverAt.toISOString(),
        ],
      );
      await client.query(
        `INSERT INTO ${B3_SCHEMA}.nfc_assignments (
           id, organization_id, nfc_tag_id, target_type, target_customer_id,
           active, valid_from
         ) VALUES ($1, $2, $3, 'customer', $4, true, $5)`,
        [
          da5V5Ids.assignmentAAfterCutover,
          syntheticIds.organization,
          assignment.rows[0].tag_id,
          syntheticIds.reassignmentCustomer,
          cutoverAt.toISOString(),
        ],
      );
      await appendFixtureAudit(
        client,
        'Da5V5FixtureTagADeactivated',
        'NfcAssignment',
        assignment.rows[0].assignment_id,
      );
      await appendFixtureAudit(
        client,
        'Da5V5FixtureTagAAssigned',
        'NfcAssignment',
        da5V5Ids.assignmentAAfterCutover,
      );
      await client.query('COMMIT');
      transactionOpen = false;
      this.currentState = 'cutover-complete';
      return 'match';
    } catch {
      if (transactionOpen) {
        await rollback(client);
      }
      return this.fail();
    } finally {
      client.release();
    }
  }

  markTerminal(
    status: Da5V5Status,
    invariants: Da5V5InvariantStatus,
  ): 'match' | 'mismatch' {
    if (
      this.currentState !== 'cutover-complete'
      || !isExactTerminalStatus(status)
      || Object.values(invariants).some((value) => value !== 'match')
    ) {
      return this.fail();
    }
    this.currentState = 'terminal';
    return 'match';
  }

  private fail(): 'mismatch' {
    this.currentState = 'failed';
    return 'mismatch';
  }
}

const DA5_V5_PROTECTED_FIXTURE_ARM_STATUS = Object.freeze<Da5V5Status>({
  activeAssignments: 1,
  activeOtherTargetDecisions: 0,
  activeTimeEntries: 0,
  adminSetupReceipts: 1,
  auditEvents: 18,
  canonicalDecisions: 15,
  customers: 2,
  duplicateDecisions: 1,
  fixtureAuditEvents: 1,
  generalWorkTargets: 1,
  manualWorkEvents: 10,
  nfcWorkEvents: 5,
  offlineReconciliations: 6,
  projectReceipts: 0,
  projects: 1,
  reviewHistoricalConfiguration: 0,
  reviewMarkers: 0,
  reviewPredecessors: 0,
  stoppedTimeEntries: 7,
  syncReceipts: 15,
  tags: 2,
  timeEntries: 7,
  totalAssignments: 1,
  workEvents: 15,
});

interface Da5V5OfflineInvariantRow {
  readonly assignment_id: string | null;
  readonly decision_type: string | null;
  readonly device_sequence: string;
  readonly nfc_tag_id: string | null;
  readonly review_reason: string | null;
  readonly tag_fingerprint: string | null;
  readonly target_id: string;
  readonly target_type: string;
  readonly trigger_type: string;
}

interface Da5V5ExpectedOfflineSequence {
  readonly assignmentId: string | null;
  readonly decisionType: string | null;
  readonly deviceSequence: string;
  readonly nfcTagId: string | null;
  readonly reviewReason: string | null;
  readonly tagFingerprint: string | null;
  readonly targetId: string;
  readonly targetType: 'customer' | 'general_work' | 'project';
  readonly triggerType: 'manual' | 'nfc';
}

function expectedNfcSequence(
  deviceSequence: string,
  targetId: string,
  assignmentId: string,
  nfcTagId: string,
  tagFingerprint: string,
  decisionType: string,
): Da5V5ExpectedOfflineSequence {
  return Object.freeze({
    assignmentId,
    decisionType,
    deviceSequence,
    nfcTagId,
    reviewReason: null,
    tagFingerprint,
    targetId,
    targetType: 'customer',
    triggerType: 'nfc',
  });
}

function expectedNfcReviewSequence(
  deviceSequence: string,
  targetId: string,
  assignmentId: string,
  nfcTagId: string,
  tagFingerprint: string,
  reviewReason: string,
): Da5V5ExpectedOfflineSequence {
  return Object.freeze({
    assignmentId,
    decisionType: null,
    deviceSequence,
    nfcTagId,
    reviewReason,
    tagFingerprint,
    targetId,
    targetType: 'customer',
    triggerType: 'nfc',
  });
}

function expectedManualSequence(
  deviceSequence: string,
  targetType: 'customer' | 'general_work' | 'project',
  targetId: string,
  decisionType: string,
): Da5V5ExpectedOfflineSequence {
  return Object.freeze({
    assignmentId: null,
    decisionType,
    deviceSequence,
    nfcTagId: null,
    reviewReason: null,
    tagFingerprint: null,
    targetId,
    targetType,
    triggerType: 'manual',
  });
}

function sequenceMatches(
  rows: readonly Da5V5OfflineInvariantRow[],
  expected: readonly Da5V5ExpectedOfflineSequence[],
): boolean {
  return rows.length === expected.length && rows.every((row, index) => {
    const exact = expected[index];
    return exact !== undefined
      && row.assignment_id === exact.assignmentId
      && row.decision_type === exact.decisionType
      && row.device_sequence === exact.deviceSequence
      && row.nfc_tag_id === exact.nfcTagId
      && row.review_reason === exact.reviewReason
      && row.tag_fingerprint === exact.tagFingerprint
      && row.target_id === exact.targetId
      && row.target_type === exact.targetType
      && row.trigger_type === exact.triggerType;
  });
}

function pendingDa5V5Invariants(): Da5V5InvariantStatus {
  return Object.freeze({
    ordinaryOfflineOrder: 'pending',
    protectedReviewOrder: 'pending',
    reviewPendingHasNoTimeMutation: 'pending',
    tagBActiveEntryRetained: 'pending',
    terminalFifoDrained: 'pending',
  });
}

function mismatchDa5V5Invariants(): Da5V5InvariantStatus {
  return Object.freeze({
    ordinaryOfflineOrder: 'mismatch',
    protectedReviewOrder: 'mismatch',
    reviewPendingHasNoTimeMutation: 'mismatch',
    tagBActiveEntryRetained: 'mismatch',
    terminalFifoDrained: 'mismatch',
  });
}

function isExactTerminalStatus(status: Da5V5Status): boolean {
  return sameDa5V5Status(status, Object.freeze({
    activeAssignments: 2,
    activeOtherTargetDecisions: 1,
    activeTimeEntries: 1,
    adminSetupReceipts: 1,
    auditEvents: 25,
    canonicalDecisions: 17,
    customers: 2,
    duplicateDecisions: 1,
    fixtureAuditEvents: 4,
    generalWorkTargets: 1,
    manualWorkEvents: 10,
    nfcWorkEvents: 9,
    offlineReconciliations: 9,
    projectReceipts: 0,
    projects: 1,
    reviewHistoricalConfiguration: 1,
    reviewMarkers: 1,
    reviewPredecessors: 1,
    stoppedTimeEntries: 7,
    syncReceipts: 19,
    tags: 2,
    timeEntries: 8,
    totalAssignments: 3,
    workEvents: 19,
  }));
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original fixture failure.
  }
}
