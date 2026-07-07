import { beforeEach, describe, expect, it, vi } from 'vitest';

const { nfcManagerMock } = vi.hoisted(() => ({
  nfcManagerMock: {
    start: vi.fn(),
    isSupported: vi.fn(),
    isEnabled: vi.fn(),
    registerTagEvent: vi.fn(),
    unregisterTagEvent: vi.fn(),
    setEventListener: vi.fn(),
  },
}));

vi.mock('react-native-nfc-manager', () => ({
  default: nfcManagerMock,
  NfcEvents: { DiscoverTag: 'NfcManagerDiscoverTag' },
}));

const { RnNfcScanAdapter } = await import('../../src/nfc/RnNfcScanAdapter');

// DT-016: covers capability-check branching and the async-event-to-sync-scan() bridge using
// a test double for react-native-nfc-manager - no real hardware required, mirroring
// FakeNfcScanAdapter.test.ts/CliNfcScanAdapter.test.ts's rigor for the two existing
// NfcScanPort implementations.
describe('RnNfcScanAdapter (DT-016)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nfcManagerMock.start.mockResolvedValue(undefined);
    nfcManagerMock.isSupported.mockResolvedValue(true);
    nfcManagerMock.isEnabled.mockResolvedValue(true);
    nfcManagerMock.registerTagEvent.mockResolvedValue(undefined);
    nfcManagerMock.unregisterTagEvent.mockResolvedValue(undefined);
  });

  it('scan() returns unreadable before any tag has ever been discovered', () => {
    const adapter = new RnNfcScanAdapter();

    expect(adapter.scan()).toEqual({ status: 'unreadable' });
  });

  it('reports not_supported when the device has no NFC hardware, without starting the manager', async () => {
    nfcManagerMock.isSupported.mockResolvedValue(false);
    const adapter = new RnNfcScanAdapter();

    const capability = await adapter.checkCapability();

    expect(capability).toBe('not_supported');
    expect(nfcManagerMock.start).not.toHaveBeenCalled();
  });

  it('reports disabled when NFC hardware exists but is turned off', async () => {
    nfcManagerMock.isEnabled.mockResolvedValue(false);
    const adapter = new RnNfcScanAdapter();

    expect(await adapter.checkCapability()).toBe('disabled');
  });

  it('reports ready when NFC is supported and enabled', async () => {
    const adapter = new RnNfcScanAdapter();

    expect(await adapter.checkCapability()).toBe('ready');
  });

  it('resolves waitForNextTag with a captured, normalized payload once the native library reports a discovered tag, and buffers it for scan()', async () => {
    const adapter = new RnNfcScanAdapter();

    const resultPromise = adapter.waitForNextTag();
    await vi.waitFor(() => expect(nfcManagerMock.setEventListener).toHaveBeenCalled());
    const [, listener] = nfcManagerMock.setEventListener.mock.calls[0] as [string, (tag: { id: string }) => void];
    listener({ id: 'tag-abc-123' });

    const result = await resultPromise;

    expect(result).toEqual({ status: 'captured', payload: 'tag-abc-123' });
    expect(adapter.scan()).toEqual({ status: 'captured', payload: 'tag-abc-123' });
    expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('resolves waitForNextTag as unreadable when registerTagEvent itself fails', async () => {
    nfcManagerMock.registerTagEvent.mockRejectedValue(new Error('platform error'));
    const adapter = new RnNfcScanAdapter();

    const result = await adapter.waitForNextTag();

    expect(result).toEqual({ status: 'unreadable' });
    expect(adapter.scan()).toEqual({ status: 'unreadable' });
  });

  it('starts the native manager only once across multiple calls', async () => {
    const adapter = new RnNfcScanAdapter();

    await adapter.checkCapability();
    await adapter.checkCapability();

    expect(nfcManagerMock.start).toHaveBeenCalledTimes(1);
  });
});
