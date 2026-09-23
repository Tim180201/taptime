import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createTimestamp } from '@taptime/core';

const { manager, errors, listeners } = vi.hoisted(() => ({
  manager: { start: vi.fn(), isSupported: vi.fn(), isEnabled: vi.fn(), requestTechnology: vi.fn(),
    getTag: vi.fn(), cancelTechnologyRequest: vi.fn(), setEventListener: vi.fn(),
    registerTagEvent: vi.fn(), unregisterTagEvent: vi.fn() },
  errors: { UserCancel: class extends Error {}, Timeout: class extends Error {} },
  listeners: new Map<string, ((value: unknown) => void) | null>(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('react-native-nfc-manager', () => ({ default: manager, NfcTech: { MifareIOS: 'mifare' },
  NfcEvents: { SessionClosed: 'closed', DiscoverTag: 'discover' }, NfcError: errors }));
import { RnNfcScanAdapter, normalizeTag } from '../../src/nfc/RnNfcScanAdapter';
import { ExclusiveNfcCaptureArbiter } from '../../src/nfc/ExclusiveNfcCaptureArbiter';

const capturedAt = createTimestamp('2026-09-23T10:00:00.000Z');
const tag = { id: '0400A1b2C3d4E5', type: 'mifare', ndefMessage: [] };
function adapter(timeoutMilliseconds = 20_000) { return new RnNfcScanAdapter({ platform: 'ios', captureTimestamp: () => capturedAt, timeoutMilliseconds }); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function close(error: unknown = null) { listeners.get('closed')?.(error); }

beforeEach(() => {
  vi.resetAllMocks(); listeners.clear();
  manager.start.mockResolvedValue(undefined); manager.isSupported.mockResolvedValue(true);
  manager.requestTechnology.mockResolvedValue('mifare'); manager.getTag.mockResolvedValue(tag);
  manager.setEventListener.mockImplementation((name, listener) => { listeners.set(name, listener); });
  // manager 3.17.2 emits SessionClosed AFTER cancel resolves (native reset precedes event).
  manager.cancelTechnologyRequest.mockImplementation(async () => { queueMicrotask(() => close()); });
});
afterEach(() => vi.useRealTimers());

describe('iOS explicit tag reader', () => {
  it('checks TagReader support without opening a session or asking Android isEnabled', async () => {
    await expect(adapter().checkCapability()).resolves.toBe('ready');
    expect(manager.isSupported).toHaveBeenCalledWith('mifare');
    expect(manager.requestTechnology).not.toHaveBeenCalled();
    expect(manager.registerTagEvent).not.toHaveBeenCalled();
    expect(manager.isEnabled).not.toHaveBeenCalled();
  });
  it('returns identical canonical evidence to Android, preserving leading zero bytes and ignoring NDEF', async () => {
    const ios = await adapter().scan();
    expect(ios).toEqual(normalizeTag(tag, capturedAt));
    expect(ios).toEqual({ status: 'captured', payload: 'nfc:uid:v1:0400A1B2C3D4E5', capturedAt });
    expect(manager.requestTechnology).toHaveBeenCalledWith('mifare', { alertMessage: 'Halte dein iPhone an den Tag.' });
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
    expect(listeners.get('closed')).toBeNull();
  });
  it.each([undefined, '', '04:00', '004'])('rejects malformed UID %s without another identity', async (id) => {
    manager.getTag.mockResolvedValue({ ...tag, id });
    await expect(adapter().scan()).resolves.toEqual({ status: 'unreadable' });
  });
  it('does not request a session on unsupported devices', async () => {
    manager.isSupported.mockResolvedValue(false);
    const nfc = adapter();
    await expect(nfc.checkCapability()).resolves.toBe('not_supported');
    await expect(nfc.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(manager.requestTechnology).not.toHaveBeenCalled();
  });
  it.each([['cancelled', () => new errors.UserCancel()], ['timed_out', () => new errors.Timeout()]] as const)
    ('maps native %s and accepts a later session', async (status, makeError) => {
      manager.requestTechnology.mockImplementationOnce(async () => { const error = makeError(); close(status === 'cancelled' ? null : error); throw error; });
      const nfc = adapter();
      await expect(nfc.scan()).resolves.toEqual({ status });
      await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
    });
  it('cancels before a pending start finishes without opening a late session', async () => {
    const start = deferred<void>(); manager.start.mockReturnValue(start.promise);
    const nfc = adapter(); const result = nfc.scan();
    await vi.waitFor(() => expect(manager.start).toHaveBeenCalled());
    const cancellation = nfc.cancelCapture(); start.resolve(); await cancellation;
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(manager.requestTechnology).not.toHaveBeenCalled();
  });
  it.each([['cancelled', () => new errors.UserCancel()], ['timed_out', () => new errors.Timeout()]] as const)
    ('preserves %s when the native request rejects before SessionClosed and cleanup finds no session', async (status, makeError) => {
      manager.requestTechnology.mockRejectedValueOnce(makeError());
      manager.cancelTechnologyRequest.mockRejectedValueOnce(new Error('Not even registered'));
      const nfc = adapter(); const result = nfc.scan();
      let done = false; void result.then(() => { done = true; });
      await vi.waitFor(() => expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce());
      expect(done).toBe(false);
      await expect(nfc.scan()).resolves.toEqual({ status: 'unavailable' });
      close(status === 'cancelled' ? null : makeError());
      await expect(result).resolves.toEqual({ status });
      await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
    });
  it('withholds a captured result if its native cleanup fails', async () => {
    manager.cancelTechnologyRequest.mockRejectedValueOnce(new Error('bridge failure'));
    const nfc = adapter(); const result = nfc.scan();
    await vi.waitFor(() => expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce());
    close();
    await expect(result).resolves.toEqual({ status: 'unavailable' });
  });
  it('times out an open reader and drains the request before allowing reuse', async () => {
    vi.useFakeTimers(); const request = deferred<string>();
    manager.requestTechnology.mockReturnValueOnce(request.promise);
    manager.cancelTechnologyRequest.mockImplementationOnce(async () => { request.reject(new errors.UserCancel()); queueMicrotask(() => close()); });
    const nfc = adapter(100); const result = nfc.scan();
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toEqual({ status: 'timed_out' });
    await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
  });
  it('rejects a second session and waits for SessionClosed after native cancel returns', async () => {
    manager.cancelTechnologyRequest.mockResolvedValue(undefined);
    const nfc = adapter(); const arbiter = new ExclusiveNfcCaptureArbiter(nfc);
    const lifecycle = arbiter.scope('lifecycle'); const administration = arbiter.scope('administration');
    const first = lifecycle.scan(); let done = false; void first.then(() => { done = true; });
    await vi.waitFor(() => expect(manager.cancelTechnologyRequest).toHaveBeenCalled());
    expect(done).toBe(false);
    await expect(administration.scan()).resolves.toEqual({ status: 'unavailable' });
    close(); await expect(first).resolves.toMatchObject({ status: 'captured' });
  });
  it('holds the administration owner throughout the connected tag action', async () => {
    const action = deferred<void>(); const nfc = adapter(); const arbiter = new ExclusiveNfcCaptureArbiter(nfc);
    const administration = arbiter.scope('administration'); const lifecycle = arbiter.scope('lifecycle');
    const write = vi.fn(() => action.promise);
    expect(administration.scanWithTagAction).toBeTypeOf('function');
    const result = administration.scanWithTagAction!(write);
    await vi.waitFor(() => expect(write).toHaveBeenCalled());
    expect(manager.cancelTechnologyRequest).not.toHaveBeenCalled();
    await expect(lifecycle.scan()).resolves.toEqual({ status: 'unavailable' });
    action.resolve(); await expect(result).resolves.toMatchObject({ status: 'captured' });
    expect(manager.requestTechnology).toHaveBeenCalledOnce();
  });
  it('withholds a capture after cancellation during the connected action', async () => {
    const action = deferred<void>(); const nfc = adapter();
    expect(nfc.scanWithTagAction).toBeTypeOf('function');
    const result = nfc.scanWithTagAction!(async () => action.promise);
    await vi.waitFor(() => expect(manager.getTag).toHaveBeenCalled());
    const cancellation = nfc.cancelCapture(); action.resolve(); await cancellation;
    await expect(result).resolves.toEqual({ status: 'cancelled' });
  });
  it('fails closed if native cleanup never closes, then recovers only after the old callback', async () => {
    vi.useFakeTimers(); manager.cancelTechnologyRequest.mockResolvedValue(undefined);
    const nfc = adapter(); const result = nfc.scan();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toEqual({ status: 'unavailable' });
    await expect(nfc.scan()).resolves.toEqual({ status: 'unavailable' });
    close(); manager.cancelTechnologyRequest.mockImplementation(async () => { queueMicrotask(() => close()); });
    await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
  });
});
