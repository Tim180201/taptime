import { describe, expect, it } from 'vitest';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  createCanonicalNfcUidPayload,
  customerAssignmentTarget,
} from '@taptime/core';
import { SessionBoundScanContextResolver } from '../../src/scan/SessionBoundScanContextResolver';
import type { ProductScanSessionSnapshot } from '../../src/scan/contracts';
import type {
  ScanContextApiPort,
  ScanContextResolutionCommand,
  ScanContextResolutionResult,
} from '../../src/transport/contracts';

const payloadA = createCanonicalNfcUidPayload('A1B2');
const payloadB = createCanonicalNfcUidPayload('C3D4');

const contextA = {
  status: 'resolved',
  assignmentId: NfcAssignmentId('20000000-0000-4000-8000-000000000101'),
  nfcTagId: NfcTagId('30000000-0000-4000-8000-000000000101'),
  target: customerAssignmentTarget(CustomerId('40000000-0000-4000-8000-000000000101')),
} satisfies ScanContextResolutionResult;

const contextB = {
  status: 'resolved',
  assignmentId: NfcAssignmentId('20000000-0000-4000-8000-000000000202'),
  nfcTagId: NfcTagId('30000000-0000-4000-8000-000000000202'),
  target: customerAssignmentTarget(CustomerId('40000000-0000-4000-8000-000000000202')),
} satisfies ScanContextResolutionResult;

function snapshot(
  overrides: Partial<ProductScanSessionSnapshot['session']> & { readonly generation?: number } = {},
): ProductScanSessionSnapshot {
  return {
    generation: overrides.generation ?? 1,
    session: {
      userId: overrides.userId ?? '10000000-0000-4000-8000-000000000101',
      organizationId: overrides.organizationId ?? '00000000-0000-4000-8000-000000000101',
      membershipId: overrides.membershipId ?? '12000000-0000-4000-8000-000000000101',
      role: overrides.role ?? 'employee',
    },
  };
}

class FakeLiveScanContext implements ScanContextApiPort {
  readonly commands: ScanContextResolutionCommand[] = [];
  implementation: (
    command: ScanContextResolutionCommand,
  ) => Promise<ScanContextResolutionResult> = async () => contextA;

  async resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolutionResult> {
    this.commands.push(command);
    return this.implementation(command);
  }
}

function setup() {
  const live = new FakeLiveScanContext();
  const resolver = new SessionBoundScanContextResolver(live);
  return { live, resolver };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function seedA(context: ReturnType<typeof setup>, session = snapshot()): Promise<void> {
  await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toMatchObject({
    status: 'resolved', source: 'live', assignmentId: contextA.assignmentId,
  });
}

describe('SessionBoundScanContextResolver', () => {
  it('always attempts live first and falls back only after an exact transient failure', async () => {
    const context = setup();
    const session = snapshot();
    await seedA(context, session);
    context.live.implementation = async () => ({ status: 'transient_failure' });

    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      ...contextA,
      target: { ...contextA.target },
      source: 'session_cache',
    });
    expect(context.live.commands).toEqual([
      { organizationId: session.session.organizationId, payload: payloadA },
      { organizationId: session.session.organizationId, payload: payloadA },
    ]);
    expect(JSON.stringify(context.live.commands)).not.toMatch(
      /userId|membershipId|role|generation/,
    );
  });

  it('returns a transient failure when no positive slot exists', async () => {
    const context = setup();
    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session: snapshot(), payload: payloadA }))
      .resolves.toEqual({ status: 'transient_failure' });
  });

  it.each([
    ['generation', snapshot({ generation: 2 }), payloadA],
    ['User', snapshot({ userId: '10000000-0000-4000-8000-000000000202' }), payloadA],
    ['Organization', snapshot({ organizationId: '00000000-0000-4000-8000-000000000202' }), payloadA],
    ['Membership', snapshot({ membershipId: '12000000-0000-4000-8000-000000000202' }), payloadA],
    ['role', snapshot({ role: 'administrator' }), payloadA],
    ['payload', snapshot(), payloadB],
  ] as const)('refuses fallback after an exact %s mismatch', async (_field, session, payload) => {
    const context = setup();
    await seedA(context);
    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session, payload })).resolves.toEqual({
      status: 'transient_failure',
    });
  });

  it('replaces its single slot after another live positive resolution', async () => {
    const context = setup();
    const session = snapshot();
    await seedA(context, session);
    context.live.implementation = async () => contextB;
    await context.resolver.resolve({ session, payload: payloadB });
    context.live.implementation = async () => ({ status: 'transient_failure' });

    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'transient_failure',
    });
    await expect(context.resolver.resolve({ session, payload: payloadB })).resolves.toMatchObject({
      status: 'resolved', source: 'session_cache', assignmentId: contextB.assignmentId,
    });
  });

  it('stores defensive frozen copies of both session and resolved context', async () => {
    const context = setup();
    const mutableSession = snapshot();
    const liveContext = {
      ...contextA,
      target: { ...contextA.target },
    } as Extract<ScanContextResolutionResult, { status: 'resolved' }>;
    context.live.implementation = async () => liveContext;

    const liveResult = await context.resolver.resolve({
      session: mutableSession,
      payload: payloadA,
    });
    expect(Object.isFrozen(liveResult)).toBe(true);
    if (liveResult.status === 'resolved') {
      expect(Object.isFrozen(liveResult.target)).toBe(true);
    }

    (mutableSession.session as { role: 'administrator' | 'employee' }).role = 'administrator';
    (liveContext.target as { targetId: CustomerId }).targetId = CustomerId(
      '40000000-0000-4000-8000-000000000999',
    );
    context.live.implementation = async () => ({ status: 'transient_failure' });

    await expect(context.resolver.resolve({ session: snapshot(), payload: payloadA }))
      .resolves.toMatchObject({
        status: 'resolved',
        source: 'session_cache',
        target: { targetId: contextA.target.targetId },
      });
  });

  it('invalidates a matching slot after a definitive not-resolved response', async () => {
    const context = setup();
    const session = snapshot();
    await seedA(context, session);
    context.live.implementation = async () => ({ status: 'not_resolved' });
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'not_resolved',
    });
    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'transient_failure',
    });
  });

  it('retains the slot when not-resolved belongs to another payload', async () => {
    const context = setup();
    const session = snapshot();
    await seedA(context, session);
    context.live.implementation = async () => ({ status: 'not_resolved' });
    await context.resolver.resolve({ session, payload: payloadB });
    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toMatchObject({
      status: 'resolved', source: 'session_cache',
    });
  });

  it.each(['authority_rejected', 'unavailable'] as const)(
    'invalidates the entire slot after %s',
    async (status) => {
      const context = setup();
      const session = snapshot();
      await seedA(context, session);
      context.live.implementation = async () => ({ status });
      await expect(context.resolver.resolve({ session, payload: payloadB })).resolves.toEqual({
        status,
      });
      context.live.implementation = async () => ({ status: 'transient_failure' });
      await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
        status: 'transient_failure',
      });
    },
  );

  it('maps a thrown live call to unavailable and invalidates the slot', async () => {
    const context = setup();
    const session = snapshot();
    await seedA(context, session);
    context.live.implementation = async () => {
      throw new Error('synthetic live transport failure');
    };
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'unavailable',
    });
    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'transient_failure',
    });
  });

  it('supports explicit invalidation for owning runtime and session transitions', async () => {
    const context = setup();
    const session = snapshot();
    await seedA(context, session);
    context.resolver.clear();
    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'transient_failure',
    });
  });

  it('never lets a stale in-flight live response repopulate a cleared slot', async () => {
    const context = setup();
    const session = snapshot();
    const liveResult = deferred<ScanContextResolutionResult>();
    context.live.implementation = () => liveResult.promise;
    const inFlight = context.resolver.resolve({ session, payload: payloadA });

    context.resolver.clear();
    liveResult.resolve(contextA);
    await expect(inFlight).resolves.toMatchObject({ status: 'resolved', source: 'live' });

    context.live.implementation = async () => ({ status: 'transient_failure' });
    await expect(context.resolver.resolve({ session, payload: payloadA })).resolves.toEqual({
      status: 'transient_failure',
    });
  });
});
