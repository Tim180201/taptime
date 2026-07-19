import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

export async function query<Row extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return client.query<Row>({ text, values: [...values], name: undefined });
}

export async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The original failure remains authoritative.
  }
}

export async function setOfflineActorContext(
  client: PoolClient,
  actor: {
    readonly identity_binding_id: string;
    readonly user_id: string;
    readonly organization_id: string;
    readonly membership_id: string;
    readonly membership_role: string;
  },
): Promise<void> {
  const settings = [
    ['app.identity_binding_id', actor.identity_binding_id],
    ['app.user_id', actor.user_id],
    ['app.organization_id', actor.organization_id],
    ['app.membership_id', actor.membership_id],
    ['app.membership_role', actor.membership_role],
  ] as const;
  for (const [name, value] of settings) {
    await query(client, 'SELECT pg_catalog.set_config($1, $2, true)', [name, value]);
  }
}
