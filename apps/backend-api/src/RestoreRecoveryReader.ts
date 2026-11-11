import type { Pool } from 'pg';
import { parseRestoreRecoveryStateV1, type RestoreRecoveryStateV1 } from '@taptime/offline-sync-contract';

export async function readRestoreRecovery(
  pool: Pool,
  session: { readonly organizationId: string; readonly userId: string; readonly membershipId: string },
): Promise<RestoreRecoveryStateV1> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL ROLE taptime_identity_resolver');
    const result = await client.query(`SELECT id,target_kind,
      to_char(target_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS target_time,activated_at
      FROM taptime_server.read_latest_restore_recovery_v1($1,$2,$3)`,
    [session.organizationId, session.userId, session.membershipId]);
    const row = result.rows[0];
    const state = parseRestoreRecoveryStateV1({ contractVersion: 1, operation: row ? {
      id: row.id,
      target: row.target_kind === 'latest' ? { kind: 'latest' }
        : { kind: row.target_kind, time: row.target_time },
      activatedAt: row.activated_at.toISOString(),
    } : null });
    if (!state) throw new Error('Invalid restore recovery projection');
    await client.query('COMMIT');
    return state;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
