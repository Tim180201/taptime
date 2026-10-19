import type { PoolClient, QueryResultRow } from 'pg';
import { isArchiveResponse, type ArchiveKind, type ArchiveRequests, type ArchiveResponses, type ArchiveReadResult } from '@taptime/mobile-work-contract';
import { boundedSearchPage, createArchiveContext } from '@taptime/mobile-work-contract/server-search';
import { personCursor, readManagedPerson } from './ManagedPeopleReader.js';

const timestamp = (value: Date | string | null): string | null => value === null ? null : new Date(value).toISOString();
const location = (row: QueryResultRow) => row.location_id === null ? null : { id: row.location_id, name: row.location_name };
export async function readArchive<K extends ArchiveKind>(client: PoolClient, kind: K, request: ArchiveRequests[K]): Promise<ArchiveReadResult<K>> {
  let response: unknown;
  if (kind === 'person_time') {
    const input = request as ArchiveRequests['person_time'];
    if (personCursor(input) === undefined) return { status: 'invalid_request' };
    const result = await readManagedPerson(client, { ...input, accessToken: '' }, true);
    if (result.status !== 'succeeded') return result;
    response = result.value;
  } else if (kind === 'status') {
    const input = request as ArchiveRequests['status'];
    const result = await client.query('SELECT * FROM taptime_server.read_archive_status_v1($1,$2,$3)', [input.membershipIds,
      input.targets.filter(t => t.targetType === 'customer').map(t => t.targetId), input.targets.filter(t => t.targetType === 'project').map(t => t.targetId)]);
    const status = result.rows[0]?.result_status;
    if (status === 'forbidden' || status === 'invalid_request') return { status };
    if (status !== 'succeeded') throw new Error('Archive status omitted status');
    response = { people: result.rows.filter(r => r.entity_type === 'person').map(r => ({ membershipId: r.entity_id, archived: r.archived })),
      targets: result.rows.filter(r => r.entity_type === 'customer' || r.entity_type === 'project').map(r => ({ targetType: r.entity_type, targetId: r.entity_id, archived: r.archived })) };
  } else {
    const context = createArchiveContext(kind, request);
    if (!context) return { status: 'invalid_request' };
    const { after } = context;
    const input = context.request;
    const people = input as ArchiveRequests['people'], summary = input as ArchiveRequests['managed_people'];
    const result = kind === 'people' ? await client.query('SELECT * FROM taptime_server.read_archive_people_v1($1,$2,$3,$4,$5,$6)',
      [input.locationId, people.membershipId, input.search, after?.name ?? null, after?.id ?? null, input.limit + 1])
      : kind === 'targets' ? await client.query('SELECT * FROM taptime_server.read_archive_targets_v1($1,$2,$3,$4,$5,$6)',
        [input.locationId, input.search, after?.name ?? null, after?.id ?? null, after ? (after.rank === 1 ? 'customer' : 'project') : null, input.limit + 1])
        : await client.query('SELECT *,taptime_server.read_organization_package_v1() AS package_usage FROM taptime_server.read_managed_active_summary_v6($1,$2,$3,$4,$5,$6,$7,$8)',
          [input.locationId, summary.isRunning, after?.name ?? null, after?.id ?? null, input.limit + 1, summary.fromInclusive, summary.toExclusive, input.search]);
    const first = result.rows[0];
    if (first?.result_status === 'forbidden' || first?.result_status === 'invalid_request') return { status: first.result_status };
    if (first?.result_status !== 'succeeded') throw new Error('Archive page omitted status');
    const rows = result.rows.filter(row => kind === 'targets' ? row.target_id !== null : row.membership_id !== null);
    response = boundedSearchPage(rows, input.limit, (page, nextCursor) => {
      if (kind === 'people') return { people: page.map(row => ({ membershipId: row.membership_id, displayName: row.display_name,
        role: row.membership_role, location: location(row), revokedAt: timestamp(row.revoked_at), lastStartedAt: timestamp(row.last_started_at) })), nextCursor };
      if (kind === 'targets') return { targets: page.map(row => ({ targetType: row.target_type, targetId: row.target_id, displayName: row.display_name,
        location: location(row), deactivatedAt: timestamp(row.deactivated_at), lastStartedAt: timestamp(row.last_started_at) })), nextCursor };
      return { serverTime: timestamp(first.server_time), runningCount: Number(first.running_count), totalCount: Number(first.total_count), packageUsage: first.package_usage,
        people: page.map(row => ({ membershipId: row.membership_id, displayName: row.membership_display_name, role: row.membership_role, location: location(row),
          isRunning: row.is_running, runningSince: timestamp(row.running_since), runningTargetDisplayName: row.running_target_display_name,
          departedAt: timestamp(row.departed_at), monthWorkDurationSeconds: Number(row.month_work_duration_seconds) })), nextCursor };
    }, row => context.cursor({ name: (kind === 'managed_people' ? row.membership_display_name : row.display_name) ?? '',
      id: kind === 'targets' ? row.target_id : row.membership_id, ...(kind === 'targets' ? { rank: row.target_type === 'customer' ? 1 : 2 } : {}) }));
  }
  if (!isArchiveResponse(kind, response)) throw new Error('Invalid archive response');
  return { status: 'succeeded', response: response as ArchiveResponses[K] };
}
