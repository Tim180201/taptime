import { describe, expect, it } from 'vitest';
import {
  createCanonicalNfcUidPayload,
  isCanonicalNfcUidPayload,
} from '../../src/domain/CanonicalNfcUidPayload';

describe('CanonicalNfcUidPayload', () => {
  it.each([
    ['00', 'nfc:uid:v1:00'],
    ['a1b2', 'nfc:uid:v1:A1B2'],
    ['A1b2C3d4', 'nfc:uid:v1:A1B2C3D4'],
    ['0123456789abcdef'.repeat(4), `nfc:uid:v1:${'0123456789ABCDEF'.repeat(4)}`],
  ])('canonicalizes accepted ASCII hexadecimal UID %s', (rawUid, expected) => {
    expect(createCanonicalNfcUidPayload(rawUid)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['A', 'below one byte'],
    ['ABC', 'odd length'],
    ['AA'.repeat(33), 'above 32 bytes'],
    [' A1', 'leading whitespace'],
    ['A1 ', 'trailing whitespace'],
    ['A 1', 'embedded whitespace'],
    ['A1-B2', 'separator'],
    ['A1:B2', 'separator'],
    ['0xA1', 'hex prefix'],
    ['Ｇ１', 'Unicode lookalike'],
    ['A1G2', 'non-hexadecimal character'],
    ['nfc:uid:v1:A1', 'already-namespaced input'],
  ])('rejects %s (%s) without trimming or repair', (rawUid) => {
    expect(() => createCanonicalNfcUidPayload(rawUid)).toThrow();
  });

  it.each([
    'nfc:uid:v1:00',
    'nfc:uid:v1:A1B2C3D4',
    `nfc:uid:v1:${'AB'.repeat(32)}`,
  ])('recognizes canonical stored payload %s', (payload) => {
    expect(isCanonicalNfcUidPayload(payload)).toBe(true);
  });

  it.each([
    'A1B2',
    'nfc:uid:v1:a1b2',
    'nfc:uid:v1:A1B',
    'nfc:uid:v1:',
    `nfc:uid:v1:${'AB'.repeat(33)}`,
    'nfc:uid:v2:A1B2',
  ])('rejects non-canonical stored payload %s', (payload) => {
    expect(isCanonicalNfcUidPayload(payload)).toBe(false);
  });
});
