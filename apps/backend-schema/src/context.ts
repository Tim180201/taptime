import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export const B3_EMPLOYEE_ROLE = 'taptime_employee';
export const B3_ADMIN_ROLE = 'taptime_administrator';
export const B3_LIFECYCLE_ROLE = 'taptime_server_lifecycle';

export type B3RuntimeRole =
  | typeof B3_EMPLOYEE_ROLE
  | typeof B3_ADMIN_ROLE
  | typeof B3_LIFECYCLE_ROLE;

export interface B3RequestContext {
  readonly organizationId?: string;
  readonly userId?: string;
  readonly correlationId?: string;
}

export async function query<Row extends QueryResultRow>(
  client: PoolClient,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return client.query<Row>(text, [...values]);
}

export async function withRequestTransaction<Value>(
  pool: Pool,
  role: B3RuntimeRole,
  context: B3RequestContext,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    if (context.organizationId !== undefined) {
      await client.query("SELECT set_config('app.organization_id', $1, true)", [context.organizationId]);
    }
    if (context.userId !== undefined) {
      await client.query("SELECT set_config('app.user_id', $1, true)", [context.userId]);
    }
    await client.query("SELECT set_config('app.correlation_id', $1, true)", [context.correlationId ?? randomUUID()]);
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
