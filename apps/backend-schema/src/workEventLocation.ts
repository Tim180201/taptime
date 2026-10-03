import type { PoolClient } from 'pg';

/** Read only the server-recorded evidence, after insertion and before the engine decision. */
export async function workEventLocationUnavailable(
  client: PoolClient, organizationId: string, workEventId: string,
): Promise<boolean> {
  const result = await client.query<{ unavailable: boolean }>(
    'SELECT taptime_server.work_event_location_unavailable_v1($1::uuid,$2::uuid) AS unavailable',
    [organizationId, workEventId],
  );
  return result.rows[0]?.unavailable === true;
}
