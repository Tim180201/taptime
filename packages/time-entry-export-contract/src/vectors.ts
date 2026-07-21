import type { TimeEntryExportRow } from './types.js';

export const TIME_ENTRY_EXPORT_GOLDEN_ROWS: readonly TimeEntryExportRow[] = Object.freeze([
  Object.freeze({
    organizationId: '11111111-1111-4111-8111-111111111111',
    organizationName: '=Tap; "Nord"',
    timeEntryId: '33333333-3333-4333-8333-333333333333',
    employeeMembershipId: '22222222-2222-4222-8222-222222222222',
    employeeDisplayName: ' Jörg',
    customerId: '44444444-4444-4444-8444-444444444444',
    customerDisplayName: '@Kundschaft',
    status: 'stopped',
    startedAtUtc: '2026-07-21T08:00:00.123456Z',
    stoppedAtUtc: '2026-07-21T09:02:03.123457Z',
    durationSeconds: '3723.000001',
  }),
]);
