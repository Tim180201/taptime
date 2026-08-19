import { describe, expect, it } from 'vitest';
import {
  Da5V5FlightCredentialCapture,
  readDa5V5HiddenCredential,
} from '../src/Da5V5SecretInput.js';

const validCredential = '0123456789abcdef'.repeat(4);

describe('DA5 V5 byte-only Flight credential capture', () => {
  it.each(['\r', '\n'])('accepts one exact frame terminated by %j without echo', (terminator) => {
    const capture = new Da5V5FlightCredentialCapture();
    const chunk = Buffer.from(`${validCredential}${terminator}`, 'ascii');
    capture.push(chunk);
    expect(chunk.every((byte) => byte === 0)).toBe(true);
    expect(capture.terminated()).toBe(true);
    const credential = capture.settle();
    expect(credential.equals(Buffer.from(validCredential, 'ascii'))).toBe(true);
    expect(JSON.stringify(capture)).toBe('{}');
    credential.fill(0);
  });

  it('accepts arbitrarily split Buffer chunks and wipes every supplied chunk', () => {
    const capture = new Da5V5FlightCredentialCapture();
    for (const part of [validCredential.slice(0, 1), validCredential.slice(1, 31),
      validCredential.slice(31), '\n']) {
      const chunk = Buffer.from(part, 'ascii');
      capture.push(chunk);
      expect(chunk.every((byte) => byte === 0)).toBe(true);
    }
    const credential = capture.settle();
    expect(credential.toString('ascii')).toBe(validCredential);
    credential.fill(0);
  });

  it.each([
    ['short', `${validCredential.slice(1)}\n`],
    ['long', `${validCredential}a\n`],
    ['uppercase', `${'A'}${validCredential.slice(1)}\n`],
    ['nonhex', `${'g'}${validCredential.slice(1)}\n`],
    ['utf8', `${'é'}${validCredential.slice(2)}\n`],
    ['nul', `\0${validCredential.slice(1)}\n`],
    ['escape', `\u001b${validCredential.slice(1)}\n`],
    ['backspace', `\b${validCredential.slice(1)}\n`],
    ['ctrl-c', `\u0003${validCredential.slice(1)}\n`],
  ])('rejects %s input with one disclosure-neutral error', (_name, value) => {
    const capture = new Da5V5FlightCredentialCapture();
    const chunk = Buffer.from(value, 'utf8');
    let message = '';
    try {
      capture.push(chunk);
      capture.settle().fill(0);
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('DA5 V5 flight input rejected');
    expect(chunk.every((byte) => byte === 0)).toBe(true);
    expect(message).not.toMatch(/[0-9a-f]{8}/u);
  });

  it.each([
    ['CRLF in one chunk', `${validCredential}\r\n`],
    ['same-chunk trailing byte', `${validCredential}\nx`],
  ])('rejects %s after scanning and wiping the complete chunk', (_name, value) => {
    const capture = new Da5V5FlightCredentialCapture();
    const chunk = Buffer.from(value, 'ascii');
    expect(() => capture.push(chunk)).toThrow('DA5 V5 flight input rejected');
    expect(chunk.every((byte) => byte === 0)).toBe(true);
  });

  it.each(['\n', 'x'])('rejects a later chunk after the terminator (%j)', (extra) => {
    const capture = new Da5V5FlightCredentialCapture();
    const first = Buffer.from(`${validCredential}\r`, 'ascii');
    capture.push(first);
    const later = Buffer.from(extra, 'ascii');
    expect(() => capture.push(later)).toThrow('DA5 V5 flight input rejected');
    expect(first.every((byte) => byte === 0)).toBe(true);
    expect(later.every((byte) => byte === 0)).toBe(true);
  });

  it.each(['close', 'end', 'error', 'abort'])('zeroizes on %s-style cancellation', () => {
    const capture = new Da5V5FlightCredentialCapture();
    const partial = Buffer.from(validCredential.slice(0, 20), 'ascii');
    capture.push(partial);
    capture.destroy();
    expect(partial.every((byte) => byte === 0)).toBe(true);
    expect(() => capture.settle()).toThrow('DA5 V5 flight input rejected');
  });

  it('keeps the legacy ownership-based hidden API exported and separate', () => {
    expect(typeof readDa5V5HiddenCredential).toBe('function');
    expect(readDa5V5HiddenCredential.name).toBe('readDa5V5HiddenCredential');
  });
});
