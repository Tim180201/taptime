// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it } from 'vitest';
import { TimeRecordControls } from '../src/TimeEditingControls';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';

const record: SafeOwnTimeRecord = { timeRecordId: '10000000-0000-4000-8000-000000000001', source: 'canonical',
  targetType: 'customer', targetDisplayName: 'Kunde', status: 'stopped', startedAt: '2026-10-21T06:00:00.000Z',
  stoppedAt: '2026-10-21T07:00:00.000Z', startedVia: 'manual', stoppedVia: 'manual',
  details: { origin: 'manual', baseRowVersion: 2, effectiveRevisionNumber: 0, changed: false, change: null,
    comment: null, overlapsAnotherRecord: false } };
afterEach(cleanup);
it('shows each lock screen event in history, including in a read-only person view', () => {
  render(<TimeRecordControls record={{ ...record, details: { ...record.details!, lockScreenActions: [
    { workEventId: '10000000-0000-4000-8000-000000000002', action: 'pause', at: '2026-10-21T06:20:00.000Z' },
    { workEventId: '10000000-0000-4000-8000-000000000003', action: 'resume', at: '2026-10-21T07:00:00.000Z' },
    { workEventId: '10000000-0000-4000-8000-000000000004', action: 'stop', at: '2026-10-21T07:00:00.000Z' },
  ] } }} />);
  expect(screen.getByText('Verlauf')).toBeInTheDocument();
  expect(screen.getAllByText(/vom Sperrbildschirm/)).toHaveLength(3);
  expect(screen.getByText(/Pause begonnen.*vom Sperrbildschirm/)).toBeInTheDocument();
  expect(screen.getByText(/Pause beendet.*vom Sperrbildschirm/)).toBeInTheDocument();
  expect(screen.getByText(/Zeit beendet.*vom Sperrbildschirm/)).toBeInTheDocument();
});
it('keeps an ordinary manual entry free of the new provenance', () => {
  render(<TimeRecordControls record={record} />);
  expect(screen.queryByText(/vom Sperrbildschirm/)).not.toBeInTheDocument();
  expect(screen.queryByText('Verlauf')).not.toBeInTheDocument();
});
