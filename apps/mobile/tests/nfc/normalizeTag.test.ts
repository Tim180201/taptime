import { describe, expect, it, vi } from 'vitest';
import { createCanonicalNfcUidPayload, createTimestamp } from '@taptime/core';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('react-native-nfc-manager', () => ({
  default: {
    start: vi.fn(),
    isSupported: vi.fn(),
    isEnabled: vi.fn(),
    registerTagEvent: vi.fn(),
    unregisterTagEvent: vi.fn(),
    setEventListener: vi.fn(),
  },
  NfcEvents: { DiscoverTag: 'NfcManagerDiscoverTag' },
}));

const { normalizeTag } = await import('../../src/nfc/RnNfcScanAdapter');
const capturedAt = createTimestamp('2026-07-14T08:30:00.000Z');

describe('normalizeTag (ADR-0009)', () => {
  it('converts the installed Android uppercase UID shape to the canonical v1 payload', () => {
    expect(normalizeTag({ id: '04A1B2C3D4E5F6', ndefMessage: [] }, capturedAt)).toEqual({
      status: 'captured',
      payload: 'nfc:uid:v1:04A1B2C3D4E5F6',
      capturedAt,
    });
  });

  it('canonicalizes lowercase SDK input without changing byte order', () => {
    expect(normalizeTag({ id: 'a1b2', ndefMessage: [] }, capturedAt)).toEqual({
      status: 'captured',
      payload: 'nfc:uid:v1:A1B2',
      capturedAt,
    });
  });

  it('uses exactly the shared codec that future registration must use', () => {
    const uid = '04A1B2C3';
    expect(normalizeTag({ id: uid, ndefMessage: [] }, capturedAt)).toEqual({
      status: 'captured',
      payload: createCanonicalNfcUidPayload(uid),
      capturedAt,
    });
  });

  it('uses the UID even when an NDEF message exists and never falls back to NDEF', () => {
    expect(normalizeTag({
      id: 'A1B2',
      ndefMessage: [{ tnf: 1, type: [84], payload: [115, 116, 97, 114, 116], id: [] }],
    }, capturedAt)).toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
    expect(normalizeTag({
      ndefMessage: [{ tnf: 1, type: [84], payload: [65, 49, 66, 50], id: [] }],
    }, capturedAt)).toEqual({ status: 'unreadable' });
  });

  it.each([
    [{ ndefMessage: [] }, 'missing UID'],
    [{ id: '', ndefMessage: [] }, 'empty UID'],
    [{ id: ' A1', ndefMessage: [] }, 'leading whitespace'],
    [{ id: 'A1 ', ndefMessage: [] }, 'trailing whitespace'],
    [{ id: 'A1-B2', ndefMessage: [] }, 'separator'],
    [{ id: '0xA1', ndefMessage: [] }, 'prefix'],
    [{ id: 'ABC', ndefMessage: [] }, 'odd length'],
    [{ id: 'Ａ１', ndefMessage: [] }, 'Unicode lookalike'],
  ])('maps $1 to unreadable without repair', (tag, _description) => {
    expect(normalizeTag(tag, capturedAt)).toEqual({ status: 'unreadable' });
  });
});
