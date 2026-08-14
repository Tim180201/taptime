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

async function sealFailureRunResult(invalidRoot: string) {
  const credential = Buffer.from('a'.repeat(64), 'ascii');
  const controller = new Da5V5FlightController({
    bindingInputsVerified: true,
    bindingSetId: 'a'.repeat(64),
    childEntrypointPath: '/private/tmp/da5V5Main.js',
    childEnvironment: Object.freeze({}),
    credential,
    evidenceParentPath: '/private/tmp/da5-v5-evidence',
    repositoryRootPath: process.cwd(),
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
