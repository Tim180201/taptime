import { describe, expect, it, vi } from 'vitest';
import { normalizeTag } from '../../src/nfc/RnNfcScanAdapter';

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

// DT-016: pure payload-normalization logic, no native module interaction required beyond
// satisfying the module's own top-level import (mocked above).
describe('normalizeTag (DT-016)', () => {
  it('normalizes a tag with a non-empty id into a captured NfcScanCaptureResult', () => {
    expect(normalizeTag({ id: 'tag-abc-123', ndefMessage: [] })).toEqual({
      status: 'captured',
      payload: 'tag-abc-123',
    });
  });

  it('treats a missing id as unreadable', () => {
    expect(normalizeTag({ ndefMessage: [] })).toEqual({ status: 'unreadable' });
  });

  it('treats an empty or whitespace-only id as unreadable', () => {
    expect(normalizeTag({ id: '   ', ndefMessage: [] })).toEqual({ status: 'unreadable' });
  });
});
