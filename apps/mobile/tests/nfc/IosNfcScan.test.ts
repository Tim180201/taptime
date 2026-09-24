import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createTimestamp } from '@taptime/core';

const { manager, errors, listeners, alert, diagnostic } = vi.hoisted(() => ({
  manager: { start: vi.fn(), isSupported: vi.fn(), isEnabled: vi.fn(), requestTechnology: vi.fn(),
    getTag: vi.fn(), cancelTechnologyRequest: vi.fn(), setEventListener: vi.fn(),
    registerTagEvent: vi.fn(), unregisterTagEvent: vi.fn() },
  errors: { UserCancel: class extends Error {}, Timeout: class extends Error {} },
  alert: vi.fn(), diagnostic: vi.fn(),
  listeners: new Map<string, ((value: unknown) => void) | null>(),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Alert: { alert } }));
vi.mock('../../src/nfc/IosNfcDiagnostics', () => ({ recordNfcDiagnostic: diagnostic }));
vi.mock('react-native-nfc-manager', () => ({ default: manager, NfcTech: { MifareIOS: 'mifare' },
  NfcEvents: { SessionClosed: 'closed', DiscoverTag: 'discover' }, NfcError: errors }));
import { RnNfcScanAdapter, normalizeTag } from '../../src/nfc/RnNfcScanAdapter';
import { AdminSetupCoordinator } from '../../src/administration/AdminSetupCoordinator';
import type { AdminSessionSnapshot, AdminSetupApiPort } from '../../src/administration/contracts';
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
  // One allowed ordering; delayed/early/missing closure are exercised separately below.
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
  it('delivers the capture before a SessionClosed delayed by three seconds, holding native ownership', async () => {
    vi.useFakeTimers();
    manager.cancelTechnologyRequest.mockImplementationOnce(async () => { setTimeout(() => close(), 3_000); });
    const nfc = adapter(); const arbiter = new ExclusiveNfcCaptureArbiter(nfc);
    const first = arbiter.scope('lifecycle').scan();
    let outcome: unknown; void first.then((value) => { outcome = value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toEqual(normalizeTag(tag, capturedAt));
    await expect(arbiter.scope('administration').scan()).resolves.toEqual({ status: 'cancelled' });
    expect(alert).toHaveBeenCalledWith('Scan wird noch abgeschlossen', expect.stringContaining('Bitte warte'));
    expect(manager.requestTechnology).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
  });
  it('waits for cancel acknowledgement even if SessionClosed arrives first', async () => {
    vi.useFakeTimers(); const cancellation = deferred<void>();
    manager.cancelTechnologyRequest.mockImplementationOnce(() => { close(); return cancellation.promise; });
    const nfc = adapter(); let outcome: unknown;
    void nfc.scan().then((value) => { outcome = value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toBeUndefined();
    await expect(nfc.scan()).resolves.toEqual({ status: 'unavailable' });
    cancellation.resolve(); await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toEqual(normalizeTag(tag, capturedAt));
    await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
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
  it('keeps the captured result when SessionClosed never arrives and never lends a late reset to a new session', async () => {
    vi.useFakeTimers(); manager.cancelTechnologyRequest.mockResolvedValue(undefined);
    const nfc = adapter(); let outcome: unknown;
    void nfc.scan().then((value) => { outcome = value; });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(outcome).toEqual(normalizeTag(tag, capturedAt));
    // A timeout is not proof of native reset. Even after a very long delay there must
    // be no new request whose handle the old delegate could erase.
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(nfc.scan()).resolves.toEqual({ status: 'cancelled' });
    expect(manager.requestTechnology).toHaveBeenCalledOnce();
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
    close();
    manager.cancelTechnologyRequest.mockImplementation(async () => { queueMicrotask(() => close()); });
    await expect(nfc.scan()).resolves.toMatchObject({ status: 'captured' });
    expect(manager.requestTechnology).toHaveBeenCalledTimes(2);
  });
  it('delivers scanWithTagAction only after writing and cancel succeed, without waiting for SessionClosed', async () => {
    vi.useFakeTimers(); const writing = deferred<void>();
    manager.cancelTechnologyRequest.mockResolvedValue(undefined);
    const nfc = adapter(); const action = vi.fn(() => writing.promise); let outcome: unknown;
    void nfc.scanWithTagAction!(action).then((value) => { outcome = value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(action).toHaveBeenCalledOnce(); expect(outcome).toBeUndefined();
    expect(manager.cancelTechnologyRequest).not.toHaveBeenCalled();
    writing.resolve(); await vi.advanceTimersByTimeAsync(0);
    expect(outcome).toEqual(normalizeTag(tag, capturedAt));
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
    close();
  });
  it('logs only lifecycle labels, relative milliseconds and mapped codes, including lost closure and failed cancel', async () => {
    vi.useFakeTimers();
    manager.cancelTechnologyRequest.mockResolvedValueOnce(undefined);
    await adapter().scanWithTagAction!(async () => undefined);
    await vi.advanceTimersByTimeAsync(2_000);
    close();
    expect(diagnostic.mock.calls.map(([phase]) => phase)).toEqual([
      'requested', 'connected', 'read', 'action_finished', 'cancel_ok', 'deadline_expired', 'session_closed',
    ]);
    expect(diagnostic).toHaveBeenLastCalledWith('session_closed', 2_000, 200);
    diagnostic.mockClear();
    manager.cancelTechnologyRequest.mockRejectedValueOnce(new Error('private-token-and-uid'));
    const pending = adapter().scan();
    await vi.advanceTimersByTimeAsync(0);
    close(new errors.Timeout()); await pending;
    expect(diagnostic).toHaveBeenCalledWith('cancel_failed', 0, -1);
    expect(diagnostic).toHaveBeenLastCalledWith('session_closed', 0, 201);
    const next = adapter().scan(); await vi.advanceTimersByTimeAsync(0); await next;
    expect(JSON.stringify(diagnostic.mock.calls)).not.toMatch(/private-token|0400A1|nfc:uid/);
    expect(diagnostic.mock.calls.every((args) => args.length === 3 && Number.isFinite(args[1]) && Number.isInteger(args[2]))).toBe(true);
  });

  it.each(['success', 'write_failed', 'cancel_failed', 'server_failed'] as const)
    ('runs real iOS capture through tag assignment with truthful outcome: %s', async (scenario) => {
      vi.useFakeTimers();
      manager.cancelTechnologyRequest.mockImplementationOnce(async () => {
        if (scenario === 'cancel_failed') throw new Error('native failure');
      });
      const snapshot: AdminSessionSnapshot = { generation: 1, session: {
        userId: '10000000-0000-4000-8000-000000000001',
        membershipId: '20000000-0000-4000-8000-000000000001',
        organizationId: '30000000-0000-4000-8000-000000000001',
        role: 'administrator', nfcSetupAvailable: true,
      } };
      const customerId = '40000000-0000-4000-8000-000000000001';
      const projection = { status: 'succeeded' as const,
        organization: { id: snapshot.session.organizationId, name: 'Testbetrieb' },
        customers: [{ id: customerId, displayName: 'Werkstatt', active: true }], nfcTags: [], nextCursor: null };
      const session = { capture: () => snapshot, isCurrent: (value: AdminSessionSnapshot) => value === snapshot,
        subscribe: () => () => undefined };
      const submitted = deferred<Awaited<ReturnType<AdminSetupApiPort['provisionTag']>>>();
      const api: AdminSetupApiPort = { readProjection: vi.fn(async () => projection), provisionTag: vi.fn(() => submitted.promise) };
      const writer = { write: vi.fn(async () => scenario === 'write_failed'
        ? { status: 'failed' as const, reason: 'write_failed' as const } : { status: 'written' as const }), cancel: vi.fn(async () => undefined) };
      const coordinator = new AdminSetupCoordinator(session,
        new ExclusiveNfcCaptureArbiter(adapter()).scope('administration'), api,
        () => '50000000-0000-4000-8000-000000000001', writer);
      await coordinator.start(); const pending = coordinator.provision(customerId, 'Eingang');
      await vi.advanceTimersByTimeAsync(2_500);
      expect(writer.write).toHaveBeenCalledOnce();
      if (scenario === 'success' || scenario === 'server_failed') {
        // Native invalidation succeeded, but no SessionClosed was sent. Only the
        // server response, not the Apple checkmark, may produce assignment success.
        expect(api.provisionTag).toHaveBeenCalledWith(expect.objectContaining({ canonicalPayload: 'nfc:uid:v1:0400A1B2C3D4E5' }));
        expect(coordinator.getState()).toMatchObject({ status: 'submitting' });
        submitted.resolve(scenario === 'success'
          ? { status: 'succeeded', validationFingerprint: 'A1B2C3D4E5F6' }
          : { status: 'unavailable' });
      } else {
        expect(api.provisionTag).not.toHaveBeenCalled();
      }
      await pending;
      const status = { success: 'tag_provisioned', write_failed: 'tag_write_failed', cancel_failed: 'nfc_unavailable', server_failed: 'request_failed' }[scenario];
      expect(coordinator.getState()).toMatchObject({ status: 'ready', outcome: { status } });
      close(); await coordinator.stop();
    });

});
