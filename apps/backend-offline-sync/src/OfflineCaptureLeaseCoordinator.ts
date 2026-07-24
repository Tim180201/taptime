import { createHash, randomUUID } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS,
  OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS,
  encodeLengthFramedUtf8,
  isCanonicalOfflineUuid,
  isOfflineAsciiCursor,
  isOfflineBase64Url32Bytes,
  type OfflineCaptureLeaseItem,
  type OfflineCaptureLeaseItemV2,
  type OfflineCaptureLeasePage,
  type OfflineCaptureLeasePageV2,
  type OfflineCaptureLeaseResult,
  type OfflineCaptureLeaseResultV2,
} from '@taptime/offline-sync-contract';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { query, rollback, setOfflineActorContext } from './database.js';
import { offlineLookupHmac } from './lookupHmac.js';
import { offlineManifestDigest } from './manifestDigest.js';
import { offlineManifestDigestV2 } from './manifestDigest.js';
import type {
  AuthenticatedOfflineCaptureLeaseIssueCommand,
  AuthenticatedOfflineCaptureLeasePageCommand,
  OfflineCaptureLeaseIssuer,
} from './types.js';

export const OFFLINE_LEASE_ROLE = 'taptime_offline_lease_issuer';

interface ActorRow extends QueryResultRow {
  readonly identity_binding_id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'administrator' | 'employee';
  readonly membership_row_version: string;
}

interface ProjectionRow extends QueryResultRow {
  readonly assignment_id: string;
  readonly nfc_tag_id: string;
  readonly target_type: 'customer';
  readonly target_customer_id: string;
  readonly display_name: string;
  readonly canonical_payload: string;
  readonly assignment_row_version: string;
  readonly customer_row_version: string;
}

interface ProjectionRowV2 extends QueryResultRow {
  readonly item_type: 'nfc_assignment' | 'manual_target';
  readonly assignment_id: string | null;
  readonly nfc_tag_id: string | null;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly display_name: string;
  readonly canonical_payload: string | null;
  readonly assignment_row_version: string | null;
  readonly target_row_version: string;
}

interface InstallationRow extends QueryResultRow {
  readonly id: string;
}

interface ReceiptRow extends QueryResultRow {
  readonly lease_id: string;
  readonly binding_digest_hex: string;
  readonly lookup_key_digest_hex: string;
  readonly lease_schema_version: number;
}

interface LeaseRow extends QueryResultRow {
  readonly id: string;
  readonly installation_id: string;
  readonly identity_binding_id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_row_version: string;
  readonly membership_role: 'administrator' | 'employee';
  readonly issued_at: Date;
  readonly expires_at: Date;
  readonly configuration_revision: string;
  readonly item_count: number;
  readonly serialized_bytes: number;
  readonly manifest_digest: string;
  readonly lease_schema_version: number;
  readonly manifest_version: number;
}

interface ItemRow extends QueryResultRow {
  readonly id: string;
  readonly lookup_value: string;
  readonly assignment_id: string;
  readonly nfc_tag_id: string;
  readonly target_type: 'customer';
  readonly target_customer_id: string;
  readonly display_name: string;
}

interface ItemRowV2 extends QueryResultRow {
  readonly id: string;
  readonly item_type: 'nfc_assignment' | 'manual_target';
  readonly lookup_value: string | null;
  readonly assignment_id: string | null;
  readonly nfc_tag_id: string | null;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_customer_id: string;
  readonly display_name: string;
  readonly assignment_row_version: string | null;
  readonly target_row_version: string;
}

export class OfflineCaptureLeaseCoordinator implements OfflineCaptureLeaseIssuer {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly createUuid: () => string = randomUUID,
  ) {}

  async issue(
    request: AuthenticatedOfflineCaptureLeaseIssueCommand,
  ): Promise<OfflineCaptureLeaseResult> {
    const { command } = request;
    if (
      !isCanonicalOfflineUuid(command.commandId)
      || !isOfflineBase64Url32Bytes(command.installationBinding)
      || !isOfflineBase64Url32Bytes(command.lookupKey)
    ) {
      throw new TypeError('Invalid offline capture lease command');
    }
    const lookupKey = decodeBase64Url32(command.lookupKey);
    const bindingBytes = decodeBase64Url32(command.installationBinding);
    const bindingDigest = createHash('sha256').update(bindingBytes).digest();
    const lookupKeyDigest = createHash('sha256').update(lookupKey).digest();
    const verification = await this.accessTokenVerifier.verify(request.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'authority_rejected' };
    }

    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_LEASE_ROLE}`);
      const actor = await resolveActiveActor(
        client,
        verification.identity.issuer,
        verification.identity.subject,
      );
      if (actor === null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actor);
      await query(
        client,
        `SELECT pg_catalog.pg_advisory_xact_lock(
           pg_catalog.hashtextextended(pg_catalog.encode($1::bytea, 'hex'), 0)
         )`,
        [bindingDigest],
      );

      const existing = await query<ReceiptRow>(
        client,
        `SELECT receipt.lease_id,
                pg_catalog.encode(receipt.binding_digest, 'hex') AS binding_digest_hex,
                pg_catalog.encode(receipt.lookup_key_digest, 'hex') AS lookup_key_digest_hex,
                receipt.lease_schema_version
         FROM taptime_server.offline_capture_lease_receipts AS receipt
         WHERE receipt.organization_id = $1::uuid
           AND receipt.command_id = $2::uuid`,
        [actor.organization_id, command.commandId],
      );
      const prior = existing.rows[0];
      if (prior !== undefined) {
        if (
          prior.binding_digest_hex !== bindingDigest.toString('hex')
          || prior.lookup_key_digest_hex !== lookupKeyDigest.toString('hex')
          || prior.lease_schema_version !== 1
        ) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'unavailable' };
        }
        const page = await readLeasePage(client, actor.organization_id, prior.lease_id, null, 100);
        await query(client, 'COMMIT');
        transactionOpen = false;
        return page === null
          ? { status: 'unavailable' }
          : { status: 'ready', page, idempotentRetry: true };
      }

      const projection = await query<ProjectionRow>(
        client,
        `SELECT assignment_id, nfc_tag_id, target_type, target_customer_id,
                display_name, canonical_payload, assignment_row_version,
                customer_row_version
         FROM taptime_server.lock_offline_capture_projection_v1($1::uuid)`,
        [actor.organization_id],
      );
      const items = projection.rows
        .map((row): OfflineCaptureLeaseItem => Object.freeze({
          itemId: requireGeneratedUuid(this.createUuid()),
          lookup: offlineLookupHmac(lookupKey, row.canonical_payload),
          assignmentId: row.assignment_id,
          nfcTagId: row.nfc_tag_id,
          targetType: row.target_type,
          targetId: row.target_customer_id,
          displayName: row.display_name,
        }))
        .sort((left, right) => left.itemId.localeCompare(right.itemId, 'en'));
      const serializedBytes = Buffer.byteLength(JSON.stringify(items), 'utf8');
      if (
        items.length > OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS
        || serializedBytes > OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
      ) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'incomplete_or_oversize' };
      }
      const configurationRevision = createHash('sha256')
        .update(encodeLengthFramedUtf8(projection.rows.flatMap((row) => [
          row.assignment_id,
          row.nfc_tag_id,
          row.target_type,
          row.target_customer_id,
          row.display_name,
          row.assignment_row_version,
          row.customer_row_version,
        ])))
        .digest('hex');
      const manifestDigest = offlineManifestDigest(items);
      const installation = await findOrCreateInstallation(
        client,
        actor,
        bindingDigest,
        this.createUuid,
      );
      if (installation === null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'unavailable' };
      }
      const leaseId = requireGeneratedUuid(this.createUuid());
      const now = await query<{ issued_at: Date; expires_at: Date }>(
        client,
        `SELECT pg_catalog.transaction_timestamp() AS issued_at,
                pg_catalog.transaction_timestamp() + interval '12 hours' AS expires_at`,
      );
      const issuedAt = now.rows[0]!.issued_at;
      const expiresAt = now.rows[0]!.expires_at;
      await query(
        client,
        `INSERT INTO taptime_server.offline_capture_leases (
           id, organization_id, installation_id, identity_binding_id, user_id,
           membership_id, membership_row_version, membership_role, issued_at, expires_at,
           configuration_revision, item_count, serialized_bytes, manifest_digest
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::bigint, $8,
           $9::timestamptz, $10::timestamptz, $11, $12, $13, $14
         )`,
        [
          leaseId,
          actor.organization_id,
          installation.id,
          actor.identity_binding_id,
          actor.user_id,
          actor.membership_id,
          actor.membership_row_version,
          actor.membership_role,
          issuedAt,
          expiresAt,
          configurationRevision,
          items.length,
          serializedBytes,
          manifestDigest,
        ],
      );
      if (
        expiresAt.getTime() - issuedAt.getTime()
        !== OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS
      ) {
        throw new Error('Database returned an invalid offline capture lease lifetime');
      }
      await insertItems(client, actor.organization_id, installation.id, leaseId, items);
      await query(
        client,
        `INSERT INTO taptime_server.offline_capture_lease_receipts (
           organization_id, command_id, user_id, membership_id, identity_binding_id,
           installation_id, lease_id, binding_digest, lookup_key_digest
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
           $7::uuid, $8::bytea, $9::bytea)`,
        [
          actor.organization_id,
          command.commandId,
          actor.user_id,
          actor.membership_id,
          actor.identity_binding_id,
          installation.id,
          leaseId,
          bindingDigest,
          lookupKeyDigest,
        ],
      );
      const page = await readLeasePage(client, actor.organization_id, leaseId, null, 100);
      await query(client, 'COMMIT');
      transactionOpen = false;
      return page === null
        ? { status: 'unavailable' }
        : { status: 'ready', page, idempotentRetry: false };
    } catch (error) {
      if (transactionOpen) await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async readPage(
    request: AuthenticatedOfflineCaptureLeasePageCommand,
  ): Promise<OfflineCaptureLeaseResult> {
    const { command } = request;
    if (
      !isCanonicalOfflineUuid(command.leaseId)
      || !isOfflineAsciiCursor(command.cursor)
      || !Number.isSafeInteger(command.limit)
      || command.limit < 1
      || command.limit > OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS
    ) {
      throw new TypeError('Invalid offline capture lease page command');
    }
    const afterItemId = decodeCursor(command.cursor);
    if (afterItemId === null) {
      throw new TypeError('Invalid offline capture lease cursor');
    }
    const verification = await this.accessTokenVerifier.verify(request.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'authority_rejected' };
    }
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_LEASE_ROLE}`);
      const actor = await resolveActiveActor(
        client,
        verification.identity.issuer,
        verification.identity.subject,
      );
      if (actor === null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actor);
      const page = await readLeasePage(
        client,
        actor.organization_id,
        command.leaseId,
        afterItemId,
        command.limit,
      );
      await query(client, 'COMMIT');
      transactionOpen = false;
      return page === null
        ? { status: 'unavailable' }
        : { status: 'ready', page, idempotentRetry: true };
    } catch (error) {
      if (transactionOpen) await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async issueV2(
    request: AuthenticatedOfflineCaptureLeaseIssueCommand,
  ): Promise<OfflineCaptureLeaseResultV2> {
    const { command } = request;
    if (
      !isCanonicalOfflineUuid(command.commandId)
      || !isOfflineBase64Url32Bytes(command.installationBinding)
      || !isOfflineBase64Url32Bytes(command.lookupKey)
    ) {
      throw new TypeError('Invalid offline capture lease v2 command');
    }
    const lookupKey = decodeBase64Url32(command.lookupKey);
    const bindingBytes = decodeBase64Url32(command.installationBinding);
    const bindingDigest = createHash('sha256').update(bindingBytes).digest();
    const lookupKeyDigest = createHash('sha256').update(lookupKey).digest();
    const verification = await this.accessTokenVerifier.verify(request.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'authority_rejected' };
    }

    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_LEASE_ROLE}`);
      const actor = await resolveActiveActor(
        client,
        verification.identity.issuer,
        verification.identity.subject,
      );
      if (actor === null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actor);
      await query(
        client,
        `SELECT pg_catalog.pg_advisory_xact_lock(
           pg_catalog.hashtextextended(pg_catalog.encode($1::bytea, 'hex'), 0)
         )`,
        [bindingDigest],
      );

      const existing = await query<ReceiptRow>(
        client,
        `SELECT receipt.lease_id,
                pg_catalog.encode(receipt.binding_digest, 'hex') AS binding_digest_hex,
                pg_catalog.encode(receipt.lookup_key_digest, 'hex') AS lookup_key_digest_hex,
                receipt.lease_schema_version
         FROM taptime_server.offline_capture_lease_receipts AS receipt
         WHERE receipt.organization_id = $1::uuid
           AND receipt.command_id = $2::uuid`,
        [actor.organization_id, command.commandId],
      );
      const prior = existing.rows[0];
      if (prior !== undefined) {
        if (
          prior.binding_digest_hex !== bindingDigest.toString('hex')
          || prior.lookup_key_digest_hex !== lookupKeyDigest.toString('hex')
          || prior.lease_schema_version !== 2
        ) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'unavailable' };
        }
        const page = await readLeasePageV2(
          client,
          actor.organization_id,
          prior.lease_id,
          null,
          100,
        );
        await query(client, 'COMMIT');
        transactionOpen = false;
        return page === null
          ? { status: 'unavailable' }
          : { status: 'ready', page, idempotentRetry: true };
      }

      const projection = await query<ProjectionRowV2>(
        client,
        `SELECT item_type, assignment_id, nfc_tag_id, target_type, target_id,
                display_name, canonical_payload, assignment_row_version,
                target_row_version
         FROM taptime_server.lock_offline_capture_projection_v2($1::uuid)`,
        [actor.organization_id],
      );
      const items = projection.rows
        .map((row): OfflineCaptureLeaseItemV2 => {
          const targetRowVersion = requirePositiveRowVersion(row.target_row_version);
          if (row.item_type === 'manual_target') {
            return Object.freeze({
              itemType: row.item_type,
              itemId: requireGeneratedUuid(this.createUuid()),
              targetType: row.target_type,
              targetId: row.target_id,
              displayName: row.display_name,
              targetRowVersion,
            });
          }
          if (
            row.target_type !== 'customer'
            || row.assignment_id === null
            || row.nfc_tag_id === null
            || row.canonical_payload === null
            || row.assignment_row_version === null
          ) {
            throw new Error('Offline v2 NFC projection returned an invalid row');
          }
          return Object.freeze({
            itemType: row.item_type,
            itemId: requireGeneratedUuid(this.createUuid()),
            lookup: offlineLookupHmac(lookupKey, row.canonical_payload),
            assignmentId: row.assignment_id,
            nfcTagId: row.nfc_tag_id,
            targetType: row.target_type,
            targetId: row.target_id,
            displayName: row.display_name,
            assignmentRowVersion: requirePositiveRowVersion(row.assignment_row_version),
            targetRowVersion,
          });
        })
        .sort(compareItemIds);
      const serializedBytes = Buffer.byteLength(JSON.stringify(items), 'utf8');
      if (
        items.length > OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS
        || serializedBytes > OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
      ) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'incomplete_or_oversize' };
      }
      const configurationRevision = createHash('sha256')
        .update(encodeLengthFramedUtf8(projection.rows.flatMap((row) => [
          row.item_type,
          row.assignment_id ?? '',
          row.nfc_tag_id ?? '',
          row.target_type,
          row.target_id,
          row.display_name,
          row.assignment_row_version ?? '',
          row.target_row_version,
        ])))
        .digest('hex');
      const manifestDigest = offlineManifestDigestV2(items);
      const installation = await findOrCreateInstallation(
        client,
        actor,
        bindingDigest,
        this.createUuid,
      );
      if (installation === null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'unavailable' };
      }
      const leaseId = requireGeneratedUuid(this.createUuid());
      const now = await query<{ issued_at: Date; expires_at: Date }>(
        client,
        `SELECT pg_catalog.transaction_timestamp() AS issued_at,
                pg_catalog.transaction_timestamp() + interval '12 hours' AS expires_at`,
      );
      const issuedAt = now.rows[0]!.issued_at;
      const expiresAt = now.rows[0]!.expires_at;
      await query(
        client,
        `INSERT INTO taptime_server.offline_capture_leases (
           id, organization_id, installation_id, identity_binding_id, user_id,
           membership_id, membership_row_version, membership_role, issued_at, expires_at,
           configuration_revision, item_count, serialized_bytes, manifest_digest,
           lease_schema_version, manifest_version
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::bigint, $8,
           $9::timestamptz, $10::timestamptz, $11, $12, $13, $14, 2, 2
         )`,
        [
          leaseId,
          actor.organization_id,
          installation.id,
          actor.identity_binding_id,
          actor.user_id,
          actor.membership_id,
          actor.membership_row_version,
          actor.membership_role,
          issuedAt,
          expiresAt,
          configurationRevision,
          items.length,
          serializedBytes,
          manifestDigest,
        ],
      );
      if (
        expiresAt.getTime() - issuedAt.getTime()
        !== OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS
      ) {
        throw new Error('Database returned an invalid offline capture lease lifetime');
      }
      await insertItemsV2(client, actor.organization_id, installation.id, leaseId, items);
      await query(
        client,
        `INSERT INTO taptime_server.offline_capture_lease_receipts (
           organization_id, command_id, user_id, membership_id, identity_binding_id,
           installation_id, lease_id, binding_digest, lookup_key_digest,
           lease_schema_version
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
           $7::uuid, $8::bytea, $9::bytea, 2)`,
        [
          actor.organization_id,
          command.commandId,
          actor.user_id,
          actor.membership_id,
          actor.identity_binding_id,
          installation.id,
          leaseId,
          bindingDigest,
          lookupKeyDigest,
        ],
      );
      const page = await readLeasePageV2(client, actor.organization_id, leaseId, null, 100);
      await query(client, 'COMMIT');
      transactionOpen = false;
      return page === null
        ? { status: 'unavailable' }
        : { status: 'ready', page, idempotentRetry: false };
    } catch (error) {
      if (transactionOpen) await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async readPageV2(
    request: AuthenticatedOfflineCaptureLeasePageCommand,
  ): Promise<OfflineCaptureLeaseResultV2> {
    const { command } = request;
    if (
      !isCanonicalOfflineUuid(command.leaseId)
      || !isOfflineAsciiCursor(command.cursor)
      || !Number.isSafeInteger(command.limit)
      || command.limit < 1
      || command.limit > OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS
    ) {
      throw new TypeError('Invalid offline capture lease v2 page command');
    }
    const afterItemId = decodeCursor(command.cursor);
    if (afterItemId === null) {
      throw new TypeError('Invalid offline capture lease cursor');
    }
    const verification = await this.accessTokenVerifier.verify(request.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'authority_rejected' };
    }
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_LEASE_ROLE}`);
      const actor = await resolveActiveActor(
        client,
        verification.identity.issuer,
        verification.identity.subject,
      );
      if (actor === null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actor);
      const page = await readLeasePageV2(
        client,
        actor.organization_id,
        command.leaseId,
        afterItemId,
        command.limit,
      );
      await query(client, 'COMMIT');
      transactionOpen = false;
      return page === null
        ? { status: 'unavailable' }
        : { status: 'ready', page, idempotentRetry: true };
    } catch (error) {
      if (transactionOpen) await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function resolveActiveActor(
  client: PoolClient,
  issuer: string,
  subject: string,
): Promise<ActorRow | null> {
  const result = await query<ActorRow>(
    client,
    `SELECT identity_binding_id, user_id, organization_id, membership_id,
            membership_role, membership_row_version
     FROM taptime_server.lock_offline_active_actor_v1($1, $2)`,
    [issuer, subject],
  );
  if (result.rows.length > 1) {
    throw new Error('Offline actor resolver returned multiple active Memberships');
  }
  return result.rows[0] ?? null;
}

async function findOrCreateInstallation(
  client: PoolClient,
  actor: ActorRow,
  bindingDigest: Buffer,
  createUuid: () => string,
): Promise<InstallationRow | null> {
  const existing = await query<InstallationRow>(
    client,
    `SELECT id
     FROM taptime_server.offline_installations
     WHERE binding_digest = $1::bytea`,
    [bindingDigest],
  );
  if (existing.rows[0] !== undefined) {
    return existing.rows[0];
  }
  const installationId = requireGeneratedUuid(createUuid());
  const inserted = await query<InstallationRow>(
    client,
    `INSERT INTO taptime_server.offline_installations (
       id, organization_id, user_id, membership_id, identity_binding_id, binding_digest
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::bytea)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      installationId,
      actor.organization_id,
      actor.user_id,
      actor.membership_id,
      actor.identity_binding_id,
      bindingDigest,
    ],
  );
  return inserted.rows[0] ?? null;
}

async function insertItems(
  client: PoolClient,
  organizationId: string,
  installationId: string,
  leaseId: string,
  items: readonly OfflineCaptureLeaseItem[],
): Promise<void> {
  if (items.length === 0) return;
  await query(
    client,
    `INSERT INTO taptime_server.offline_capture_lease_items (
       id, organization_id, lease_id, installation_id, lookup_value, assignment_id,
       nfc_tag_id, target_type, target_customer_id, display_name,
       assignment_row_version, target_row_version
     )
     SELECT item.id, $1::uuid, $2::uuid, $3::uuid, item.lookup_value,
            item.assignment_id, item.nfc_tag_id, item.target_type,
            item.target_customer_id, item.display_name, assignment.row_version,
            target.row_version
     FROM pg_catalog.jsonb_to_recordset($4::jsonb) AS item(
       id uuid,
       lookup_value text,
       assignment_id uuid,
       nfc_tag_id uuid,
       target_type text,
       target_customer_id uuid,
       display_name text
     )
     JOIN taptime_server.work_targets AS target
       ON target.organization_id = $1::uuid
      AND target.target_type = item.target_type
      AND target.target_id = item.target_customer_id
     JOIN taptime_server.nfc_assignments AS assignment
       ON assignment.organization_id = $1::uuid
      AND assignment.id = item.assignment_id`,
    [
      organizationId,
      leaseId,
      installationId,
      JSON.stringify(items.map((item) => ({
        id: item.itemId,
        lookup_value: item.lookup,
        assignment_id: item.assignmentId,
        nfc_tag_id: item.nfcTagId,
        target_type: item.targetType,
        target_customer_id: item.targetId,
        display_name: item.displayName,
      }))),
    ],
  );
}

async function insertItemsV2(
  client: PoolClient,
  organizationId: string,
  installationId: string,
  leaseId: string,
  items: readonly OfflineCaptureLeaseItemV2[],
): Promise<void> {
  if (items.length === 0) return;
  await query(
    client,
    `INSERT INTO taptime_server.offline_capture_lease_items (
       id, organization_id, lease_id, installation_id, item_type, lookup_value,
       assignment_id, nfc_tag_id, target_type, target_customer_id, display_name,
       assignment_row_version, target_row_version
     )
     SELECT item.id, $1::uuid, $2::uuid, $3::uuid, item.item_type,
            item.lookup_value, item.assignment_id, item.nfc_tag_id,
            item.target_type, item.target_id, item.display_name,
            item.assignment_row_version, item.target_row_version
     FROM pg_catalog.jsonb_to_recordset($4::jsonb) AS item(
       id uuid,
       item_type text,
       lookup_value text,
       assignment_id uuid,
       nfc_tag_id uuid,
       target_type text,
       target_id uuid,
       display_name text,
       assignment_row_version bigint,
       target_row_version bigint
     )`,
    [
      organizationId,
      leaseId,
      installationId,
      JSON.stringify(items.map((item) => ({
        id: item.itemId,
        item_type: item.itemType,
        lookup_value: item.itemType === 'nfc_assignment' ? item.lookup : null,
        assignment_id: item.itemType === 'nfc_assignment' ? item.assignmentId : null,
        nfc_tag_id: item.itemType === 'nfc_assignment' ? item.nfcTagId : null,
        target_type: item.targetType,
        target_id: item.targetId,
        display_name: item.displayName,
        assignment_row_version:
          item.itemType === 'nfc_assignment' ? item.assignmentRowVersion : null,
        target_row_version: item.targetRowVersion,
      }))),
    ],
  );
}

async function readLeasePage(
  client: PoolClient,
  organizationId: string,
  leaseId: string,
  afterItemId: string | null,
  limit: number,
): Promise<OfflineCaptureLeasePage | null> {
  const lease = await query<LeaseRow>(
    client,
    `SELECT id, installation_id, identity_binding_id, user_id, organization_id,
            membership_id, membership_row_version, membership_role, issued_at, expires_at,
            configuration_revision, item_count, serialized_bytes, manifest_digest,
            lease_schema_version, manifest_version
     FROM taptime_server.offline_capture_leases
     WHERE organization_id = $1::uuid AND id = $2::uuid`,
    [organizationId, leaseId],
  );
  const header = lease.rows[0];
  if (
    header === undefined
    || header.lease_schema_version !== 1
    || header.manifest_version !== 1
  ) return null;
  const itemRows = await query<ItemRow>(
    client,
    `SELECT id, lookup_value, assignment_id, nfc_tag_id, target_type,
            target_customer_id, display_name
     FROM taptime_server.offline_capture_lease_items
     WHERE organization_id = $1::uuid
       AND lease_id = $2::uuid
       AND ($3::uuid IS NULL OR id > $3::uuid)
     ORDER BY id
     LIMIT $4`,
    [organizationId, leaseId, afterItemId, limit + 1],
  );
  const hasMore = itemRows.rows.length > limit;
  const selected = hasMore ? itemRows.rows.slice(0, limit) : itemRows.rows;
  const items = selected.map((item): OfflineCaptureLeaseItem => Object.freeze({
    itemId: item.id,
    lookup: item.lookup_value,
    assignmentId: item.assignment_id,
    nfcTagId: item.nfc_tag_id,
    targetType: item.target_type,
    targetId: item.target_customer_id,
    displayName: item.display_name,
  }));
  return Object.freeze({
    leaseId: header.id,
    installationId: header.installation_id,
    identityBindingId: header.identity_binding_id,
    userId: header.user_id,
    organizationId: header.organization_id,
    membershipId: header.membership_id,
    membershipRowVersion: Number(header.membership_row_version),
    role: header.membership_role,
    issuedAt: header.issued_at.toISOString(),
    expiresAt: header.expires_at.toISOString(),
    configurationRevision: header.configuration_revision,
    itemCount: header.item_count,
    serializedBytes: header.serialized_bytes,
    manifestDigest: header.manifest_digest,
    items: Object.freeze(items),
    nextCursor: hasMore ? encodeCursor(selected.at(-1)!.id) : null,
  });
}

async function readLeasePageV2(
  client: PoolClient,
  organizationId: string,
  leaseId: string,
  afterItemId: string | null,
  limit: number,
): Promise<OfflineCaptureLeasePageV2 | null> {
  const lease = await query<LeaseRow>(
    client,
    `SELECT id, installation_id, identity_binding_id, user_id, organization_id,
            membership_id, membership_row_version, membership_role, issued_at, expires_at,
            configuration_revision, item_count, serialized_bytes, manifest_digest,
            lease_schema_version, manifest_version
     FROM taptime_server.offline_capture_leases
     WHERE organization_id = $1::uuid AND id = $2::uuid`,
    [organizationId, leaseId],
  );
  const header = lease.rows[0];
  if (
    header === undefined
    || header.lease_schema_version !== 2
    || header.manifest_version !== 2
  ) return null;
  const itemRows = await query<ItemRowV2>(
    client,
    `SELECT id, item_type, lookup_value, assignment_id, nfc_tag_id, target_type,
            target_customer_id, display_name, assignment_row_version,
            target_row_version
     FROM taptime_server.offline_capture_lease_items
     WHERE organization_id = $1::uuid
       AND lease_id = $2::uuid
       AND ($3::uuid IS NULL OR id > $3::uuid)
     ORDER BY id
     LIMIT $4`,
    [organizationId, leaseId, afterItemId, limit + 1],
  );
  const hasMore = itemRows.rows.length > limit;
  const selected = hasMore ? itemRows.rows.slice(0, limit) : itemRows.rows;
  const items = selected.map((item): OfflineCaptureLeaseItemV2 => {
    const targetRowVersion = requirePositiveRowVersion(item.target_row_version);
    if (item.item_type === 'manual_target') {
      return Object.freeze({
        itemType: item.item_type,
        itemId: item.id,
        targetType: item.target_type,
        targetId: item.target_customer_id,
        displayName: item.display_name,
        targetRowVersion,
      });
    }
    if (
      item.target_type !== 'customer'
      || item.lookup_value === null
      || item.assignment_id === null
      || item.nfc_tag_id === null
      || item.assignment_row_version === null
    ) {
      throw new Error('Stored offline v2 NFC lease item has an invalid shape');
    }
    return Object.freeze({
      itemType: item.item_type,
      itemId: item.id,
      lookup: item.lookup_value,
      assignmentId: item.assignment_id,
      nfcTagId: item.nfc_tag_id,
      targetType: item.target_type,
      targetId: item.target_customer_id,
      displayName: item.display_name,
      assignmentRowVersion: requirePositiveRowVersion(item.assignment_row_version),
      targetRowVersion,
    });
  });
  return Object.freeze({
    leaseSchemaVersion: 2,
    manifestVersion: 2,
    leaseId: header.id,
    installationId: header.installation_id,
    identityBindingId: header.identity_binding_id,
    userId: header.user_id,
    organizationId: header.organization_id,
    membershipId: header.membership_id,
    membershipRowVersion: requirePositiveRowVersion(header.membership_row_version),
    role: header.membership_role,
    issuedAt: header.issued_at.toISOString(),
    expiresAt: header.expires_at.toISOString(),
    configurationRevision: header.configuration_revision,
    itemCount: header.item_count,
    serializedBytes: header.serialized_bytes,
    manifestDigest: header.manifest_digest,
    items: Object.freeze(items),
    nextCursor: hasMore ? encodeCursor(selected.at(-1)!.id) : null,
  });
}

function compareItemIds(
  left: OfflineCaptureLeaseItemV2,
  right: OfflineCaptureLeaseItemV2,
): number {
  if (left.itemId < right.itemId) return -1;
  if (left.itemId > right.itemId) return 1;
  return 0;
}

function requirePositiveRowVersion(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Database returned an invalid row version');
  }
  return parsed;
}

function decodeBase64Url32(value: string): Buffer {
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.byteLength !== 32 || bytes.toString('base64url') !== value) {
    throw new TypeError('Offline base64url value is not canonical 32-byte data');
  }
  return bytes;
}

function encodeCursor(itemId: string): string {
  return Buffer.from(itemId, 'ascii').toString('base64url');
}

function decodeCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url');
    if (decoded.toString('base64url') !== cursor) return null;
    const itemId = decoded.toString('ascii');
    return isCanonicalOfflineUuid(itemId) ? itemId : null;
  } catch {
    return null;
  }
}

function requireGeneratedUuid(value: string): string {
  if (!isCanonicalOfflineUuid(value)) {
    throw new Error('Secure UUID generator returned a non-canonical UUID');
  }
  return value;
}
