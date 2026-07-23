// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type { AdminWebCapability, AdminWebState } from '../src/contracts';

const organization = { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' };
const customer = {
  id: '40000000-0000-4000-8000-000000000001',
  displayName: 'Werkstatt',
  active: true,
};
const tag = {
  id: '50000000-0000-4000-8000-000000000001',
  displayName: 'Eingang',
  validationFingerprint: 'A1B2C3D4E5F6',
  assignmentState: 'assigned' as const,
  targetCustomerId: customer.id,
  activeAssignmentId: '60000000-0000-4000-8000-000000000001',
};
const record = {
  timeRecordId: '80000000-0000-4000-8000-000000000001',
  employeeDisplayName: 'Employee Alpha',
  customerDisplayName: 'Werkstatt',
  source: 'recovered' as const,
  status: 'stopped' as const,
  startedAt: '2026-07-20T08:00:00.000Z',
  stoppedAt: '2026-07-20T16:00:00.000Z',
  baseRowVersion: 0,
  effectiveRevisionNumber: 2,
  overlapsAnotherRecord: true,
};
const reviewItem = {
  reviewItemId: '90000000-0000-4000-8000-000000000001',
  source: 'offline_v2' as const,
  employeeDisplayName: 'Employee Alpha',
  customerDisplayName: 'Werkstatt',
  occurredAt: '2026-07-20T09:00:00.000Z',
  reviewReason: 'predecessor_requires_review',
  deviceSequence: 7,
  predecessorBlocked: true,
};
const utcContext = { timeZone: 'UTC', usedUtcFallback: true } as const;

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => { resolve = done; });
  return { promise, resolve };
}

const readyState: Extract<AdminWebState, { readonly status: 'ready' }> = {
  status: 'ready',
  projection: { organization, customers: [customer], nfcTags: [tag], nextCursor: null },
  employeeProjection: {
    organization,
    employeeMemberships: [{
      id: '70000000-0000-4000-8000-000000000001',
      displayName: 'Employee Alpha',
      role: 'employee',
      active: true,
    }],
    nextCursor: null,
  },
  creating: false,
  creatingEmployee: false,
  invitation: null,
  reassignmentIntent: null,
  reassigning: false,
  timeRecords: [record],
  timeRecordsNextCursor: null,
  reviewItems: [reviewItem],
  reviewItemsNextCursor: null,
  sections: {
    setup: { status: 'ready' },
    employees: { status: 'ready' },
    timeRecords: { status: 'ready' },
    reviewItems: { status: 'ready' },
  },
  timeWindow: {
    fromInclusive: '2026-06-20T12:00:00.000Z',
    toExclusive: '2026-07-21T12:00:00.000Z',
  },
  timeReviewBusy: false,
  correctionIntent: null,
  adjudicationIntent: null,
  notice: null,
};

class FakeCapability implements AdminWebCapability {
  state: AdminWebState;
  private readonly listeners = new Set<() => void>();
  constructor(state: AdminWebState) { this.state = state; }
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  emit(state: AdminWebState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  invalidateTimeBoundIntents = vi.fn(() => undefined);
  signIn = vi.fn(async () => undefined);
  signOut = vi.fn(async () => undefined);
  refresh = vi.fn(async () => undefined);
  retrySection = vi.fn(async () => undefined);
  loadMore = vi.fn(async () => undefined);
  createCustomer = vi.fn(async () => undefined);
  createEmployeeInvitation = vi.fn(async () => undefined);
  loadMoreEmployees = vi.fn(async () => undefined);
  dismissInvitation = vi.fn(() => undefined);
  prepareReassignment = vi.fn<AdminWebCapability['prepareReassignment']>(() => undefined);
  cancelReassignment = vi.fn(() => undefined);
  confirmReassignment = vi.fn(async () => undefined);
  prepareCorrection = vi.fn<AdminWebCapability['prepareCorrection']>(() => undefined);
  cancelCorrection = vi.fn(() => undefined);
  confirmCorrection = vi.fn(async () => undefined);
  prepareAdjudication = vi.fn<AdminWebCapability['prepareAdjudication']>(() => undefined);
  cancelAdjudication = vi.fn(() => undefined);
  confirmAdjudication = vi.fn(async () => undefined);
  exportTimeRecords = vi.fn(async () => undefined);
  loadMoreTimeRecords = vi.fn(async () => undefined);
  loadMoreReviewItems = vi.fn(async () => undefined);
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#uebersicht');
});

describe('professional Admin Web shell', () => {
  it('renders an explicitly labelled memory-only sign-in form', async () => {
    const capability = new FakeCapability({ status: 'signed_out' });
    render(<App administration={capability} />);
    expect(screen.getByLabelText('E-Mail')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('autocomplete', 'current-password');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'admin@example.test');
    await userEvent.type(screen.getByLabelText('Passwort'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sicher anmelden' }));
    expect(capability.signIn).toHaveBeenCalledWith('admin@example.test', 'secret');
  });

  it('clears the password field before the asynchronous sign-in can settle', async () => {
    const capability = new FakeCapability({ status: 'signed_out' });
    const pending = deferred<undefined>();
    capability.signIn.mockImplementation(async () => {
      capability.emit({ status: 'signing_in' });
      return pending.promise;
    });
    render(<App administration={capability} />);
    await userEvent.type(screen.getByLabelText('E-Mail'), 'admin@example.test');
    await userEvent.type(screen.getByLabelText('Passwort'), 'memory-only-secret');

    await userEvent.click(screen.getByRole('button', { name: 'Sicher anmelden' }));

    expect(capability.signIn).toHaveBeenCalledWith(
      'admin@example.test',
      'memory-only-secret',
    );
    expect(screen.getByLabelText('Passwort')).toHaveValue('');
    pending.resolve(undefined);
    capability.emit({ status: 'signed_out' });
    await waitFor(() => expect(screen.getByLabelText('Passwort')).toHaveValue(''));
  });

  it('exposes exactly five allow-listed fragment views and deterministic hash navigation', async () => {
    const capability = new FakeCapability(readyState);
    render(<App administration={capability} />);
    const navigation = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(navigation.querySelectorAll('a')).toHaveLength(5);
    await userEvent.click(screen.getByRole('link', { name: 'Arbeitszeiten' }));
    expect(window.location.hash).toBe('#arbeitszeiten');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Arbeitszeiten', level: 1 })).toHaveFocus();
    expect(screen.getByText('Wiederhergestellt')).toBeInTheDocument();
  });

  it('resolves an invalid fragment to Übersicht without retaining unsafe content', async () => {
    window.history.replaceState(null, '', '#record=secret-value');
    render(<App administration={new FakeCapability(readyState)} />);
    await waitFor(() => expect(window.location.hash).toBe('#uebersicht'));
    expect(screen.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeInTheDocument();
    expect(window.location.href).not.toContain('secret-value');
  });

  it('destroys a one-time invitation when navigating away from Beschäftigte', async () => {
    const secret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const capability = new FakeCapability({
      ...readyState,
      invitation: { value: secret, expiresAt: '2099-07-15T12:34:56.789Z' },
    });
    window.history.replaceState(null, '', '#beschaeftigte');
    render(<App administration={capability} />);
    expect(screen.getByText(secret)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/clipboard/i);
    await userEvent.click(screen.getByRole('link', { name: 'Übersicht' }));
    fireEvent(window, new HashChangeEvent('hashchange'));
    await waitFor(() => expect(capability.dismissInvitation).toHaveBeenCalledOnce());
    expect(window.location.href).not.toContain(secret);
  });

  it('invalidates invitation disclosure on navigation even while no secret exists yet', async () => {
    const capability = new FakeCapability({
      ...readyState,
      creatingEmployee: true,
      invitation: null,
    });
    window.history.replaceState(null, '', '#beschaeftigte');
    render(<App administration={capability} />);

    await userEvent.click(screen.getByRole('link', { name: 'Übersicht' }));
    fireEvent(window, new HashChangeEvent('hashchange'));
    await waitFor(() => expect(capability.dismissInvitation).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('link', { name: 'Beschäftigte' }));
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Beschäftigte', level: 1 }))
      .toBeInTheDocument();
    expect(document.querySelector('.invitation')).toBeNull();
  });

  it('states loaded versus complete truth and offers cursor-backed load-more controls', async () => {
    const capability = new FakeCapability({
      ...readyState,
      timeRecordsNextCursor: 'cursor_page_2',
      reviewItemsNextCursor: 'review_page_2',
    });
    window.history.replaceState(null, '', '#arbeitszeiten');
    render(<App administration={capability} />);
    expect(screen.getByText('Arbeitszeiten bisher geladen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Weitere Arbeitszeiten laden' }));
    expect(capability.loadMoreTimeRecords).toHaveBeenCalledOnce();
    window.history.replaceState(null, '', '#pruefungen');
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByText('Prüfungen bisher geladen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Weitere Prüfungen laden' }));
    expect(capability.loadMoreReviewItems).toHaveBeenCalledOnce();
  });

  it('contains a section failure and retries only that section', async () => {
    const capability = new FakeCapability({
      ...readyState,
      sections: {
        ...readyState.sections,
        setup: { status: 'unavailable', message: 'Einrichtung nicht erreichbar.' },
      },
    });
    window.history.replaceState(null, '', '#einrichtung');
    render(<App administration={capability} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Einrichtung nicht erreichbar.');
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(capability.retrySection).toHaveBeenCalledWith('setup');
  });

  it('renders safe fingerprints and never raw NFC payload labels', () => {
    window.history.replaceState(null, '', '#einrichtung');
    render(<App administration={new FakeCapability(readyState)} />);
    expect(screen.getAllByText(/Prüf-Fingerprint A1B2C3D4E5F6/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/nfc:uid|canonicalPayload/i);
  });

  it('renders append-only correction confirmation with before, after and verbatim reason', () => {
    const capability = new FakeCapability({
      ...readyState,
      correctionIntent: {
        commandId: 'a0000000-0000-4000-8000-000000000001',
        timeRecord: record,
        startedAt: '2026-07-20T08:15:00.000Z',
        stoppedAt: '2026-07-20T16:15:00.000Z',
        reason: 'Beleg geprüft.',
      },
    });
    window.history.replaceState(null, '', '#arbeitszeiten');
    render(<App administration={capability} />);
    const confirmation = screen.getByRole('alertdialog', { name: 'Korrektur ausdrücklich bestätigen' });
    expect(confirmation).toHaveTextContent('Vorher');
    expect(confirmation).toHaveTextContent('Nachher');
    expect(confirmation).toHaveTextContent('Beleg geprüft.');
  });

  it('renders exact correction truth and restores focus after conflict intent removal', async () => {
    const capability = new FakeCapability(readyState);
    const reason = 'Erste  Zeile\nZweite   Zeile';
    capability.prepareCorrection.mockImplementation((
      timeRecordId,
      startedAt,
      stoppedAt,
      submittedReason,
    ) => {
      capability.emit({
        ...readyState,
        correctionIntent: {
          commandId: 'a0000000-0000-4000-8000-000000000001',
          timeRecord: record,
          startedAt,
          stoppedAt,
          reason: submittedReason,
        },
      });
      expect(timeRecordId).toBe(record.timeRecordId);
    });
    capability.confirmCorrection.mockImplementation(async () => {
      capability.emit({
        ...readyState,
        correctionIntent: null,
        notice: 'Die Arbeitszeit wurde zwischenzeitlich geändert.',
      });
    });
    window.history.replaceState(null, '', '#arbeitszeiten');
    render(<App administration={capability} resolveTimeZone={() => utcContext} />);
    fireEvent.change(screen.getByLabelText('Arbeitszeit'), {
      target: { value: record.timeRecordId },
    });
    fireEvent.change(screen.getByLabelText('Neuer Beginn'), {
      target: { value: '2026-07-20T08:15:30.123' },
    });
    fireEvent.change(screen.getByLabelText('Neues Ende'), {
      target: { value: '2026-07-20T16:45:59.987' },
    });
    fireEvent.change(screen.getByLabelText('Begründung'), {
      target: { value: reason },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Korrektur prüfen' }));

    expect(capability.prepareCorrection).toHaveBeenCalledWith(
      record.timeRecordId,
      '2026-07-20T08:15:30.123Z',
      '2026-07-20T16:45:59.987Z',
      reason,
    );
    const confirmation = screen.getByRole('alertdialog', {
      name: 'Korrektur ausdrücklich bestätigen',
    });
    expect(confirmation).toHaveTextContent('2026-07-20 08:15:30.123 GMT+0 [UTC]');
    expect(confirmation).toHaveTextContent('2026-07-20 16:45:59.987 GMT+0 [UTC]');
    expect(confirmation.querySelector('.verbatim-reason')?.textContent).toBe(reason);

    await userEvent.click(screen.getByRole('button', {
      name: 'Korrektur ausdrücklich bestätigen',
    }));
    const correctionTrigger = screen.getByRole('button', { name: 'Korrektur prüfen' });
    await waitFor(() => expect(correctionTrigger).toHaveFocus());
    expect(document.activeElement).toBe(correctionTrigger);
  });

  it('renders exact adjudication truth and restores focus after error intent removal', async () => {
    const capability = new FakeCapability(readyState);
    const reason = 'Prüfung  exakt\nZweite   Aussage';
    capability.prepareAdjudication.mockImplementation((
      reviewItemId,
      resolution,
      timeRecordId,
      startedAt,
      stoppedAt,
      submittedReason,
    ) => {
      capability.emit({
        ...readyState,
        adjudicationIntent: {
          commandId: 'a0000000-0000-4000-8000-000000000002',
          reviewItem,
          resolution,
          timeRecord: null,
          startedAt,
          stoppedAt,
          reason: submittedReason,
        },
      });
      expect(reviewItemId).toBe(reviewItem.reviewItemId);
      expect(timeRecordId).toBeNull();
    });
    capability.confirmAdjudication.mockImplementation(async () => {
      capability.emit({
        ...readyState,
        adjudicationIntent: null,
        notice: 'Review-Entscheidung konnte nicht protokolliert werden.',
      });
    });
    window.history.replaceState(null, '', '#pruefungen');
    render(<App administration={capability} resolveTimeZone={() => utcContext} />);
    fireEvent.change(screen.getByLabelText('Review-Evidence'), {
      target: { value: reviewItem.reviewItemId },
    });
    fireEvent.change(screen.getByLabelText('Entscheidung'), {
      target: { value: 'create_recovered_time_record' },
    });
    fireEvent.change(screen.getByLabelText('Beginn'), {
      target: { value: '2026-07-20T07:01:02.003' },
    });
    fireEvent.change(screen.getByLabelText('Ende'), {
      target: { value: '2026-07-20T08:04:05.006' },
    });
    fireEvent.change(screen.getByLabelText('Begründung'), {
      target: { value: reason },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Review-Entscheidung prüfen' }));

    expect(capability.prepareAdjudication).toHaveBeenCalledWith(
      reviewItem.reviewItemId,
      'create_recovered_time_record',
      null,
      '2026-07-20T07:01:02.003Z',
      '2026-07-20T08:04:05.006Z',
      reason,
    );
    const confirmation = screen.getByRole('alertdialog', {
      name: 'Review-Entscheidung ausdrücklich bestätigen',
    });
    expect(confirmation).toHaveTextContent('2026-07-20 07:01:02.003 GMT+0 [UTC]');
    expect(confirmation).toHaveTextContent('2026-07-20 08:04:05.006 GMT+0 [UTC]');
    expect(confirmation.querySelector('.verbatim-reason')?.textContent).toBe(reason);

    await userEvent.click(screen.getByRole('button', {
      name: 'Review ausdrücklich bestätigen',
    }));
    const adjudicationTrigger = screen.getByRole('button', {
      name: 'Review-Entscheidung prüfen',
    });
    await waitFor(() => expect(adjudicationTrigger).toHaveFocus());
    expect(document.activeElement).toBe(adjudicationTrigger);
  });

  it('uses the logical reassignment fallback after success disables the original trigger', async () => {
    const targetCustomer = {
      id: '40000000-0000-4000-8000-000000000002',
      displayName: 'Lager',
      active: true,
    };
    const reassignmentState = {
      ...readyState,
      projection: {
        ...readyState.projection,
        customers: [customer, targetCustomer],
      },
    };
    const capability = new FakeCapability(reassignmentState);
    capability.prepareReassignment.mockImplementation((nfcTagId, targetCustomerId) => {
      capability.emit({
        ...reassignmentState,
        reassignmentIntent: {
          commandId: 'a0000000-0000-4000-8000-000000000004',
          nfcTagId,
          expectedActiveAssignmentId: tag.activeAssignmentId!,
          targetCustomerId,
        },
      });
    });
    capability.confirmReassignment.mockImplementation(async () => {
      capability.emit({
        ...reassignmentState,
        projection: {
          ...reassignmentState.projection,
          nfcTags: [{
            ...tag,
            targetCustomerId: targetCustomer.id,
            activeAssignmentId: '60000000-0000-4000-8000-000000000002',
          }],
        },
        reassignmentIntent: null,
        notice: 'NFC-Tag wurde sicher neu zugeordnet.',
      });
    });
    window.history.replaceState(null, '', '#einrichtung');
    render(<App administration={capability} />);
    fireEvent.change(screen.getByLabelText('NFC-Tag'), {
      target: { value: tag.id },
    });
    fireEvent.change(screen.getByLabelText('Neuer aktiver Kunde'), {
      target: { value: targetCustomer.id },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Zuordnung prüfen' }));
    await userEvent.click(screen.getByRole('button', {
      name: 'Änderung ausdrücklich bestätigen',
    }));

    const reassignmentTrigger = screen.getByRole('button', { name: 'Zuordnung prüfen' });
    const tagSelection = screen.getByLabelText('NFC-Tag');
    await waitFor(() => expect(tagSelection).toHaveFocus());
    expect(reassignmentTrigger).toBeDisabled();
    expect(document.activeElement).toBe(tagSelection);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('focuses setup retry after reassignment intent removal and failed refresh', async () => {
    const targetCustomer = {
      id: '40000000-0000-4000-8000-000000000002',
      displayName: 'Lager',
      active: true,
    };
    const intentState = {
      ...readyState,
      projection: {
        ...readyState.projection,
        customers: [customer, targetCustomer],
      },
      reassignmentIntent: {
        commandId: 'a0000000-0000-4000-8000-000000000005',
        nfcTagId: tag.id,
        expectedActiveAssignmentId: tag.activeAssignmentId!,
        targetCustomerId: targetCustomer.id,
      },
    };
    const capability = new FakeCapability(intentState);
    capability.confirmReassignment.mockImplementation(async () => {
      capability.emit({
        ...intentState,
        reassignmentIntent: null,
        reassigning: false,
        sections: {
          ...intentState.sections,
          setup: { status: 'unavailable', message: 'Einrichtung nicht erreichbar.' },
        },
        notice: 'Die Zuordnung wurde zwischenzeitlich geändert.',
      });
    });
    window.history.replaceState(null, '', '#einrichtung');
    render(<App administration={capability} />);

    await userEvent.click(screen.getByRole('button', {
      name: 'Änderung ausdrücklich bestätigen',
    }));

    const retry = screen.getByRole('button', { name: 'Erneut versuchen' });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(document.activeElement).toBe(retry);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('focuses time-record retry after correction conflict and failed refresh', async () => {
    const intentState = {
      ...readyState,
      correctionIntent: {
        commandId: 'a0000000-0000-4000-8000-000000000006',
        timeRecord: record,
        startedAt: '2026-07-20T08:15:00.000Z',
        stoppedAt: '2026-07-20T16:15:00.000Z',
        reason: 'Beleg geprüft.',
      },
    };
    const capability = new FakeCapability(intentState);
    capability.confirmCorrection.mockImplementation(async () => {
      capability.emit({
        ...intentState,
        correctionIntent: null,
        timeReviewBusy: false,
        sections: {
          ...intentState.sections,
          timeRecords: { status: 'unavailable', message: 'Arbeitszeiten nicht erreichbar.' },
        },
        notice: 'Die Arbeitszeit wurde zwischenzeitlich geändert.',
      });
    });
    window.history.replaceState(null, '', '#arbeitszeiten');
    render(<App administration={capability} />);

    await userEvent.click(screen.getByRole('button', {
      name: 'Korrektur ausdrücklich bestätigen',
    }));

    const retry = screen.getByRole('button', { name: 'Erneut versuchen' });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(document.activeElement).toBe(retry);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('focuses review retry after adjudication error and failed refresh', async () => {
    const intentState = {
      ...readyState,
      adjudicationIntent: {
        commandId: 'a0000000-0000-4000-8000-000000000007',
        reviewItem,
        resolution: 'no_time_record_change' as const,
        timeRecord: null,
        startedAt: null,
        stoppedAt: null,
        reason: 'Beleg geprüft.',
      },
    };
    const capability = new FakeCapability(intentState);
    capability.confirmAdjudication.mockImplementation(async () => {
      capability.emit({
        ...intentState,
        adjudicationIntent: null,
        timeReviewBusy: false,
        sections: {
          ...intentState.sections,
          reviewItems: { status: 'unavailable', message: 'Prüfungen nicht erreichbar.' },
        },
        notice: 'Review-Entscheidung konnte nicht protokolliert werden.',
      });
    });
    window.history.replaceState(null, '', '#pruefungen');
    render(<App administration={capability} />);

    await userEvent.click(screen.getByRole('button', {
      name: 'Review ausdrücklich bestätigen',
    }));

    const retry = screen.getByRole('button', { name: 'Erneut versuchen' });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(document.activeElement).toBe(retry);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('uses one central timezone and atomically discards open inputs and intents after a zone change', async () => {
    let context = { timeZone: 'Europe/Berlin', usedUtcFallback: false };
    const resolveTimeZone = () => context;
    const capability = new FakeCapability(readyState);
    capability.invalidateTimeBoundIntents.mockImplementation(() => {
      const current = capability.getState();
      if (current.status === 'ready') {
        capability.emit({
          ...current,
          correctionIntent: null,
          adjudicationIntent: null,
          timeReviewBusy: false,
        });
      }
    });
    window.history.replaceState(null, '', '#arbeitszeiten');
    render(<App administration={capability} resolveTimeZone={resolveTimeZone} />);
    expect(screen.getByText('Zeitdarstellung: Europe/Berlin')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Arbeitszeit'), {
      target: { value: record.timeRecordId },
    });
    expect(screen.getByLabelText('Neuer Beginn')).not.toHaveValue('');
    capability.emit({
      ...readyState,
      correctionIntent: {
        commandId: 'a0000000-0000-4000-8000-000000000003',
        timeRecord: record,
        startedAt: '2026-07-20T08:00:00.000Z',
        stoppedAt: '2026-07-20T16:00:00.000Z',
        reason: 'Offener Intent',
      },
    });

    context = { timeZone: 'UTC', usedUtcFallback: true };
    fireEvent.focus(window);

    await waitFor(() => expect(capability.invalidateTimeBoundIntents).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Zeitdarstellung: UTC/)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByLabelText('Arbeitszeit')).toHaveValue('');
    expect(screen.getByLabelText('Neuer Beginn')).toHaveValue('');
    expect(screen.getByLabelText('Neues Ende')).toHaveValue('');
  });

  it('returns focus to the preparation button when a confirmation is cancelled', async () => {
    const capability = new FakeCapability({
      ...readyState,
      correctionIntent: {
        commandId: 'a0000000-0000-4000-8000-000000000001',
        timeRecord: record,
        startedAt: '2026-07-20T08:15:00.000Z',
        stoppedAt: '2026-07-20T16:15:00.000Z',
        reason: 'Beleg geprüft.',
      },
    });
    capability.cancelCorrection.mockImplementation(() => {
      capability.emit({ ...readyState, correctionIntent: null });
    });
    window.history.replaceState(null, '', '#arbeitszeiten');
    render(<App administration={capability} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(capability.cancelCorrection).toHaveBeenCalledOnce();
    const correctionTrigger = screen.getByRole('button', { name: 'Korrektur prüfen' });
    await waitFor(() => expect(correctionTrigger).toHaveFocus());
    expect(document.activeElement).toBe(correctionTrigger);
  });

  it('has no automatically detectable WCAG A/AA violation in the overview shell', async () => {
    render(<App administration={new FakeCapability(readyState)} />);
    const result = await axe.run(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
