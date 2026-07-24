import { B3_SCHEMA } from '@taptime/backend-schema';
import type { Pool } from 'pg';
import {
  DA4_V5_PUBLIC_MANIFEST,
  type Da4V5FixtureManifest,
} from './Da4V5Profile.js';
import { syntheticIds } from './constants.js';

export interface Da4V5Status {
  readonly activeAssignments: number;
  readonly activeInvitations: number;
  readonly auditEvents: number;
  readonly canonicalDecisions: number;
  readonly customerReceipts: number;
  readonly customers: number;
  readonly employeeInvitationReceipts: number;
  readonly employees: number;
  readonly expiredUnconsumedInvitations: number;
  readonly exportAudits: number;
  readonly reassignmentReceipts: number;
  readonly reviewAdjudications: number;
  readonly syncReceipts: number;
  readonly tags: number;
  readonly timeRecordRevisions: number;
  readonly timeRecords: number;
  readonly timeReviewCommandReceipts: number;
  readonly totalAssignments: number;
  readonly unconsumedInvitations: number;
  readonly unresolvedReviews: number;
  readonly workEvents: number;
}

export const DA4_V5_INITIAL_STATUS = Object.freeze<Da4V5Status>({
  activeAssignments: 1,
  activeInvitations: 0,
  auditEvents: 101,
  canonicalDecisions: 202,
  customerReceipts: 0,
  customers: 21,
  employeeInvitationReceipts: 0,
  employees: 21,
  expiredUnconsumedInvitations: 0,
  exportAudits: 0,
  reassignmentReceipts: 0,
  reviewAdjudications: 0,
  syncReceipts: 0,
  tags: 1,
  timeRecordRevisions: 0,
  timeRecords: 101,
  timeReviewCommandReceipts: 0,
  totalAssignments: 1,
  unconsumedInvitations: 0,
  unresolvedReviews: 101,
  workEvents: 303,
});

export async function seedDa4V5Fixture(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let consistencyTriggerDisabled = false;
  try {
    await client.query(`
      ALTER TABLE ${B3_SCHEMA}.canonical_decisions
        DISABLE TRIGGER canonical_decisions_result_consistency
    `);
    consistencyTriggerDisabled = true;
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ${B3_SCHEMA}.customers
        (id, organization_id, display_name, active, activated_at)
       SELECT
        ('20000001-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
        $1, 'DA4 V5 Customer ' || pg_catalog.lpad(series.value::text, 2, '0'),
        true, pg_catalog.transaction_timestamp()
       FROM pg_catalog.generate_series(1, 19) AS series(value)`,
      [syntheticIds.organization],
    );
    await client.query(
      `INSERT INTO ${B3_SCHEMA}.users (id)
       SELECT ('10000001-0000-4000-8000-' ||
         pg_catalog.lpad(series.value::text, 12, '0'))::uuid
       FROM pg_catalog.generate_series(1, 21) AS series(value)`,
    );
    await client.query(
      `INSERT INTO ${B3_SCHEMA}.memberships
        (id, organization_id, user_id, role, created_by_user_id, display_name)
       SELECT
        ('12000001-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
        $1,
        ('10000001-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
        'employee',
        $2,
        CASE series.value
          WHEN 1 THEN $3
          WHEN 2 THEN $4
          ELSE 'DA4 V5 Employee ' || pg_catalog.lpad(series.value::text, 2, '0')
        END
       FROM pg_catalog.generate_series(1, 21) AS series(value)`,
      [
        syntheticIds.organization,
        syntheticIds.administratorUser,
        DA4_V5_PUBLIC_MANIFEST.correctionTargetEmployeeLabel,
        DA4_V5_PUBLIC_MANIFEST.oldestReviewTargetEmployeeLabel,
      ],
    );
    await client.query(
      `INSERT INTO ${B3_SCHEMA}.nfc_tags
        (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, $3, 'taptime:nfc:v1:da4-v5')`,
      [
        syntheticIds.tagA,
        syntheticIds.organization,
        DA4_V5_PUBLIC_MANIFEST.reassignmentTagLabel,
      ],
    );
    await client.query(
      `INSERT INTO ${B3_SCHEMA}.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
       VALUES ($1, $2, $3, 'customer', $4, true, pg_catalog.transaction_timestamp())`,
      [
        syntheticIds.assignmentA,
        syntheticIds.organization,
        syntheticIds.tagA,
        syntheticIds.customer,
      ],
    );
    await client.query(
      `WITH fixture AS (
         SELECT series.value,
           pg_catalog.date_trunc('hour', pg_catalog.transaction_timestamp())
             - interval '25 days' + series.value * interval '4 hours' AS started_at,
           CASE WHEN series.value = 1
             THEN '10000001-0000-4000-8000-000000000001'::uuid
             ELSE '10000001-0000-4000-8000-000000000003'::uuid
           END AS user_id
         FROM pg_catalog.generate_series(1, 101) AS series(value)
       )
       INSERT INTO ${B3_SCHEMA}.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, received_at, content_hash,
         content_hash_algorithm, content_hash_version)
       SELECT
        ('51000001-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, $2::uuid, $3::uuid, 'customer', $4::uuid, user_id, started_at, started_at,
        pg_catalog.repeat('a', 64), 'sha256', 1
       FROM fixture
       UNION ALL
       SELECT
        ('51000002-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, $2::uuid, $3::uuid, 'customer', $4::uuid, user_id,
        started_at + interval '30 minutes',
        started_at + interval '30 minutes', pg_catalog.repeat('b', 64), 'sha256', 1
       FROM fixture`,
      [
        syntheticIds.organization,
        syntheticIds.assignmentA,
        syntheticIds.tagA,
        syntheticIds.customer,
      ],
    );
    await client.query(
      `WITH fixture AS (
         SELECT series.value,
           pg_catalog.date_trunc('hour', pg_catalog.transaction_timestamp())
             - interval '25 days' + series.value * interval '4 hours' AS started_at,
           CASE WHEN series.value = 1
             THEN '10000001-0000-4000-8000-000000000001'::uuid
             ELSE '10000001-0000-4000-8000-000000000003'::uuid
           END AS user_id
         FROM pg_catalog.generate_series(1, 101) AS series(value)
       )
       INSERT INTO ${B3_SCHEMA}.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, stop_work_event_id, stopped_at)
       SELECT
        ('61000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, user_id, 'customer', $2::uuid, 'stopped',
        ('51000001-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        started_at,
        ('51000002-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        started_at + interval '30 minutes'
       FROM fixture`,
      [syntheticIds.organization, syntheticIds.customer],
    );
    await client.query(
      `WITH fixture AS (
         SELECT series.value,
           CASE WHEN series.value = 1
             THEN '10000001-0000-4000-8000-000000000001'::uuid
             ELSE '10000001-0000-4000-8000-000000000003'::uuid
           END AS user_id
         FROM pg_catalog.generate_series(1, 101) AS series(value)
       )
       INSERT INTO ${B3_SCHEMA}.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, time_entry_id, engine_version, decision_payload)
       SELECT
        ('51000001-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, user_id, 'customer', $2::uuid, 'time_entry_started',
        ('61000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        'da4-v5-fixture', '{}'::jsonb
       FROM fixture
       UNION ALL
       SELECT
        ('51000002-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, user_id, 'customer', $2::uuid, 'time_entry_stopped',
        ('61000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        'da4-v5-fixture', '{}'::jsonb
       FROM fixture`,
      [syntheticIds.organization, syntheticIds.customer],
    );
    await client.query(
      `WITH fixture AS (
         SELECT series.value,
           pg_catalog.date_trunc('hour', pg_catalog.transaction_timestamp())
             - interval '7 days' + series.value * interval '1 minute' AS occurred_at,
           CASE WHEN series.value = 1
             THEN '10000001-0000-4000-8000-000000000002'::uuid
             ELSE '10000001-0000-4000-8000-000000000004'::uuid
           END AS user_id
         FROM pg_catalog.generate_series(1, 101) AS series(value)
       )
       INSERT INTO ${B3_SCHEMA}.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, received_at, content_hash,
         content_hash_algorithm, content_hash_version)
       SELECT
        ('52000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, $2::uuid, $3::uuid, 'customer', $4::uuid, user_id,
        occurred_at, occurred_at,
        pg_catalog.repeat('c', 64), 'sha256', 1
       FROM fixture`,
      [
        syntheticIds.organization,
        syntheticIds.assignmentA,
        syntheticIds.tagA,
        syntheticIds.customer,
      ],
    );
    await client.query(
      `WITH fixture AS (
         SELECT series.value,
           pg_catalog.date_trunc('hour', pg_catalog.transaction_timestamp())
             - interval '7 days' + series.value * interval '1 minute' AS occurred_at,
           CASE WHEN series.value = 1
             THEN '10000001-0000-4000-8000-000000000002'::uuid
             ELSE '10000001-0000-4000-8000-000000000004'::uuid
           END AS user_id
         FROM pg_catalog.generate_series(1, 101) AS series(value)
       )
       INSERT INTO ${B3_SCHEMA}.audit_events
        (id, organization_id, actor_user_id, work_event_user_id, work_event_id,
         event_type, entity_type, entity_id, occurred_at, recorded_at, correlation_id, payload)
       SELECT
        ('72000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        $1::uuid, NULL, user_id,
        ('52000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        'LifecycleDeferred', 'WorkEvent',
        ('52000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
        occurred_at, occurred_at, 'da4-v5-fixture-' || value,
        '{"reason":"server_lifecycle_deferred"}'::jsonb
       FROM fixture`,
      [syntheticIds.organization],
    );
    await client.query('COMMIT');
    await client.query(`
      ALTER TABLE ${B3_SCHEMA}.canonical_decisions
        ENABLE TRIGGER canonical_decisions_result_consistency
    `);
    consistencyTriggerDisabled = false;
  } catch (error) {
    await client.query('ROLLBACK');
    if (consistencyTriggerDisabled) {
      await client.query(`
        ALTER TABLE ${B3_SCHEMA}.canonical_decisions
          ENABLE TRIGGER canonical_decisions_result_consistency
      `);
    }
    throw error;
  } finally {
    client.release();
  }
  const status = await readDa4V5Status(pool);
  assertDa4V5InitialStatus(status);
}

export async function readDa4V5Status(pool: Pool): Promise<Da4V5Status> {
  const result = await pool.query<Record<keyof Da4V5Status, string>>(`
    WITH invitation_status AS MATERIALIZED (
      SELECT
        count(*) FILTER (WHERE consumed_at IS NULL)::text AS unconsumed_invitations,
        count(*) FILTER (
          WHERE consumed_at IS NULL
            AND expires_at > pg_catalog.transaction_timestamp()
        )::text AS active_invitations,
        count(*) FILTER (
          WHERE consumed_at IS NULL
            AND expires_at <= pg_catalog.transaction_timestamp()
        )::text AS expired_unconsumed_invitations
      FROM ${B3_SCHEMA}.employee_membership_invitations
    )
    SELECT
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_assignments WHERE active)
        AS "activeAssignments",
      (SELECT active_invitations FROM invitation_status) AS "activeInvitations",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS "auditEvents",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions) AS "canonicalDecisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.admin_setup_command_receipts
       WHERE command_type = 'createCustomer') AS "customerReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.customers) AS "customers",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.employee_invitation_command_receipts)
        AS "employeeInvitationReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.memberships
       WHERE role = 'employee' AND revoked_at IS NULL AND display_name IS NOT NULL) AS "employees",
      (SELECT expired_unconsumed_invitations FROM invitation_status)
        AS "expiredUnconsumedInvitations",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events
       WHERE event_type = 'TimeEntryExportGenerated') AS "exportAudits",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.admin_setup_command_receipts
       WHERE command_type = 'reassignNfcTag') AS "reassignmentReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.offline_review_adjudications)
        AS "reviewAdjudications",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.sync_receipts) AS "syncReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_tags) AS "tags",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_record_revisions)
        AS "timeRecordRevisions",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.effective_time_records_v1) AS "timeRecords",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.time_review_command_receipts)
        AS "timeReviewCommandReceipts",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.nfc_assignments) AS "totalAssignments",
      (SELECT unconsumed_invitations FROM invitation_status) AS "unconsumedInvitations",
      (SELECT count(*)::text
       FROM ${B3_SCHEMA}.work_events AS event
       WHERE EXISTS (
         SELECT 1 FROM ${B3_SCHEMA}.audit_events AS audit
         WHERE audit.organization_id = event.organization_id
           AND audit.work_event_id = event.id
           AND audit.event_type = 'LifecycleDeferred'
           AND audit.entity_type = 'WorkEvent'
       )
       AND NOT EXISTS (
         SELECT 1 FROM ${B3_SCHEMA}.canonical_decisions AS decision
         WHERE decision.organization_id = event.organization_id
           AND decision.work_event_id = event.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM ${B3_SCHEMA}.offline_event_reconciliations AS reconciliation
         WHERE reconciliation.organization_id = event.organization_id
           AND reconciliation.work_event_id = event.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM ${B3_SCHEMA}.offline_review_adjudications AS adjudication
         WHERE adjudication.organization_id = event.organization_id
           AND adjudication.work_event_id = event.id
       )) AS "unresolvedReviews",
      (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS "workEvents"
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('DA4 V5 status query returned no result');
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)]),
  ) as unknown as Da4V5Status);
}

export async function readDa4V5FixtureManifest(pool: Pool): Promise<Da4V5FixtureManifest> {
  const result = await pool.query<{
    started_at: Date;
    stopped_at: Date;
  }>(
    `SELECT record.effective_started_at AS started_at,
            record.effective_stopped_at AS stopped_at
     FROM ${B3_SCHEMA}.effective_time_records_v1 AS record
     JOIN ${B3_SCHEMA}.memberships AS membership
       ON membership.organization_id = record.organization_id
      AND membership.user_id = record.user_id
     WHERE record.organization_id = $1
       AND membership.display_name = $2`,
    [
      syntheticIds.organization,
      DA4_V5_PUBLIC_MANIFEST.correctionTargetEmployeeLabel,
    ],
  );
  if (result.rowCount !== 1 || result.rows[0] === undefined) {
    throw new Error('DA4 V5 correction target invariant failed');
  }
  const startedAt = result.rows[0].started_at;
  const stoppedAt = result.rows[0].stopped_at;
  return Object.freeze({
    ...DA4_V5_PUBLIC_MANIFEST,
    correctionOriginalStartedAt: startedAt.toISOString(),
    correctionOriginalStoppedAt: stoppedAt.toISOString(),
    correctionTransformedStartedAt: new Date(startedAt.valueOf() + 60_000).toISOString(),
    correctionTransformedStoppedAt: new Date(stoppedAt.valueOf() - 60_000).toISOString(),
  });
}

export function assertDa4V5InitialStatus(status: Da4V5Status): void {
  for (const [key, expected] of Object.entries(DA4_V5_INITIAL_STATUS)) {
    if (status[key as keyof Da4V5Status] !== expected) {
      throw new Error('DA4 V5 initial aggregate invariant failed');
    }
  }
}
