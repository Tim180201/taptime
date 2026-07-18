import { randomUUID } from 'node:crypto';
import { reassignNfcTagCommandDigestV1 } from '@taptime/administration-contract';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  CustomerId,
  NfcAssignmentId,
  type MembershipId,
} from '@taptime/core';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  ReassignNfcTagCommand,
  ReassignNfcTagResult,
  ReassignmentCoordinatorControls,
  ReassignmentWriteStage,
} from './types.js';

export const C3E2_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const C3E2_ASSIGNMENT_REASSIGNER_ROLE = 'taptime_assignment_reassigner';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEFAULT_INTERNAL_DEADLINE_MILLISECONDS = 8_000;
const DEADLINE_SAFETY_MILLISECONDS = 100;

interface ResolvedActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

interface DigestRow extends QueryResultRow {
  readonly request_hash: string;
}

interface ReceiptRow extends QueryResultRow {
  readonly actor_user_id: string;
  readonly membership_id: string;
  readonly command_type: 'createCustomer' | 'provisionNfcTag' | 'reassignNfcTag';
  readonly request_hash_version: number;
  readonly request_hash: string;
  readonly result_status: 'succeeded';
  readonly result_customer_id: string | null;
  readonly result_nfc_tag_id: string | null;
  readonly result_nfc_assignment_id: string | null;
  readonly result_replaced_assignment_id: string | null;
  readonly result_target_customer_id: string | null;
  readonly result_assignment_changed: boolean | null;
  readonly result_effective_at: string | null;
}

interface LockedAssignmentRow extends QueryResultRow {
  readonly id: string;
  readonly target_customer_id: string;
}

interface EffectiveAtRow extends QueryResultRow {
  readonly effective_at: string;
}

interface TransactionOutcome<Value> {
  readonly disposition: 'commit' | 'rollback';
  readonly value: Value;
}

export class InjectedC3E2Failure extends Error {
  constructor(readonly stage: ReassignmentWriteStage) {
    super(`Injected C3E2 failure after ${stage}`);
    this.name = 'InjectedC3E2Failure';
  }
}

export class C3E2DeadlineExceededError extends Error {
  constructor() {
    super('C3E2 operation deadline exceeded');
    this.name = 'C3E2DeadlineExceededError';
  }
}

export class NfcTagReassignmentCoordinator {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async reassignNfcTag(
    command: ReassignNfcTagCommand,
    controls: ReassignmentCoordinatorControls = {},
  ): Promise<ReassignNfcTagResult> {
    if (!validCommand(command)) {
      return { status: 'invalid_request' };
    }

    return this.runWithAuthority(
      command.accessToken,
      command.expectedMembershipId,
      command.commandId,
      controls,
      async (client, actor, assertActive) => {
        const requestHash = await commandDigest(client, actor, command);
        const nodeHash = reassignNfcTagCommandDigestV1(
          actor.organization_id,
          actor.user_id,
          actor.membership_id,
          command.nfcTagId,
          command.expectedActiveAssignmentId,
          command.targetCustomerId,
        );
        if (requestHash !== nodeHash) {
          throw new Error('Node and database C3E2 command contracts diverged');
        }

        const existing = await findReceipt(client, actor.organization_id, command.commandId);
        if (existing !== null) {
          return {
            disposition: 'commit',
            value: await mapReceipt(
              client,
              existing,
              actor,
              command,
              requestHash,
            ),
          };
        }
        await controls.afterReceiptMiss?.();
        assertActive();

        const assignment = await client.query<LockedAssignmentRow>(
          `SELECT assignment.id, assignment.target_customer_id
           FROM taptime_server.nfc_tags AS tag
           INNER JOIN taptime_server.nfc_assignments AS assignment
             ON assignment.organization_id = tag.organization_id
            AND assignment.nfc_tag_id = tag.id
            AND assignment.id = $3
            AND assignment.target_type = 'customer'
            AND assignment.active
           WHERE tag.organization_id = $1
             AND tag.id = $2
           FOR UPDATE OF assignment`,
          [
            actor.organization_id,
            command.nfcTagId,
            command.expectedActiveAssignmentId,
          ],
        );
        if (assignment.rowCount !== 1) {
          return {
            disposition: 'rollback',
            value: { status: 'assignment_conflict' },
          };
        }
        await controls.afterAssignmentLocked?.();
        assertActive();

        const target = await client.query<{ readonly locked_customer_id: string }>(
          `SELECT locked_customer_id
           FROM taptime_server.lock_assignment_reassignment_target_v1($1, $2)`,
          [actor.organization_id, command.targetCustomerId],
        );
        if (target.rowCount !== 1) {
          return {
            disposition: 'rollback',
            value: { status: 'assignment_target_unavailable' },
          };
        }

        const current = assignment.rows[0]!;
        if (current.target_customer_id === command.targetCustomerId) {
          await insertReceipt(client, {
            organizationId: actor.organization_id,
            commandId: command.commandId,
            actor,
            requestHash,
            nfcTagId: command.nfcTagId,
            resultAssignmentId: command.expectedActiveAssignmentId,
            replacedAssignmentId: null,
            targetCustomerId: command.targetCustomerId,
            assignmentChanged: false,
            effectiveAt: false,
          });
          await afterWrite('receipt', controls, assertActive);
          return {
            disposition: 'commit',
            value: successResult(
              false,
              false,
              command.expectedActiveAssignmentId,
              null,
              command.targetCustomerId,
              null,
            ),
          };
        }

        const activeWork = await client.query<{ readonly assignment_in_use: boolean }>(
          `SELECT EXISTS (
             SELECT 1
             FROM taptime_server.time_entries AS entry
             INNER JOIN taptime_server.work_events AS start_event
               ON start_event.organization_id = entry.organization_id
              AND start_event.id = entry.start_work_event_id
             WHERE entry.organization_id = $1
               AND entry.status = 'started'
               AND start_event.assignment_id = $2
           ) AS assignment_in_use`,
          [actor.organization_id, command.expectedActiveAssignmentId],
        );
        if (activeWork.rows[0]?.assignment_in_use !== false) {
          return {
            disposition: 'rollback',
            value: { status: 'assignment_in_use' },
          };
        }

        const effective = await client.query<EffectiveAtRow>(
          `SELECT pg_catalog.to_char(
             pg_catalog.transaction_timestamp() AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
           ) AS effective_at`,
        );
        const effectiveAt = effective.rows[0]?.effective_at;
        if (effectiveAt === undefined) {
          throw new Error('Database did not return the C3E2 cutover timestamp');
        }

        const closed = await client.query(
          `UPDATE taptime_server.nfc_assignments
           SET active = false,
             valid_to = pg_catalog.transaction_timestamp(),
             row_version = row_version + 1
           WHERE organization_id = $1
             AND id = $2
             AND nfc_tag_id = $3
             AND active
           RETURNING id`,
          [
            actor.organization_id,
            command.expectedActiveAssignmentId,
            command.nfcTagId,
          ],
        );
        if (closed.rowCount !== 1) {
          return {
            disposition: 'rollback',
            value: { status: 'assignment_conflict' },
          };
        }
        await afterWrite('old_assignment_and_audit', controls, assertActive);

        const newAssignmentId = randomUUID();
        await client.query(
          `INSERT INTO taptime_server.nfc_assignments (
             id, organization_id, nfc_tag_id, target_type,
             target_customer_id, active, valid_from
           ) VALUES (
             $1, $2, $3, 'customer', $4, true, pg_catalog.transaction_timestamp()
           )`,
          [
            newAssignmentId,
            actor.organization_id,
            command.nfcTagId,
            command.targetCustomerId,
          ],
        );
        await afterWrite('new_assignment_and_audit', controls, assertActive);

        await insertReceipt(client, {
          organizationId: actor.organization_id,
          commandId: command.commandId,
          actor,
          requestHash,
          nfcTagId: command.nfcTagId,
          resultAssignmentId: newAssignmentId,
          replacedAssignmentId: command.expectedActiveAssignmentId,
          targetCustomerId: command.targetCustomerId,
          assignmentChanged: true,
          effectiveAt: true,
        });
        await afterWrite('receipt', controls, assertActive);

        return {
          disposition: 'commit',
          value: successResult(
            false,
            true,
            newAssignmentId,
            command.expectedActiveAssignmentId,
            command.targetCustomerId,
            effectiveAt,
          ),
        };
      },
    );
  }

  private async runWithAuthority<Value>(
    accessToken: string,
    expectedMembershipId: MembershipId,
    commandId: string,
    controls: ReassignmentCoordinatorControls,
    operation: (
      client: PoolClient,
      actor: ResolvedActorRow,
      assertActive: () => void,
    ) => Promise<TransactionOutcome<Value>>,
  ): Promise<Value | { readonly status: 'unauthorized' } | { readonly status: 'forbidden' }> {
    const deadline = controls.deadlineEpochMilliseconds
      ?? Date.now() + DEFAULT_INTERNAL_DEADLINE_MILLISECONDS;
    assertBeforeDeadline(deadline);
    const verification = await this.accessTokenVerifier.verify(accessToken);
    if (verification.status === 'rejected') {
      return { status: 'unauthorized' };
    }
    assertBeforeDeadline(deadline);

    const client = await this.pool.connect();
    let connectionFailure: Error | undefined;
    const recordConnectionFailure = (error: Error): void => {
      connectionFailure ??= error;
    };
    const assertActive = (): void => {
      assertBeforeDeadline(deadline);
      if (connectionFailure !== undefined) {
        throw connectionFailure;
      }
    };
    client.on('error', recordConnectionFailure);
    let transactionOpen = false;
    try {
      assertActive();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE');
      transactionOpen = true;
      await setDatabaseDeadlines(client, deadline);
      await client.query(`SET LOCAL ROLE ${C3E2_IDENTITY_RESOLVER_ROLE}`);
      const authority = await client.query<ResolvedActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      if (authority.rows.length > 1) {
        throw new Error('Locked identity resolver returned more than one active Membership');
      }
      const actor = authority.rows[0];
      if (actor === undefined) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'unauthorized' };
      }
      if (actor.membership_role !== 'administrator' && actor.membership_role !== 'employee') {
        throw new Error('Locked identity resolver returned an unsupported Membership role');
      }
      if (
        actor.membership_role !== 'administrator'
        || actor.membership_id !== expectedMembershipId
      ) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'forbidden' };
      }
      await controls.afterAuthorityLocked?.();
      assertActive();

      await client.query(
        'SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))',
        [
          `taptime:c3:admin-command:v1:${actor.organization_id.length}:`
            + `${actor.organization_id}:${commandId.length}:${commandId}`,
        ],
      );
      await controls.afterCommandLocked?.();
      assertActive();

      await client.query(
        `SELECT
           pg_catalog.set_config('app.user_id', $1, true),
           pg_catalog.set_config('app.organization_id', $2, true),
           pg_catalog.set_config('app.membership_id', $3, true),
           pg_catalog.set_config('app.membership_role', 'administrator', true),
           pg_catalog.set_config('app.correlation_id', $4, true)`,
        [actor.user_id, actor.organization_id, actor.membership_id, commandId],
      );
      await client.query(`SET LOCAL ROLE ${C3E2_ASSIGNMENT_REASSIGNER_ROLE}`);

      const outcome = await operation(client, actor, assertActive);
      assertActive();
      if (outcome.disposition === 'rollback') {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return outcome.value;
      }
      await controls.beforeCommit?.();
      assertActive();
      await client.query('COMMIT');
      transactionOpen = false;
      return outcome.value;
    } catch (error) {
      if (transactionOpen) {
        await rollbackPreservingOriginalError(client);
      }
      throw error;
    } finally {
      client.off('error', recordConnectionFailure);
      client.release(connectionFailure);
    }
  }
}

function validCommand(command: ReassignNfcTagCommand): boolean {
  return typeof command.accessToken === 'string'
    && command.accessToken.length > 0
    && isCanonicalUuid(command.expectedMembershipId)
    && isCanonicalUuid(command.commandId)
    && isCanonicalUuid(command.nfcTagId)
    && isCanonicalUuid(command.expectedActiveAssignmentId)
    && isCanonicalUuid(command.targetCustomerId);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

async function commandDigest(
  client: PoolClient,
  actor: ResolvedActorRow,
  command: ReassignNfcTagCommand,
): Promise<string> {
  const result = await client.query<DigestRow>(
    `SELECT pg_catalog.encode(
       taptime_server.admin_reassign_nfc_tag_digest_v1($1, $2, $3, $4, $5, $6),
       'hex'
     ) AS request_hash`,
    [
      actor.organization_id,
      actor.user_id,
      actor.membership_id,
      command.nfcTagId,
      command.expectedActiveAssignmentId,
      command.targetCustomerId,
    ],
  );
  const requestHash = result.rows[0]?.request_hash;
  if (requestHash === undefined) {
    throw new Error('Database did not return the C3E2 command digest');
  }
  return requestHash;
}

async function findReceipt(
  client: PoolClient,
  organizationId: string,
  commandId: string,
): Promise<ReceiptRow | null> {
  const result = await client.query<ReceiptRow>(
    `SELECT
       actor_user_id,
       membership_id,
       command_type,
       request_hash_version,
       pg_catalog.encode(request_hash, 'hex') AS request_hash,
       result_status,
       result_customer_id,
       result_nfc_tag_id,
       result_nfc_assignment_id,
       result_replaced_assignment_id,
       result_target_customer_id,
       result_assignment_changed,
       CASE WHEN result_effective_at IS NULL THEN NULL ELSE pg_catalog.to_char(
         result_effective_at AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
       ) END AS result_effective_at
     FROM taptime_server.admin_setup_command_receipts
     WHERE organization_id = $1
       AND command_id = $2`,
    [organizationId, commandId],
  );
  if (result.rows.length > 1) {
    throw new Error('Administration receipt lookup returned more than one row');
  }
  return result.rows[0] ?? null;
}

async function mapReceipt(
  client: PoolClient,
  receipt: ReceiptRow,
  actor: ResolvedActorRow,
  command: ReassignNfcTagCommand,
  requestHash: string,
): Promise<ReassignNfcTagResult> {
  if (
    receipt.actor_user_id !== actor.user_id
    || receipt.membership_id !== actor.membership_id
    || receipt.command_type !== 'reassignNfcTag'
    || receipt.request_hash_version !== 1
    || receipt.request_hash !== requestHash
    || receipt.result_status !== 'succeeded'
  ) {
    return { status: 'command_id_conflict' };
  }
  if (
    receipt.result_customer_id !== null
    || receipt.result_nfc_tag_id !== command.nfcTagId
    || receipt.result_nfc_assignment_id === null
    || receipt.result_target_customer_id !== command.targetCustomerId
    || receipt.result_assignment_changed === null
  ) {
    throw new Error('Stored C3E2 receipt has an invalid result shape');
  }

  if (receipt.result_assignment_changed) {
    if (
      receipt.result_replaced_assignment_id !== command.expectedActiveAssignmentId
      || receipt.result_effective_at === null
    ) {
      throw new Error('Stored changed C3E2 receipt has an invalid result shape');
    }
    const resources = await client.query(
      `SELECT result.id
       FROM taptime_server.nfc_assignments AS result
       INNER JOIN taptime_server.nfc_assignments AS replaced
         ON replaced.organization_id = result.organization_id
        AND replaced.id = $4
        AND replaced.nfc_tag_id = result.nfc_tag_id
        AND replaced.target_type = 'customer'
        AND NOT replaced.active
        AND pg_catalog.to_char(
          replaced.valid_to AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) = $6
       WHERE result.organization_id = $1
         AND result.id = $2
         AND result.nfc_tag_id = $3
         AND result.target_type = 'customer'
         AND result.target_customer_id = $5
         AND pg_catalog.to_char(
           result.valid_from AT TIME ZONE 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
         ) = $6`,
      [
        actor.organization_id,
        receipt.result_nfc_assignment_id,
        command.nfcTagId,
        command.expectedActiveAssignmentId,
        command.targetCustomerId,
        receipt.result_effective_at,
      ],
    );
    if (resources.rowCount !== 1) {
      throw new Error('Stored changed C3E2 receipt does not match its Assignment history');
    }
    return successResult(
      true,
      true,
      receipt.result_nfc_assignment_id,
      command.expectedActiveAssignmentId,
      command.targetCustomerId,
      receipt.result_effective_at,
    );
  }

  if (
    receipt.result_nfc_assignment_id !== command.expectedActiveAssignmentId
    || receipt.result_replaced_assignment_id !== null
    || receipt.result_effective_at !== null
  ) {
    throw new Error('Stored no-op C3E2 receipt has an invalid result shape');
  }
  const resource = await client.query(
    `SELECT assignment.id
     FROM taptime_server.nfc_assignments AS assignment
     WHERE assignment.organization_id = $1
       AND assignment.id = $2
       AND assignment.nfc_tag_id = $3
       AND assignment.target_type = 'customer'
       AND assignment.target_customer_id = $4`,
    [
      actor.organization_id,
      command.expectedActiveAssignmentId,
      command.nfcTagId,
      command.targetCustomerId,
    ],
  );
  if (resource.rowCount !== 1) {
    throw new Error('Stored no-op C3E2 receipt does not match its Assignment');
  }
  return successResult(
    true,
    false,
    command.expectedActiveAssignmentId,
    null,
    command.targetCustomerId,
    null,
  );
}

interface ReceiptInsert {
  readonly organizationId: string;
  readonly commandId: string;
  readonly actor: ResolvedActorRow;
  readonly requestHash: string;
  readonly nfcTagId: string;
  readonly resultAssignmentId: string;
  readonly replacedAssignmentId: string | null;
  readonly targetCustomerId: string;
  readonly assignmentChanged: boolean;
  readonly effectiveAt: boolean;
}

async function insertReceipt(client: PoolClient, receipt: ReceiptInsert): Promise<void> {
  const inserted = await client.query(
    `INSERT INTO taptime_server.admin_setup_command_receipts (
       organization_id,
       command_id,
       actor_user_id,
       membership_id,
       command_type,
       request_hash_version,
       request_hash,
       result_status,
       result_customer_id,
       result_nfc_tag_id,
       result_nfc_assignment_id,
       result_replaced_assignment_id,
       result_target_customer_id,
       result_assignment_changed,
       result_effective_at
     ) VALUES (
       $1, $2, $3, $4, 'reassignNfcTag', 1, pg_catalog.decode($5, 'hex'),
       'succeeded', NULL, $6, $7, $8, $9, $10,
       CASE WHEN $11::boolean THEN pg_catalog.transaction_timestamp() ELSE NULL END
     )
     RETURNING command_id`,
    [
      receipt.organizationId,
      receipt.commandId,
      receipt.actor.user_id,
      receipt.actor.membership_id,
      receipt.requestHash,
      receipt.nfcTagId,
      receipt.resultAssignmentId,
      receipt.replacedAssignmentId,
      receipt.targetCustomerId,
      receipt.assignmentChanged,
      receipt.effectiveAt,
    ],
  );
  if (inserted.rowCount !== 1) {
    throw new Error('C3E2 receipt insert did not create exactly one row');
  }
}

function successResult(
  idempotentRetry: boolean,
  assignmentChanged: boolean,
  resultAssignmentId: string,
  replacedAssignmentId: string | null,
  targetCustomerId: string,
  effectiveAt: string | null,
): Extract<ReassignNfcTagResult, { readonly status: 'succeeded' }> {
  return Object.freeze({
    status: 'succeeded',
    idempotentRetry,
    assignmentChanged,
    resultAssignmentId: NfcAssignmentId(resultAssignmentId),
    replacedAssignmentId: replacedAssignmentId === null
      ? null
      : NfcAssignmentId(replacedAssignmentId),
    targetCustomerId: CustomerId(targetCustomerId),
    effectiveAt,
  });
}

async function afterWrite(
  stage: ReassignmentWriteStage,
  controls: ReassignmentCoordinatorControls,
  assertActive: () => void,
): Promise<void> {
  await controls.afterWrite?.(stage);
  assertActive();
}

function assertBeforeDeadline(deadlineEpochMilliseconds: number): void {
  if (
    !Number.isSafeInteger(deadlineEpochMilliseconds)
    || deadlineEpochMilliseconds <= Date.now()
  ) {
    throw new C3E2DeadlineExceededError();
  }
}

async function setDatabaseDeadlines(
  client: PoolClient,
  deadlineEpochMilliseconds: number,
): Promise<void> {
  const remaining = deadlineEpochMilliseconds - Date.now() - DEADLINE_SAFETY_MILLISECONDS;
  if (remaining < 1) {
    throw new C3E2DeadlineExceededError();
  }
  const milliseconds = `${remaining}ms`;
  await client.query(
    `SELECT
       pg_catalog.set_config('lock_timeout', $1, true),
       pg_catalog.set_config('statement_timeout', $1, true),
       pg_catalog.set_config('transaction_timeout', $1, true)`,
    [milliseconds],
  );
}

async function rollbackPreservingOriginalError(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original verification, database, deadline, mapping or test-injection error.
  }
}
