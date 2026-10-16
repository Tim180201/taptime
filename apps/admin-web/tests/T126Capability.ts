import { AdminWebCoordinator, type AdminWebAuthPort } from '../src/AdminWebCoordinator';
import type { AdminWebApiPort } from '../src/AdminWebApiClient';
import type { SafeTimeRecord } from '../src/contracts';
export const renameSelf = '70000000-0000-4000-8000-000000000001';
export const renameEmployee = '70000000-0000-4000-8000-000000000002';
const organization = { id: '30000000-0000-4000-8000-000000000001', name: 'Beispielbetrieb' };
const location = { id: '60000000-0000-4000-8000-000000000001', name: 'Nord' };
/** Synthetic backend only: actual coordinator, views, pagination and navigation remain in use. */
export async function createRenameCapability(role: 'administrator' | 'standortleitung' = 'administrator') {
  const people = [
    { id: renameSelf, name: null as string | null, role, active: true, rowVersion: 1, location },
    { id: renameEmployee, name: 'Clara Beispiel' as string | null, role: 'employee' as const, active: true, rowVersion: 1, location },
  ];
  const commands: { commandId: string; id: string; version: number; name: string }[] = [];
  const names = () => people.map(p => ({ id: p.id, displayName: p.name ?? (p.role === 'employee' ? 'Mitarbeiter' : p.role === 'administrator' ? 'Administrator' : 'Standortleitung'),
    role: p.role, active: p.active, rowVersion: p.rowVersion, location: p.location }));
  const record = (from: string): SafeTimeRecord => ({ timeRecordId: '80000000-0000-4000-8000-000000000001', employeeMembershipId: renameSelf,
    employeeDisplayName: people[0]!.name ?? '', targetType: 'customer', targetDisplayName: 'Werkstatt', startedVia: 'nfc', stoppedVia: 'nfc',
    source: 'canonical', status: 'stopped', startedAt: new Date(Date.parse(from) + 86400_000).toISOString(), stoppedAt: new Date(Date.parse(from) + 90000_000).toISOString(),
    baseRowVersion: 1, effectiveRevisionNumber: 0, overlapsAnotherRecord: false });
  const auth: AdminWebAuthPort = { signIn: async () => 'signed_in', signOut: async () => {}, withAccessToken: async operation => operation('synthetic') };
  const api = {
    session: async () => ({ status: 'succeeded', value: { membershipId: renameSelf, organizationId: organization.id, role, locationsEnabled: true,
      managementScope: role === 'administrator' ? { kind: 'organization' } : { kind: 'locations', locations: [location] },
      availableSections: ['employees', 'time_records', 'time_export', 'review_items'] } }),
    employeeProjection: async () => ({ status: 'succeeded', value: { organization, employeeMemberships: names(), nextCursor: null } }),
    timeRecords: async (_token: string, _member: string, from: string) => ({ status: 'succeeded', value: { items: [record(from)], nextCursor: null } }),
    reviewItems: async () => ({ status: 'succeeded', value: { items: [{ reviewItemId: '90000000-0000-4000-8000-000000000001', employeeMembershipId: renameSelf,
      employeeDisplayName: people[0]!.name ?? '', targetType: 'customer', targetDisplayName: 'Werkstatt', triggerType: 'nfc',
      occurredAt: '2026-09-15T08:00:00.000Z', source: 'offline_v2', reviewReason: 'predecessor_requires_review', deviceSequence: 1, predecessorBlocked: true }], nextCursor: null } }),
    managedActiveSummary: async () => ({ status: 'succeeded', value: { serverTime: '2026-10-16T12:00:00.000Z', totalCount: people.length, runningCount: 0, nextCursor: null,
      people: names().map(p => ({ membershipId: p.id, displayName: p.displayName, role: p.role, location, isRunning: false, runningSince: null, runningTargetDisplayName: null, departedAt: null, monthWorkDurationSeconds: 3600 })) } }),
    managedPersonTime: async (_token: string, request: { fromInclusive: string; toExclusive: string }) => ({ status: 'succeeded', value: {
      records: [], activeRecord: null, nextCursor: null, windowStartedAt: request.fromInclusive, windowEndedAt: request.toExclusive } }),
    targetAssignments: async () => ({ status: 'succeeded', value: { items: [], nextCursor: null } }),
    voidedTime: async () => ({ status: 'succeeded', value: { status: 'ready', records: [], nextAfterId: null } }),
    querySearch: async (_token: string, _kind: string, request: { search: string | null; active: boolean | null; locationId: string | null }) => ({ status: 'succeeded', value: {
      status: 'succeeded', organization, employeeMemberships: names().filter(p => (request.active == null || p.active === request.active) && (!request.search || p.displayName.includes(request.search)))
        .map(p => ({ ...p, firstSignedInAt: null, lastSignedInAt: null })), nextCursor: null } }),
    readMembershipName: async (_token: string, _member: string, id: string) => {
      const p = people.find(p => p.id === id)!;
      return { status: 'succeeded', value: { displayName: p.name, rowVersion: p.rowVersion } };
    },
    renameMembership: async (_token: string, _member: string, commandId: string, id: string, version: number, name: string) => {
      commands.push({ commandId, id, version, name }); const p = people.find(p => p.id === id)!; p.name = name; p.rowVersion++;
      return { status: 'succeeded', value: true };
    },
  };
  const coordinator = new AdminWebCoordinator(auth, api as unknown as AdminWebApiPort, () => Date.parse('2026-10-16T12:00:00.000Z'));
  await coordinator.signIn('synthetic@example.invalid', 'synthetic');
  return { coordinator, api, commands, people };
}
