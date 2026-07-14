import { createNfcPayload, type NfcPayload } from './NfcPayload';

export const CANONICAL_NFC_UID_PREFIX = 'nfc:uid:v1:';
export const MINIMUM_NFC_UID_HEX_LENGTH = 2;
export const MAXIMUM_NFC_UID_HEX_LENGTH = 64;

const asciiHexPattern = /^[0-9A-Fa-f]+$/;
const uppercaseAsciiHexPattern = /^[0-9A-F]+$/;

/**
 * Encodes an Android-discovered UID into the only payload representation authorized by ADR-0009.
 * This is deliberately separate from createNfcPayload(): historical prototype payloads remain
 * opaque and are not reinterpreted globally.
 */
export function createCanonicalNfcUidPayload(uidHex: string): NfcPayload {
  if (!isValidUidHex(uidHex, asciiHexPattern)) {
    throw new Error('NFC UID must be an even-length 1-32 byte ASCII hexadecimal value');
  }
  return createNfcPayload(`${CANONICAL_NFC_UID_PREFIX}${uidHex.toUpperCase()}`);
}

export function isCanonicalNfcUidPayload(value: string): value is NfcPayload {
  if (!value.startsWith(CANONICAL_NFC_UID_PREFIX)) {
    return false;
  }
  return isValidUidHex(value.slice(CANONICAL_NFC_UID_PREFIX.length), uppercaseAsciiHexPattern);
}

function isValidUidHex(value: string, pattern: RegExp): boolean {
  return value.length >= MINIMUM_NFC_UID_HEX_LENGTH
    && value.length <= MAXIMUM_NFC_UID_HEX_LENGTH
    && value.length % 2 === 0
    && pattern.test(value);
}
