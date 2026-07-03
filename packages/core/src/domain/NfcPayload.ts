import type { Brand } from './ids';

export type NfcPayload = Brand<string, 'NfcPayload'>;

export function createNfcPayload(rawValue: string): NfcPayload {
  if (!rawValue || rawValue.trim().length === 0) {
    throw new Error('NfcPayload must be a non-empty string');
  }
  return rawValue as NfcPayload;
}
