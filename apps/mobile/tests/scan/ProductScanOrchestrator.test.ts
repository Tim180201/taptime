import { describe, expect, it, vi } from 'vitest';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  TimeEntryId,
  WorkEventId,
  createCanonicalNfcUidPayload,
  createTimestamp,
  customerAssignmentTarget,
  type NfcScanCaptureResult,
  type NfcScanPort,
} from '@taptime/core';
import type { NfcCaptureLifecyclePort, NfcCapabilityState } from '../../src/nfc/RnNfcScanAdapter';
import { ProductScanOrchestrator } from '../../src/scan/ProductScanOrchestrator';
import type {
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
} from '../../src/scan/contracts';
import type {
  LifecycleEventApiPort,
  LifecycleEventCommand,
  LifecycleEventResult,
  ScanContextApiPort,
  ScanContextResolutionCommand,
  ScanContextResolutionResult,
} from '../../src/transport/contracts';

const sessionA: ProductScanSessionSnapshot = Object.freeze({
  generation: 1,
  session: Object.freeze({
    userId: '10000000-0000-4000-8000-000000000101',
    membershipId: '12000000-0000-4000-8000-000000000101',
    organizationId: '00000000-0000-4000-8000-000000000101',
    role: 'employee',
  }),
});

const sessionB: ProductScanSessionSnapshot = Object.freeze({
  generation: 2,
  session: Object.freeze({
    userId: '10000000-0000-4000-8000-000000000202',
    membershipId: '12000000-0000-4000-8000-000000000202',
    organizationId: '00000000-0000-4000-8000-000000000202',
    role: 'employee',
  }),
});

const resolvedContext: Extract<ScanContextResolutionResult, { status: 'resolved' }> = {
  status: 'resolved',
  assignmentId: NfcAssignmentId('20000000-0000-4000-8000-000000000101'),
  nfcTagId: NfcTagId('30000000-0000-4000-8000-000000000101'),
  target: customerAssignmentTarget(CustomerId('40000000-0000-4000-8000-000000000101')),
};

const startedResult: LifecycleEventResult = {
  status: 'synchronized',
  idempotentRetry: false,
  decision: {
    status: 'time_entry_started',
    timeEntryId: TimeEntryId('50000000-0000-4000-8000-000000000101'),
  },
  workEventId: WorkEventId('60000000-0000-4000-8000-000000000101'),
  receiptId: '70000000-0000-4000-8000-000000000101',
  serverTimeEntryId: TimeEntryId('50000000-0000-4000-8000-000000000101'),
};

const capturedAt = createTimestamp('2026-07-14T08:30:00.000Z');

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeSessionContext implements ProductScanSessionContextReader {
  private readonly listeners = new Set<() => void>();

  constructor(private snapshot: ProductScanSessionSnapshot | null = sessionA) {}

  capture(): ProductScanSessionSnapshot | null {
    return this.snapshot;
  }

  isCurrent(snapshot: ProductScanSessionSnapshot): boolean {
    const current = this.snapshot;
    return current !== null
      && current.generation === snapshot.generation
      && current.session.userId === snapshot.session.userId
      && current.session.organizationId === snapshot.session.organizationId
      && current.session.membershipId === snapshot.session.membershipId
      && current.session.role === snapshot.session.role;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replace(snapshot: ProductScanSessionSnapshot | null): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

class FakeNfc implements NfcScanPort, NfcCaptureLifecyclePort {
  capability: NfcCapabilityState = 'ready';
  scanCalls = 0;
  capabilityCalls = 0;
  cancelCalls = 0;
  stopCalls = 0;
  scanImplementation: () => Promise<NfcScanCaptureResult> = async () => ({
    status: 'captured',
    payload: createCanonicalNfcUidPayload('A1B2'),
    capturedAt,
  });

  async scan(): Promise<NfcScanCaptureResult> {
    this.scanCalls += 1;
    return this.scanImplementation();
  }

  async checkCapability(): Promise<NfcCapabilityState> {
    this.capabilityCalls += 1;
    return this.capability;
  }

  async cancelCapture(): Promise<void> {
    this.cancelCalls += 1;
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
    await this.cancelCapture();
  }
}

class FakeScanContext implements ScanContextApiPort {
  readonly commands: ScanContextResolutionCommand[] = [];
  implementation: (command: ScanContextResolutionCommand) => Promise<ScanContextResolutionResult> =
    async () => resolvedContext;

  async resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolutionResult> {
    this.commands.push(command);
    return this.implementation(command);
  }
}

class FakeLifecycle implements LifecycleEventApiPort {
  readonly commands: LifecycleEventCommand[] = [];
  implementation: (command: LifecycleEventCommand) => Promise<LifecycleEventResult> =
    async () => startedResult;

  async ingest(command: LifecycleEventCommand): Promise<LifecycleEventResult> {
    this.commands.push(command);
    return this.implementation(command);
  }
}

function setup() {
  const nfc = new FakeNfc();
  const scanContext = new FakeScanContext();
  const lifecycle = new FakeLifecycle();
  const session = new FakeSessionContext();
  const uuids = [
    '60000000-0000-4000-8000-000000000101',
    '70000000-0000-4000-8000-000000000101',
    '60000000-0000-4000-8000-000000000102',
    '70000000-0000-4000-8000-000000000102',
  ];
  let uuidIndex = 0;
  const createUuid = vi.fn(() => uuids[uuidIndex++]!);
  const orchestrator = new ProductScanOrchestrator(
    nfc,
    nfc,
    scanContext,
    lifecycle,
    session,
    createUuid,
  );
  return { nfc, scanContext, lifecycle, session, createUuid, orchestrator };
}

async function startReady(context: ReturnType<typeof setup>): Promise<void> {
  await context.orchestrator.start();
  expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: null });
}

describe('ProductScanOrchestrator (Block D)', () => {
  it('uses the real scan port once, then scan-context, then lifecycle with exact capture evidence', async () => {
    const context = setup();
    const order: string[] = [];
    context.nfc.scanImplementation = async () => {
      order.push('scan');
      return { status: 'captured', payload: createCanonicalNfcUidPayload('a1b2'), capturedAt };
    };
    context.scanContext.implementation = async () => {
      order.push('scan-context');
      return resolvedContext;
    };
    context.lifecycle.implementation = async () => {
      order.push('lifecycle');
      return startedResult;
    };
    await startReady(context);

    await context.orchestrator.scan();

    expect(order).toEqual(['scan', 'scan-context', 'lifecycle']);
    expect(context.nfc.scanCalls).toBe(1);
    expect(context.scanContext.commands).toEqual([{
      organizationId: sessionA.session.organizationId,
      payload: 'nfc:uid:v1:A1B2',
    }]);
    expect(context.lifecycle.commands).toEqual([{
      organizationId: sessionA.session.organizationId,
      workEvent: {
        id: '60000000-0000-4000-8000-000000000101',
        assignmentId: resolvedContext.assignmentId,
        nfcTagId: resolvedContext.nfcTagId,
        target: resolvedContext.target,
        occurredAt: '2026-07-14T08:30:00.000Z',
      },
      receipt: {
        id: '70000000-0000-4000-8000-000000000101',
        attemptNumber: 1,
      },
    }]);
    expect(context.createUuid).toHaveBeenCalledTimes(2);
    expect(context.orchestrator.getState()).toEqual({
      status: 'ready',
      outcome: { status: 'time_entry_started' },
    });
  });

  it.each([
    [{ status: 'unreadable' }, 'unreadable'],
    [{ status: 'timed_out' }, 'timed_out'],
    [{ status: 'cancelled' }, 'cancelled'],
    [{ status: 'unavailable' }, 'nfc_unavailable'],
  ] as const)('does not call either server port after capture result %s', async (capture, outcome) => {
    const context = setup();
    context.nfc.scanImplementation = async () => capture;
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.scanContext.commands).toEqual([]);
    expect(context.lifecycle.commands).toEqual([]);
    expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: { status: outcome } });
  });

  it('rejects a non-canonical capture before any server request', async () => {
    const context = setup();
    context.nfc.scanImplementation = async () => ({
      status: 'captured',
      payload: 'A1B2' as ReturnType<typeof createCanonicalNfcUidPayload>,
      capturedAt,
    });
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.scanContext.commands).toEqual([]);
    expect(context.orchestrator.getState()).toEqual({
      status: 'ready', outcome: { status: 'unreadable' },
    });
  });

  it('fails closed when a physical capture has no discovery timestamp', async () => {
    const context = setup();
    context.nfc.scanImplementation = async () => ({
      status: 'captured',
      payload: createCanonicalNfcUidPayload('A1B2'),
    });
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.scanContext.commands).toEqual([]);
    expect(context.lifecycle.commands).toEqual([]);
    expect(context.orchestrator.getState()).toEqual({
      status: 'ready', outcome: { status: 'nfc_unavailable' },
    });
  });

  it.each([
    [{ status: 'not_resolved' }, 'tag_not_assigned'],
    [{ status: 'transient_failure' }, 'scan_context_unavailable'],
    [{ status: 'unavailable' }, 'scan_context_unavailable'],
    [{ status: 'authority_rejected' }, 'session_rejected'],
  ] as const)('does not create lifecycle evidence when scan-context returns %s', async (result, outcome) => {
    const context = setup();
    context.scanContext.implementation = async () => result;
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.lifecycle.commands).toEqual([]);
    expect(context.createUuid).not.toHaveBeenCalled();
    expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: { status: outcome } });
  });

  it.each([
    [startedResult, 'time_entry_started'],
    [{
      ...startedResult,
      decision: {
        status: 'time_entry_stopped',
        timeEntryId: TimeEntryId('50000000-0000-4000-8000-000000000101'),
      },
    }, 'time_entry_stopped'],
    [{
      ...startedResult,
      decision: {
        status: 'duplicate_scan_ignored',
        previousWorkEventId: WorkEventId('60000000-0000-4000-8000-000000000099'),
      },
      serverTimeEntryId: null,
    }, 'duplicate_scan_ignored'],
    [{
      ...startedResult,
      decision: {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: TimeEntryId('50000000-0000-4000-8000-000000000099'),
      },
      serverTimeEntryId: TimeEntryId('50000000-0000-4000-8000-000000000099'),
    }, 'active_entry_for_other_target_rejected'],
    [{
      ...startedResult,
      decision: {
        status: 'escalation_required',
        reason: 'work_event_precedes_active_time_entry',
      },
      serverTimeEntryId: null,
    }, 'escalation_required'],
    [{ status: 'deferred', reason: 'configuration_unavailable_or_inactive' }, 'deferred'],
    [{ status: 'conflict', reason: 'work_event_content_conflict' }, 'conflict'],
  ] as const)('maps the exact server result to presentation %s without local lifecycle choice', async (result, outcome) => {
    const context = setup();
    context.lifecycle.implementation = async () => result;
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: { status: outcome } });
  });

  it('coalesces rapid presses into one capture and one immutable evidence set', async () => {
    const context = setup();
    const capture = deferred<NfcScanCaptureResult>();
    context.nfc.scanImplementation = () => capture.promise;
    await startReady(context);
    const first = context.orchestrator.scan();
    const second = context.orchestrator.scan();
    expect(first).toBe(second);
    expect(context.nfc.scanCalls).toBe(1);
    capture.resolve({ status: 'captured', payload: createCanonicalNfcUidPayload('A1B2'), capturedAt });
    await Promise.all([first, second]);
    expect(context.scanContext.commands).toHaveLength(1);
    expect(context.lifecycle.commands).toHaveLength(1);
    expect(context.createUuid).toHaveBeenCalledTimes(2);
  });

  it('retains ambiguous lifecycle evidence and retries the byte-equivalent command only', async () => {
    const context = setup();
    context.lifecycle.implementation = vi.fn()
      .mockResolvedValueOnce({ status: 'transient_failure' })
      .mockResolvedValueOnce(startedResult);
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.orchestrator.getState()).toEqual({ status: 'retry_pending' });
    const original = context.lifecycle.commands[0]!;
    const serialized = JSON.stringify(original);

    const firstRetry = context.orchestrator.retry();
    const duplicateRetry = context.orchestrator.retry();
    expect(firstRetry).toBe(duplicateRetry);
    await firstRetry;

    expect(context.lifecycle.commands).toHaveLength(2);
    expect(context.lifecycle.commands[1]).toBe(original);
    expect(JSON.stringify(context.lifecycle.commands[1])).toBe(serialized);
    expect(context.lifecycle.commands[1]!.receipt.attemptNumber).toBe(1);
    expect(context.nfc.scanCalls).toBe(1);
    expect(context.scanContext.commands).toHaveLength(1);
    expect(context.createUuid).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 'transient_failure' },
    { status: 'unavailable' },
  ] as const)('treats lifecycle %s as ambiguous and blocks a new scan', async (result) => {
    const context = setup();
    context.lifecycle.implementation = async () => result;
    await startReady(context);
    await context.orchestrator.scan();
    await context.orchestrator.scan();
    expect(context.orchestrator.getState()).toEqual({ status: 'retry_pending' });
    expect(context.nfc.scanCalls).toBe(1);
  });

  it('cancels capture on session replacement and never submits a late old-session tag', async () => {
    const context = setup();
    const capture = deferred<NfcScanCaptureResult>();
    context.nfc.scanImplementation = () => capture.promise;
    await startReady(context);
    const operation = context.orchestrator.scan();
    context.session.replace(sessionB);
    await vi.waitFor(() => expect(context.nfc.cancelCalls).toBeGreaterThan(0));
    capture.resolve({ status: 'captured', payload: createCanonicalNfcUidPayload('A1B2'), capturedAt });
    await operation;
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: null }));
    expect(context.scanContext.commands).toEqual([]);
    expect(context.lifecycle.commands).toEqual([]);
  });

  it.each([
    ['sign-out', null],
    ['session generation change', Object.freeze({ ...sessionA, generation: 2 })],
    ['Membership context replacement', Object.freeze({
      ...sessionA,
      session: Object.freeze({
        ...sessionA.session,
        membershipId: '12000000-0000-4000-8000-000000000303',
      }),
    })],
  ] as const)('cancels an active capture on %s', async (_label, replacement) => {
    const context = setup();
    const capture = deferred<NfcScanCaptureResult>();
    context.nfc.scanImplementation = () => capture.promise;
    await startReady(context);
    const operation = context.orchestrator.scan();
    context.session.replace(replacement);
    await vi.waitFor(() => expect(context.nfc.cancelCalls).toBeGreaterThan(0));
    capture.resolve({ status: 'captured', payload: createCanonicalNfcUidPayload('A1B2'), capturedAt });
    await operation;
    expect(context.scanContext.commands).toEqual([]);
  });

  it('does not send lifecycle evidence after session replacement during scan-context resolution', async () => {
    const context = setup();
    const resolution = deferred<ScanContextResolutionResult>();
    context.scanContext.implementation = () => resolution.promise;
    await startReady(context);
    const operation = context.orchestrator.scan();
    await vi.waitFor(() => expect(context.scanContext.commands).toHaveLength(1));
    context.session.replace(sessionB);
    resolution.resolve(resolvedContext);
    await operation;
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: null }));
    expect(context.lifecycle.commands).toEqual([]);
  });

  it('does not publish a late lifecycle response into another User/Organization session', async () => {
    const context = setup();
    const lifecycle = deferred<LifecycleEventResult>();
    context.lifecycle.implementation = () => lifecycle.promise;
    await startReady(context);
    const operation = context.orchestrator.scan();
    await vi.waitFor(() => expect(context.lifecycle.commands).toHaveLength(1));
    context.session.replace(sessionB);
    const blockedNewScan = context.orchestrator.scan();
    expect(blockedNewScan).toBe(operation);
    expect(context.nfc.scanCalls).toBe(1);
    expect(context.orchestrator.getState()).toEqual({ status: 'checking' });
    lifecycle.resolve(startedResult);
    await Promise.all([operation, blockedNewScan]);
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'ready', outcome: null }));
    await context.orchestrator.retry();
    expect(context.lifecycle.commands).toHaveLength(1);
  });

  it('protects ambiguous evidence when its response becomes transient after identity change', async () => {
    const context = setup();
    const lifecycle = deferred<LifecycleEventResult>();
    context.lifecycle.implementation = vi.fn()
      .mockImplementationOnce(() => lifecycle.promise)
      .mockResolvedValueOnce(startedResult);
    await startReady(context);
    const operation = context.orchestrator.scan();
    await vi.waitFor(() => expect(context.lifecycle.commands).toHaveLength(1));
    const original = context.lifecycle.commands[0]!;

    context.session.replace(sessionB);
    lifecycle.resolve({ status: 'transient_failure' });
    await operation;
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({
      status: 'protected_pending',
    }));
    await context.orchestrator.retry();
    expect(context.lifecycle.commands).toHaveLength(1);

    context.session.replace(Object.freeze({ ...sessionA, generation: 4 }));
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'retry_pending' }));
    await context.orchestrator.retry();
    expect(context.lifecycle.commands[1]).toBe(original);
  });

  it('allows same evidence under a new generation only for the same User and Organization', async () => {
    const context = setup();
    context.lifecycle.implementation = vi.fn()
      .mockResolvedValueOnce({ status: 'transient_failure' })
      .mockResolvedValueOnce(startedResult);
    await startReady(context);
    await context.orchestrator.scan();
    const original = context.lifecycle.commands[0]!;
    context.session.replace(Object.freeze({ ...sessionA, generation: 2 }));
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'retry_pending' }));
    await context.orchestrator.retry();
    expect(context.lifecycle.commands[1]).toBe(original);
  });

  it('protects volatile pending evidence from another User and restores it for the owner', async () => {
    const context = setup();
    context.lifecycle.implementation = vi.fn()
      .mockResolvedValueOnce({ status: 'transient_failure' })
      .mockResolvedValueOnce(startedResult);
    await startReady(context);
    await context.orchestrator.scan();
    const original = context.lifecycle.commands[0]!;
    context.session.replace(sessionB);
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'protected_pending' }));
    await context.orchestrator.retry();
    await context.orchestrator.scan();
    expect(context.lifecycle.commands).toHaveLength(1);
    expect(context.nfc.scanCalls).toBe(1);

    context.session.replace(Object.freeze({ ...sessionA, generation: 3 }));
    await vi.waitFor(() => expect(context.orchestrator.getState()).toEqual({ status: 'retry_pending' }));
    await context.orchestrator.retry();
    expect(context.lifecycle.commands[1]).toBe(original);
  });

  it('never touches native capture when capability is unsupported', async () => {
    const context = setup();
    context.nfc.capability = 'not_supported';
    await context.orchestrator.start();
    expect(context.orchestrator.getState()).toEqual({ status: 'not_supported' });
    await context.orchestrator.scan();
    expect(context.nfc.scanCalls).toBe(0);
  });

  it('keeps scanning disabled when the NFC capability check fails', async () => {
    const context = setup();
    vi.spyOn(context.nfc, 'checkCapability').mockRejectedValue(new Error('synthetic NFC failure'));
    await context.orchestrator.start();
    expect(context.orchestrator.getState()).toEqual({ status: 'unavailable' });
    await context.orchestrator.scan();
    expect(context.nfc.scanCalls).toBe(0);
  });

  it('fails closed before lifecycle when secure UUID generation is invalid or collides', async () => {
    const context = setup();
    context.createUuid.mockReset();
    context.createUuid.mockReturnValue('same-invalid-id');
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.lifecycle.commands).toEqual([]);
    expect(context.orchestrator.getState()).toEqual({
      status: 'ready', outcome: { status: 'nfc_unavailable' },
    });
  });

  it('fails closed when secure UUID generation throws', async () => {
    const context = setup();
    context.createUuid.mockImplementation(() => {
      throw new Error('synthetic entropy failure');
    });
    await startReady(context);
    await context.orchestrator.scan();
    expect(context.lifecycle.commands).toEqual([]);
    expect(context.orchestrator.getState()).toEqual({
      status: 'ready', outcome: { status: 'nfc_unavailable' },
    });
  });

  it('stops the native lifecycle and invalidates the facade without publishing late work', async () => {
    const context = setup();
    const capture = deferred<NfcScanCaptureResult>();
    context.nfc.scanImplementation = () => capture.promise;
    await startReady(context);
    const operation = context.orchestrator.scan();
    const stopped = context.orchestrator.stop();
    capture.resolve({ status: 'captured', payload: createCanonicalNfcUidPayload('A1B2'), capturedAt });
    await Promise.all([operation, stopped]);
    expect(context.nfc.stopCalls).toBe(1);
    expect(context.orchestrator.getState()).toEqual({ status: 'inactive' });
    expect(context.scanContext.commands).toEqual([]);
  });
});
