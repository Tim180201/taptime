import { businessDay } from '@taptime/core';
import type { ArchivePerson, ArchiveTarget, ArchiveRequests, ArchiveResponses, SearchKind, SearchRequests } from '@taptime/mobile-work-contract';
import { AdminWebApiClient, type AdminWebApiPort } from '../src/AdminWebApiClient';
import { AdminWebCoordinator, type AdminWebAuthPort } from '../src/AdminWebCoordinator';
import { customerSearch } from './searchFixtures';
export const archiveIds = {
  self: '70000000-0000-4000-8000-000000000001', active: '70000000-0000-4000-8000-000000000002',
  former: '70000000-0000-4000-8000-000000000003', former2: '70000000-0000-4000-8000-000000000004', foreign: '70000000-0000-4000-8000-000000000005',
  north: '60000000-0000-4000-8000-000000000001', south: '60000000-0000-4000-8000-000000000002',
  customer: '40000000-0000-4000-8000-000000000001', deleted: '40000000-0000-4000-8000-000000000002', project: '40000000-0000-4000-8000-000000000003',
};
const id = archiveIds;
const organization = { id: '30000000-0000-4000-8000-000000000001', name: 'Beispielbetrieb' };
const north = { id: id.north, name: 'Nord' }, south = { id: id.south, name: 'Süd' };
const asOf = '2026-10-19T12:00:00.000Z';
export const archivePeople: ArchivePerson[] = [
  { membershipId: id.former, displayName: 'Erika Ehemalig', role: 'employee', location: north, revokedAt: '2026-07-31T10:00:00.000Z', lastStartedAt: '2026-07-20T08:00:00.000Z' },
  { membershipId: id.foreign, displayName: 'Frieda Süd', role: 'employee', location: south, revokedAt: '2026-07-31T10:00:00.000Z', lastStartedAt: '2026-07-20T08:00:00.000Z' },
  { membershipId: id.former2, displayName: 'Zara Ohne Zeiten', role: 'employee', location: north, revokedAt: '2026-09-30T10:00:00.000Z', lastStartedAt: null },
];
export const archiveTargets: ArchiveTarget[] = [
  { targetType: 'customer', targetId: id.deleted, displayName: 'Alte Werkstatt', location: north, deactivatedAt: '2026-08-01T08:00:00.000Z', lastStartedAt: '2026-07-20T08:00:00.000Z' },
  { targetType: 'project', targetId: id.project, displayName: 'Projekt Sommer', location: north, deactivatedAt: '2026-08-01T08:00:00.000Z', lastStartedAt: null },
];
/** Real HTTP parsers + coordinator; only backend responses are synthetic. No accounts or external network. */
export async function createArchiveCapability(role: 'administrator' | 'standortleitung' | 'employee' = 'administrator', empty = false) {
  const requests: { path: string; body: any }[] = [];
  let members = [
    { id: id.self, displayName: 'Alex Verwaltung', role, active: true, rowVersion: 1, location: north },
    { id: id.active, displayName: 'Clara Aktiv', role: 'employee' as const, active: true, rowVersion: 1, location: north },
  ];
  const scope = role === 'administrator' ? { kind: 'organization' as const } : { kind: 'locations' as const, locations: [north] };
  const inScope = (row: { location: { id: string } | null }, location: string | null) => (!location || row.location?.id === location) && (role === 'administrator' || row.location?.id === id.north);
  const record = (membershipId: string, month: string) => ({ timeRecordId: '80000000-0000-4000-8000-000000000001',
    targetType: 'customer' as const, targetDisplayName: 'Alte Werkstatt', source: 'canonical' as const,
    status: 'stopped' as const, startedAt: `${month}-20T08:00:00.000Z`, stoppedAt: `${month}-20T10:00:00.000Z`, startedVia: 'nfc' as const, stoppedVia: 'nfc' as const,
    details: { origin: 'nfc' as const, baseRowVersion: 1, effectiveRevisionNumber: 0, comment: null, changed: false, change: null, overlapsAnotherRecord: false },
    calendar: { asOf, workDurationSeconds: 7200, breakDurationSeconds: 0, breakIntervals: [] } });
  const fetcher: typeof fetch = async (url, init) => {
    const path = String(url), body = JSON.parse(String(init?.body)); requests.push({ path, body });
    if (role === 'employee' || body.expectedMembershipId !== id.self) return Response.json({ error: { code: 'forbidden' } }, { status: 403 });
    if (path.endsWith('/archive/people') || path.endsWith('/archive/targets')) {
      const people = path.endsWith('/people');
      const rows = empty ? [] : (people ? archivePeople : archiveTargets).filter(row => inScope(row, body.locationId)
        && (!body.membershipId || 'membershipId' in row && row.membershipId === body.membershipId)
        && (!body.search || row.displayName?.toLocaleLowerCase('de').includes(body.search.toLocaleLowerCase('de'))));
      const offset = body.cursor ? Number(body.cursor.slice(4)) : 0;
      // Deliberately small pages exercise the real pager with opaque cursors.
      const limit = body.membershipId ? 1 : 2;
      return Response.json({ [people ? 'people' : 'targets']: rows.slice(offset, offset + limit), nextCursor: offset + limit < rows.length ? `page${offset + limit}` : null });
    }
    if (path.endsWith('/archive/status')) return Response.json({
      people: body.membershipIds.filter((value: string) => members.some(m => m.id === value) || archivePeople.some(p => p.membershipId === value && inScope(p, null)))
        .map((membershipId: string) => ({ membershipId, archived: archivePeople.some(p => p.membershipId === membershipId) })),
      targets: body.targets.map((target: object) => ({ ...target, archived: true })),
    });
    if (path.endsWith('/managed-active-summary')) {
      const month = businessDay(Date.parse(body.fromInclusive)).slice(0, 7);
      const people = members.filter(m => m.active).map(m => ({ membershipId: m.id, displayName: m.displayName, role: m.role, location: m.location,
        isRunning: m.id === id.active, runningSince: m.id === id.active ? '2026-10-19T08:00:00.000Z' : null,
        runningTargetDisplayName: m.id === id.active ? 'Werkstatt am Park' : null, departedAt: null as string | null, monthWorkDurationSeconds: 7200 }));
      if (month === '2026-07') people.push(...archivePeople.filter(p => p.lastStartedAt && inScope(p, body.locationId)).map(p => ({
        membershipId: p.membershipId, displayName: p.displayName!, role: p.role, location: p.location!, isRunning: false,
        runningSince: null, runningTargetDisplayName: null, departedAt: p.revokedAt, monthWorkDurationSeconds: 7200 })));
      return Response.json({ serverTime: asOf, runningCount: 1, totalCount: members.length, packageUsage: role === 'administrator' ? { packageSize: 10, activeAccessCount: members.length } : null,
        people: people.filter(p => inScope(p, body.locationId) && (body.isRunning === null || p.isRunning === body.isRunning) && (!body.search || p.displayName.includes(body.search))), nextCursor: null });
    }
    if (path.endsWith('/managed-person-time')) {
      if (!members.some(m => m.id === body.targetMembershipId) && !archivePeople.some(p => p.membershipId === body.targetMembershipId && inScope(p, null))) return Response.json({ error: { code: 'forbidden' } }, { status: 403 });
      const month = businessDay(Date.parse(body.fromInclusive)).slice(0, 7);
      return Response.json({ canManageTime: body.targetMembershipId !== id.former && body.targetMembershipId !== id.foreign,
        activeRecord: null, records: month === '2026-07' ? [record(body.targetMembershipId, month)] : [], nextCursor: null,
        windowStartedAt: body.fromInclusive, windowEndedAt: body.toExclusive });
    }
    throw new Error(`Unexpected fixture route: ${path}`);
  };
  const client = new AdminWebApiClient(fetcher);
  const customerQuery = customerSearch(async () => ({ status: 'ready', value: { scope: 'people', asOf, customers: [
    { customerId: id.customer, displayName: 'Werkstatt am Park', active: true, workDurationSeconds: 3600, running: false, people: [] },
    { customerId: id.deleted, displayName: 'Alte Werkstatt', active: false, workDurationSeconds: 7200, running: false,
      people: [{ membershipId: id.former, displayName: 'Erika Ehemalig', workDurationSeconds: 7200, running: false }] },
  ] } }));
  const api: Partial<AdminWebApiPort> = {
    session: async () => ({ status: 'succeeded', value: { membershipId: id.self, organizationId: organization.id, role, locationsEnabled: true, managementScope: scope,
      availableSections: role === 'employee' ? ['own_time'] : ['employees', 'time_records', 'review_items', 'setup', ...(role === 'administrator' ? ['time_export' as const] : [])] } }),
    employeeProjection: async () => ({ status: 'succeeded', value: { organization, employeeMemberships: members.filter(m => m.active), nextCursor: null } }),
    projection: async () => ({ status: 'succeeded', value: { organization, customers: [{ id: id.customer, displayName: 'Werkstatt am Park', active: true }], nfcTags: [], customersComplete: true, nfcTagsComplete: true, nextCursor: null } }),
    timeRecords: async () => ({ status: 'succeeded', value: { items: [{ ...record(id.former, '2026-07'), targetId: id.deleted, employeeMembershipId: id.former, employeeDisplayName: 'Erika Ehemalig', baseRowVersion: 1, effectiveRevisionNumber: 0, overlapsAnotherRecord: false }], nextCursor: null } }),
    reviewItems: async () => ({ status: 'succeeded', value: { items: [{ employeeMembershipId: id.former, employeeDisplayName: 'Erika Ehemalig', reviewItemId: '90000000-0000-4000-8000-000000000001', source: 'offline_v2', targetType: 'customer', targetId: id.deleted, targetDisplayName: 'Alte Werkstatt', triggerType: 'nfc', occurredAt: '2026-07-20T08:00:00.000Z', reviewReason: 'predecessor_requires_review', predecessorBlocked: true, deviceSequence: 1 }], nextCursor: null } }),
    queryArchive: client.queryArchive.bind(client), managedActiveSummary: client.managedActiveSummary.bind(client), managedPersonTime: client.managedPersonTime.bind(client),
    querySearch: (async (_token: string, kind: SearchKind, request: SearchRequests[SearchKind]) => {
      if (kind === 'customer_hours' || kind === 'customer_detail') { const result = await customerQuery(kind, request as never); return result.value ? { status: 'succeeded', value: result.value } : { status: 'unreachable' }; }
      if (kind === 'memberships') return { status: 'succeeded', value: { status: 'succeeded', organization, employeeMemberships: members.filter(m => m.active).map(m => ({ ...m, firstSignedInAt: null, lastSignedInAt: null })), nextCursor: null } };
      if (kind === 'projects') return { status: 'succeeded', value: { projects: [{ projectId: id.project, displayName: 'Projekt Sommer', active: false, rowVersion: 1 }, { projectId: id.customer, displayName: 'Projekt Herbst', active: true, rowVersion: 1 }], nextCursor: null } };
      if (kind === 'setup_customers' || kind === 'setup_tags') return { status: 'succeeded', value: { status: 'succeeded', organization, customers: [], nfcTags: [], nextCursor: null } };
      return { status: 'succeeded', value: { targets: [], nextCursor: null } };
    }) as AdminWebApiPort['querySearch'],
    targetAssignments: async () => ({ status: 'succeeded', value: { items: [], nextCursor: null } }),
    revokeMembership: async (_token, _actor, _command, target) => { members = members.filter(m => m.id !== target); return { status: 'succeeded', value: true }; },
  };
  const auth: AdminWebAuthPort = { signIn: async () => 'signed_in', signOut: async () => {}, withAccessToken: async operation => operation('synthetic') };
  const coordinator = new AdminWebCoordinator(auth, api as AdminWebApiPort, () => Date.parse(asOf));
  await coordinator.signIn('synthetic@example.invalid', 'synthetic');
  return { coordinator, api, client, requests };
}
