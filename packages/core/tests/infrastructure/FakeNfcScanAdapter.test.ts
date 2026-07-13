import { describe, expect, it } from 'vitest';
import { FakeNfcScanAdapter } from '../../src/infrastructure/adapters/FakeNfcScanAdapter';

describe('FakeNfcScanAdapter (DT-001)', () => {
  it('is unreadable by default', async () => {
    const adapter = new FakeNfcScanAdapter();
    expect(await adapter.scan()).toEqual({ status: 'unreadable' });
  });

  it('exposes a normalized payload matching the NfcScanPort contract after a triggered scan', async () => {
    const adapter = new FakeNfcScanAdapter();
    adapter.triggerScan('tag-raw-payload');
    expect(await adapter.scan()).toEqual({ status: 'captured', payload: 'tag-raw-payload' });
  });

  it('can be reset to an unreadable result', async () => {
    const adapter = new FakeNfcScanAdapter();
    adapter.triggerScan('tag-raw-payload');
    adapter.triggerUnreadableScan();
    expect(await adapter.scan()).toEqual({ status: 'unreadable' });
  });

  it('rejects an empty raw payload, matching NfcPayload construction rules', async () => {
    const adapter = new FakeNfcScanAdapter();
    expect(() => adapter.triggerScan('')).toThrow();
  });
});
