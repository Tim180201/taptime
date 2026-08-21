import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { chmod, mkdtemp, open, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_FAST_FLIGHT_PLAN,
  DA5_V5_FAST_FLIGHT_PLAN_SHA256,
  DA5_V5_FLIGHT_FAILURE_REASONS,
  DA5_V5_FLIGHT_PROTOCOL_VERSION,
  DA5_V5_INPUT_EOF_ABORT_REASON,
  DA5_V5_INPUT_ORDER_ABORT_REASON,
  DA5_V5_OS_SIGNAL_ABORT_REASON,
  Da5V5FlightController,
  Da5V5FlightProtocolValidator,
  Da5V5ReceiptSealError,
  classifyDa5V5FastLane,
  da5V5FlightTerminalResult,
  da5V5FlightProtocolStartupLines,
  requireDa5V5FlightPlanBinding,
  sealDa5V5FlightReceipt,
  terminateDa5V5UnwrappedChild,
  type Da5V5FlightReceipt,
} from '../src/Da5V5FlightController.js';

const temporaryRoots: string[] = [];
const sealedRoots: string[] = [];
const observed = Object.freeze({ equality: 'match' as const, observation: 'observed' as const });
const productMatch = Object.freeze({
  aggregates: observed,
  invariants: observed,
  queue: observed,
  schema_version: 1 as const,
  tag_roles: observed,
});

afterEach(async () => {
  for (const sealed of sealedRoots.splice(0)) {
    await chmod(sealed, 0o700).catch(() => undefined);
  }
  for (const root of temporaryRoots.splice(0)) {
    for (const entry of await readdir(root).catch(() => [])) {
      await chmod(join(root, entry), 0o700).catch(() => undefined);
    }
    await rm(root, { force: true, recursive: true });
  }
});

describe('DA5 V5 immutable fast-flight supervisor contract', () => {
  it('binds a deterministic frozen plan with the exact closed error vocabulary', () => {
    expect(DA5_V5_FAST_FLIGHT_PLAN_SHA256).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.isFrozen(DA5_V5_FAST_FLIGHT_PLAN)).toBe(true);
    expect(Object.isFrozen(DA5_V5_FAST_FLIGHT_PLAN.steps)).toBe(true);
    expect(new Set(DA5_V5_FAST_FLIGHT_PLAN.steps.map((step) => step.id)).size)
      .toBe(DA5_V5_FAST_FLIGHT_PLAN.steps.length);
    expect(DA5_V5_FLIGHT_FAILURE_REASONS).toEqual([
      'SIGNAL',
      'IPC_EOF',
      'UNEXPECTED_OUTPUT',
      'NONCE_OR_ORDER_MISMATCH',
      'CHILD_NONZERO_OR_EARLY_EXIT',
      'MACHINE_STEP_TIMEOUT_OR_HANG',
      'CLEANUP_OR_CHECKER_FAILURE',
      'RECEIPT_SEAL_FAILURE',
    ]);
    for (const step of DA5_V5_FAST_FLIGHT_PLAN.steps) {
      if (step.kind !== 'human') continue;
      expect(step.prompt).toEqual(expect.objectContaining({
        action: expect.any(String),
        allowed_response: expect.any(Array),
        button: expect.any(String),
        do_not: expect.any(String),
        field: expect.any(String),
        screen: expect.any(String),
      }));
      expect(step.prompt.allowed_response).toContain('ABORT');
    }
  });

  it('binds compact manual-email prompts, one result gate and the invitation order', () => {
    const steps = DA5_V5_FAST_FLIGHT_PLAN.steps;
    const byId = (id: string) => {
      const step = steps.find((candidate) => candidate.id === id);
      expect(step).toBeDefined();
      return step;
    };
    const humanPrompt = (id: string) => {
      const step = byId(id);
      expect(step?.kind).toBe('human');
      if (step?.kind !== 'human') throw new Error('expected Human step');
      return step.prompt;
    };
    const ids = steps.map(({ id }) => id);
    const serialized = JSON.stringify(DA5_V5_FAST_FLIGHT_PLAN);
    expect(ids.some((id) => id.includes('visible'))).toBe(false);
    expect(serialized).not.toContain('VISIBLE');
    expect(serialized).not.toContain('credential-field-confirm');
    expect(serialized).not.toContain('accessibility-credential-field-confirm');

    expect(ids.indexOf('administrator-result')).toBeLessThan(ids.indexOf('admin-setup-actions'));
    expect(ids.indexOf('admin-setup-actions')).toBeLessThan(ids.indexOf('invitation-create'));
    expect(ids.indexOf('invitation-create')).toBeLessThan(ids.indexOf('enrollment-empty-active'));
    expect(ids.indexOf('enrollment-result')).toBeLessThan(ids.indexOf('invitation-empty-active'));
    expect(ids.indexOf('invitation-empty-active')).toBeLessThan(
      ids.indexOf('invitation-field-ready'),
    );
    expect(ids.indexOf('invitation-field-ready')).toBeLessThan(ids.indexOf('invitation-secret'));
    expect(ids.indexOf('invitation-secret')).toBeLessThan(
      ids.indexOf('employee-install-transition'),
    );

    expect(humanPrompt('administrator-empty-active')).toMatchObject({
      button: 'Anmelden',
      field: 'E-Mail-Adresse / Passwort',
      screen: 'TapTim.e — Anmeldung',
    });
    expect(humanPrompt('administrator-empty-active').action).toContain(
      'administrator-e2e@example.invalid',
    );
    expect(humanPrompt('administrator-result').action).toContain('Administrator setup');
    expect(humanPrompt('enrollment-empty-active')).toMatchObject({
      button: 'Mit Einladung beitreten',
      field: 'E-Mail-Adresse / Passwort',
      screen: 'TapTim.e — Anmeldung',
    });
    expect(humanPrompt('enrollment-empty-active').action).toContain(
      'employee-enrollment-e2e@example.invalid',
    );
    expect(humanPrompt('enrollment-result').action).toContain('Als Beschäftigter beitreten');
    expect(humanPrompt('invitation-empty-active')).toMatchObject({
      button: 'Einladung sicher einlösen',
      field: 'Einladungsgeheimnis',
      screen: 'Als Beschäftigter beitreten',
    });
    expect(humanPrompt('employee-empty-active').action).toContain(
      'android-e2e@example.invalid',
    );
    expect(humanPrompt('employee-ready').action).toContain('Bereit zum Scannen');

    for (const [role, email, surface] of [
      ['administrator', 'administrator-e2e@example.invalid', 'administrator-setup'],
      ['employee', 'android-e2e@example.invalid', 'employee-navigation'],
    ] as const) {
      expect(humanPrompt(`accessibility-${role}-empty-active`).action).toContain(email);
      expect(humanPrompt(`accessibility-${surface}`)).toMatchObject({
        button: 'Anmelden',
        field: 'E-Mail-Adresse / Passwort / focus order / labels / state / layout',
      });
      expect(humanPrompt(`accessibility-${surface}`).action).toContain(surface);
    }
  });

  it('makes the child reject a supervisor digest other than its compiled plan', () => {
    const nonce = '1'.repeat(64);
    expect(requireDa5V5FlightPlanBinding(
      `flight-bind ${nonce} ${DA5_V5_FAST_FLIGHT_PLAN_SHA256}`,
    )).toEqual({ planDigest: DA5_V5_FAST_FLIGHT_PLAN_SHA256, runNonce: nonce });
    expect(() => requireDa5V5FlightPlanBinding(
      `flight-bind ${nonce} ${'f'.repeat(64)}`,
    )).toThrow(/NONCE_OR_ORDER_MISMATCH/u);
  });

  it('rejects extra, duplicate and out-of-order critical child frames', () => {
    expect(() => new Da5V5FlightProtocolValidator().observe('da5_v5_ready_extra'))
      .toThrow(/UNEXPECTED_OUTPUT/u);

    const duplicate = boundValidator();
    duplicate.beginStep('1'.repeat(64), '2'.repeat(64), 0, 'device-preflight');
    duplicate.observe(outputFrame(0, 'da5_v5_device_preflight=match'));
    expect(() => duplicate.observe(outputFrame(0, 'da5_v5_device_preflight=match')))
      .toThrow(/NONCE_OR_ORDER_MISMATCH/u);

    const outOfOrder = boundValidator();
    outOfOrder.beginStep('1'.repeat(64), '2'.repeat(64), 0, 'device-preflight');
    expect(() => outOfOrder.observe(outputFrame(1, 'da5_v5_device_preflight=match')))
      .toThrow(/NONCE_OR_ORDER_MISMATCH/u);

    const extra = boundValidator();
    extra.beginStep('1'.repeat(64), '2'.repeat(64), 0, 'device-preflight');
    extra.observe(outputFrame(0, 'da5_v5_device_preflight=match'));
    expect(() => extra.observe(outputFrame(1, 'da5_v5_device_preflight=match')))
      .toThrow(/UNEXPECTED_OUTPUT/u);
  });

  it('fails closed when a TERM/KILL-resistant child never proves close', async () => {
    const child = new EventEmitter() as ChildProcess;
    Object.assign(child, {
      exitCode: null,
      kill: vi.fn(() => true),
      pid: undefined,
      signalCode: null,
    });
    await expect(terminateDa5V5UnwrappedChild(child, 1))
      .rejects.toThrow(/CLEANUP_OR_CHECKER_FAILURE/u);
    expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
    expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
  });

  it.each([
    [DA5_V5_INPUT_ORDER_ABORT_REASON, 'NONCE_OR_ORDER_MISMATCH'],
    [DA5_V5_INPUT_EOF_ABORT_REASON, 'IPC_EOF'],
    [DA5_V5_OS_SIGNAL_ABORT_REASON, 'SIGNAL'],
    ['unknown-abort-reason', 'SIGNAL'],
  ] as const)('maps an already-aborted %s signal before spawn to %s',
    async (reason, expected) => {
      const abortController = new AbortController();
      abortController.abort(reason);
      const spawnChild = vi.fn(() => {
        throw new Error('spawn must remain unreachable');
      }) as unknown as typeof spawn;
      const credential = Buffer.from('a'.repeat(64), 'ascii');
      const controller = controllerFixture(credential, abortController.signal, spawnChild);
      const result = await controller.run();
      expect(spawnChild).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        attempted_outcome: 'FAIL_CLOSED',
        failure_reason: expected,
        fast_lane: 'STOP',
      });
      expect(credential.every((byte) => byte === 0)).toBe(true);
    });

  it.each([
    ['synchronous write throw', 'write-throw'],
    ['write callback error', 'write-error'],
    ['synchronous end throw', 'end-throw'],
    ['end callback error', 'end-error'],
    ['pipe error with a late write callback', 'pipe-error-late'],
    ['pipe close', 'pipe-close'],
    ['child error', 'child-error'],
    ['child close', 'child-close'],
  ] as const)('closes FD3 exactly once on %s', async (_name, mode) => {
    const run = await transferFailureRun(mode);
    expect(run.result.failure_reason).toBe('CHILD_NONZERO_OR_EARLY_EXIT');
    expect(run.pipe.writeCalls).toBe(1);
    expect(run.pipe.observedBytes).toBe(64);
    expect(run.pipe.observedLowercaseHex).toBe(true);
    expect(run.pipe.destroyed).toBe(true);
    expect(run.credential.every((byte) => byte === 0)).toBe(true);
    expect(run.attest).toHaveBeenCalledTimes(1);
    expect(run.seal).toHaveBeenCalledTimes(1);
    expect(run.pipe.listenerCount('error')).toBe(0);
    expect(run.pipe.listenerCount('close')).toBe(0);
    if (mode === 'write-error' || mode === 'end-error') {
      expect(run.pipe.errorEvents).toBe(1);
      expect(run.pipe.closeEvents).toBe(1);
      expect(run.child.kill).toHaveBeenCalledWith('SIGTERM');
    }
  });

  it('fails closed when successful end is followed by a late FD3 error before close',
    async () => {
      vi.useFakeTimers();
      try {
        const operation = transferFailureRun('end-success-late-error');
        await vi.runAllTimersAsync();
        const run = await operation;
        expect(run.result.failure_reason).toBe('CHILD_NONZERO_OR_EARLY_EXIT');
        expect(run.pipe.history).toEqual([
          'write',
          'write-success',
          'end',
          'end-success',
          'error',
          'close',
        ]);
        expect(run.pipe.endCalls).toBe(1);
        expect(run.pipe.errorEvents).toBe(1);
        expect(run.pipe.closeEvents).toBe(1);
        expect(run.pipe.destroyed).toBe(true);
        expect(run.child.kill).toHaveBeenCalledWith('SIGTERM');
        expect(run.credential.every((byte) => byte === 0)).toBe(true);
        expect(run.attest).toHaveBeenCalledTimes(1);
        expect(run.seal).toHaveBeenCalledTimes(1);
        expect(run.pipe.listenerCount('error')).toBe(0);
        expect(run.pipe.listenerCount('close')).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

  it('advances past a normal FD3 transfer only after one successful end-to-close lifecycle',
    async () => {
      const run = await transferFailureRun('end-success-close');
      expect(run.result.failure_reason).toBe('CHILD_NONZERO_OR_EARLY_EXIT');
      expect(run.pipe.history).toEqual([
        'write',
        'write-success',
        'end',
        'end-success',
        'close',
      ]);
      expect(run.pipe.endCalls).toBe(1);
      expect(run.pipe.errorEvents).toBe(0);
      expect(run.pipe.closeEvents).toBe(1);
      expect(run.credential.every((byte) => byte === 0)).toBe(true);
      expect(run.attest).toHaveBeenCalledTimes(1);
      expect(run.seal).toHaveBeenCalledTimes(1);
      expect(run.pipe.listenerCount('error')).toBe(0);
      expect(run.pipe.listenerCount('close')).toBe(0);
    });

  it.each([
    [DA5_V5_OS_SIGNAL_ABORT_REASON, 'SIGNAL'],
    [DA5_V5_INPUT_ORDER_ABORT_REASON, 'NONCE_OR_ORDER_MISMATCH'],
    [DA5_V5_INPUT_EOF_ABORT_REASON, 'IPC_EOF'],
    ['unknown-abort-reason', 'SIGNAL'],
  ] as const)('maps a stalled FD3 %s abort to %s and ignores late callbacks',
    async (reason, expected) => {
    const run = await transferFailureRun('signal', reason);
    expect(run.result.failure_reason).toBe(expected);
    expect(run.pipe.writeCalls).toBe(1);
    expect(run.pipe.destroyed).toBe(true);
    expect(run.credential.every((byte) => byte === 0)).toBe(true);
    expect(run.attest).toHaveBeenCalledTimes(1);
    expect(run.seal).toHaveBeenCalledTimes(1);
    expect(run.pipe.listenerCount('error')).toBe(0);
    expect(run.pipe.listenerCount('close')).toBe(0);
  });

  it('bounds a stalled FD3 transfer with the machine-step timeout', async () => {
    vi.useFakeTimers();
    try {
      const operation = transferFailureRun('timeout');
      await vi.advanceTimersByTimeAsync(30_001);
      await vi.runAllTimersAsync();
      const run = await operation;
      expect(run.result.failure_reason).toBe('MACHINE_STEP_TIMEOUT_OR_HANG');
      expect(run.pipe.writeCalls).toBe(1);
      expect(run.pipe.destroyed).toBe(true);
      expect(run.credential.every((byte) => byte === 0)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retains the primary failure when cleanup attestation also fails', async () => {
    const abortController = new AbortController();
    abortController.abort(DA5_V5_INPUT_ORDER_ABORT_REASON);
    const credential = Buffer.from('a'.repeat(64), 'ascii');
    const spawnChild = vi.fn(() => {
      throw new Error('spawn must remain unreachable');
    }) as unknown as typeof spawn;
    const seal = vi.fn(async () => '/private/tmp/da5-v5-evidence/flight-sealed');
    const controller = new Da5V5FlightController(
      controllerOptions(credential, abortController.signal),
      {
        attest: vi.fn(async () => {
          throw new Error('injected attestation failure');
        }),
        seal,
        spawnChild,
      },
    );

    const result = await controller.run();

    expect(spawnChild).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      attempted_outcome: 'FAIL_CLOSED',
      cleanup: 'MISMATCH',
      failure_reason: 'NONCE_OR_ORDER_MISMATCH',
      fast_lane: 'STOP',
      receipt_root: '/private/tmp/da5-v5-evidence/flight-sealed',
    });
    expect(seal).toHaveBeenCalledWith(expect.objectContaining({
      receipt: expect.objectContaining({
        cleanup: 'MISMATCH',
        failure_reason: 'NONCE_OR_ORDER_MISMATCH',
      }),
    }));
    expect(credential.every((byte) => byte === 0)).toBe(true);
  });

  it('uses the generic cleanup reason when cleanup fails without a primary failure', async () => {
    const credential = Buffer.from('a'.repeat(64), 'ascii');
    let spawnedChild: ChildProcess | null = null;
    const spawnChild = vi.fn(() => {
      const child = spawn(
        process.execPath,
        ['--input-type=module', '--eval', cleanAbortChildSource('failed')],
        {
          detached: true,
          env: { PATH: process.env.PATH },
          stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
        },
      );
      spawnedChild = child;
      return child;
    }) as unknown as typeof spawn;
    const seal = vi.fn(async () => '/private/tmp/da5-v5-evidence/flight-sealed');
    const controller = new Da5V5FlightController(controllerOptions(credential, undefined), {
      attest: async () => receiptFixture().scoped_cleanup,
      createNonce: () => '2'.repeat(64),
      seal,
      spawnChild,
    });

    const result = await controller.run();

    expect(result).toMatchObject({
      attempted_outcome: 'ABORT',
      cleanup: 'MISMATCH',
      failure_reason: 'CLEANUP_OR_CHECKER_FAILURE',
      fast_lane: 'STOP',
      receipt_root: '/private/tmp/da5-v5-evidence/flight-sealed',
    });
    expect(seal).toHaveBeenCalledWith(expect.objectContaining({
      receipt: expect.objectContaining({
        cleanup: 'MISMATCH',
        failure_reason: 'CLEANUP_OR_CHECKER_FAILURE',
      }),
    }));
    expect(credential.every((byte) => byte === 0)).toBe(true);
    expect((spawnedChild as ChildProcess | null)?.exitCode).toBe(1);
  }, 10_000);

  it('terminates and attests after an input-order violation during a machine wait', async () => {
    const abortController = new AbortController();
    const credential = Buffer.from('a'.repeat(64), 'ascii');
    const attest = vi.fn(async () => receiptFixture().scoped_cleanup);
    const seal = vi.fn(async () => '/private/tmp/da5-v5-evidence/flight-sealed');
    let spawnedChild: ChildProcess | null = null;
    const spawnChild = vi.fn(() => {
      const child = spawn(
        process.execPath,
        ['--input-type=module', '--eval', inFlightAbortChildSource()],
        {
          detached: true,
          env: { PATH: process.env.PATH },
          stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
        },
      );
      spawnedChild = child;
      const input = child.stdin;
      if (input === null) throw new Error('test child stdin unavailable');
      const originalWrite = input.write.bind(input);
      input.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
        const written = Reflect.apply(originalWrite, input, [chunk, ...args]) as boolean;
        if (String(chunk).startsWith('flight-step ')) {
          setImmediate(() => abortController.abort(DA5_V5_INPUT_ORDER_ABORT_REASON));
        }
        return written;
      }) as typeof input.write;
      return child;
    }) as unknown as typeof spawn;
    const controller = new Da5V5FlightController(
      controllerOptions(credential, abortController.signal),
      {
        attest,
        createNonce: () => '2'.repeat(64),
        seal,
        spawnChild,
      },
    );

    const result = await controller.run();

    expect(result).toMatchObject({
      attempted_outcome: 'FAIL_CLOSED',
      cleanup: 'MATCH',
      failure_reason: 'NONCE_OR_ORDER_MISMATCH',
      fast_lane: 'STOP',
      receipt_root: '/private/tmp/da5-v5-evidence/flight-sealed',
    });
    expect(spawnChild).toHaveBeenCalledTimes(1);
    expect(attest).toHaveBeenCalledTimes(1);
    expect(seal).toHaveBeenCalledTimes(1);
    expect(credential.every((byte) => byte === 0)).toBe(true);
    expect((spawnedChild as ChildProcess | null)?.exitCode).toBe(1);
  }, 10_000);

  it('requires one prevalidated run nonce and one combined Human input port', () => {
    const credential = Buffer.from('a'.repeat(64), 'ascii');
    const base = controllerOptions(credential, undefined);
    expect(() => new Da5V5FlightController({
      ...base,
      runNonce: 'x'.repeat(64),
    })).toThrow(/binding mismatch/u);
    expect(() => new Da5V5FlightController({
      ...base,
      humanInput: null as unknown as typeof base.humanInput,
    })).toThrow(/binding mismatch/u);
    credential.fill(0);
  });

  it('permits only a clean pre-Product abort and closes every disqualifier', () => {
    const base = {
      accessibilityRestoration: 'NOT_REQUIRED' as const,
      attemptedOutcome: 'ABORT' as const,
      bindingInputsUnchanged: true,
      cleanup: 'MATCH' as const,
      failureReason: null,
      humanAssertionFailed: false,
      productMutationStarted: false,
      productSnapshot: productMatch,
      taskOwnedDisposableOnly: true,
    };
    expect(classifyDa5V5FastLane(base)).toEqual({ disqualifiers: [], status: 'MATCH' });
    expect(classifyDa5V5FastLane({ ...base, attemptedOutcome: 'PASS' })).toMatchObject({
      status: 'STOP',
      disqualifiers: ['product_pass_ends_campaign'],
    });
    expect(classifyDa5V5FastLane({ ...base, attemptedOutcome: 'FAIL_CLOSED' }))
      .toMatchObject({ status: 'STOP', disqualifiers: ['fail_closed_attempt'] });
    const postMutationUnobserved = classifyDa5V5FastLane({
      ...base,
      productMutationStarted: true,
      productSnapshot: {
        ...productMatch,
        queue: { equality: 'unproved', observation: 'unobserved' },
      },
    });
    expect(postMutationUnobserved.status).toBe('STOP');
    expect(postMutationUnobserved.disqualifiers).toContain('product_equality_queue');
  });

  it('seals one disclosure-safe receipt atomically outside the repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'da5-v5-flight-test-'));
    temporaryRoots.push(root);
    const receipt = receiptFixture();

    const sealed = await sealDa5V5FlightReceipt({
      evidenceParentPath: join(root, 'evidence'),
      receipt,
      repositoryRootPath: process.cwd(),
    });
    sealedRoots.push(sealed);

    expect((await stat(sealed)).mode & 0o777).toBe(0o555);
    expect((await stat(join(sealed, 'receipt.draft.json'))).mode & 0o777).toBe(0o444);
    expect((await stat(join(sealed, 'evidence-manifest.json'))).mode & 0o777).toBe(0o444);
    const receiptBytes = await readFile(join(sealed, 'receipt.draft.json'));
    const manifest = JSON.parse(await readFile(
      join(sealed, 'evidence-manifest.json'),
      'utf8',
    )) as { readonly files: readonly [{ readonly sha256: string }] };
    expect(manifest.files[0].sha256).toBe(
      createHash('sha256').update(receiptBytes).digest('hex'),
    );
    expect(JSON.parse(receiptBytes.toString('utf8'))).toMatchObject({
      authority: 'NON_AUTHORITATIVE_STAGED_CLAIMS',
      classification_candidate_eligible: true,
    });
    const commitment = JSON.parse(await readFile(
      join(sealed, 'seal-commitment.json'),
      'utf8',
    )) as { readonly fast_lane: string; readonly receipt_seal: string };
    expect(commitment).toMatchObject({ fast_lane: 'MATCH', receipt_seal: 'MATCH' });
    expect(JSON.stringify(receipt)).not.toContain('receipt_sha256');
  });

  it('rejects open or contradictory receipt claims before creating a draft', async () => {
    const root = await mkdtemp(join(tmpdir(), 'da5-v5-flight-test-'));
    temporaryRoots.push(root);
    const receipt = receiptFixture();
    const openSchema = { ...receipt, extra: 'not-closed' } as Da5V5FlightReceipt;
    await expect(sealDa5V5FlightReceipt({
      evidenceParentPath: join(root, 'evidence-open'),
      receipt: openSchema,
      repositoryRootPath: process.cwd(),
    })).rejects.toThrow(/schema mismatch/u);
    const contradictory = {
      ...receipt,
      attempted_outcome: 'PASS',
    } as Da5V5FlightReceipt;
    await expect(sealDa5V5FlightReceipt({
      evidenceParentPath: join(root, 'evidence-contradictory'),
      receipt: contradictory,
      repositoryRootPath: process.cwd(),
    })).rejects.toThrow(/claim mismatch/u);
  });

  it('proves absence after post-rename validation and parent-fsync faults', async () => {
    for (const fault of ['validation', 'fsync'] as const) {
      const root = await mkdtemp(join(tmpdir(), `da5-v5-flight-${fault}-`));
      temporaryRoots.push(root);
      const evidence = join(root, 'evidence');
      let parentSyncFailed = false;
      let validationFailed = false;
      const seal = sealDa5V5FlightReceipt({
        evidenceParentPath: evidence,
        receipt: receiptFixture(),
        repositoryRootPath: process.cwd(),
      }, fault === 'validation' ? {
        stat: async (path) => {
          if (String(path).includes('/flight-') && !validationFailed) {
            validationFailed = true;
            throw new Error('injected validation failure');
          }
          return stat(path);
        },
      } : {
        syncDirectory: async (path) => {
          if (path.endsWith('/evidence') && !parentSyncFailed) {
            parentSyncFailed = true;
            throw new Error('injected parent fsync failure');
          }
          await syncTestDirectory(path);
        },
      });
      const error = await seal.catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(Da5V5ReceiptSealError);
      expect(error).toMatchObject({ absenceProven: true, invalidRoot: null });
      expect((await readdir(evidence)).filter((name) => name.startsWith('flight-'))).toEqual([]);
    }
  });

  it('retains an explicit non-authoritative invalid marker when removal fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'da5-v5-flight-remove-fault-'));
    temporaryRoots.push(root);
    const evidence = join(root, 'evidence');
    let validationFailed = false;
    const error = await sealDa5V5FlightReceipt({
      evidenceParentPath: evidence,
      receipt: receiptFixture(),
      repositoryRootPath: process.cwd(),
    }, {
      stat: async (path) => {
        if (String(path).includes('/flight-') && !validationFailed) {
          validationFailed = true;
          throw new Error('injected validation failure');
        }
        return stat(path);
      },
      rm: async () => { throw new Error('injected removal failure'); },
    }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Da5V5ReceiptSealError);
    expect(error).toMatchObject({ absenceProven: false });
    const invalidRoot = (error as Da5V5ReceiptSealError).invalidRoot;
    expect(invalidRoot).toMatch(/\.invalid-[0-9a-f]{16}$/u);
    if (invalidRoot === null) throw new Error('expected invalid root');
    sealedRoots.push(invalidRoot);
    expect(JSON.parse(await readFile(join(invalidRoot, 'INVALID_SEAL.json'), 'utf8')))
      .toMatchObject({
        authority: 'NON_AUTHORITATIVE_INVALID_SEAL',
        receipt_seal: 'MISMATCH',
      });
  });

  it('keeps an invalid marker separate from sealed receipt authority', async () => {
    const invalidRoot = '/private/tmp/da5-v5-evidence/flight.invalid-0123456789abcdef';
    const result = await sealFailureRunResult(invalidRoot);

    expect(result).toMatchObject({
      attempted_outcome: 'FAIL_CLOSED',
      cleanup: 'MATCH',
      failure_reason: 'RECEIPT_SEAL_FAILURE',
      fast_lane: 'STOP',
      invalid_receipt_root: invalidRoot,
      receipt_root: null,
    });
  });

  it('publishes seal failure without exposing or treating the invalid marker as sealed', async () => {
    const invalidRoot = '/private/tmp/da5-v5-evidence/flight.invalid-fedcba9876543210';
    const terminal = da5V5FlightTerminalResult(await sealFailureRunResult(invalidRoot));

    expect(terminal).toMatchObject({
      cleanup: 'MATCH',
      failure_reason: 'RECEIPT_SEAL_FAILURE',
      fast_lane: 'STOP',
      invalid_receipt_root: {
        present: true,
        sha256: createHash('sha256').update(invalidRoot).digest('hex'),
      },
      receipt_sealed: false,
    });
    expect(JSON.stringify(terminal)).not.toContain(invalidRoot);
  });
});

function boundValidator(): Da5V5FlightProtocolValidator {
  const validator = new Da5V5FlightProtocolValidator();
  for (const line of da5V5FlightProtocolStartupLines()) validator.observe(line);
  validator.beginBinding('1'.repeat(64), DA5_V5_FAST_FLIGHT_PLAN_SHA256);
  validator.observe(`da5_v5_flight_bound=${JSON.stringify({
    plan_digest: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
    protocol_version: DA5_V5_FLIGHT_PROTOCOL_VERSION,
    run_nonce: '1'.repeat(64),
  })}`);
  return validator;
}

function outputFrame(sequence: number, payload: string): string {
  return `da5_v5_flight_output=${JSON.stringify({
    order: 0,
    payload: Buffer.from(payload, 'utf8').toString('base64url'),
    protocol_version: DA5_V5_FLIGHT_PROTOCOL_VERSION,
    run_nonce: '1'.repeat(64),
    sequence,
    step_nonce: '2'.repeat(64),
  })}`;
}

function inFlightAbortChildSource(): string {
  return `
    import { createInterface } from 'node:readline';
    import { createReadStream } from 'node:fs';

    const credential = createReadStream('', { autoClose: true, fd: 3 });
    let credentialBytes = 0;
    let credentialValid = true;
    credential.on('data', (chunk) => {
      credentialBytes += chunk.length;
      credentialValid = credentialValid && chunk.every((byte) => (
        (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
      ));
      chunk.fill(0);
    });
    credential.on('error', () => process.exit(20));
    credential.on('end', () => {
      if (credentialBytes !== 64 || !credentialValid) process.exit(19);
      process.stdout.write(${JSON.stringify(`${da5V5FlightProtocolStartupLines().join('\n')}\n`)});
    });
    const lines = createInterface({ input: process.stdin, terminal: false });
    let step = null;
    lines.on('line', (line) => {
      if (line.startsWith('flight-bind ')) {
        const [, runNonce, planDigest] = line.split(' ');
        process.stdout.write('da5_v5_flight_bound=' + JSON.stringify({
          plan_digest: planDigest,
          protocol_version: ${DA5_V5_FLIGHT_PROTOCOL_VERSION},
          run_nonce: runNonce,
        }) + '\\n');
        return;
      }
      if (line.startsWith('flight-step ')) {
        const [, runNonce, stepNonce, order] = line.split(' ');
        step = { order: Number(order), runNonce, stepNonce };
      }
    });
    const output = (payload, sequence) => {
      process.stdout.write('da5_v5_flight_output=' + JSON.stringify({
        order: step.order,
        payload: Buffer.from(payload, 'utf8').toString('base64url'),
        protocol_version: ${DA5_V5_FLIGHT_PROTOCOL_VERSION},
        run_nonce: step.runNonce,
        sequence,
        step_nonce: step.stepNonce,
      }) + '\\n');
    };
    process.on('SIGTERM', () => {
      const finish = () => {
        if (step === null) {
          setTimeout(finish, 1);
          return;
        }
        output('da5_v5_device_preflight=match', 0);
        process.stdout.write('da5_v5_flight_step=' + JSON.stringify({
          order: step.order,
          output_count: 1,
          protocol_version: ${DA5_V5_FLIGHT_PROTOCOL_VERSION},
          result: 'abort',
          run_nonce: step.runNonce,
          step_nonce: step.stepNonce,
        }) + '\\n');
        output('da5_v5_precleanup_snapshot_failed', 1);
        output('da5_v5_cleanup_complete', 2);
        output('da5_v5_aborted', 3);
        setTimeout(() => process.exit(1), 5);
      };
      finish();
    });
  `;
}

function cleanAbortChildSource(cleanup: 'complete' | 'failed'): string {
  const cleanupPayload = cleanup === 'complete'
    ? 'da5_v5_cleanup_complete'
    : 'da5_v5_cleanup_failed';
  return `
    import { createInterface } from 'node:readline';
    import { createReadStream } from 'node:fs';

    const credential = createReadStream('', { autoClose: true, fd: 3 });
    let credentialBytes = 0;
    let credentialValid = true;
    credential.on('data', (chunk) => {
      credentialBytes += chunk.length;
      credentialValid = credentialValid && chunk.every((byte) => (
        (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
      ));
      chunk.fill(0);
    });
    credential.on('error', () => process.exit(20));
    credential.on('end', () => {
      if (credentialBytes !== 64 || !credentialValid) process.exit(19);
      process.stdout.write(${JSON.stringify(`${da5V5FlightProtocolStartupLines().join('\n')}\n`)});
    });
    const lines = createInterface({ input: process.stdin, terminal: false });
    let step = null;
    const output = (payload, sequence) => {
      process.stdout.write('da5_v5_flight_output=' + JSON.stringify({
        order: step.order,
        payload: Buffer.from(payload, 'utf8').toString('base64url'),
        protocol_version: ${DA5_V5_FLIGHT_PROTOCOL_VERSION},
        run_nonce: step.runNonce,
        sequence,
        step_nonce: step.stepNonce,
      }) + '\\n');
    };
    const result = (outcome, outputCount) => {
      process.stdout.write('da5_v5_flight_step=' + JSON.stringify({
        order: step.order,
        output_count: outputCount,
        protocol_version: ${DA5_V5_FLIGHT_PROTOCOL_VERSION},
        result: outcome,
        run_nonce: step.runNonce,
        step_nonce: step.stepNonce,
      }) + '\\n');
    };
    lines.on('line', (line) => {
      if (line.startsWith('flight-bind ')) {
        const [, runNonce, planDigest] = line.split(' ');
        process.stdout.write('da5_v5_flight_bound=' + JSON.stringify({
          plan_digest: planDigest,
          protocol_version: ${DA5_V5_FLIGHT_PROTOCOL_VERSION},
          run_nonce: runNonce,
        }) + '\\n');
        return;
      }
      if (!line.startsWith('flight-step ')) return;
      const [, runNonce, stepNonce, order, frame] = line.split(' ');
      const command = Buffer.from(frame, 'base64url').toString('utf8');
      step = { order: Number(order), runNonce, stepNonce };
      if (command === 'device-preflight') {
        output('da5_v5_device_preflight=match', 0);
        result('continue', 1);
        return;
      }
      if (command === 'abort') {
        result('abort', 0);
        output('da5_v5_precleanup_snapshot_failed', 0);
        output(${JSON.stringify(cleanupPayload)}, 1);
        output('da5_v5_aborted', 2);
        setTimeout(() => process.exit(1), 5);
        return;
      }
      process.exit(21);
    });
  `;
}

async function sealFailureRunResult(invalidRoot: string) {
  const credential = Buffer.from('a'.repeat(64), 'ascii');
  const controller = new Da5V5FlightController({
    bindingInputsVerified: true,
    bindingSetId: 'a'.repeat(64),
    childEntrypointPath: '/private/tmp/da5V5Main.js',
    childEnvironment: Object.freeze({}),
    credential,
    evidenceParentPath: '/private/tmp/da5-v5-evidence',
    humanInput: Object.freeze({
      request: async () => 'ABORT',
    }),
    repositoryRootPath: process.cwd(),
    runNonce: '1'.repeat(64),
    runtimeGuardBinaryPath: '/private/tmp/da5-v5-runtime-guard',
    standardProfile: Object.freeze({
      androidApi: '35',
      androidBuild: 'AP3A.241105.007',
      androidRelease: '15',
      deviceModel: 'Pixel 8',
      fontScale: '1.0',
    }),
  }, {
    attest: async () => receiptFixture().scoped_cleanup,
    createNonce: () => '1'.repeat(64),
    seal: async () => { throw new Da5V5ReceiptSealError(false, invalidRoot); },
    spawnChild: vi.fn(() => {
      throw new Error('injected spawn failure');
    }) as unknown as typeof spawn,
  });

  const result = await controller.run();
  expect(credential.every((byte) => byte === 0)).toBe(true);
  return result;
}

type TransferFailureMode =
  | 'child-error'
  | 'child-close'
  | 'end-error'
  | 'end-success-close'
  | 'end-success-late-error'
  | 'end-throw'
  | 'pipe-close'
  | 'pipe-error-late'
  | 'signal'
  | 'timeout'
  | 'write-error'
  | 'write-throw';

class FakeCredentialPipe extends EventEmitter {
  closed = false;
  closeEvents = 0;
  closeScheduled = false;
  destroyed = false;
  endCalls = 0;
  errorEvents = 0;
  observedBytes = 0;
  observedLowercaseHex = false;
  readonly history: string[] = [];
  writableEnded = false;
  writeCalls = 0;

  constructor(
    private readonly mode: TransferFailureMode,
    private readonly abort: () => void,
    private readonly closeChild: (error?: Error) => void,
  ) {
    super();
  }

  write(value: Buffer, callback: (error?: Error | null) => void): boolean {
    this.history.push('write');
    this.writeCalls += 1;
    this.observedBytes = value.byteLength;
    this.observedLowercaseHex = value.every((byte) => (
      (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
    ));
    if (this.mode === 'write-throw') throw new Error('private write throw');
    if (this.mode === 'write-error') {
      setImmediate(() => {
        this.history.push('write-error');
        callback(new Error('private write callback error'));
        this.emitPairedFailure('write');
      });
    } else if (this.mode === 'pipe-error-late') {
      setImmediate(() => {
        this.emit('error', new Error('private pipe error'));
        callback(null);
      });
    } else if (this.mode === 'pipe-close') {
      this.scheduleClose();
    } else if (this.mode === 'child-close') {
      setImmediate(() => {
        this.closeChild();
        this.emitClose();
      });
    } else if (this.mode === 'child-error') {
      setImmediate(() => this.emitChildError());
    } else if (this.mode === 'signal') {
      setImmediate(() => {
        this.abort();
        this.history.push('write-success');
        callback(null);
      });
    } else if (this.mode !== 'timeout') {
      setImmediate(() => {
        this.history.push('write-success');
        callback(null);
      });
    }
    return true;
  }

  end(callback: (error?: Error | null) => void): void {
    this.history.push('end');
    this.endCalls += 1;
    this.writableEnded = true;
    if (this.mode === 'end-throw') throw new Error('private end throw');
    setImmediate(() => {
      if (this.mode === 'end-error') {
        this.history.push('end-error');
        callback(new Error('private end callback error'));
        this.emitPairedFailure('end');
        return;
      }
      this.history.push('end-success');
      callback(null);
      if (this.mode === 'end-success-late-error') {
        this.emitPairedFailure('end-success');
      } else if (this.mode === 'end-success-close') {
        this.scheduleClose(() => this.emitChildError());
      }
    });
  }

  destroy(): this {
    this.destroyed = true;
    if (![
      'child-close',
      'end-error',
      'end-success-late-error',
      'write-error',
    ].includes(this.mode)) {
      this.scheduleClose();
    }
    return this;
  }

  private emitChildError(): void {
    this.closeChild(new Error('private child error'));
  }

  private emitPairedFailure(stage: 'end' | 'end-success' | 'write'): void {
    setImmediate(() => {
      this.history.push('error');
      this.errorEvents += 1;
      this.emit('error', new Error(`private ${stage} stream error`));
      this.emitClose();
    });
  }

  private emitClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.destroyed = true;
    this.history.push('close');
    this.closeEvents += 1;
    this.emit('close');
  }

  private scheduleClose(afterClose?: () => void): void {
    if (this.closed || this.closeScheduled) return;
    this.closeScheduled = true;
    setImmediate(() => {
      this.closeScheduled = false;
      if (this.closed) return;
      this.emitClose();
      if (afterClose !== undefined) setImmediate(afterClose);
    });
  }
}

async function transferFailureRun(
  mode: TransferFailureMode,
  abortReason: unknown = DA5_V5_OS_SIGNAL_ABORT_REASON,
) {
  const credential = Buffer.from('0123456789abcdef'.repeat(4), 'ascii');
  const abortController = new AbortController();
  const child = new EventEmitter() as ChildProcess;
  let childClosed = false;
  const closeChild = (error?: Error): void => {
    if (error !== undefined) {
      child.emit('error', error);
      return;
    }
    if (childClosed) return;
    childClosed = true;
    child.emit('close', 1, null);
  };
  const pipe = new FakeCredentialPipe(
    mode,
    () => abortController.abort(abortReason),
    (error?: Error) => closeChild(error),
  );
  const stdin = Object.assign(new EventEmitter(), {
    destroyed: false,
    write: vi.fn(() => true),
  });
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  Object.assign(child, {
    exitCode: null,
    kill: vi.fn(() => {
      setImmediate(closeChild);
      return true;
    }),
    pid: 2_147_483_647,
    signalCode: null,
    stderr,
    stdin,
    stdio: [stdin, stdout, stderr, pipe],
    stdout,
  });
  const attest = vi.fn(async () => receiptFixture().scoped_cleanup);
  const seal = vi.fn(async () => '/private/tmp/da5-v5-evidence/flight-sealed');
  const controller = new Da5V5FlightController(
    controllerOptions(credential, abortController.signal),
    {
      attest,
      createNonce: () => '2'.repeat(64),
      seal,
      spawnChild: vi.fn(() => child) as unknown as typeof spawn,
    },
  );
  const result = await controller.run();
  return { attest, child, credential, pipe, result, seal };
}

function controllerFixture(
  credential: Buffer,
  signal: AbortSignal | undefined,
  spawnChild: typeof spawn,
): Da5V5FlightController {
  return new Da5V5FlightController(controllerOptions(credential, signal), {
    attest: async () => receiptFixture().scoped_cleanup,
    createNonce: () => '2'.repeat(64),
    seal: async () => '/private/tmp/da5-v5-evidence/flight-sealed',
    spawnChild,
  });
}

function controllerOptions(credential: Buffer, signal: AbortSignal | undefined) {
  return {
    bindingInputsVerified: true as const,
    bindingSetId: 'a'.repeat(64),
    childEntrypointPath: '/private/tmp/da5V5Main.js',
    childEnvironment: Object.freeze({}),
    credential,
    evidenceParentPath: '/private/tmp/da5-v5-evidence',
    humanInput: Object.freeze({ request: async () => 'ABORT' }),
    repositoryRootPath: process.cwd(),
    runNonce: '1'.repeat(64),
    runtimeGuardBinaryPath: '/private/tmp/da5-v5-runtime-guard',
    signal,
    standardProfile: Object.freeze({
      androidApi: '35',
      androidBuild: 'AP3A.241105.007',
      androidRelease: '15',
      deviceModel: 'Pixel 8',
      fontScale: '1.0',
    }),
  };
}

async function syncTestDirectory(path: string): Promise<void> {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

function receiptFixture(): Da5V5FlightReceipt {
  const attestation = Object.freeze({
    android: 'match' as const,
    bound_postgres_processes: 'match' as const,
    checked_ports: Object.freeze([3000, 54321, 55435] as const),
    operator_processes: 'match' as const,
    owned_listeners: 'match' as const,
    product_equality: productMatch,
    schema_version: 1 as const,
    status: 'match' as const,
    task_roots: 'match' as const,
  });
  return Object.freeze({
    accessibility_restoration: 'NOT_REQUIRED',
    attempted_outcome: 'ABORT',
    authority_after: 'CONSUMED',
    authority_before: 'FRESH_SEPARATE_HUMAN_AUTHORIZATION',
    binding_set_id: 'a'.repeat(64),
    classification_candidate: 'ELIGIBLE',
    cleanup: 'MATCH',
    failure_reason: null,
    fast_lane_disqualifiers: Object.freeze([]),
    plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
    product_equality: productMatch,
    receipt_id: 'b'.repeat(32),
    run_category: 'pre_product_non_product',
    run_id: 'c'.repeat(32),
    schema_version: 1,
    scoped_cleanup: attestation,
  });
}
