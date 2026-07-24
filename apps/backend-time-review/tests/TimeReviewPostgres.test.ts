import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { TimeReviewCoordinator } from '../src/index.js';
import {
  DA3_READ_LOGIN,
  DA3_WRITE_LOGIN,
  ids,
  resetMigratePrepareAndSeed,
  runtimeConnectionString,
  tokens,
  verifier,
} from './fixtures.js';

const installerConnectionString = process.env.DA3_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const runtimePassword = process.env.DA3_RUNTIME_PASSWORD ?? 'da3-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 4 });
const readPool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, DA3_READ_LOGIN, runtimePassword),
  max: 1,
});
const writePool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, DA3_WRITE_LOGIN, runtimePassword),
  max: 4,
});
const coordinator = new TimeReviewCoordinator(readPool, writePool, verifier);

beforeEach(async () => {
  await resetMigratePrepareAndSeed(installerPool, runtimePassword);
}, 30_000);

afterAll(async () => {
  await Promise.all([readPool.end(), writePool.end(), installerPool.end()]);
});

describe('DA3 PostgreSQL correction and review boundary', () => {
  it('reads generalized Project/manual time and review provenance through v2 only', async () => {
    const projectId = '20000000-0000-4000-8000-000000000351';
    const startedEventId = '50000000-0000-4000-8000-000000000351';
    const stoppedEventId = '50000000-0000-4000-8000-000000000352';
    const reviewEventId = '50000000-0000-4000-8000-000000000353';
    const entryId = '60000000-0000-4000-8000-000000000351';
    await insertGeneralizedProjectManualEvidence({
      projectId, startedEventId, stoppedEventId, reviewEventId, entryId,
    });

    const timePage = await coordinator.queryTimeRecordsV2({
      accessToken: tokens.adminA,
      request: {
        expectedMembershipId: ids.membershipAdminA,
        fromInclusive: '2026-07-01T00:00:00.000Z',
        toExclusive: '2026-08-01T00:00:00.000Z',
        limit: 100,
        cursor: null,
      },
    });
    expect(timePage).toMatchObject({
      status: 'ready',
      value: {
        records: expect.arrayContaining([expect.objectContaining({
          timeRecordId: entryId,
          targetType: 'project',
          targetId: projectId,
          targetDisplayName: 'Montage Nord',
          startedVia: 'manual',
          stoppedVia: 'manual',
        })]),
      },
    });

    const reviewPage = await coordinator.queryReviewItemsV2({
      accessToken: tokens.adminA,
      request: {
        expectedMembershipId: ids.membershipAdminA,
        limit: 100,
        cursor: null,
      },
    });
    expect(reviewPage).toMatchObject({
      status: 'ready',
      value: {
        items: expect.arrayContaining([expect.objectContaining({
          reviewItemId: reviewEventId,
          source: 'server_legacy',
          targetType: 'project',
          targetId: projectId,
          targetDisplayName: 'Montage Nord',
          triggerType: 'manual',
        })]),
      },
    });
  });

  it('queries bounded effective records and appends an idempotent correction overlay', async () => {
    const before = await queryRecords(tokens.adminA, ids.membershipAdminA);
    expect(before.status).toBe('ready');
    if (before.status !== 'ready') return;
    expect(before.value.records).toHaveLength(2);
    const stopped = before.value.records.find((record) => record.timeRecordId === ids.stoppedEntryA)!;
    expect(stopped).toMatchObject({
      source: 'canonical', status: 'stopped', baseRowVersion: 2, effectiveRevisionNumber: 0,
      startedAt: '2026-07-20T08:00:00.000Z', stoppedAt: '2026-07-20T16:00:00.000Z',
    });

    const request = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: ids.correctionCommand,
      timeRecordId: ids.stoppedEntryA,
      expectedBaseRowVersion: 2,
      expectedRevisionNumber: 0,
      startedAt: '2026-07-20T08:15:00.000Z',
      stoppedAt: '2026-07-20T16:30:00.000Z',
      reason: '  Beleg und Mitarbeiterhinweis geprüft.  ',
    } as const;
    const corrected = await coordinator.correctTimeRecord({ accessToken: tokens.adminA, request });
    expect(corrected).toMatchObject({
      status: 'committed',
      value: { timeRecordId: ids.stoppedEntryA, revisionNumber: 1, idempotentRetry: false },
    });
    const retry = await coordinator.correctTimeRecord({ accessToken: tokens.adminA, request });
    expect(retry).toMatchObject({ status: 'committed', value: { idempotentRetry: true } });
    expect((await coordinator.correctTimeRecord({
      accessToken: tokens.adminA,
      request: { ...request, reason: 'Andere Begründung' },
    })).status).toBe('command_id_conflict');

    const truth = await installerPool.query<{
      base_started: Date;
      effective_started: Date;
      reason: string;
      revisions: number;
      audits: number;
      receipts: number;
    }>(`SELECT entry.started_at AS base_started,
               effective.effective_started_at AS effective_started,
               revision.reason,
               (SELECT count(*)::integer FROM taptime_server.time_record_revisions) AS revisions,
               (SELECT count(*)::integer FROM taptime_server.audit_events
                 WHERE event_type = 'TimeRecordCorrected') AS audits,
               (SELECT count(*)::integer FROM taptime_server.time_review_command_receipts) AS receipts
        FROM taptime_server.time_entries AS entry
        JOIN taptime_server.effective_time_records_v1 AS effective
          ON effective.organization_id = entry.organization_id AND effective.time_record_id = entry.id
        JOIN taptime_server.time_record_revisions AS revision
          ON revision.organization_id = entry.organization_id AND revision.time_record_id = entry.id
        WHERE entry.id = $1`, [ids.stoppedEntryA]);
    expect(truth.rows[0]).toMatchObject({
      reason: request.reason, revisions: 1, audits: 1, receipts: 1,
    });
    expect(truth.rows[0]!.base_started.toISOString()).toBe('2026-07-20T08:00:00.000Z');
    expect(truth.rows[0]!.effective_started.toISOString()).toBe(request.startedAt);
  });

  it('rejects active, stale, Employee and cross-tenant correction attempts without a ledger', async () => {
    const base = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: ids.correctionCommand,
      timeRecordId: ids.activeEntryA,
      expectedBaseRowVersion: 1,
      expectedRevisionNumber: 0,
      startedAt: '2026-07-21T08:30:00.000Z',
      stoppedAt: '2026-07-21T09:00:00.000Z',
      reason: 'Active row must fail.',
    } as const;
    expect((await coordinator.correctTimeRecord({ accessToken: tokens.adminA, request: base })).status)
      .toBe('not_adjustable');
    expect((await coordinator.correctTimeRecord({
      accessToken: tokens.employeeA,
      request: { ...base, expectedMembershipId: ids.membershipEmployeeA },
    })).status).toBe('authority_rejected');
    expect((await queryRecords(tokens.adminB, ids.membershipAdminB)).status).toBe('ready');
    const count = await installerPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM taptime_server.time_record_revisions',
    );
    expect(count.rows[0]!.count).toBe('0');
  });

  it('exposes only safe legacy server evidence and adjudicates its exact prefix append-only', async () => {
    const page = await coordinator.queryReviewItems({
      accessToken: tokens.adminA,
      request: { expectedMembershipId: ids.membershipAdminA, limit: 100, cursor: null },
    });
    expect(page).toMatchObject({
      status: 'ready',
      value: { items: [{ reviewItemId: ids.legacyReviewEventA, source: 'server_legacy' }] },
    });
    if (page.status !== 'ready') return;
    expect(JSON.stringify(page.value)).not.toContain('da3-a');

    const request = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: ids.adjudicationCommand,
      reviewItemIds: [ids.legacyReviewEventA],
      resolution: { type: 'create_recovered_time_record' as const,
        startedAt: '2026-07-21T12:00:00.000Z', stoppedAt: '2026-07-21T13:00:00.000Z' },
      reason: 'Legacy-Beleg eindeutig als geschlossene Arbeitszeit bestätigt.',
    };
    const adjudicated = await coordinator.adjudicateReviewItems({
      accessToken: tokens.adminA,
      request,
    });
    expect(adjudicated.status).toBe('committed');
    if (adjudicated.status !== 'committed') return;
    expect(adjudicated.value).toMatchObject({
      resolution: 'create_recovered_time_record', revisionNumber: 1, idempotentRetry: false,
    });
    expect(adjudicated.value.timeRecordId).not.toBeNull();
    expect((await coordinator.adjudicateReviewItems({ accessToken: tokens.adminA, request })))
      .toMatchObject({ status: 'committed', value: { idempotentRetry: true } });

    const after = await coordinator.queryReviewItems({
      accessToken: tokens.adminA,
      request: { expectedMembershipId: ids.membershipAdminA, limit: 100, cursor: null },
    });
    expect(after).toMatchObject({ status: 'ready', value: { items: [] } });
    const stored = await installerPool.query<{
      adjudications: number; revisions: number; audits: number; decisions: number;
    }>(`SELECT
          (SELECT count(*)::integer FROM taptime_server.offline_review_adjudications) AS adjudications,
          (SELECT count(*)::integer FROM taptime_server.time_record_revisions) AS revisions,
          (SELECT count(*)::integer FROM taptime_server.audit_events
            WHERE event_type = 'TimeReviewAdjudicated') AS audits,
          (SELECT count(*)::integer FROM taptime_server.canonical_decisions
            WHERE work_event_id = $1) AS decisions`, [ids.legacyReviewEventA]);
    expect(stored.rows[0]).toEqual({ adjudications: 1, revisions: 1, audits: 1, decisions: 0 });
    await expect(installerPool.query(
      `UPDATE taptime_server.offline_review_adjudications SET reason = 'tamper'`,
    )).rejects.toMatchObject({ code: '55000' });
  });

  it('denies direct table access to both isolated runtime logins', async () => {
    const directRead = await readPool.connect();
    try {
      await directRead.query('BEGIN');
      await directRead.query('SET LOCAL ROLE taptime_time_review_reader');
      await expect(directRead.query('SELECT * FROM taptime_server.time_record_revisions'))
        .rejects.toMatchObject({ code: '42501' });
      await directRead.query('ROLLBACK');
    } finally {
      directRead.release();
    }
    const directWrite = await writePool.connect();
    try {
      await directWrite.query('BEGIN');
      await directWrite.query('SET LOCAL ROLE taptime_time_review_writer');
      await expect(directWrite.query(
        `INSERT INTO taptime_server.time_review_command_receipts
          (organization_id, command_id, actor_user_id, actor_membership_id,
           command_type, request_hash, result_payload)
         VALUES ($1, $2, $3, $4, 'correction', repeat('a', 64), '{}')`,
        [ids.organizationA, ids.correctionCommand, ids.adminA, ids.membershipAdminA],
      )).rejects.toMatchObject({ code: '42501' });
      await directWrite.query('ROLLBACK');
    } finally {
      directWrite.release();
    }
  });

  it('serializes concurrent corrections for one employee and commits only one expected revision', async () => {
    const first = correctionRequest(
      '80000000-0000-4000-8000-000000000311',
      '2026-07-20T08:10:00.000Z', '2026-07-20T16:10:00.000Z',
    );
    const second = correctionRequest(
      '80000000-0000-4000-8000-000000000312',
      '2026-07-20T08:20:00.000Z', '2026-07-20T16:20:00.000Z',
    );
    const results = await Promise.all([
      coordinator.correctTimeRecord({ accessToken: tokens.adminA, request: first }),
      coordinator.correctTimeRecord({ accessToken: tokens.adminA, request: second }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['committed', 'conflict']);
    const counts = await timeReviewCounts();
    expect(counts).toEqual({ revisions: 1, adjudications: 0, receipts: 1, audits: 1 });
  });

  it('rolls back revision, receipt and success audit together on a late transaction failure', async () => {
    const result = await coordinator.correctTimeRecord(
      { accessToken: tokens.adminA, request: correctionRequest(
        '80000000-0000-4000-8000-000000000313',
        '2026-07-20T08:10:00.000Z', '2026-07-20T16:10:00.000Z',
      ) },
      { beforeCommit: () => { throw new Error('synthetic disconnect before commit'); } },
    );
    expect(result).toEqual({ status: 'unavailable' });
    expect(await timeReviewCounts()).toEqual({
      revisions: 0, adjudications: 0, receipts: 0, audits: 0,
    });
  });

  it('records a no-change decision without manufacturing a revision or CanonicalDecision', async () => {
    const request = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: '80000000-0000-4000-8000-000000000314',
      reviewItemIds: [ids.legacyReviewEventA],
      resolution: { type: 'no_time_record_change' as const },
      reason: 'Evidence geprüft; keine Arbeitszeitänderung erforderlich.',
    };
    await expect(coordinator.adjudicateReviewItems({ accessToken: tokens.adminA, request }))
      .resolves.toMatchObject({
        status: 'committed',
        value: { resolution: 'no_time_record_change', timeRecordId: null, revisionNumber: null },
      });
    expect(await timeReviewCounts()).toEqual({
      revisions: 0, adjudications: 1, receipts: 1, audits: 1,
    });
    const decisions = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM taptime_server.canonical_decisions
       WHERE work_event_id = $1`, [ids.legacyReviewEventA],
    );
    expect(decisions.rows[0]!.count).toBe('0');
  });

  it('adjusts an existing stopped record through an exact review decision', async () => {
    const request = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: '80000000-0000-4000-8000-000000000315',
      reviewItemIds: [ids.legacyReviewEventA],
      resolution: {
        type: 'adjust_existing_time_record' as const,
        timeRecordId: ids.stoppedEntryA, expectedBaseRowVersion: 2,
        expectedRevisionNumber: 0, startedAt: '2026-07-20T08:05:00.000Z',
        stoppedAt: '2026-07-20T16:05:00.000Z',
      },
      reason: 'Review-Evidence dem bestehenden Datensatz zugeordnet.',
    };
    await expect(coordinator.adjudicateReviewItems({ accessToken: tokens.adminA, request }))
      .resolves.toMatchObject({
        status: 'committed',
        value: { timeRecordId: ids.stoppedEntryA, revisionNumber: 1 },
      });
    const effective = await queryRecords(tokens.adminA, ids.membershipAdminA);
    expect(effective).toMatchObject({
      status: 'ready',
      value: { records: expect.arrayContaining([expect.objectContaining({
        timeRecordId: ids.stoppedEntryA, effectiveRevisionNumber: 1,
        startedAt: request.resolution.startedAt, stoppedAt: request.resolution.stoppedAt,
      })]) },
    });
  });

  it('rejects a non-prefix legacy selection and mixed source families atomically', async () => {
    const laterLegacy = '50000000-0000-4000-8000-000000000399';
    await insertLegacyReview(laterLegacy, '2026-07-21T13:00:00.000Z');
    const nonPrefix = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: '80000000-0000-4000-8000-000000000316',
      reviewItemIds: [laterLegacy], resolution: { type: 'no_time_record_change' as const },
      reason: 'Nicht-Präfix muss vollständig scheitern.',
    };
    expect((await coordinator.adjudicateReviewItems({ accessToken: tokens.adminA, request: nonPrefix })).status)
      .toBe('conflict');

    await insertOfflineReviewForLegacyEvent();
    const mixed = {
      ...nonPrefix,
      commandId: '80000000-0000-4000-8000-000000000317',
      reviewItemIds: [ids.legacyReviewEventA, laterLegacy],
    };
    expect((await coordinator.adjudicateReviewItems({ accessToken: tokens.adminA, request: mixed })).status)
      .toBe('invalid_evidence');
    expect(await timeReviewCounts()).toEqual({
      revisions: 0, adjudications: 0, receipts: 0, audits: 0,
    });
  });

  it('adjudicates exact offline evidence, preserves it, and releases only its proved cursor', async () => {
    const installationId = await insertOfflineReviewForLegacyEvent();
    await assertFalseCursorClearRejected(installationId);
    const request = {
      expectedMembershipId: ids.membershipAdminA,
      commandId: '80000000-0000-4000-8000-000000000318',
      reviewItemIds: [ids.legacyReviewEventA],
      resolution: { type: 'no_time_record_change' as const },
      reason: 'Offline-Beleg geprüft; keine Arbeitszeitänderung.',
    };
    await expect(coordinator.adjudicateReviewItems({ accessToken: tokens.adminA, request }))
      .resolves.toMatchObject({ status: 'committed' });
    const state = await installerPool.query<{
      reconciliations: number; predecessor: string | null; adjudications: number;
    }>(`SELECT
          (SELECT count(*)::integer FROM taptime_server.offline_event_reconciliations
            WHERE work_event_id = $1) AS reconciliations,
          (SELECT review_predecessor_sequence::text FROM taptime_server.offline_sync_cursors
            WHERE installation_id = $2) AS predecessor,
          (SELECT count(*)::integer FROM taptime_server.offline_review_adjudications
            WHERE work_event_id = $1) AS adjudications`, [ids.legacyReviewEventA, installationId]);
    expect(state.rows[0]).toEqual({ reconciliations: 1, predecessor: null, adjudications: 1 });
    await expect(installerPool.query(
      `UPDATE taptime_server.offline_event_reconciliations SET review_reason = NULL
       WHERE work_event_id = $1`, [ids.legacyReviewEventA],
    )).rejects.toMatchObject({ code: '55000' });
  });
});

function queryRecords(accessToken: string, expectedMembershipId: string) {
  return coordinator.queryTimeRecords({
    accessToken,
    request: {
      expectedMembershipId,
      fromInclusive: '2026-07-01T00:00:00.000Z',
      toExclusive: '2026-08-01T00:00:00.000Z',
      limit: 100,
      cursor: null,
    },
  });
}

async function insertGeneralizedProjectManualEvidence(input: {
  readonly projectId: string;
  readonly startedEventId: string;
  readonly stoppedEventId: string;
  readonly reviewEventId: string;
  readonly entryId: string;
}): Promise<void> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.projects
        (id, organization_id, display_name)
       VALUES ($1, $2, 'Montage Nord')`,
      [input.projectId, ids.organizationA],
    );
    await client.query(
      `INSERT INTO taptime_server.work_events
        (id, organization_id, target_type, target_customer_id, trigger_type,
         triggered_by_user_id, occurred_at, content_hash,
         content_hash_algorithm, content_hash_version)
       VALUES
        ($1, $4, 'project', $5, 'manual', $6, '2026-07-22T08:00:00Z',
         repeat('a', 64), 'sha256', 2),
        ($2, $4, 'project', $5, 'manual', $6, '2026-07-22T10:00:00Z',
         repeat('b', 64), 'sha256', 2),
        ($3, $4, 'project', $5, 'manual', $6, '2026-07-22T11:00:00Z',
         repeat('c', 64), 'sha256', 2)`,
      [
        input.startedEventId, input.stoppedEventId, input.reviewEventId,
        ids.organizationA, input.projectId, ids.adminA,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.time_entries
        (id, organization_id, user_id, target_type, target_customer_id,
         status, start_work_event_id, started_via, started_at)
       VALUES ($1, $2, $3, 'project', $4, 'started',
         $5, 'manual', '2026-07-22T08:00:00Z')`,
      [
        input.entryId, ids.organizationA, ids.adminA, input.projectId,
        input.startedEventId,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type,
         target_customer_id, decision_type, time_entry_id, engine_version,
         decision_payload)
       VALUES ($1, $2, $3, 'project', $4, 'time_entry_started', $5, 'da5-test', '{}')`,
      [
        input.startedEventId, ids.organizationA, ids.adminA,
        input.projectId, input.entryId,
      ],
    );
    await client.query('COMMIT');
    await client.query('BEGIN');
    await client.query(
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $1, stopped_via = 'manual',
           stopped_at = '2026-07-22T10:00:00Z', row_version = row_version + 1
       WHERE organization_id = $2 AND id = $3`,
      [input.stoppedEventId, ids.organizationA, input.entryId],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type,
         target_customer_id, decision_type, time_entry_id, engine_version,
         decision_payload)
       VALUES ($1, $2, $3, 'project', $4, 'time_entry_stopped', $5, 'da5-test', '{}')`,
      [
        input.stoppedEventId, ids.organizationA, ids.adminA,
        input.projectId, input.entryId,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.audit_events
        (id, organization_id, actor_user_id, work_event_user_id, work_event_id,
         event_type, entity_type, entity_id, occurred_at, correlation_id, payload)
       VALUES (pg_catalog.gen_random_uuid(), $1, $2, $2, $3,
         'LifecycleDeferred', 'WorkEvent', $3, pg_catalog.transaction_timestamp(),
         'da5-generalized-review', '{}')`,
      [ids.organizationA, ids.adminA, input.reviewEventId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function correctionRequest(commandId: string, startedAt: string, stoppedAt: string) {
  return {
    expectedMembershipId: ids.membershipAdminA, commandId,
    timeRecordId: ids.stoppedEntryA, expectedBaseRowVersion: 2,
    expectedRevisionNumber: 0, startedAt, stoppedAt,
    reason: 'Konkurrenztest mit geprüftem Beleg.',
  } as const;
}

async function timeReviewCounts(): Promise<{
  readonly revisions: number; readonly adjudications: number;
  readonly receipts: number; readonly audits: number;
}> {
  const result = await installerPool.query<{
    revisions: number; adjudications: number; receipts: number; audits: number;
  }>(`SELECT
        (SELECT count(*)::integer FROM taptime_server.time_record_revisions) AS revisions,
        (SELECT count(*)::integer FROM taptime_server.offline_review_adjudications) AS adjudications,
        (SELECT count(*)::integer FROM taptime_server.time_review_command_receipts) AS receipts,
        (SELECT count(*)::integer FROM taptime_server.audit_events
          WHERE event_type IN ('TimeRecordCorrected', 'TimeReviewAdjudicated')) AS audits`);
  return result.rows[0]!;
}

async function insertLegacyReview(eventId: string, occurredAt: string): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type,
       target_customer_id, triggered_by_user_id, occurred_at, content_hash,
       content_hash_algorithm, content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, repeat('b', 64), 'sha256', 1)`,
    [eventId, ids.organizationA, ids.assignmentA, ids.tagA, ids.customerA, ids.employeeA, occurredAt],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.audit_events
      (id, organization_id, actor_user_id, work_event_user_id, work_event_id,
       event_type, entity_type, entity_id, occurred_at, correlation_id, payload)
     VALUES (pg_catalog.gen_random_uuid(), $1, $2, $2, $3,
       'LifecycleDeferred', 'WorkEvent', $3, pg_catalog.transaction_timestamp(),
       'da3-extra-legacy', '{}')`,
    [ids.organizationA, ids.employeeA, eventId],
  );
}

async function insertOfflineReviewForLegacyEvent(): Promise<string> {
  const installationId = '91000000-0000-4000-8000-000000000301';
  const leaseId = '92000000-0000-4000-8000-000000000301';
  const itemId = '93000000-0000-4000-8000-000000000301';
  const receiptId = '94000000-0000-4000-8000-000000000301';
  await installerPool.query(
    `INSERT INTO taptime_server.offline_installations
      (id, organization_id, user_id, membership_id, identity_binding_id, binding_digest)
     VALUES ($1, $2, $3, $4, '11000000-0000-4000-8000-000000000302', decode(repeat('11', 32), 'hex'))`,
    [installationId, ids.organizationA, ids.employeeA, ids.membershipEmployeeA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.offline_capture_leases
      (id, organization_id, installation_id, identity_binding_id, user_id, membership_id,
       membership_row_version, membership_role, issued_at, expires_at,
       configuration_revision, item_count, serialized_bytes, manifest_digest)
     VALUES ($1, $2, $3, '11000000-0000-4000-8000-000000000302', $4, $5,
       1, 'employee', '2026-07-21T00:00:00Z', '2026-07-21T12:00:00Z',
       repeat('a', 64), 1, 1, repeat('b', 64))`,
    [leaseId, ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.offline_capture_lease_items
      (id, organization_id, lease_id, installation_id, lookup_value, assignment_id,
       nfc_tag_id, target_type, target_customer_id, display_name,
       assignment_row_version, target_row_version)
     VALUES ($1, $2, $3, $4, repeat('c', 64), $5, $6, 'customer', $7, 'Customer A',
       1, 1)`,
    [itemId, ids.organizationA, leaseId, installationId, ids.assignmentA, ids.tagA, ids.customerA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.sync_receipts
      (id, organization_id, user_id, target_type, target_customer_id, work_event_id,
       attempt_number, status)
     VALUES ($1, $2, $3, 'customer', $4, $5, 1, 'received')`,
    [receiptId, ids.organizationA, ids.employeeA, ids.customerA, ids.legacyReviewEventA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.offline_sync_cursors
      (organization_id, installation_id, user_id, membership_id,
       last_durable_sequence, review_predecessor_sequence)
     VALUES ($1, $2, $3, $4, 1, 1)`,
    [ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.offline_event_reconciliations
      (organization_id, work_event_id, receipt_id, installation_id, lease_id,
       lease_item_id, user_id, membership_id, device_sequence, request_content_hash,
       boot_marker, monotonic_anchor_milliseconds, monotonic_delta_milliseconds,
       wall_clock_anchor, clock_proof_status, clock_proof_version, provenance_version,
       result_status, review_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, repeat('d', 64),
       'da3-boot', 0, 0, '2026-07-21T00:00:00Z', 'review_only', 1, 1,
       'review_pending', 'capture_time_out_of_bounds')`,
    [
      ids.organizationA, ids.legacyReviewEventA, receiptId, installationId,
      leaseId, itemId, ids.employeeA, ids.membershipEmployeeA,
    ],
  );
  return installationId;
}

async function assertFalseCursorClearRejected(installationId: string): Promise<void> {
  const testFunction = 'taptime_server.da3_attempt_false_cursor_clear_test';
  await installerPool.query(`
    CREATE FUNCTION ${testFunction}(requested_organization_id uuid, requested_installation_id uuid)
    RETURNS void
    LANGUAGE sql
    VOLATILE
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $false_clear$
      UPDATE taptime_server.offline_sync_cursors
      SET review_predecessor_sequence = NULL
      WHERE organization_id = requested_organization_id
        AND installation_id = requested_installation_id
    $false_clear$;
    ALTER FUNCTION ${testFunction}(uuid, uuid)
      OWNER TO taptime_time_review_write_function_owner;
    REVOKE ALL ON FUNCTION ${testFunction}(uuid, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${testFunction}(uuid, uuid) TO taptime_time_review_writer;
  `);
  const directWrite = await writePool.connect();
  try {
    await directWrite.query('BEGIN');
    await directWrite.query('SET LOCAL ROLE taptime_time_review_writer');
    await expect(directWrite.query(
      `SELECT ${testFunction}($1, $2)`,
      [ids.organizationA, installationId],
    )).rejects.toMatchObject({ code: '23514' });
    await directWrite.query('ROLLBACK');
  } finally {
    directWrite.release();
    await installerPool.query(`DROP FUNCTION IF EXISTS ${testFunction}(uuid, uuid)`);
  }
}
