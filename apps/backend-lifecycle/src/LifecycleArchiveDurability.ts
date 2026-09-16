import type { PoolClient, QueryResultRow } from 'pg';

const LIFECYCLE_ROLE = 'taptime_server_lifecycle';
const walFilePattern = /^[0-9A-F]{24}$/;

export interface LifecycleArchiveActor {
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly membershipRole: 'administrator' | 'standortleitung' | 'employee';
}

export interface LifecycleArchiveIdentity {
  readonly workEventId: string;
  readonly receiptId: string;
}

export interface LifecycleArchiveDurabilityPort {
  requireOffsiteArchive(
    client: PoolClient,
    actor: LifecycleArchiveActor,
    identity: LifecycleArchiveIdentity,
  ): Promise<{ readonly requiredWalFile: string; readonly offsiteArchived: boolean }>;
}

interface ArchiveRequirementRow extends QueryResultRow {
  readonly required_wal_file: string;
  readonly offsite_archived: boolean;
}

export class PostgresLifecycleArchiveDurability implements LifecycleArchiveDurabilityPort {
  async requireOffsiteArchive(
    client: PoolClient,
    actor: LifecycleArchiveActor,
    identity: LifecycleArchiveIdentity,
  ): Promise<{ readonly requiredWalFile: string; readonly offsiteArchived: boolean }> {
    let transactionOpen = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await client.query(`SET LOCAL ROLE ${LIFECYCLE_ROLE}`);
      await client.query(
        `SELECT
           set_config('app.organization_id', $1, true),
           set_config('app.user_id', $2, true),
           set_config('app.membership_id', $3, true),
           set_config('app.membership_role', $4, true),
           set_config('app.correlation_id', $5, true)`,
        [
          actor.organizationId,
          actor.userId,
          actor.membershipId,
          actor.membershipRole,
          identity.receiptId,
        ],
      );
      const result = await client.query<ArchiveRequirementRow>(
        `SELECT required_wal_file, offsite_archived
         FROM taptime_server.record_lifecycle_event_archive_requirement_v1(
           $1::uuid, $2::uuid
         )`,
        [identity.workEventId, identity.receiptId],
      );
      const row = result.rows.length === 1 ? result.rows[0] : undefined;
      if (
        row === undefined
        || !walFilePattern.test(row.required_wal_file)
        || typeof row.offsite_archived !== 'boolean'
      ) {
        throw new Error('Lifecycle archive requirement returned invalid evidence');
      }
      await client.query('COMMIT');
      transactionOpen = false;
      return Object.freeze({
        requiredWalFile: row.required_wal_file,
        offsiteArchived: row.offsite_archived,
      });
    } catch (error) {
      if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }
}

export class LifecycleArchivePendingError extends Error {
  constructor() {
    super('Lifecycle event is committed but its WAL is not offsite archived');
    this.name = 'LifecycleArchivePendingError';
  }
}
