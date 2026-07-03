import type { Brand } from './ids';

export type Timestamp = Brand<string, 'Timestamp'>;

export function createTimestamp(isoValue: string): Timestamp {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Timestamp must be a valid ISO 8601 date string');
  }
  return isoValue as Timestamp;
}
