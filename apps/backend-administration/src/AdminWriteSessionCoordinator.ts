import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createCustomerCommandDigestV1,
  normalizeCustomerNameV1,
  normalizeNfcTagNameV1,
  normalizeOrganizationNameV1,
  provisionNfcTagCommandDigestV1,
  provisionBreakNfcTagCommandDigestV1,
} from '@taptime/administration-contract';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  CustomerId,
  isMembershipRole,
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
  AdministrationLocationActivationGap,
  AdministrationLocationSetup,
  AdministrationMembershipLocationSetup,
  AdministrationWorkTargetLocationSetup,
  CreateCustomerCommand,
  CreateCustomerResult,
  MutateLocationSetupCommand,
  MutateLocationSetupResult,
  ProvisionNfcTagCommand,
  ProvisionNfcTagResult,
  ProvisionBreakNfcTagCommand,
  ProvisionBreakNfcTagResult,
  ReadAssignableLocationsCommand,
  ReadAssignableLocationsResult,
  ReadLocationSetupProjectionCommand,
  ReadLocationSetupProjectionResult,
  ReadSetupProjectionCommand,
  ReadSetupProjectionResult,
} from './types.js';

export const C3C_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const C3C_ADMIN_SETUP_ROLE = 'taptime_admin_setup';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const cursorPattern = /^v1:([ct]):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const locationCursorPattern = /^v1:l:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const membershipLocationCursorPattern = /^v1:m:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const workTargetLocationCursorPattern = /^v1:w:(customer|project|general_work):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const locationGapCursorPattern = /^v1:g:([0-4]):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
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
  readonly assignment_type: 'work' | 'break' | null;
}

interface BreakTagReceiptRow extends QueryResultRow {
  readonly actor_user_id: string;
  readonly membership_id: string;
  readonly request_hash: string;
  readonly nfc_tag_id: string;
  readonly nfc_assignment_id: string;
  readonly validation_fingerprint: string;
}

interface OrganizationRow extends QueryResultRow {
  readonly id: string;
  readonly name: string;
}

interface LocationSetupRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly active: boolean;
  readonly row_version: string;
}

interface MembershipLocationSetupRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly role: string;
  readonly home_location_id: string | null;
  readonly work_location_ids: string[];
  readonly management_location_ids: string[];
}

interface WorkTargetLocationSetupRow extends QueryResultRow {
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly display_name: string;
  readonly location_id: string | null;
}

interface LocationGapRow extends QueryResultRow {
  readonly kind_order: number;
  readonly gap_kind: AdministrationLocationActivationGap['kind'];
  readonly id: string;
  readonly display_name: string;
}

interface LocationReceiptRow extends QueryResultRow {
  readonly actor_user_id: string;
  readonly actor_membership_id: string;
  readonly command_type: MutateLocationSetupCommand['action'];
  readonly request_hash: Buffer;
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

  async provisionBreakNfcTag(
    command: ProvisionBreakNfcTagCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<ProvisionBreakNfcTagResult> {
    const normalized = typeof command.displayName === 'string'
      ? normalizeNfcTagNameV1(command.displayName)
      : { status: 'invalid' as const };
    if (!validCommonCommand(command) || normalized.status === 'invalid'
      || typeof command.canonicalPayload !== 'string'
      || !isCanonicalNfcUidPayload(command.canonicalPayload)) {
      return { status: 'invalid_request' };
    }
    return this.runWithAuthority(command.accessToken, command.expectedMembershipId,
      command.commandId, controls, async (client, actor, assertActive) => {
        const digestRow = await client.query<NameDigestRow>(
          `WITH normalized AS (
             SELECT taptime_server.normalize_taptime_name_v1($4, 'tag') AS canonical_name
           )
           SELECT canonical_name, pg_catalog.encode(
             taptime_server.admin_provision_break_nfc_tag_digest_v1(
               $1, $2, $3, canonical_name, $5
             ), 'hex') AS request_hash
           FROM normalized WHERE canonical_name IS NOT NULL`,
          [actor.organization_id, actor.user_id, actor.membership_id,
            command.displayName, command.canonicalPayload],
        );
        const digest = digestRow.rows[0] ?? { canonical_name: null, request_hash: null };
        const nodeDigest = provisionBreakNfcTagCommandDigestV1(actor.organization_id,
          actor.user_id, actor.membership_id, normalized.canonicalName,
          command.canonicalPayload);
        assertMatchingDigest(digest, normalized.canonicalName, nodeDigest);
        const existing = await findBreakTagReceipt(client, actor.organization_id,
          command.commandId);
        if (existing !== null) {
          return { disposition: 'commit', value: mapBreakTagReceipt(existing, actor,
            digest.request_hash, normalized.canonicalName, command.canonicalPayload) };
        }
        await controls.afterReceiptMiss?.(); assertActive();
        const tagId = randomUUID();
        const insertedTag = await client.query<InsertedTagRow>(
          `SELECT inserted_nfc_tag_id AS id, validation_fingerprint
           FROM taptime_server.insert_admin_setup_nfc_tag_v1($1, $2, $3, $4)`,
          [tagId, actor.organization_id, digest.canonical_name, command.canonicalPayload]);
        if (insertedTag.rowCount !== 1) {
          return { disposition: 'rollback', value: { status: 'tag_payload_already_registered' } };
        }
        await afterWrite('nfc_tag_and_audit', controls, assertActive);
        const assignmentId = randomUUID();
        await client.query(
          `INSERT INTO taptime_server.nfc_assignments (
             id, organization_id, nfc_tag_id, target_type, target_customer_id,
             assignment_type, active
           ) VALUES ($1, $2, $3, NULL, NULL, 'break', true)`,
          [assignmentId, actor.organization_id, tagId]);
        await afterWrite('nfc_assignment_and_audit', controls, assertActive);
        const receipt = await client.query(
          `INSERT INTO taptime_server.admin_break_tag_command_receipts (
             organization_id, command_id, actor_user_id, membership_id, request_hash,
             nfc_tag_id, nfc_assignment_id
           ) VALUES ($1, $2, $3, $4, pg_catalog.decode($5, 'hex'), $6, $7)
           ON CONFLICT DO NOTHING`,
          [actor.organization_id, command.commandId, actor.user_id, actor.membership_id,
            digest.request_hash, tagId, assignmentId]);
        if (receipt.rowCount !== 1) {
          const raced = await findBreakTagReceipt(client, actor.organization_id, command.commandId);
          if (raced === null) throw new Error('Break Tag receipt race has no committed receipt');
          return { disposition: 'rollback', value: mapBreakTagReceipt(raced, actor,
            digest.request_hash, normalized.canonicalName, command.canonicalPayload) };
        }
        await afterWrite('receipt', controls, assertActive);
        return { disposition: 'commit', value: breakTagSuccess(tagId, assignmentId,
          normalized.canonicalName, insertedTag.rows[0]!.validation_fingerprint, false) };
      });
  }

  async readAssignableLocations(
    command: ReadAssignableLocationsCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<ReadAssignableLocationsResult> {
    const afterId = parseSimpleLocationCursor(command.cursor, 'locations');
    if (!validLocationRead(command, afterId)) return { status: 'invalid_request' };
    return this.runWithAuthority(
      command.accessToken,
      command.expectedMembershipId,
      null,
      controls,
      async (client, actor) => {
        const rows = await client.query<LocationSetupRow>(
          `SELECT location.id, location.display_name, location.active, location.row_version::text
           FROM taptime_server.locations AS location
           WHERE location.organization_id = $1
             AND location.active
             AND ($2::uuid IS NULL OR location.id > $2)
           ORDER BY location.id
           LIMIT $3`,
          [actor.organization_id, afterId, command.limit + 1],
        );
        const page = rows.rows.slice(0, command.limit);
        return {
          disposition: 'commit',
          value: {
            status: 'succeeded',
            locations: page.map((row) => ({ id: row.id, displayName: row.display_name })),
            nextCursor: rows.rows.length > command.limit
              ? `v1:l:${page.at(-1)!.id}`
              : null,
          },
        };
      },
    );
  }

  async readLocationSetupProjection(
    command: ReadLocationSetupProjectionCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<ReadLocationSetupProjectionResult> {
    const parsedCursor = parseLocationSetupCursor(command.kind, command.cursor);
    if (parsedCursor === undefined || !validLocationRead(command, parsedCursor)) {
      return { status: 'invalid_request' };
    }
    return this.runWithAuthority<ReadLocationSetupProjectionResult>(
      command.accessToken,
      command.expectedMembershipId,
      null,
      controls,
      async (client, actor) => {
        const feature = await client.query<{ readonly locations_enabled: boolean }>(
          `SELECT organization.locations_enabled
           FROM taptime_server.organizations AS organization
           WHERE organization.id = $1`,
          [actor.organization_id],
        );
        if (feature.rowCount !== 1) throw new Error('Location setup Organization disappeared');
        const projected = await readLocationSetupPage(
          client,
          actor.organization_id,
          actor.membership_id,
          command.kind,
          parsedCursor,
          command.limit,
        );
        return {
          disposition: 'commit',
          value: {
            status: 'succeeded',
            locationsEnabled: feature.rows[0]!.locations_enabled,
            kind: command.kind,
            items: projected.items,
            nextCursor: projected.nextCursor,
          },
        };
      },
    );
  }

  async mutateLocationSetup(
    command: MutateLocationSetupCommand,
    controls: AdminCoordinatorControls = {},
  ): Promise<MutateLocationSetupResult> {
    const prepared = prepareLocationMutation(command);
    if (prepared === null) return { status: 'invalid_request' };
    return this.runWithAuthority<MutateLocationSetupResult>(
      command.accessToken,
      command.expectedMembershipId,
      command.commandId,
      controls,
      async (client, actor, assertActive) => {
        await client.query(
          'SELECT pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 0))',
          [`taptime:t015e:location-setup:v1:${actor.organization_id}`],
        );
        assertActive();
        const existing = await client.query<LocationReceiptRow>(
          `SELECT actor_user_id, actor_membership_id, command_type, request_hash
           FROM taptime_server.location_setup_command_receipts
           WHERE organization_id = $1 AND command_id = $2`,
          [actor.organization_id, command.commandId],
        );
        if (existing.rowCount === 1) {
          const receipt = existing.rows[0]!;
          const matches = receipt.actor_user_id === actor.user_id
            && receipt.actor_membership_id === actor.membership_id
            && receipt.command_type === command.action
            && receipt.request_hash.length === prepared.requestHash.length
            && timingSafeEqual(receipt.request_hash, prepared.requestHash);
          return {
            disposition: 'commit',
            value: matches
              ? { status: 'succeeded', idempotentRetry: true }
              : { status: 'command_id_conflict' },
          };
        }
        assertActive();
        const result = await applyLocationMutation(
          client,
          actor.organization_id,
          command,
          prepared.canonicalName,
        );
        if (result.status !== 'succeeded') {
          return { disposition: 'rollback', value: result };
        }
        await client.query(
          `INSERT INTO taptime_server.location_setup_command_receipts (
             organization_id, command_id, actor_user_id, actor_membership_id,
             command_type, request_hash, result_entity_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            actor.organization_id,
            command.commandId,
            actor.user_id,
            actor.membership_id,
            command.action,
            prepared.requestHash,
            locationMutationEntityId(command, actor.organization_id),
          ],
        );
        return {
          disposition: 'commit',
          value: { status: 'succeeded', idempotentRetry: false },
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
               NULL::uuid AS active_assignment_id,
               NULL::text AS assignment_type
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
               assignment.id AS active_assignment_id,
               assignment.assignment_type
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
             active_assignment_id,
             assignment_type
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
          if ((row.assignment_type === null) !== (row.active_assignment_id === null)
            || (row.assignment_type === 'work' && row.target_customer_id === null)
            || (row.assignment_type === 'break' && row.target_customer_id !== null)) {
            throw new Error('NFC Tag projection Assignment has an invalid shape');
          }
          nfcTags.push(Object.freeze({
            id: NfcTagId(row.id),
            displayName: row.display_name,
            validationFingerprint: row.validation_fingerprint,
            assignmentState: row.active_assignment_id === null ? 'unassigned' : 'assigned',
            assignmentType: row.assignment_type,
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
      if (!isMembershipRole(actor.membership_role)) {
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

type ParsedLocationSetupCursor =
  | { readonly kind: 'locations' | 'memberships'; readonly id: string }
  | { readonly kind: 'work_targets'; readonly targetType: string; readonly id: string }
  | { readonly kind: 'activation_gaps'; readonly kindOrder: number; readonly id: string };

function validLocationRead(
  command: { readonly accessToken: unknown; readonly expectedMembershipId: unknown;
    readonly limit: unknown },
  parsedCursor: unknown,
): boolean {
  return typeof command.accessToken === 'string'
    && command.accessToken.length > 0
    && isCanonicalUuid(command.expectedMembershipId)
    && parsedCursor !== undefined
    && Number.isSafeInteger(command.limit)
    && Number(command.limit) >= 1
    && Number(command.limit) <= 100;
}

function parseSimpleLocationCursor(
  value: unknown,
  kind: 'locations' | 'memberships',
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 256) return undefined;
  const match = (kind === 'locations' ? locationCursorPattern : membershipLocationCursorPattern)
    .exec(value);
  return match?.[1];
}

function parseLocationSetupCursor(
  kind: ReadLocationSetupProjectionCommand['kind'],
  value: unknown,
): ParsedLocationSetupCursor | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 256) return undefined;
  if (kind === 'locations' || kind === 'memberships') {
    const id = parseSimpleLocationCursor(value, kind);
    return id === undefined || id === null ? id : { kind, id };
  }
  if (kind === 'work_targets') {
    const match = workTargetLocationCursorPattern.exec(value);
    return match === null ? undefined : { kind, targetType: match[1]!, id: match[2]! };
  }
  const match = locationGapCursorPattern.exec(value);
  return match === null ? undefined : { kind, kindOrder: Number(match[1]), id: match[2]! };
}

async function readLocationSetupPage(
  client: PoolClient,
  organizationId: string,
  actorMembershipId: string,
  kind: ReadLocationSetupProjectionCommand['kind'],
  cursor: ParsedLocationSetupCursor | null,
  limit: number,
): Promise<{
  readonly items: readonly (
    | AdministrationLocationSetup
    | AdministrationMembershipLocationSetup
    | AdministrationWorkTargetLocationSetup
    | AdministrationLocationActivationGap
  )[];
  readonly nextCursor: string | null;
}> {
  if (kind === 'locations') {
    const afterId = cursor?.kind === 'locations' ? cursor.id : null;
    const result = await client.query<LocationSetupRow>(
      `SELECT location.id, location.display_name, location.active, location.row_version::text
       FROM taptime_server.locations AS location
       WHERE location.organization_id = $1
         AND ($2::uuid IS NULL OR location.id > $2)
       ORDER BY location.id
       LIMIT $3`,
      [organizationId, afterId, limit + 1],
    );
    const page = result.rows.slice(0, limit);
    const items: AdministrationLocationSetup[] = page.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      active: row.active,
      rowVersion: safePositiveInteger(row.row_version, 'Location row version'),
    }));
    return { items, nextCursor: result.rows.length > limit ? `v1:l:${page.at(-1)!.id}` : null };
  }

  if (kind === 'memberships') {
    const afterId = cursor?.kind === 'memberships' ? cursor.id : null;
    const result = await client.query<MembershipLocationSetupRow>(
      `SELECT membership.id, COALESCE(membership.display_name, '') AS display_name,
              membership.role, home.location_id AS home_location_id,
              ARRAY(
                SELECT work_grant.location_id::text
                FROM taptime_server.membership_work_location_grants AS work_grant
                WHERE work_grant.organization_id = membership.organization_id
                  AND work_grant.membership_id = membership.id
                  AND work_grant.revoked_at IS NULL
                ORDER BY work_grant.location_id
              ) AS work_location_ids,
              ARRAY(
                SELECT management_grant.location_id::text
                FROM taptime_server.membership_management_location_grants AS management_grant
                WHERE management_grant.organization_id = membership.organization_id
                  AND management_grant.membership_id = membership.id
                  AND management_grant.revoked_at IS NULL
                ORDER BY management_grant.location_id
              ) AS management_location_ids
       FROM taptime_server.memberships AS membership
       LEFT JOIN taptime_server.membership_home_location_assignments AS home
         ON home.organization_id = membership.organization_id
        AND home.membership_id = membership.id
        AND home.revoked_at IS NULL
       WHERE membership.organization_id = $1
         AND membership.revoked_at IS NULL
         AND ($2::uuid IS NULL OR membership.id > $2)
       ORDER BY membership.id
       LIMIT $3`,
      [organizationId, afterId, limit + 1],
    );
    const page = result.rows.slice(0, limit);
    const items: AdministrationMembershipLocationSetup[] = page.map((row) => {
      if (!isMembershipRole(row.role)) throw new Error('Unsupported Location setup Membership role');
      return {
        id: row.id,
        displayName: row.display_name.length > 0
          ? row.display_name
          : row.id === actorMembershipId ? 'Sie selbst' : `Zugehörigkeit ${row.id}`,
        role: row.role,
        homeLocationId: row.home_location_id,
        workLocationIds: Object.freeze([...row.work_location_ids]),
        managementLocationIds: Object.freeze([...row.management_location_ids]),
      };
    });
    return { items, nextCursor: result.rows.length > limit ? `v1:m:${page.at(-1)!.id}` : null };
  }

  if (kind === 'work_targets') {
    const afterType = cursor?.kind === 'work_targets' ? cursor.targetType : null;
    const afterId = cursor?.kind === 'work_targets' ? cursor.id : null;
    const result = await client.query<WorkTargetLocationSetupRow>(
      `SELECT target.target_type, target.target_id, target.display_name,
              binding.location_id
       FROM taptime_server.work_targets AS target
       LEFT JOIN taptime_server.work_target_location_assignments AS binding
         ON binding.organization_id = target.organization_id
        AND binding.target_type = target.target_type
        AND binding.target_id = target.target_id
        AND binding.revoked_at IS NULL
       WHERE target.organization_id = $1
         AND target.active
         AND (
           $2::text IS NULL
           OR (target.target_type, target.target_id) > ($2, $3::uuid)
         )
       ORDER BY target.target_type, target.target_id
       LIMIT $4`,
      [organizationId, afterType, afterId, limit + 1],
    );
    const page = result.rows.slice(0, limit);
    const items: AdministrationWorkTargetLocationSetup[] = page.map((row) => ({
      targetType: row.target_type,
      targetId: row.target_id,
      displayName: row.display_name,
      locationId: row.location_id,
    }));
    const last = page.at(-1);
    return {
      items,
      nextCursor: result.rows.length > limit && last !== undefined
        ? `v1:w:${last.target_type}:${last.target_id}`
        : null,
    };
  }

  const afterKind = cursor?.kind === 'activation_gaps' ? cursor.kindOrder : null;
  const afterId = cursor?.kind === 'activation_gaps' ? cursor.id : null;
  const result = await client.query<LocationGapRow>(
    `WITH gaps AS (
       SELECT 0 AS kind_order, 'membership'::text AS gap_kind, membership.id,
              COALESCE(membership.display_name, CASE WHEN membership.id = $5
                THEN 'Sie selbst' ELSE 'Zugehörigkeit ' || membership.id::text END)
                AS display_name
       FROM taptime_server.memberships AS membership
       WHERE membership.organization_id = $1 AND membership.revoked_at IS NULL
         AND 1 <> (
           SELECT count(*)
           FROM taptime_server.membership_home_location_assignments AS home
           JOIN taptime_server.locations AS location
             ON location.organization_id = home.organization_id
            AND location.id = home.location_id AND location.active
           WHERE home.organization_id = membership.organization_id
             AND home.membership_id = membership.id AND home.revoked_at IS NULL
         )
       UNION ALL
       SELECT 1, 'customer', customer.id, customer.display_name
       FROM taptime_server.customers AS customer
       LEFT JOIN taptime_server.work_targets AS target
         ON target.organization_id = customer.organization_id
        AND target.target_type = 'customer' AND target.target_id = customer.id
       WHERE customer.organization_id = $1 AND customer.active
         AND (target.target_id IS NULL OR NOT target.active OR 1 <> (
           SELECT count(*) FROM taptime_server.work_target_location_assignments AS binding
           JOIN taptime_server.locations AS location
             ON location.organization_id = binding.organization_id
            AND location.id = binding.location_id AND location.active
           WHERE binding.organization_id = customer.organization_id
             AND binding.target_type = 'customer' AND binding.target_id = customer.id
             AND binding.revoked_at IS NULL
         ))
       UNION ALL
       SELECT 2, 'project', project.id, project.display_name
       FROM taptime_server.projects AS project
       LEFT JOIN taptime_server.work_targets AS target
         ON target.organization_id = project.organization_id
        AND target.target_type = 'project' AND target.target_id = project.id
       WHERE project.organization_id = $1 AND project.active
         AND (target.target_id IS NULL OR NOT target.active OR 1 <> (
           SELECT count(*) FROM taptime_server.work_target_location_assignments AS binding
           JOIN taptime_server.locations AS location
             ON location.organization_id = binding.organization_id
            AND location.id = binding.location_id AND location.active
           WHERE binding.organization_id = project.organization_id
             AND binding.target_type = 'project' AND binding.target_id = project.id
             AND binding.revoked_at IS NULL
         ))
       UNION ALL
       SELECT 3, 'work_target', target.target_id, target.display_name
       FROM taptime_server.work_targets AS target
       WHERE target.organization_id = $1 AND target.active AND target.target_type = 'general_work'
         AND 1 <> (
           SELECT count(*) FROM taptime_server.work_target_location_assignments AS binding
           JOIN taptime_server.locations AS location
             ON location.organization_id = binding.organization_id
            AND location.id = binding.location_id AND location.active
           WHERE binding.organization_id = target.organization_id
             AND binding.target_type = target.target_type
             AND binding.target_id = target.target_id AND binding.revoked_at IS NULL
         )
       UNION ALL
       SELECT 4, 'nfc_assignment', assignment.id,
              tag.display_name || ' → ' || COALESCE(target.display_name, 'Arbeitsziel fehlt')
       FROM taptime_server.nfc_assignments AS assignment
       JOIN taptime_server.nfc_tags AS tag
         ON tag.organization_id = assignment.organization_id AND tag.id = assignment.nfc_tag_id
       LEFT JOIN taptime_server.work_targets AS target
         ON target.organization_id = assignment.organization_id
        AND target.target_type = assignment.target_type
        AND target.target_id = assignment.target_customer_id
       WHERE assignment.organization_id = $1 AND assignment.active
         AND assignment.assignment_type = 'work'
         AND (target.target_id IS NULL OR NOT target.active OR 1 <> (
           SELECT count(*) FROM taptime_server.work_target_location_assignments AS binding
           JOIN taptime_server.locations AS location
             ON location.organization_id = binding.organization_id
            AND location.id = binding.location_id AND location.active
           WHERE binding.organization_id = target.organization_id
             AND binding.target_type = target.target_type
             AND binding.target_id = target.target_id AND binding.revoked_at IS NULL
         ))
     )
     SELECT kind_order, gap_kind, id, display_name FROM gaps
     WHERE $2::integer IS NULL OR (kind_order, id) > ($2, $3::uuid)
     ORDER BY kind_order, id LIMIT $4`,
    [organizationId, afterKind, afterId, limit + 1, actorMembershipId],
  );
  const page = result.rows.slice(0, limit);
  const items: AdministrationLocationActivationGap[] = page.map((row) => ({
    kind: row.gap_kind,
    id: row.id,
    displayName: row.display_name,
  }));
  const last = page.at(-1);
  return {
    items,
    nextCursor: result.rows.length > limit && last !== undefined
      ? `v1:g:${last.kind_order}:${last.id}`
      : null,
  };
}

function prepareLocationMutation(command: MutateLocationSetupCommand): {
  readonly canonicalName: string | null;
  readonly requestHash: Buffer;
} | null {
  if (!validCommonCommand(command)) return null;
  let canonicalName: string | null = null;
  if (command.action === 'create_location' || command.action === 'rename_location') {
    if (!isCanonicalUuid(command.locationId) || typeof command.displayName !== 'string') return null;
    const normalized = normalizeCustomerNameV1(command.displayName);
    if (normalized.status !== 'valid') return null;
    canonicalName = normalized.canonicalName;
    if (command.action === 'rename_location'
      && (!Number.isSafeInteger(command.expectedRowVersion) || command.expectedRowVersion < 1)) {
      return null;
    }
  } else if (command.action === 'deactivate_location') {
    if (!isCanonicalUuid(command.locationId)
      || !Number.isSafeInteger(command.expectedRowVersion) || command.expectedRowVersion < 1) return null;
  } else if (
    command.action === 'set_home_location'
    || command.action === 'set_work_location'
    || command.action === 'set_management_location'
  ) {
    if (!isCanonicalUuid(command.membershipId) || !isCanonicalUuid(command.locationId)) return null;
    if (command.action !== 'set_home_location' && typeof command.assigned !== 'boolean') return null;
  } else if (command.action === 'set_work_target_location') {
    if (!['customer', 'project', 'general_work'].includes(command.targetType)
      || !isCanonicalUuid(command.targetId) || !isCanonicalUuid(command.locationId)) return null;
  } else if (command.action === 'set_locations_enabled') {
    if (typeof command.enabled !== 'boolean') return null;
  } else {
    return null;
  }
  const common = {
    expectedMembershipId: command.expectedMembershipId,
    commandId: command.commandId,
    action: command.action,
  } as const;
  const request = command.action === 'create_location'
    ? { ...common, locationId: command.locationId, displayName: canonicalName }
    : command.action === 'rename_location'
      ? { ...common, locationId: command.locationId,
          expectedRowVersion: command.expectedRowVersion, displayName: canonicalName }
      : command.action === 'deactivate_location'
        ? { ...common, locationId: command.locationId,
            expectedRowVersion: command.expectedRowVersion }
        : command.action === 'set_home_location'
          ? { ...common, membershipId: command.membershipId, locationId: command.locationId }
          : command.action === 'set_work_location'
            ? { ...common, membershipId: command.membershipId, locationId: command.locationId,
                assigned: command.assigned }
            : command.action === 'set_management_location'
              ? { ...common, membershipId: command.membershipId, locationId: command.locationId,
                  assigned: command.assigned }
              : command.action === 'set_work_target_location'
                ? { ...common, targetType: command.targetType, targetId: command.targetId,
                    locationId: command.locationId }
                : { ...common, enabled: command.enabled };
  return {
    canonicalName,
    requestHash: createHash('sha256')
      .update('taptime:t015e:location-setup:v1\0')
      .update(JSON.stringify(request))
      .digest(),
  };
}

function locationMutationEntityId(command: MutateLocationSetupCommand, organizationId: string): string {
  switch (command.action) {
    case 'create_location':
    case 'rename_location':
    case 'deactivate_location':
    case 'set_home_location':
    case 'set_work_location':
    case 'set_management_location': return command.locationId;
    case 'set_work_target_location': return command.targetId;
    case 'set_locations_enabled': return organizationId;
  }
}

async function applyLocationMutation(
  client: PoolClient,
  organizationId: string,
  command: MutateLocationSetupCommand,
  canonicalName: string | null,
): Promise<MutateLocationSetupResult> {
  if (command.action === 'create_location') {
    const inserted = await client.query(
      `INSERT INTO taptime_server.locations (id, organization_id, display_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [command.locationId, organizationId, canonicalName],
    );
    return inserted.rowCount === 1
      ? { status: 'succeeded', idempotentRetry: false }
      : { status: 'location_unavailable' };
  }
  if (command.action === 'rename_location' || command.action === 'deactivate_location') {
    const references = command.action === 'deactivate_location'
      ? await client.query(
          `SELECT 1 FROM (
             SELECT location_id FROM taptime_server.membership_home_location_assignments
               WHERE organization_id = $1 AND location_id = $2 AND revoked_at IS NULL
             UNION ALL SELECT location_id FROM taptime_server.membership_work_location_grants
               WHERE organization_id = $1 AND location_id = $2 AND revoked_at IS NULL
             UNION ALL SELECT location_id FROM taptime_server.membership_management_location_grants
               WHERE organization_id = $1 AND location_id = $2 AND revoked_at IS NULL
             UNION ALL SELECT location_id FROM taptime_server.work_target_location_assignments
               WHERE organization_id = $1 AND location_id = $2 AND revoked_at IS NULL
           ) AS reference LIMIT 1`,
          [organizationId, command.locationId],
        )
      : null;
    if (references?.rowCount === 1) return { status: 'location_in_use' };
    const updated = command.action === 'rename_location'
      ? await client.query(
          `UPDATE taptime_server.locations
           SET display_name = $4, row_version = row_version + 1
           WHERE organization_id = $1 AND id = $2 AND active AND row_version = $3`,
          [organizationId, command.locationId, command.expectedRowVersion, canonicalName],
        )
      : await client.query(
          `UPDATE taptime_server.locations
           SET active = false, deactivated_at = pg_catalog.transaction_timestamp(),
               row_version = row_version + 1
           WHERE organization_id = $1 AND id = $2 AND active AND row_version = $3`,
          [organizationId, command.locationId, command.expectedRowVersion],
        );
    if (updated.rowCount === 1) return { status: 'succeeded', idempotentRetry: false };
    const current = await client.query<{ readonly row_version: string }>(
      `SELECT row_version::text FROM taptime_server.locations
       WHERE organization_id = $1 AND id = $2 AND active`,
      [organizationId, command.locationId],
    );
    return current.rowCount === 1 ? { status: 'stale_row_version' } : { status: 'location_unavailable' };
  }
  if (command.action === 'set_locations_enabled') {
    try {
      await client.query(
        'SELECT taptime_server.set_organization_locations_enabled_v1($1, $2)',
        [organizationId, command.enabled],
      );
      return { status: 'succeeded', idempotentRetry: false };
    } catch (error) {
      if (isPostgresError(error, '23514')) return { status: 'setup_incomplete' };
      throw error;
    }
  }

  const location = await client.query(
    `SELECT 1 FROM taptime_server.locations
     WHERE organization_id = $1 AND id = $2 AND active`,
    [organizationId, command.locationId],
  );
  if (location.rowCount !== 1) return { status: 'location_unavailable' };

  if (command.action === 'set_work_target_location') {
    const target = await client.query(
      `SELECT 1 FROM taptime_server.work_targets
       WHERE organization_id = $1 AND target_type = $2 AND target_id = $3 AND active`,
      [organizationId, command.targetType, command.targetId],
    );
    if (target.rowCount !== 1) return { status: 'target_unavailable' };
    const current = await client.query<{ readonly id: string; readonly location_id: string }>(
      `SELECT id, location_id FROM taptime_server.work_target_location_assignments
       WHERE organization_id = $1 AND target_type = $2 AND target_id = $3 AND revoked_at IS NULL
       FOR UPDATE`,
      [organizationId, command.targetType, command.targetId],
    );
    if (current.rows[0]?.location_id === command.locationId) {
      return { status: 'succeeded', idempotentRetry: false };
    }
    if (current.rowCount === 1) {
      await client.query(
        `UPDATE taptime_server.work_target_location_assignments
         SET revoked_at = pg_catalog.transaction_timestamp() WHERE id = $1`,
        [current.rows[0]!.id],
      );
    }
    await client.query(
      `INSERT INTO taptime_server.work_target_location_assignments
         (id, organization_id, target_type, target_id, location_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), organizationId, command.targetType, command.targetId, command.locationId],
    );
    return { status: 'succeeded', idempotentRetry: false };
  }

  const membership = await client.query<{ readonly role: string }>(
    `SELECT role FROM taptime_server.memberships
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL`,
    [organizationId, command.membershipId],
  );
  if (membership.rowCount !== 1) return { status: 'membership_unavailable' };
  if (command.action === 'set_management_location'
    && command.assigned && membership.rows[0]!.role !== 'standortleitung') {
    return { status: 'management_role_required' };
  }

  if (command.action === 'set_home_location') {
    const workConflict = await client.query(
      `SELECT 1 FROM taptime_server.membership_work_location_grants
       WHERE organization_id = $1 AND membership_id = $2 AND location_id = $3
         AND revoked_at IS NULL`,
      [organizationId, command.membershipId, command.locationId],
    );
    if (workConflict.rowCount === 1) return { status: 'home_work_conflict' };
    const current = await client.query<{ readonly id: string; readonly location_id: string }>(
      `SELECT id, location_id FROM taptime_server.membership_home_location_assignments
       WHERE organization_id = $1 AND membership_id = $2 AND revoked_at IS NULL FOR UPDATE`,
      [organizationId, command.membershipId],
    );
    if (current.rows[0]?.location_id === command.locationId) {
      return { status: 'succeeded', idempotentRetry: false };
    }
    if (current.rowCount === 1) {
      await client.query(
        `UPDATE taptime_server.membership_home_location_assignments
         SET revoked_at = pg_catalog.transaction_timestamp() WHERE id = $1`,
        [current.rows[0]!.id],
      );
    }
    await client.query(
      `INSERT INTO taptime_server.membership_home_location_assignments
         (id, organization_id, membership_id, location_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), organizationId, command.membershipId, command.locationId],
    );
    return { status: 'succeeded', idempotentRetry: false };
  }

  const table = command.action === 'set_work_location'
    ? 'membership_work_location_grants'
    : 'membership_management_location_grants';
  if (command.action === 'set_work_location' && command.assigned) {
    const homeConflict = await client.query(
      `SELECT 1 FROM taptime_server.membership_home_location_assignments
       WHERE organization_id = $1 AND membership_id = $2 AND location_id = $3
         AND revoked_at IS NULL`,
      [organizationId, command.membershipId, command.locationId],
    );
    if (homeConflict.rowCount === 1) return { status: 'home_work_conflict' };
  }
  const current = await client.query<{ readonly id: string }>(
    `SELECT id FROM taptime_server.${table}
     WHERE organization_id = $1 AND membership_id = $2 AND location_id = $3
       AND revoked_at IS NULL FOR UPDATE`,
    [organizationId, command.membershipId, command.locationId],
  );
  if (command.assigned && current.rowCount === 0) {
    await client.query(
      `INSERT INTO taptime_server.${table}
         (id, organization_id, membership_id, location_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), organizationId, command.membershipId, command.locationId],
    );
  } else if (!command.assigned && current.rowCount === 1) {
    await client.query(
      `UPDATE taptime_server.${table}
       SET revoked_at = pg_catalog.transaction_timestamp() WHERE id = $1`,
      [current.rows[0]!.id],
    );
  }
  return { status: 'succeeded', idempotentRetry: false };
}

function safePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} is unsafe`);
  return parsed;
}

function isPostgresError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { readonly code?: unknown }).code === code;
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

async function findBreakTagReceipt(
  client: PoolClient,
  organizationId: string,
  commandId: string,
): Promise<BreakTagReceiptRow | null> {
  const result = await client.query<BreakTagReceiptRow>(
    `SELECT receipt.actor_user_id, receipt.membership_id,
            pg_catalog.encode(receipt.request_hash, 'hex') AS request_hash,
            receipt.nfc_tag_id, receipt.nfc_assignment_id, tag.validation_fingerprint
     FROM taptime_server.admin_break_tag_command_receipts AS receipt
     JOIN taptime_server.nfc_tags AS tag
       ON tag.organization_id = receipt.organization_id AND tag.id = receipt.nfc_tag_id
     JOIN taptime_server.nfc_assignments AS assignment
       ON assignment.organization_id = receipt.organization_id
      AND assignment.id = receipt.nfc_assignment_id
      AND assignment.nfc_tag_id = tag.id
      AND assignment.assignment_type = 'break'
     WHERE receipt.organization_id = $1 AND receipt.command_id = $2`,
    [organizationId, commandId]);
  if (result.rows.length > 1) throw new Error('Break Tag receipt lookup returned multiple rows');
  return result.rows[0] ?? null;
}

function mapBreakTagReceipt(
  receipt: BreakTagReceiptRow,
  actor: ResolvedActorRow,
  requestHash: string,
  canonicalName: string,
  canonicalPayload: string,
): ProvisionBreakNfcTagResult {
  if (receipt.actor_user_id !== actor.user_id || receipt.membership_id !== actor.membership_id
    || receipt.request_hash !== requestHash) return { status: 'command_id_conflict' };
  const fingerprint = validationFingerprint(canonicalPayload);
  if (receipt.validation_fingerprint !== fingerprint) {
    throw new Error('Stored Break Tag fingerprint diverged from command');
  }
  return breakTagSuccess(receipt.nfc_tag_id, receipt.nfc_assignment_id,
    canonicalName, fingerprint, true);
}

function breakTagSuccess(
  tagId: string,
  assignmentId: string,
  canonicalName: string,
  fingerprint: string,
  idempotentRetry: boolean,
): ProvisionBreakNfcTagResult {
  return Object.freeze({ status: 'succeeded', idempotentRetry,
    nfcTag: Object.freeze({ id: NfcTagId(tagId), displayName: canonicalName,
      validationFingerprint: fingerprint, assignmentState: 'assigned',
      assignmentType: 'break', targetCustomerId: null }),
    assignmentId: NfcAssignmentId(assignmentId) });
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
      assignmentType: 'work',
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
