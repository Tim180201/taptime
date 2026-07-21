import { randomBytes, randomUUID } from 'node:crypto';
import {
  AdminWriteSessionCoordinator,
  EmployeeMembershipEnrollmentCoordinator,
  NfcTagReassignmentCoordinator,
} from '@taptime/backend-administration';
import {
  OrganizationBootstrapCoordinator,
  PostgresBootstrapCapability,
} from '@taptime/backend-bootstrap';
import type {
  AccessTokenVerifier,
  AccessTokenVerificationResult,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import { ServerCanonicalLifecycleIngestionCoordinator } from '@taptime/backend-lifecycle';
import {
  OfflineCaptureLeaseCoordinator,
  OfflineEventReconciliationCoordinator,
  OfflineLifecycleIngestionCoordinator,
} from '@taptime/backend-offline-sync';
import { TimeReviewCoordinator } from '@taptime/backend-time-review';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  migrate,
} from '@taptime/backend-schema';
import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { TimeEntryExportCoordinator } from '../src/index.js';

const installerConnectionString = process.env.DA2_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da2';
const issuer = 'https://da2-journey.synthetic.invalid/auth';
const tokens = Object.freeze({
  administrator: 'da2-journey-administrator',
  employee: 'da2-journey-employee',
});
const subjects: Readonly<Record<string, string>> = Object.freeze({
  [tokens.administrator]: 'da2-journey-administrator',
  [tokens.employee]: 'da2-journey-employee',
});
const verifier: AccessTokenVerifier = Object.freeze({
  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    const subject = subjects[accessToken];
    return subject === undefined
      ? { status: 'rejected', reason: 'invalid_signature' }
      : { status: 'verified', identity: { issuer, subject } };
  },
});

const logins = Object.freeze({
  bootstrap: 'taptime_bootstrap_operator_da2journey001',
  administration: 'taptime_da2_journey_admin',
  invitation: 'taptime_da2_journey_invite',
  enrollment: 'taptime_da2_journey_enroll',
  reassignment: 'taptime_da2_journey_reassign',
  lifecycle: 'taptime_da2_journey_lifecycle',
  offlineLease: 'taptime_da3_journey_offline_lease',
  offlineEvent: 'taptime_da3_journey_offline_event',
  offlineReconciliation: 'taptime_da3_journey_offline_reconciliation',
  reviewRead: 'taptime_da3_journey_review_read',
  reviewWrite: 'taptime_da3_journey_review_write',
  export: 'taptime_da2_journey_export',
});
const password = randomBytes(32).toString('base64url');

it('runs the authorized synthetic Setup/Lifecycle/Offline/Review/Correction/Export journey and removes all state', async () => {
  const installerPool = new Pool({ connectionString: installerConnectionString, max: 6 });
  const runtimePools: Pool[] = [];
  let journeyCompleted = false;
  try {
    await resetDatabase(installerPool);
    await createRuntimeLogins(installerPool);

    const administrationPool = runtimePool(logins.administration);
    const invitationPool = runtimePool(logins.invitation);
    const enrollmentPool = runtimePool(logins.enrollment);
    const reassignmentPool = runtimePool(logins.reassignment);
    const lifecyclePool = runtimePool(logins.lifecycle);
    const offlineLeasePool = runtimePool(logins.offlineLease);
    const offlineEventPool = runtimePool(logins.offlineEvent);
    const offlineReconciliationPool = runtimePool(logins.offlineReconciliation);
    const reviewReadPool = runtimePool(logins.reviewRead);
    const reviewWritePool = runtimePool(logins.reviewWrite);
    const exportPool = runtimePool(logins.export);
    runtimePools.push(
      administrationPool,
      invitationPool,
      enrollmentPool,
      reassignmentPool,
      lifecyclePool,
      offlineLeasePool,
      offlineEventPool,
      offlineReconciliationPool,
      reviewReadPool,
      reviewWritePool,
      exportPool,
    );

    const bootstrap = new OrganizationBootstrapCoordinator(
      verifier,
      new PostgresBootstrapCapability({
        target: bootstrapTarget(),
        operatorPrincipal: logins.bootstrap,
        passwordProvider: async () => password,
      }),
    );
    const bootstrapped = await bootstrap.bootstrap({
      requestId: randomUUID(),
      organizationDisplayName: 'TapTim.e DA2 Journey',
      accessToken: tokens.administrator,
    });
    if (bootstrapped.status !== 'succeeded') {
      throw new Error(`Synthetic bootstrap failed: ${JSON.stringify(bootstrapped)}`);
    }
    expect(bootstrapped).toMatchObject({ status: 'succeeded', idempotentRetry: false });

    const organizationId = OrganizationId(bootstrapped.organizationId);
    const administratorMembershipId = MembershipId(bootstrapped.membershipId);
    const administration = new AdminWriteSessionCoordinator(administrationPool, verifier);
    const customerAlpha = await administration.createCustomer({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      displayName: 'Customer Alpha',
    });
    const customerBeta = await administration.createCustomer({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      displayName: 'Customer Beta',
    });
    expect(customerAlpha.status).toBe('succeeded');
    expect(customerBeta.status).toBe('succeeded');
    if (customerAlpha.status !== 'succeeded' || customerBeta.status !== 'succeeded') {
      throw new Error('Synthetic Customer setup failed');
    }

    const provisioned = await administration.provisionNfcTag({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      customerId: customerAlpha.customer.id,
      displayName: 'DA2 Journey Tag',
      canonicalPayload: 'nfc:uid:v1:DA2E2E01',
    });
    expect(provisioned.status).toBe('succeeded');
    if (provisioned.status !== 'succeeded') throw new Error('Synthetic NFC setup failed');

    const enrollment = new EmployeeMembershipEnrollmentCoordinator(
      invitationPool,
      enrollmentPool,
      verifier,
    );
    const invitation = await enrollment.createInvitation({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      displayName: 'Employee Journey',
    });
    expect(invitation.status).toBe('succeeded');
    if (invitation.status !== 'succeeded') throw new Error('Synthetic invitation failed');
    await expect(enrollment.redeemInvitation({
      accessToken: tokens.employee,
      commandId: randomUUID(),
      invitationSecret: invitation.invitationSecret,
    })).resolves.toMatchObject({ status: 'succeeded', role: 'employee' });

    const employeeMembership = await installerPool.query<{ id: string }>(
      `SELECT membership.id
       FROM taptime_server.memberships AS membership
       INNER JOIN taptime_server.identity_bindings AS binding
         ON binding.user_id = membership.user_id
        AND binding.revoked_at IS NULL
       WHERE membership.organization_id = $1
         AND membership.role = 'employee'
         AND membership.revoked_at IS NULL
         AND binding.issuer = $2
         AND binding.subject = $3`,
      [organizationId, issuer, subjects[tokens.employee]],
    );
    expect(employeeMembership.rows).toHaveLength(1);
    const employeeMembershipId = MembershipId(employeeMembership.rows[0]!.id);

    const lifecycle = new ServerCanonicalLifecycleIngestionCoordinator(
      lifecyclePool,
      verifier as SupabaseJwtAccessTokenVerifier,
    );
    const firstStart = Date.now() + 1_000;
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerAlpha.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: provisioned.assignmentId,
      occurredAt: firstStart,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    const firstStopped = await lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerAlpha.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: provisioned.assignmentId,
      occurredAt: firstStart + 10_000,
    }), employeeMembershipId);
    expect(firstStopped).toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_stopped' },
    });
    if (firstStopped.status !== 'synchronized'
      || firstStopped.decision.status !== 'time_entry_stopped') {
      throw new Error('Synthetic first stopped TimeEntry is unavailable');
    }
    const firstTimeEntryId = firstStopped.decision.timeEntryId;

    const reassignment = await new NfcTagReassignmentCoordinator(
      reassignmentPool,
      verifier,
    ).reassignNfcTag({
      accessToken: tokens.administrator,
      expectedMembershipId: administratorMembershipId,
      commandId: randomUUID(),
      nfcTagId: provisioned.nfcTag.id,
      expectedActiveAssignmentId: provisioned.assignmentId,
      targetCustomerId: customerBeta.customer.id,
    });
    expect(reassignment).toMatchObject({ status: 'succeeded', assignmentChanged: true });
    if (reassignment.status !== 'succeeded') throw new Error('Synthetic reassignment failed');

    const secondStart = firstStart + 20_000;
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    await expect(lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 10_000,
    }), employeeMembershipId)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_stopped' },
    });

    const review = new TimeReviewCoordinator(reviewReadPool, reviewWritePool, verifier);

    const correctionFirstStarted = await lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 20_000,
    }), employeeMembershipId);
    expect(correctionFirstStarted).toMatchObject({
      status: 'synchronized', decision: { status: 'time_entry_started' },
    });
    if (correctionFirstStarted.status !== 'synchronized'
      || correctionFirstStarted.decision.status !== 'time_entry_started') {
      throw new Error('Synthetic correction-first race start failed');
    }
    const correctionFirstGate = createGate();
    const correctionBeforeStop = review.correctTimeRecord({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), timeRecordId: correctionFirstStarted.decision.timeEntryId,
        expectedBaseRowVersion: 2, expectedRevisionNumber: 0,
        startedAt: new Date(Date.now() - 8_000).toISOString(),
        stoppedAt: new Date(Date.now() - 7_000).toISOString(),
        reason: 'Synthetic correction wins the shared lock before lifecycle stop.',
      },
    }, { beforeCommit: correctionFirstGate.pause });
    await correctionFirstGate.entered;
    const stopAfterCorrection = lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 30_000,
    }), employeeMembershipId);
    try {
      await waitForAdvisoryLockWait(installerPool, logins.lifecycle);
    } finally {
      correctionFirstGate.release();
    }
    await expect(correctionBeforeStop).resolves.toEqual({ status: 'not_adjustable' });
    await expect(stopAfterCorrection).resolves.toMatchObject({
      status: 'synchronized', decision: { status: 'time_entry_stopped' },
    });

    const lifecycleFirstStarted = await lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 40_000,
    }), employeeMembershipId);
    expect(lifecycleFirstStarted).toMatchObject({
      status: 'synchronized', decision: { status: 'time_entry_started' },
    });
    if (lifecycleFirstStarted.status !== 'synchronized'
      || lifecycleFirstStarted.decision.status !== 'time_entry_started') {
      throw new Error('Synthetic lifecycle-first race start failed');
    }
    const lifecycleFirstGate = createGate();
    const lifecycleBeforeCorrection = lifecycle.ingest(lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 50_000,
    }), employeeMembershipId, { afterAuthorityLocked: lifecycleFirstGate.pause });
    await lifecycleFirstGate.entered;
    const lifecycleRaceCorrectedStart = new Date(Date.now() - 6_000).toISOString();
    const lifecycleRaceCorrectedStop = new Date(Date.now() - 5_000).toISOString();
    const correctionAfterStop = review.correctTimeRecord({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), timeRecordId: lifecycleFirstStarted.decision.timeEntryId,
        expectedBaseRowVersion: 2, expectedRevisionNumber: 0,
        startedAt: lifecycleRaceCorrectedStart, stoppedAt: lifecycleRaceCorrectedStop,
        reason: 'Synthetic lifecycle stop wins the shared lock before correction.',
      },
    });
    try {
      await waitForAdvisoryLockWait(installerPool, logins.reviewWrite);
    } finally {
      lifecycleFirstGate.release();
    }
    await expect(lifecycleBeforeCorrection).resolves.toMatchObject({
      status: 'synchronized', decision: { status: 'time_entry_stopped' },
    });
    await expect(correctionAfterStop).resolves.toMatchObject({
      status: 'committed', value: { revisionNumber: 1 },
    });

    const beforeCorrection = await review.queryTimeRecords({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        fromInclusive: new Date(firstStart - 60_000).toISOString(),
        toExclusive: new Date(secondStart + 60_000).toISOString(),
        limit: 100, cursor: null,
      },
    });
    expect(beforeCorrection.status).toBe('ready');
    if (beforeCorrection.status !== 'ready') throw new Error('Synthetic overview failed');
    const firstRecord = beforeCorrection.value.records.find(
      (record) => record.timeRecordId === firstTimeEntryId,
    );
    if (firstRecord === undefined || firstRecord.stoppedAt === null) {
      throw new Error('Synthetic stopped record is missing from effective overview');
    }
    const correctedStart = new Date(Date.now() - 2_000).toISOString();
    const correctedStop = new Date(Date.now() - 1_000).toISOString();
    await expect(review.correctTimeRecord({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), timeRecordId: firstRecord.timeRecordId,
        expectedBaseRowVersion: firstRecord.baseRowVersion,
        expectedRevisionNumber: firstRecord.effectiveRevisionNumber,
        startedAt: correctedStart, stoppedAt: correctedStop,
        reason: 'Synthetic DA3 operator correction.',
      },
    })).resolves.toMatchObject({ status: 'committed', value: { revisionNumber: 1 } });

    const installationBinding = randomBytes(32).toString('base64url');
    const lookupKey = randomBytes(32).toString('base64url');
    const leaseResult = await new OfflineCaptureLeaseCoordinator(
      offlineLeasePool, verifier,
    ).issue({
      accessToken: tokens.employee,
      command: { commandId: randomUUID(), installationBinding, lookupKey },
    });
    expect(leaseResult.status).toBe('ready');
    if (leaseResult.status !== 'ready') throw new Error('Synthetic offline lease failed');
    const lease = leaseResult.page;
    const offlineItem = lease.items.find(
      (item) => item.assignmentId === reassignment.resultAssignmentId,
    );
    if (offlineItem === undefined) throw new Error('Synthetic offline lease item is missing');
    const offlineIngestor = new OfflineLifecycleIngestionCoordinator(offlineEventPool, verifier);
    const offlineReviewCommand = (deviceSequence: number, workEventId: string) => ({
      accessToken: tokens.employee,
      command: {
        organizationId,
        expectedMembershipId: employeeMembershipId,
        leaseId: lease.leaseId,
        leaseItemId: offlineItem.itemId,
        installationBinding,
        deviceSequence,
        provenanceVersion: 1 as const,
        clock: {
          bootMarker: 'da3-synthetic-reboot',
          monotonicAnchorMilliseconds: 0,
          monotonicDeltaMilliseconds: 0,
          wallClockAnchor: lease.issuedAt,
          clockProofStatus: 'review_only' as const,
          clockProofVersion: 1 as const,
        },
        workEvent: {
          id: WorkEventId(workEventId),
          assignmentId: offlineItem.assignmentId,
          nfcTagId: offlineItem.nfcTagId,
          target: { targetType: 'customer' as const, targetId: offlineItem.targetId },
          occurredAt: lease.issuedAt,
        },
        receipt: { id: randomUUID(), attemptNumber: 1 },
      },
    });
    const offlineEventId = randomUUID();
    const offlineResult = await offlineIngestor.ingest(offlineReviewCommand(1, offlineEventId));
    expect(offlineResult).toMatchObject({
      status: 'review_pending', reason: 'capture_time_out_of_bounds', deviceSequence: 1,
    });
    const reconciliation = new OfflineEventReconciliationCoordinator(
      offlineReconciliationPool, verifier,
    );
    await expect(reconciliation.readReviewState({
      accessToken: tokens.employee,
      request: {
        expectedMembershipId: employeeMembershipId,
        installationId: lease.installationId,
      },
    })).resolves.toMatchObject({
      status: 'ready', value: { status: 'review_pending', earliestUnresolvedSequence: 1 },
    });

    const offlineReview = await review.queryReviewItems({
      accessToken: tokens.administrator,
      request: { expectedMembershipId: administratorMembershipId, limit: 100, cursor: null },
    });
    expect(offlineReview).toMatchObject({
      status: 'ready', value: { items: [expect.objectContaining({
        reviewItemId: offlineEventId, source: 'offline_v2', deviceSequence: 1,
      })] },
    });
    const ingestionFirstEventId = randomUUID();
    const ingestionFirstGate = createGate();
    const ingestionBeforeAdjudication = offlineIngestor.ingest(
      offlineReviewCommand(2, ingestionFirstEventId),
      { afterAuthorityLocked: ingestionFirstGate.pause },
    );
    await ingestionFirstGate.entered;
    const adjudicationAfterIngestion = review.adjudicateReviewItems({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), reviewItemIds: [offlineEventId],
        resolution: { type: 'no_time_record_change' },
        reason: 'Synthetic ingestion-first evidence reviewed without time change.',
      },
    });
    try {
      await waitForAdvisoryLockWait(installerPool, logins.reviewWrite);
    } finally {
      ingestionFirstGate.release();
    }
    await expect(ingestionBeforeAdjudication).resolves.toMatchObject({
      status: 'review_pending', reason: 'predecessor_requires_review', deviceSequence: 2,
    });
    await expect(adjudicationAfterIngestion).resolves.toMatchObject({ status: 'committed' });
    await expect(reconciliation.readReviewState({
      accessToken: tokens.employee,
      request: {
        expectedMembershipId: employeeMembershipId,
        installationId: lease.installationId,
      },
    })).resolves.toMatchObject({
      status: 'ready', value: { status: 'review_pending', earliestUnresolvedSequence: 2 },
    });

    const adjudicationFirstGate = createGate();
    const adjudicationBeforeIngestion = review.adjudicateReviewItems({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), reviewItemIds: [ingestionFirstEventId],
        resolution: { type: 'no_time_record_change' },
        reason: 'Synthetic adjudication-first evidence reviewed without time change.',
      },
    }, { beforeCommit: adjudicationFirstGate.pause });
    await adjudicationFirstGate.entered;
    const adjudicationFirstEventId = randomUUID();
    const ingestionAfterAdjudication = offlineIngestor.ingest(
      offlineReviewCommand(3, adjudicationFirstEventId),
    );
    try {
      await waitForAdvisoryLockWait(installerPool, logins.offlineEvent);
    } finally {
      adjudicationFirstGate.release();
    }
    await expect(adjudicationBeforeIngestion).resolves.toMatchObject({ status: 'committed' });
    await expect(ingestionAfterAdjudication).resolves.toMatchObject({
      status: 'review_pending', reason: 'capture_time_out_of_bounds', deviceSequence: 3,
    });
    await expect(reconciliation.readReviewState({
      accessToken: tokens.employee,
      request: {
        expectedMembershipId: employeeMembershipId,
        installationId: lease.installationId,
      },
    })).resolves.toMatchObject({
      status: 'ready', value: { status: 'review_pending', earliestUnresolvedSequence: 3 },
    });
    await expect(review.adjudicateReviewItems({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), reviewItemIds: [adjudicationFirstEventId],
        resolution: { type: 'no_time_record_change' },
        reason: 'Synthetic final offline evidence reviewed without time change.',
      },
    })).resolves.toMatchObject({ status: 'committed' });
    await expect(reconciliation.readReviewState({
      accessToken: tokens.employee,
      request: {
        expectedMembershipId: employeeMembershipId,
        installationId: lease.installationId,
      },
    })).resolves.toMatchObject({
      status: 'ready', value: { status: 'clear', confirmedThroughSequence: 3 },
    });

    const deferredCommand = lifecycleCommand({
      organizationId,
      membershipId: employeeMembershipId,
      customerId: customerBeta.customer.id,
      nfcTagId: provisioned.nfcTag.id,
      assignmentId: reassignment.resultAssignmentId,
      occurredAt: secondStart + 30_000,
    });
    await expect(lifecycle.ingestDeferred(deferredCommand, employeeMembershipId))
      .resolves.toMatchObject({ status: 'deferred', evidenceStored: true });
    const legacyReview = await review.queryReviewItems({
      accessToken: tokens.administrator,
      request: { expectedMembershipId: administratorMembershipId, limit: 100, cursor: null },
    });
    expect(legacyReview).toMatchObject({
      status: 'ready', value: { items: [expect.objectContaining({
        reviewItemId: deferredCommand.workEvent.id, source: 'server_legacy',
      })] },
    });
    await expect(review.adjudicateReviewItems({
      accessToken: tokens.administrator,
      request: {
        expectedMembershipId: administratorMembershipId,
        commandId: randomUUID(), reviewItemIds: [deferredCommand.workEvent.id],
        resolution: {
          type: 'create_recovered_time_record',
          startedAt: new Date(Date.now() - 1_000).toISOString(),
          stoppedAt: new Date().toISOString(),
        },
        reason: 'Synthetic legacy evidence recovered as a closed record.',
      },
    })).resolves.toMatchObject({
      status: 'committed', value: { resolution: 'create_recovered_time_record' },
    });

    const exported = await new TimeEntryExportCoordinator(exportPool, verifier).exportTimeEntries({
      accessToken: tokens.administrator,
      correlationId: randomUUID(),
      request: {
        expectedMembershipId: administratorMembershipId,
        fromInclusive: new Date(firstStart - 60_000).toISOString(),
        toExclusive: new Date(secondStart + 60_000).toISOString(),
      },
    });
    expect(exported).toMatchObject({ status: 'succeeded', rowCount: 5 });
    if (exported.status !== 'succeeded') throw new Error('Synthetic export failed');
    const csv = new TextDecoder().decode(exported.bytes);
    expect(csv).toContain('"Customer Alpha"');
    expect(csv).toContain('"Customer Beta"');
    expect(csv).toContain('"Employee Journey"');
    expect(csv).toContain(correctedStart.replace('Z', '000Z'));

    const evidence = await installerPool.query<{
      entries: number;
      revisions: number;
      adjudications: number;
      exports: number;
      export_rows: string;
      export_bytes: string;
      export_sha: string;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM taptime_server.time_entries) AS entries,
         (SELECT count(*)::integer FROM taptime_server.time_record_revisions) AS revisions,
         (SELECT count(*)::integer FROM taptime_server.offline_review_adjudications)
           AS adjudications,
         count(*) FILTER (WHERE event_type = 'TimeEntryExportGenerated')::integer AS exports,
         max(payload->>'rowCount') FILTER
           (WHERE event_type = 'TimeEntryExportGenerated') AS export_rows,
         max(payload->>'byteCount') FILTER
           (WHERE event_type = 'TimeEntryExportGenerated') AS export_bytes,
         max(payload->>'sha256') FILTER
           (WHERE event_type = 'TimeEntryExportGenerated') AS export_sha
       FROM taptime_server.audit_events`,
    );
    expect(evidence.rows[0]).toEqual({
      entries: 4,
      revisions: 3,
      adjudications: 4,
      exports: 1,
      export_rows: '5',
      export_bytes: String(exported.byteCount),
      export_sha: exported.sha256,
    });
    journeyCompleted = true;
  } finally {
    await Promise.all(runtimePools.map(async (pool) => pool.end().catch(() => undefined)));
    await removeJourneyState(installerPool);
    const cleanup = await installerPool.query<{
      schema_exists: boolean;
      ledger_exists: boolean;
      login_count: number;
    }>(
      `SELECT
         pg_catalog.to_regnamespace($1) IS NOT NULL AS schema_exists,
         pg_catalog.to_regclass($2) IS NOT NULL AS ledger_exists,
         (SELECT count(*)::integer FROM pg_catalog.pg_roles WHERE rolname = ANY($3::text[]))
           AS login_count`,
      [B3_SCHEMA, B3_MIGRATION_TABLE, Object.values(logins)],
    );
    await installerPool.end();
    expect(cleanup.rows[0]).toEqual({
      schema_exists: false,
      ledger_exists: false,
      login_count: 0,
    });
  }
  expect(journeyCompleted).toBe(true);
});

function lifecycleCommand(input: {
  readonly organizationId: OrganizationId;
  readonly membershipId: MembershipId;
  readonly customerId: CustomerId;
  readonly nfcTagId: NfcTagId;
  readonly assignmentId: NfcAssignmentId;
  readonly occurredAt: number;
}) {
  return {
    accessToken: tokens.employee,
    requestedOrganizationId: input.organizationId,
    workEvent: {
      id: WorkEventId(randomUUID()),
      assignmentId: input.assignmentId,
      nfcTagId: input.nfcTagId,
      target: customerAssignmentTarget(input.customerId),
      occurredAt: createTimestamp(new Date(input.occurredAt).toISOString()),
    },
    receipt: { id: randomUUID(), attemptNumber: 1 },
  };
}

function createGate(): {
  readonly entered: Promise<void>;
  readonly pause: () => Promise<void>;
  readonly release: () => void;
} {
  let announceEntry!: () => void;
  let releasePause!: () => void;
  const entered = new Promise<void>((resolve) => { announceEntry = resolve; });
  const paused = new Promise<void>((resolve) => { releasePause = resolve; });
  let released = false;
  return {
    entered,
    pause: async () => {
      announceEntry();
      await paused;
    },
    release: () => {
      if (!released) {
        released = true;
        releasePause();
      }
    },
  };
}

async function waitForAdvisoryLockWait(pool: Pool, login: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = await pool.query<{ waiting: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_catalog.pg_stat_activity
         WHERE usename = $1
           AND wait_event_type = 'Lock'
           AND pg_catalog.lower(wait_event) = 'advisory'
       ) AS waiting`,
      [login],
    );
    if (waiting.rows[0]?.waiting === true) return;
    await new Promise<void>((resolve) => { setTimeout(resolve, 10); });
  }
  throw new Error(`Synthetic runtime ${login} did not block on the shared advisory lock`);
}

function runtimePool(login: string): Pool {
  const url = new URL(installerConnectionString);
  url.username = login;
  url.password = password;
  return new Pool({ connectionString: url.href, max: 2 });
}

function bootstrapTarget() {
  const url = new URL(installerConnectionString);
  return {
    mode: 'loopback-test' as const,
    host: url.hostname,
    port: Number(url.port || '5432'),
    database: url.pathname.slice(1),
    ssl: false as const,
  };
}

async function resetDatabase(pool: Pool): Promise<void> {
  await removeJourneyState(pool);
  const result = await migrate(pool);
  expect(result.applied).toEqual([
    '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012',
  ]);
}

async function createRuntimeLogins(pool: Pool): Promise<void> {
  const grants: Readonly<Record<string, readonly string[]>> = Object.freeze({
    [logins.bootstrap]: ['taptime_bootstrap_executor'],
    [logins.administration]: ['taptime_identity_resolver', 'taptime_admin_setup'],
    [logins.invitation]: ['taptime_identity_resolver', 'taptime_employee_invitation_creator'],
    [logins.enrollment]: ['taptime_employee_enrollment_redeemer'],
    [logins.reassignment]: ['taptime_identity_resolver', 'taptime_assignment_reassigner'],
    [logins.lifecycle]: ['taptime_identity_resolver', 'taptime_server_lifecycle'],
    [logins.offlineLease]: ['taptime_offline_lease_issuer'],
    [logins.offlineEvent]: ['taptime_offline_event_ingestor'],
    [logins.offlineReconciliation]: ['taptime_offline_reconciliation_reader'],
    [logins.reviewRead]: ['taptime_identity_resolver', 'taptime_time_review_reader'],
    [logins.reviewWrite]: ['taptime_identity_resolver', 'taptime_time_review_writer'],
    [logins.export]: ['taptime_identity_resolver', 'taptime_time_exporter'],
  });
  const database = quoteIdentifier(new URL(installerConnectionString).pathname.slice(1));
  const bootstrapExpiry = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
  for (const [login, parentRoles] of Object.entries(grants)) {
    await pool.query(`
      CREATE ROLE ${login}
        LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
        PASSWORD ${quoteLiteral(password)}
        ${login === logins.bootstrap ? `VALID UNTIL ${quoteLiteral(bootstrapExpiry)}` : ''};
      GRANT ${parentRoles.join(', ')} TO ${login}
        WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
      REVOKE CREATE, TEMPORARY ON DATABASE ${database} FROM ${login};
      GRANT CONNECT ON DATABASE ${database} TO ${login}
    `);
  }
}

async function removeJourneyState(pool: Pool): Promise<void> {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  for (const login of Object.values(logins)) {
    await pool.query(`
      DROP OWNED BY ${login};
      DROP ROLE IF EXISTS ${login}
    `).catch(async () => {
      await pool.query(`DROP ROLE IF EXISTS ${login}`);
    });
  }
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
