import { businessDay } from '@taptime/core';
import { AdminWebCoordinator, type AdminWebAuthPort } from '../src/AdminWebCoordinator';
import type { AdminWebApiPort } from '../src/AdminWebApiClient';
import type { SafeTimeRecord } from '../src/contracts';

/** Only the backend is synthetic: request ordering and state publication use the real coordinator. */
export async function createMonthRaceCapability(record: SafeTimeRecord) {
  const membershipId = '70000000-0000-4000-8000-000000000001';
  const organization = { id: '30000000-0000-4000-8000-000000000001', name: 'Monatsprüfung Beispielbetrieb' };
  const reads: { month: string; finished: boolean }[] = [];
  Object.assign(window, { t122cReads: reads });
  const auth: AdminWebAuthPort = {
    signIn: async () => 'signed_in', signOut: async () => {},
    withAccessToken: async operation => operation('synthetic-test-token'),
  };
  const api: Pick<AdminWebApiPort, 'session' | 'employeeProjection' | 'timeRecords'> = {
    session: async () => ({ status: 'succeeded', value: { membershipId, organizationId: organization.id,
      role: 'administrator', locationsEnabled: false, managementScope: { kind: 'organization' },
      availableSections: ['employees', 'time_records', 'time_export'] } }),
    employeeProjection: async () => ({ status: 'succeeded', value: { organization, nextCursor: null,
      employeeMemberships: [{ id: membershipId, displayName: 'Alex Beispiel', role: 'administrator', active: true, rowVersion: 1, location: null }] } }),
    timeRecords: async (_token, _membership, fromInclusive) => {
      const month = businessDay(Date.parse(fromInclusive)).slice(0, 7);
      const read = { month, finished: false }; reads.push(read);
      // Later requests finish first. No epoch or cancellation is implemented by this fake.
      await new Promise(resolve => setTimeout(resolve, ({ '2026-08': 900, '2026-07': 700, '2026-06': 500, '2026-05': 300, '2026-04': 10 } as Record<string, number>)[month] ?? 0));
      read.finished = true;
      return { status: 'succeeded', value: { nextCursor: null, items: [{ ...record,
        targetDisplayName: `Arbeitszeit ${month}`, startedAt: `${month}-15T08:00:00.000Z`, stoppedAt: `${month}-15T10:00:00.000Z` }] } };
    },
  };
  const coordinator = new AdminWebCoordinator(auth, api as AdminWebApiPort);
  await coordinator.signIn('synthetic@example.invalid', 'synthetic');
  return coordinator;
}
