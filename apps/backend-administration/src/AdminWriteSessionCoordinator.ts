import { createHash, randomUUID } from 'node:crypto';
import {
  createCustomerCommandDigestV1,
  normalizeCustomerNameV1,
  normalizeNfcTagNameV1,
  normalizeOrganizationNameV1,
  provisionNfcTagCommandDigestV1,
} from '@taptime/administration-contract';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  type MembershipId,
} from '@taptime/core';
import { isCanonicalNfcUidPayload } from '@taptime/core';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  AdminCoordinatorControls,
  AdminCustomerSummary,
  AdminNfcTagSummary,
  AdminProjectedNfcTagSummary,
  AdminWriteStage,
  CreateCustomerCommand,
  CreateCustomerResult,
  ProvisionNfcTagCommand,
  ProvisionNfcTagResult,
  ReadSetupProjectionCommand,
  ReadSetupProjectionResult,
} from './types.js';

export const C3C_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const C3C_ADMIN_SETUP_ROLE = 'taptime_admin_setup';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const cursorPattern = /^v1:([ct]):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const DEFAULT_INTERNAL_DEADLINE_MILLISECONDS = 8_000;
const DEADLINE_SAFETY_MILLISECONDS = 100;

interface ResolvedActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

interface NameDigestRow extends QueryResultRow {
  readonly canonical_name: string | null;
  readonly request_hash: string | null;
}

interface ReceiptRow extends QueryResultRow {
  readonly actor_user_id: string;
  readonly membership_id: string;
  readonly command_type: 'createCustomer' | 'provisionNfcTag';
  readonly request_hash_version: number;
  readonly request_hash: string;
  readonly result_status: 'succeeded';
  readonly result_customer_id: string | null;
  readonly result_nfc_tag_id: string | null;
  readonly result_nfc_assignment_id: string | null;
}

interface InsertedTagRow extends QueryResultRow {
  readonly id: string;
  readonly validation_fingerprint: string;
}

interface ProjectionRow extends QueryResultRow {
  readonly kind_order: number;
  readonly id: string;
  readonly display_name: string;
  readonly active: boolean | null;
  readonly validation_fingerprint: string | null;
  readonly target_customer_id: string | null;
  readonly active_assignment_id: string | null;
}

interface OrganizationRow extends QueryResultRow {
  readonly id: string;
  readonly name: string;
}

interface ParsedCursor {
  readonly kindOrder: 0 | 1;
  readonly id: string;
}

interface TransactionOutcome<Value> {
  readonly disposition: 'commit' | 'rollback';
  readonly value: Value;
}

export class InjectedC3CFailure extends Error {
  constructor(readonly stage: AdminWriteStage) {
    super(`Injected C3C failure after ${stage}`);
    this.name = 'InjectedC3CFailure';
  }
}

export class C3CDeadlineExceededError extends Error {
  constructor() {
    super('C3C operation deadline exceeded');
    this.name = 'C3CDeadlineExceededError';
  }
}

export class AdminWriteSessionCoordinator {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async createCustomer(
    command: CreateCustomerCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<CreateCustomerResult> {
    const normalized = typeof command.displayName === 'string'
      ? normalizeCustomerNameV1(command.displayName)
      : { status: 'invalid' as const };
    if (
      !validCommonCommand(command)
      || normalized.status === 'invalid'
    ) {
      return { status: 'invalid_request' };
    }

    return this.runWithAuthority(
      command.accessToken,
      command.expectedMembershipId,
      command.commandId,
      controls,
      async (client, actor, assertActive) => {
        const digest = await customerDigest(
          client,
          actor,
          command.displayName,
        );
        const nodeDigest = createCustomerCommandDigestV1(
          actor.organization_id,
          actor.user_id,
          actor.membership_id,
          normalized.canonicalName,
        );
        assertMatchingDigest(digest, normalized.canonicalName, nodeDigest);

        const existing = await findReceipt(client, actor.organization_id, command.commandId);
        if (existing !== null) {
          const replay = await mapCustomerReceipt(
            client,
            existing,
            actor,
            digest.request_hash!,
            normalized.canonicalName,
          );
          return { disposition: 'commit', value: replay };
        }
        await controls.afterReceiptMiss?.();
        assertActive();

        const customerId = randomUUID();
        await client.query(
          `INSERT INTO taptime_server.customers
            (id, organization_id, display_name, active)
           VALUES ($1, $2, $3, true)`,
          [customerId, actor.organization_id, digest.canonical_name],
        );
        await afterWrite('customer_and_audit', controls, assertActive);

        const receiptInserted = await insertReceipt(client, {
          organizationId: actor.organization_id,
          commandId: command.commandId,
          actor,
          commandType: 'createCustomer',
          requestHash: digest.request_hash!,
          resultCustomerId: customerId,
          resultNfcTagId: null,
          resultNfcAssignmentId: null,
        });
        if (!receiptInserted) {
          const racedReceipt = await findReceipt(
            client,
            actor.organization_id,
            command.commandId,
          );
          if (racedReceipt === null) {
            throw new Error('Administration receipt conflict did not expose a committed receipt');
          }
          return {
            disposition: 'rollback',
            value: await mapCustomerReceipt(
              client,
              racedReceipt,
              actor,
              digest.request_hash,
              normalized.canonicalName,
            ),
          };
        }
        await afterWrite('receipt', controls, assertActive);

        return {
          disposition: 'commit',
          value: customerSuccess(customerId, normalized.canonicalName, false),
        };
      },
    );
  }

  async provisionNfcTag(
    command: ProvisionNfcTagCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<ProvisionNfcTagResult> {
    const normalized = typeof command.displayName === 'string'
      ? normalizeNfcTagNameV1(command.displayName)
      : { status: 'invalid' as const };
    if (
      !validCommonCommand(command)
      || !isCanonicalUuid(command.customerId)
      || normalized.status === 'invalid'
      || typeof command.canonicalPayload !== 'string'
      || !isCanonicalNfcUidPayload(command.canonicalPayload)
    ) {
      return { status: 'invalid_request' };
    }

    return this.runWithAuthority(
      command.accessToken,
      command.expectedMembershipId,
      command.commandId,
      controls,
      async (client, actor, assertActive) => {
        const digest = await tagDigest(
          client,
          actor,
          command.customerId,
          command.displayName,
          command.canonicalPayload,
        );
        const nodeDigest = provisionNfcTagCommandDigestV1(
          actor.organization_id,
          actor.user_id,
          actor.membership_id,
          command.customerId,
          normalized.canonicalName,
          command.canonicalPayload,
        );
        assertMatchingDigest(digest, normalized.canonicalName, nodeDigest);

        const existing = await findReceipt(client, actor.organization_id, command.commandId);
        if (existing !== null) {
          const replay = await mapTagReceipt(
            client,
            existing,
            actor,
            digest.request_hash!,
            command.customerId,
            normalized.canonicalName,
            command.canonicalPayload,
          );
          return { disposition: 'commit', value: replay };
        }
        await controls.afterReceiptMiss?.();
        assertActive();

        const tagId = randomUUID();
        const insertedTag = await client.query<InsertedTagRow>(
          `SELECT
             inserted_nfc_tag_id AS id,
             validation_fingerprint
           FROM taptime_server.insert_admin_setup_nfc_tag_v1($1, $2, $3, $4)`,
          [tagId, actor.organization_id, digest.canonical_name, command.canonicalPayload],
        );
        if (insertedTag.rowCount !== 1) {
          const racedReceipt = await findReceipt(
            client,
            actor.organization_id,
            command.commandId,
          );
          if (racedReceipt !== null) {
            return {
              disposition: 'rollback',
              value: await mapTagReceipt(
                client,
                racedReceipt,
                actor,
                digest.request_hash,
                command.customerId,
                normalized.canonicalName,
                command.canonicalPayload,
              ),
            };
          }
          return {
            disposition: 'rollback',
            value: { status: 'tag_payload_already_registered' },
          };
        }
        await afterWrite('nfc_tag_and_audit', controls, assertActive);

        const target = await client.query<{ readonly id: string }>(
          `SELECT locked_customer_id AS id
           FROM taptime_server.lock_admin_setup_active_customer_v1($1, $2)`,
          [actor.organization_id, command.customerId],
        );
        if (target.rowCount !== 1) {
          return {
            disposition: 'rollback',
            value: { status: 'assignment_target_unavailable' },
          };
        }

        const assignmentId = randomUUID();
        await client.query(
          `INSERT INTO taptime_server.nfc_assignments
            (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
           VALUES ($1, $2, $3, 'customer', $4, true)`,
          [assignmentId, actor.organization_id, tagId, command.customerId],
        );
        await afterWrite('nfc_assignment_and_audit', controls, assertActive);

        const receiptInserted = await insertReceipt(client, {
          organizationId: actor.organization_id,
          commandId: command.commandId,
          actor,
          commandType: 'provisionNfcTag',
          requestHash: digest.request_hash!,
          resultCustomerId: null,
          resultNfcTagId: tagId,
          resultNfcAssignmentId: assignmentId,
        });
        if (!receiptInserted) {
          const racedReceipt = await findReceipt(
            client,
            actor.organization_id,
            command.commandId,
          );
          if (racedReceipt === null) {
            throw new Error('Administration receipt conflict did not expose a committed receipt');
          }
          return {
            disposition: 'rollback',
            value: await mapTagReceipt(
              client,
              racedReceipt,
              actor,
              digest.request_hash,
              command.customerId,
              normalized.canonicalName,
              command.canonicalPayload,
            ),
          };
        }
        await afterWrite('receipt', controls, assertActive);

        return {
          disposition: 'commit',
          value: tagSuccess(
            tagId,
            assignmentId,
            command.customerId,
            normalized.canonicalName,
            insertedTag.rows[0]!.validation_fingerprint,
            false,
          ),
        };
      },
    );
  }

  async readSetupProjection(
    command: ReadSetupProjectionCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<ReadSetupProjectionResult> {
    const cursor = parseCursor(command.cursor);
    if (
      typeof command.accessToken !== 'string'
      || command.accessToken.length === 0
      || !isCanonicalUuid(command.expectedMembershipId)
      || cursor === undefined
      || !Number.isSafeInteger(command.limit)
      || command.limit < 1
      || command.limit > 20
    ) {
      return { status: 'invalid_request' };
    }

    return this.runWithAuthority(
      command.accessToken,
      command.expectedMembershipId,
      null,
      controls,
      async (client, actor) => {
        const organization = await client.query<OrganizationRow>(
          `SELECT id, name
           FROM taptime_server.organizations
           WHERE id = $1
             AND name = taptime_server.normalize_taptime_name_v1(name, 'organization')`,
          [actor.organization_id],
        );
        if (organization.rowCount !== 1) {
          throw new Error('Derived Organization is unavailable to the setup projection');
        }

        const rows = await client.query<ProjectionRow>(
          `WITH setup_items AS (
             SELECT
               0::integer AS kind_order,
               customer.id,
               customer.display_name,
               customer.active,
               NULL::text AS validation_fingerprint,
               NULL::uuid AS target_customer_id,
               NULL::uuid AS active_assignment_id
             FROM taptime_server.customers AS customer
             WHERE customer.organization_id = $1
             UNION ALL
             SELECT
               1::integer AS kind_order,
               tag.id,
               tag.display_name,
               NULL::boolean AS active,
               tag.validation_fingerprint,
               assignment.target_customer_id,
               assignment.id AS active_assignment_id
             FROM taptime_server.nfc_tags AS tag
             LEFT JOIN taptime_server.nfc_assignments AS assignment
               ON assignment.organization_id = tag.organization_id
              AND assignment.nfc_tag_id = tag.id
              AND assignment.active
             WHERE tag.organization_id = $1
           )
           SELECT
             kind_order,
             id,
             display_name,
             active,
             validation_fingerprint,
             target_customer_id,
             active_assignment_id
           FROM setup_items
           WHERE $2::integer IS NULL
              OR kind_order > $2
              OR (kind_order = $2 AND id > $3::uuid)
           ORDER BY kind_order, id
           LIMIT $4`,
          [actor.organization_id, cursor?.kindOrder ?? null, cursor?.id ?? null, command.limit + 1],
        );

        const hasMore = rows.rows.length > command.limit;
        const pageRows = rows.rows.slice(0, command.limit);
        const customers: AdminCustomerSummary[] = [];
        const nfcTags: AdminProjectedNfcTagSummary[] = [];
        for (const row of pageRows) {
          if (row.kind_order === 0) {
            if (row.active === null) {
              throw new Error('Customer projection row has an invalid shape');
            }
            customers.push(Object.freeze({
              id: CustomerId(row.id),
              displayName: row.display_name,
              active: row.active,
            }));
            continue;
          }
          if (row.kind_order !== 1 || row.validation_fingerprint === null) {
            throw new Error('NFC Tag projection row has an invalid shape');
          }
          if ((row.target_customer_id === null) !== (row.active_assignment_id === null)) {
            throw new Error('NFC Tag projection Assignment has an invalid shape');
          }
          nfcTags.push(Object.freeze({
            id: NfcTagId(row.id),
            displayName: row.display_name,
            validationFingerprint: row.validation_fingerprint,
            assignmentState: row.target_customer_id === null ? 'unassigned' : 'assigned',
            targetCustomerId: row.target_customer_id === null
              ? null
              : CustomerId(row.target_customer_id),
            activeAssignmentId: row.active_assignment_id === null
              ? null
              : NfcAssignmentId(row.active_assignment_id),
          }));
        }

        const last = pageRows.at(-1);
        const nextCursor = hasMore && last !== undefined
          ? `v1:${last.kind_order === 0 ? 'c' : 't'}:${last.id}`
          : null;
        const organizationRow = organization.rows[0]!;
        const normalizedOrganizationName = normalizeOrganizationNameV1(organizationRow.name);
        if (
          normalizedOrganizationName.status === 'invalid'
          || normalizedOrganizationName.canonicalName !== organizationRow.name
        ) {
          throw new Error('Organization name diverged from the C3 name contract');
        }
        return {
          disposition: 'commit',
          value: Object.freeze({
            status: 'succeeded',
            organization: Object.freeze({
              id: OrganizationId(organizationRow.id),
              name: organizationRow.name,
            }),
            customers: Object.freeze(customers),
            nfcTags: Object.freeze(nfcTags),
            nextCursor,
          }),
        };
      },
    );
  }

  private async runWithAuthority<Value>(
    accessToken: string,
    expectedMembershipId: MembershipId,
    commandId: string | null,
    controls: AdminCoordinatorControls,
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
      await client.query(`SET LOCAL ROLE ${C3C_IDENTITY_RESOLVER_ROLE}`);
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

      if (commandId !== null) {
        await client.query(
          'SELECT pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))',
          [
            `taptime:c3:admin-command:v1:${actor.organization_id.length}:`
              + `${actor.organization_id}:${commandId.length}:${commandId}`,
          ],
        );
        await controls.afterCommandLocked?.();
        assertActive();
      }

      await client.query(
        `SELECT
           set_config('app.user_id', $1, true),
           set_config('app.organization_id', $2, true),
           set_config('app.membership_id', $3, true),
           set_config('app.membership_role', 'administrator', true),
           set_config('app.correlation_id', $4, true)`,
        [actor.user_id, actor.organization_id, actor.membership_id, commandId ?? randomUUID()],
      );
      await client.query(`SET LOCAL ROLE ${C3C_ADMIN_SETUP_ROLE}`);

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

function validCommonCommand(command: {
  readonly accessToken: unknown;
  readonly expectedMembershipId: unknown;
  readonly commandId: unknown;
}): boolean {
  return typeof command.accessToken === 'string'
    && command.accessToken.length > 0
    && isCanonicalUuid(command.expectedMembershipId)
    && isCanonicalUuid(command.commandId);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

function parseCursor(value: unknown): ParsedCursor | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 256) {
    return undefined;
  }
  const match = cursorPattern.exec(value);
  if (match === null) {
    return undefined;
  }
  return Object.freeze({ kindOrder: match[1] === 'c' ? 0 : 1, id: match[2]! });
}

async function customerDigest(
  client: PoolClient,
  actor: ResolvedActorRow,
  requestedName: string,
): Promise<NameDigestRow> {
  const result = await client.query<NameDigestRow>(
    `WITH normalized AS (
       SELECT taptime_server.normalize_taptime_name_v1($4, 'customer') AS canonical_name
     )
     SELECT
       canonical_name,
       pg_catalog.encode(
         taptime_server.admin_create_customer_digest_v1($1, $2, $3, canonical_name),
         'hex'
       ) AS request_hash
     FROM normalized
     WHERE canonical_name IS NOT NULL`,
    [actor.organization_id, actor.user_id, actor.membership_id, requestedName],
  );
  return result.rows[0] ?? { canonical_name: null, request_hash: null };
}

async function tagDigest(
  client: PoolClient,
  actor: ResolvedActorRow,
  customerId: string,
  requestedName: string,
  canonicalPayload: string,
): Promise<NameDigestRow> {
  const result = await client.query<NameDigestRow>(
    `WITH normalized AS (
       SELECT taptime_server.normalize_taptime_name_v1($5, 'tag') AS canonical_name
     )
     SELECT
       canonical_name,
       pg_catalog.encode(
         taptime_server.admin_provision_nfc_tag_digest_v1(
           $1, $2, $3, $4, canonical_name, $6
         ),
         'hex'
       ) AS request_hash
     FROM normalized
     WHERE canonical_name IS NOT NULL`,
    [
      actor.organization_id,
      actor.user_id,
      actor.membership_id,
      customerId,
      requestedName,
      canonicalPayload,
    ],
  );
  return result.rows[0] ?? { canonical_name: null, request_hash: null };
}

function assertMatchingDigest(
  digest: NameDigestRow,
  canonicalName: string,
  nodeDigest: string,
): asserts digest is { readonly canonical_name: string; readonly request_hash: string } {
  if (
    digest.canonical_name !== canonicalName
    || digest.request_hash === null
    || digest.request_hash !== nodeDigest
  ) {
    throw new Error('Node and database C3 command contracts diverged');
  }
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
       result_nfc_assignment_id
     FROM taptime_server.admin_setup_command_receipts
     WHERE organization_id = $1 AND command_id = $2`,
    [organizationId, commandId],
  );
  if (result.rows.length > 1) {
    throw new Error('Administration receipt lookup returned more than one row');
  }
  return result.rows[0] ?? null;
}

function receiptMatches(
  receipt: ReceiptRow,
  actor: ResolvedActorRow,
  commandType: ReceiptRow['command_type'],
  requestHash: string,
): boolean {
  return receipt.actor_user_id === actor.user_id
    && receipt.membership_id === actor.membership_id
    && receipt.command_type === commandType
    && receipt.request_hash_version === 1
    && receipt.request_hash === requestHash
    && receipt.result_status === 'succeeded';
}

async function mapCustomerReceipt(
  client: PoolClient,
  receipt: ReceiptRow,
  actor: ResolvedActorRow,
  requestHash: string,
  canonicalName: string,
): Promise<CreateCustomerResult> {
  if (!receiptMatches(receipt, actor, 'createCustomer', requestHash)) {
    return { status: 'command_id_conflict' };
  }
  if (
    receipt.result_customer_id === null
    || receipt.result_nfc_tag_id !== null
    || receipt.result_nfc_assignment_id !== null
  ) {
    throw new Error('Stored Customer receipt has an invalid result shape');
  }
  const storedCustomer = await client.query(
    `SELECT id
     FROM taptime_server.customers
     WHERE organization_id = $1
       AND id = $2
       AND display_name = $3`,
    [actor.organization_id, receipt.result_customer_id, canonicalName],
  );
  if (storedCustomer.rowCount !== 1) {
    throw new Error('Stored Customer receipt does not match its result resource');
  }
  return customerSuccess(receipt.result_customer_id, canonicalName, true);
}

async function mapTagReceipt(
  client: PoolClient,
  receipt: ReceiptRow,
  actor: ResolvedActorRow,
  requestHash: string,
  customerId: CustomerId,
  canonicalName: string,
  canonicalPayload: string,
): Promise<ProvisionNfcTagResult> {
  if (!receiptMatches(receipt, actor, 'provisionNfcTag', requestHash)) {
    return { status: 'command_id_conflict' };
  }
  if (
    receipt.result_customer_id !== null
    || receipt.result_nfc_tag_id === null
    || receipt.result_nfc_assignment_id === null
  ) {
    throw new Error('Stored Tag receipt has an invalid result shape');
  }
  const expectedDisplayFingerprint = validationFingerprint(canonicalPayload);
  const storedProvision = await client.query<{ readonly validation_fingerprint: string }>(
    `SELECT tag.validation_fingerprint
     FROM taptime_server.nfc_tags AS tag
     INNER JOIN taptime_server.nfc_assignments AS assignment
       ON assignment.organization_id = tag.organization_id
      AND assignment.id = $3
      AND assignment.nfc_tag_id = tag.id
      AND assignment.target_type = 'customer'
      AND assignment.target_customer_id = $5
     WHERE tag.organization_id = $1
       AND tag.id = $2
       AND tag.display_name = $4`,
    [
      actor.organization_id,
      receipt.result_nfc_tag_id,
      receipt.result_nfc_assignment_id,
      canonicalName,
      customerId,
    ],
  );
  if (storedProvision.rowCount !== 1) {
    throw new Error('Stored Tag receipt does not match its result resources');
  }
  // The receipt trigger binds the full raw payload to the digest. This only verifies the
  // non-authoritative display fingerprint derivation shared by PostgreSQL and Node.
  const storedDisplayFingerprint = storedProvision.rows[0]!.validation_fingerprint;
  if (storedDisplayFingerprint !== expectedDisplayFingerprint) {
    throw new Error('Stored Tag display fingerprint diverged from the C3 contract');
  }
  return tagSuccess(
    receipt.result_nfc_tag_id,
    receipt.result_nfc_assignment_id,
    customerId,
    canonicalName,
    storedDisplayFingerprint,
    true,
  );
}

function customerSuccess(
  customerId: string,
  canonicalName: string,
  idempotentRetry: boolean,
): CreateCustomerResult {
  return Object.freeze({
    status: 'succeeded',
    idempotentRetry,
    customer: Object.freeze({
      id: CustomerId(customerId),
      displayName: canonicalName,
      active: true,
    }),
  });
}

function tagSuccess(
  tagId: string,
  assignmentId: string,
  customerId: CustomerId,
  canonicalName: string,
  fingerprint: string,
  idempotentRetry: boolean,
): ProvisionNfcTagResult {
  return Object.freeze({
    status: 'succeeded',
    idempotentRetry,
    nfcTag: Object.freeze({
      id: NfcTagId(tagId),
      displayName: canonicalName,
      validationFingerprint: fingerprint,
      assignmentState: 'assigned',
      targetCustomerId: CustomerId(customerId),
    }),
    assignmentId: NfcAssignmentId(assignmentId),
  });
}

interface ReceiptInsert {
  readonly organizationId: string;
  readonly commandId: string;
  readonly actor: ResolvedActorRow;
  readonly commandType: ReceiptRow['command_type'];
  readonly requestHash: string;
  readonly resultCustomerId: string | null;
  readonly resultNfcTagId: string | null;
  readonly resultNfcAssignmentId: string | null;
}

async function insertReceipt(client: PoolClient, receipt: ReceiptInsert): Promise<boolean> {
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
       result_nfc_assignment_id
     ) VALUES ($1, $2, $3, $4, $5, 1, pg_catalog.decode($6, 'hex'), 'succeeded', $7, $8, $9)
     ON CONFLICT (organization_id, command_id) DO NOTHING
     RETURNING command_id`,
    [
      receipt.organizationId,
      receipt.commandId,
      receipt.actor.user_id,
      receipt.actor.membership_id,
      receipt.commandType,
      receipt.requestHash,
      receipt.resultCustomerId,
      receipt.resultNfcTagId,
      receipt.resultNfcAssignmentId,
    ],
  );
  return inserted.rowCount === 1;
}

function validationFingerprint(canonicalPayload: string): string {
  return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex').slice(0, 12).toUpperCase();
}

async function afterWrite(
  stage: AdminWriteStage,
  controls: AdminCoordinatorControls,
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
    throw new C3CDeadlineExceededError();
  }
}

async function setDatabaseDeadlines(client: PoolClient, deadlineEpochMilliseconds: number): Promise<void> {
  const remaining = deadlineEpochMilliseconds - Date.now() - DEADLINE_SAFETY_MILLISECONDS;
  if (remaining < 1) {
    throw new C3CDeadlineExceededError();
  }
  const milliseconds = `${remaining}ms`;
  await client.query(
    `SELECT
       set_config('lock_timeout', $1, true),
       set_config('statement_timeout', $1, true),
       set_config('transaction_timeout', $1, true)`,
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
