import { describe, expect, it } from 'vitest';
import { CliNfcScanAdapter } from '../../src/infrastructure/adapters/CliNfcScanAdapter';

describe('CliNfcScanAdapter (DT-001 extension, real external input)', () => {
  it('exposes a normalized payload matching the NfcScanPort contract for a given input', () => {
    const adapter = new CliNfcScanAdapter('scanned-payload');

    expect(adapter.scan()).toEqual({ status: 'captured', payload: 'scanned-payload' });
  });

  it('trims surrounding whitespace from the raw input', () => {
    const adapter = new CliNfcScanAdapter('  scanned-payload  ');

    expect(adapter.scan()).toEqual({ status: 'captured', payload: 'scanned-payload' });
  });

  it('treats undefined input as an explicit unreadable result', () => {
    const adapter = new CliNfcScanAdapter(undefined);

    expect(adapter.scan()).toEqual({ status: 'unreadable' });
  });

  it('treats empty or whitespace-only input as an explicit unreadable result', () => {
    const adapter = new CliNfcScanAdapter('   ');

    expect(adapter.scan()).toEqual({ status: 'unreadable' });
  });

  it('can be reconfigured with a new input via setInput, mirroring FakeNfcScanAdapter', () => {
    const adapter = new CliNfcScanAdapter('first-payload');

    adapter.setInput('second-payload');

    expect(adapter.scan()).toEqual({ status: 'captured', payload: 'second-payload' });
  });

  it('can be reconfigured back to unreadable via setInput', () => {
    const adapter = new CliNfcScanAdapter('first-payload');

    adapter.setInput(undefined);

    expect(adapter.scan()).toEqual({ status: 'unreadable' });
  });
});
