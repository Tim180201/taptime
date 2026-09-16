import type { PoolClient, QueryResultRow } from 'pg';
import { query, rollback, setOfflineActorContext } from './database.js';

const OFFLINE_EVENT_ROLE = 'taptime_offline_event_ingestor';
const walFilePattern = /^[0-9A-F]{24}$/;

export interface OfflineArchiveActor {
  readonly identity_binding_id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'administrator' | 'employee';
}

export interface OfflineArchiveRequirementIdentity {
  readonly workEventId: string;
  readonly receiptId: string;
  readonly installationId: string;
  readonly deviceSequence: number;
}

export interface OfflineArchiveRequirementResult {
  readonly requiredWalFile: string;
  readonly offsiteArchived: boolean;
}

export interface OfflineArchiveDurabilityPort {
  requireOffsiteArchive(
    client: PoolClient,
    actor: OfflineArchiveActor,
    identity: OfflineArchiveRequirementIdentity,
  ): Promise<OfflineArchiveRequirementResult>;
}

interface ArchiveRequirementRow extends QueryResultRow {
  readonly required_wal_file: string;
  readonly offsite_archived: boolean;
}

export class PostgresOfflineArchiveDurability implements OfflineArchiveDurabilityPort {
  async requireOffsiteArchive(
    client: PoolClient,
    actor: OfflineArchiveActor,
    identity: OfflineArchiveRequirementIdentity,
  ): Promise<OfflineArchiveRequirementResult> {
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_EVENT_ROLE}`);
      await setOfflineActorContext(client, actor);
      const result = await query<ArchiveRequirementRow>(
        client,
        `SELECT required_wal_file, offsite_archived
         FROM taptime_server.record_offline_event_archive_requirement_v1(
           $1::uuid, $2::uuid, $3::uuid, $4::bigint
         )`,
        [
          identity.workEventId,
          identity.receiptId,
          identity.installationId,
          identity.deviceSequence,
        ],
      );
      const row = result.rows.length === 1 ? result.rows[0] : undefined;
      if (
        row === undefined
        || !walFilePattern.test(row.required_wal_file)
        || typeof row.offsite_archived !== 'boolean'
      ) {
        throw new Error('Offline archive requirement capability returned invalid evidence');
      }
      await query(client, 'COMMIT');
      transactionOpen = false;
      return Object.freeze({
        requiredWalFile: row.required_wal_file,
        offsiteArchived: row.offsite_archived,
      });
    } catch (error) {
      if (transactionOpen) await rollback(client);
      throw error;
    }
  }
}
