import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type { AdminWebCapability, AdminWebState } from '../src/contracts';

function render(state: AdminWebState): string {
  const administration: AdminWebCapability = {
    getState: () => state,
    subscribe: () => () => undefined,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    loadMore: vi.fn(async () => undefined),
    createCustomer: vi.fn(async () => undefined),
    createEmployeeInvitation: vi.fn(async () => undefined),
    loadMoreEmployees: vi.fn(async () => undefined),
    dismissInvitation: vi.fn(() => undefined),
  };
  return renderToStaticMarkup(<App administration={administration} />);
}

describe('Admin Web rendered states', () => {
  it('renders an explicitly labelled sign-in form with browser credential semantics', () => {
    const html = render({ status: 'signed_out' });
    expect(html).toContain('<label>E-Mail<input type="email" autoComplete="username" required=""');
    expect(html).toContain('<label>Passwort<input type="password" autoComplete="current-password" required=""');
    expect(html).toContain('Sicher anmelden');
  });

  it('renders distinct loading and safe authority-error states', () => {
    expect(render({ status: 'loading' })).toContain('<h1>Einrichtung wird geladen …</h1>');
    const forbidden = render({ status: 'forbidden', message: 'Nur für Administratoren.' });
    expect(forbidden).toContain('<h1>Nicht verfügbar</h1>');
    expect(forbidden).toContain('<p>Nur für Administratoren.</p>');
    expect(forbidden).toContain('<button>Zur Anmeldung</button>');
  });

  it('connects the hidden Customer label, exposes status notices, and labels safe fingerprints', () => {
    const html = render({
      status: 'ready',
      creating: false,
      creatingEmployee: false,
      invitation: null,
      notice: 'Kunde wurde sicher angelegt.',
      employeeProjection: {
        organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
        employeeMemberships: [],
        nextCursor: null,
      },
      projection: {
        organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
        customers: [{ id: '40000000-0000-4000-8000-000000000001', displayName: 'Werkstatt', active: true }],
        nfcTags: [{
          id: '50000000-0000-4000-8000-000000000001',
          displayName: 'Eingang',
          validationFingerprint: 'A1B2C3D4E5F6',
          assignmentState: 'assigned',
          targetCustomerId: '40000000-0000-4000-8000-000000000001',
        }],
        nextCursor: null,
      },
    });
    expect(html).toContain('<label class="sr-only" for="customer-name">Kundenname</label>');
    expect(html).toContain('id="customer-name" required="" maxLength="120"');
    expect(html).toContain('<p role="status" class="notice">Kunde wurde sicher angelegt.</p>');
    expect(html).toContain('Prüf-Fingerprint A1B2C3D4E5F6');
    expect(html).not.toMatch(/nfc:uid|canonicalPayload/i);
  });

  it('renders explicit empty states for both bounded setup lists', () => {
    const html = render({
      status: 'ready', creating: false, creatingEmployee: false, invitation: null, notice: null,
      employeeProjection: { organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' }, employeeMemberships: [], nextCursor: null },
      projection: { organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' }, customers: [], nfcTags: [], nextCursor: null },
    });
    expect(html).toContain('Noch keine Kunden vorhanden.');
    expect(html).toContain('Noch keine Tags registriert.');
  });

  it('offers explicit cursor pagination only while another bounded page exists', () => {
    const html = render({
      status: 'ready', creating: false, creatingEmployee: false, invitation: null, notice: null,
      employeeProjection: { organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' }, employeeMemberships: [], nextCursor: null },
      projection: {
        organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
        customers: [], nfcTags: [],
        nextCursor: 'v1:c:40000000-0000-4000-8000-000000000001',
      },
    });
    expect(html).toContain('Weitere Einrichtungsdaten laden');
  });

  it('renders the one-time invitation deliberately without storage or clipboard controls', () => {
    const secret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const html = render({
      status: 'ready',
      creating: false,
      creatingEmployee: false,
      invitation: { value: secret, expiresAt: '2099-07-15T12:34:56.789Z' },
      notice: 'Einladung wurde einmalig erzeugt.',
      projection: {
        organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
        customers: [], nfcTags: [], nextCursor: null,
      },
      employeeProjection: {
        organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
        employeeMemberships: [{
          id: '70000000-0000-4000-8000-000000000001',
          displayName: 'Employee Alpha', role: 'employee', active: true,
        }],
        nextCursor: null,
      },
    });
    expect(html).toContain('Nur jetzt sicher übergeben');
    expect(html).toContain(`<code>${secret}</code>`);
    expect(html).toContain('Geheimnis verwerfen');
    expect(html).toContain('Employee Alpha');
    expect(html).not.toMatch(/localStorage|sessionStorage|clipboard/i);
  });
});
