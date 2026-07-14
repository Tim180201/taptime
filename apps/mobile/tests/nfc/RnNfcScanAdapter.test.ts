import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimestamp } from '@taptime/core';
import type { RnNfcScanAdapterOptions } from '../../src/nfc/RnNfcScanAdapter';

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

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('react-native-nfc-manager', () => ({
  default: nfcManagerMock,
  NfcEvents: { DiscoverTag: 'NfcManagerDiscoverTag' },
}));

const { RnNfcScanAdapter } = await import('../../src/nfc/RnNfcScanAdapter');
const capturedAt = createTimestamp('2026-07-14T08:30:00.000Z');

function createAdapter(options: RnNfcScanAdapterOptions = {}) {
  return new RnNfcScanAdapter({
    captureTimestamp: () => capturedAt,
    ...options,
  });
}

type DiscoverListener = (tag: { id?: string }) => void;

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function discoverListener(index = 0): DiscoverListener {
  const registrations = nfcManagerMock.setEventListener.mock.calls.filter(
    ([, listener]) => typeof listener === 'function',
  );
  return registrations[index]![1] as DiscoverListener;
}

async function beginCapture(adapter = createAdapter({ platform: 'android' })) {
  const result = adapter.scan();
  await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalled());
  return { adapter, result, listener: discoverListener() };
}

describe('RnNfcScanAdapter (Block D)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    nfcManagerMock.start.mockResolvedValue(undefined);
    nfcManagerMock.isSupported.mockResolvedValue(true);
    nfcManagerMock.isEnabled.mockResolvedValue(true);
    nfcManagerMock.registerTagEvent.mockResolvedValue(undefined);
    nfcManagerMock.unregisterTagEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('scan() waits for native discovery and resolves only after listener cleanup', async () => {
    const unregister = deferred<void>();
    nfcManagerMock.unregisterTagEvent.mockReturnValue(unregister.promise);
    let nativeTime = capturedAt;
    const adapter = createAdapter({ captureTimestamp: () => nativeTime });
    const { result, listener } = await beginCapture(adapter);
    let settled = false;
    void result.then(() => { settled = true; });

    listener({ id: '04A1B2C3' });
    nativeTime = createTimestamp('2026-07-14T08:31:00.000Z');
    await vi.waitFor(() => expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    expect(nfcManagerMock.setEventListener).toHaveBeenLastCalledWith(
      'NfcManagerDiscoverTag',
      null,
    );

    unregister.resolve();
    await expect(result).resolves.toEqual({
      status: 'captured',
      payload: 'nfc:uid:v1:04A1B2C3',
      capturedAt,
    });
  });

  it('coalesces concurrent scan callers onto one listener and one result', async () => {
    const adapter = createAdapter({ platform: 'android' });
    const first = adapter.scan();
    const second = adapter.scan();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    discoverListener()({ id: 'A1B2' });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt },
      { status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt },
    ]);
    expect(nfcManagerMock.start).toHaveBeenCalledTimes(1);
    expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent manager start calls across capability and capture', async () => {
    const start = deferred<void>();
    nfcManagerMock.start.mockReturnValue(start.promise);
    const adapter = createAdapter({ platform: 'android' });
    const capability = adapter.checkCapability();
    const capture = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.start).toHaveBeenCalledTimes(1));
    start.resolve();
    await expect(capability).resolves.toBe('ready');
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    discoverListener()({ id: 'A1B2' });
    await expect(capture).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
  });

  it.each(['ios', 'web'])('reports not_supported without native capture on %s', async (platform) => {
    const adapter = createAdapter({ platform });
    await expect(adapter.checkCapability()).resolves.toBe('not_supported');
    expect(nfcManagerMock.isSupported).not.toHaveBeenCalled();
    expect(nfcManagerMock.start).not.toHaveBeenCalled();
    expect(nfcManagerMock.registerTagEvent).not.toHaveBeenCalled();
  });

  it('reports not_supported when Android has no NFC hardware without starting the manager', async () => {
    nfcManagerMock.isSupported.mockResolvedValue(false);
    const adapter = createAdapter({ platform: 'android' });
    await expect(adapter.checkCapability()).resolves.toBe('not_supported');
    expect(nfcManagerMock.start).not.toHaveBeenCalled();
  });

  it('reports disabled separately from supported and ready', async () => {
    nfcManagerMock.isEnabled.mockResolvedValue(false);
    const adapter = createAdapter({ platform: 'android' });
    await expect(adapter.checkCapability()).resolves.toBe('disabled');
  });

  it('reports ready when Android NFC is supported and enabled', async () => {
    const adapter = createAdapter({ platform: 'android' });
    await expect(adapter.checkCapability()).resolves.toBe('ready');
  });

  it('maps registration failure to unavailable and performs cleanup exactly once', async () => {
    nfcManagerMock.registerTagEvent.mockRejectedValue(new Error('synthetic platform failure'));
    const adapter = createAdapter({ platform: 'android' });
    await expect(adapter.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('times out through an injected timeout and cleans up exactly once', async () => {
    vi.useFakeTimers();
    const adapter = createAdapter({ platform: 'android', timeoutMilliseconds: 25 });
    const result = adapter.scan();
    await vi.advanceTimersByTimeAsync(25);
    await expect(result).resolves.toEqual({ status: 'timed_out' });
    expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('explicit cancellation settles all callers and cleans up once', async () => {
    const adapter = createAdapter({ platform: 'android' });
    const first = adapter.scan();
    const second = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    await adapter.cancelCapture();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'cancelled' },
      { status: 'cancelled' },
    ]);
    expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('runtime stop cancels an active capture', async () => {
    const { adapter, result } = await beginCapture();
    await adapter.stop();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });

  it('cancels while manager start is still pending without installing a late listener', async () => {
    const start = deferred<void>();
    nfcManagerMock.start.mockReturnValue(start.promise);
    const adapter = createAdapter({ platform: 'android' });
    const result = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.start).toHaveBeenCalledTimes(1));
    const cancellation = adapter.cancelCapture();
    start.resolve();
    await cancellation;
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(nfcManagerMock.registerTagEvent).not.toHaveBeenCalled();
    expect(nfcManagerMock.setEventListener).not.toHaveBeenCalled();
  });

  it('settles during a stuck registration and blocks reuse until late cleanup completes', async () => {
    const registration = deferred<void>();
    nfcManagerMock.registerTagEvent
      .mockReturnValueOnce(registration.promise)
      .mockResolvedValue(undefined);
    const { adapter, result } = await beginCapture();
    await adapter.cancelCapture();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(nfcManagerMock.unregisterTagEvent).not.toHaveBeenCalled();

    await expect(adapter.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1);

    registration.resolve();
    await vi.waitFor(() => expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1));

    const later = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(2));
    discoverListener(1)({ id: 'A1B2' });
    await expect(later).resolves.toEqual({
      status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt,
    });
  });

  it('ignores late callbacks after settlement without a second cleanup', async () => {
    const { result, listener } = await beginCapture();
    listener({ id: 'A1B2' });
    await result;
    listener({ id: 'C3D4' });
    await Promise.resolve();
    expect(nfcManagerMock.unregisterTagEvent).toHaveBeenCalledTimes(1);
  });

  it('still settles when best-effort native unregistration rejects', async () => {
    nfcManagerMock.unregisterTagEvent.mockRejectedValue(new Error('synthetic cleanup failure'));
    const { result, listener } = await beginCapture();
    listener({ id: 'A1B2' });
    await expect(result).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
  });

  it('allows a clean later scan after success and ignores the stale first listener', async () => {
    const adapter = createAdapter({ platform: 'android' });
    const first = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    const stale = discoverListener(0);
    stale({ id: 'A1B2' });
    await first;

    const second = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(2));
    let secondSettled = false;
    void second.then(() => { secondSettled = true; });
    stale({ id: 'C3D4' });
    await Promise.resolve();
    expect(secondSettled).toBe(false);
    discoverListener(1)({ id: 'E5F6' });
    await expect(second).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:E5F6', capturedAt });
  });

  it('allows a later scan after registration failure', async () => {
    nfcManagerMock.registerTagEvent.mockRejectedValueOnce(new Error('synthetic failure'));
    const adapter = createAdapter({ platform: 'android' });
    await expect(adapter.scan()).resolves.toEqual({ status: 'unavailable' });
    const later = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(2));
    discoverListener(1)({ id: 'A1B2' });
    await expect(later).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
  });

  it('allows a later scan after timeout', async () => {
    vi.useFakeTimers();
    const adapter = createAdapter({ platform: 'android', timeoutMilliseconds: 10 });
    const timedOut = adapter.scan();
    await vi.advanceTimersByTimeAsync(10);
    await expect(timedOut).resolves.toEqual({ status: 'timed_out' });
    const later = adapter.scan();
    await vi.advanceTimersByTimeAsync(1);
    discoverListener(1)({ id: 'A1B2' });
    await expect(later).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
  });

  it('allows a later scan after cancellation', async () => {
    const adapter = createAdapter({ platform: 'android' });
    const cancelled = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    await adapter.cancelCapture();
    await expect(cancelled).resolves.toEqual({ status: 'cancelled' });
    const later = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(2));
    discoverListener(1)({ id: 'A1B2' });
    await expect(later).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
  });

  it('maps an invalid UID to unreadable and allows a later valid scan', async () => {
    const adapter = createAdapter({ platform: 'android' });
    const invalid = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    discoverListener(0)({ id: 'raw-invalid-uid' });
    await expect(invalid).resolves.toEqual({ status: 'unreadable' });
    const later = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(2));
    discoverListener(1)({ id: 'A1B2' });
    await expect(later).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
  });

  it('recovers from start failure without installing a listener', async () => {
    nfcManagerMock.start.mockRejectedValueOnce(new Error('synthetic start failure'));
    const adapter = createAdapter({ platform: 'android' });
    await expect(adapter.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(nfcManagerMock.registerTagEvent).not.toHaveBeenCalled();
    const later = adapter.scan();
    await vi.waitFor(() => expect(nfcManagerMock.registerTagEvent).toHaveBeenCalledTimes(1));
    discoverListener()({ id: 'A1B2' });
    await expect(later).resolves.toEqual({ status: 'captured', payload: 'nfc:uid:v1:A1B2', capturedAt });
    expect(nfcManagerMock.start).toHaveBeenCalledTimes(2);
  });
});
