import type { Pool, PoolClient } from 'pg';
import type { RequestActorContext } from './identityResolution.js';

/**
 * Propagates a RequestActorContext that has already been resolved authoritatively by
 * RequestActorResolutionService. This helper only sets transaction-local context values; it does
 * not select a database role, resolve Membership, or authorize an operation. B5 must re-check the
 * active Membership and apply its restricted runtime role/RLS inside the actual tenant transaction.
 */
export async function withRequestActorTransaction<Value>(
  pool: Pool,
  actor: RequestActorContext,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [actor.userId]);
    await client.query("SELECT set_config('app.organization_id', $1, true)", [actor.organizationId]);
    await client.query("SELECT set_config('app.membership_id', $1, true)", [actor.membershipId]);
    await client.query("SELECT set_config('app.membership_role', $1, true)", [actor.role]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
