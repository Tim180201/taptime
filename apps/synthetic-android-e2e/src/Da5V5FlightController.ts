import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import {
  DA5_V5_ACCESSIBILITY_SURFACE_PLAN,
  DA5_V5_CHECKPOINT_PLAN,
  type Da5V5Checkpoint,
} from './Da5V5OperationSession.js';
import { DA5_V5_PUBLIC_MANIFEST } from './Da5V5Profile.js';
import {
  attestDa5V5CleanState,
  requireDa5V5ProductSnapshotClaim,
  type Da5V5CleanStateAttestation,
  type Da5V5CleanStateAttestationOptions,
} from './Da5V5CleanStateAttestation.js';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_AUTH_EMAIL,
  SYNTHETIC_ENROLLMENT_AUTH_EMAIL,
} from './constants.js';

export const DA5_V5_FLIGHT_FAILURE_REASONS = Object.freeze([
  'SIGNAL',
  'IPC_EOF',
  'UNEXPECTED_OUTPUT',
  'NONCE_OR_ORDER_MISMATCH',
  'CHILD_NONZERO_OR_EARLY_EXIT',
  'MACHINE_STEP_TIMEOUT_OR_HANG',
  'CLEANUP_OR_CHECKER_FAILURE',
  'RECEIPT_SEAL_FAILURE',
] as const);

export type Da5V5FlightFailureReason =
  (typeof DA5_V5_FLIGHT_FAILURE_REASONS)[number];
export const DA5_V5_INPUT_ORDER_ABORT_REASON = 'DA5_V5_INPUT_ORDER_VIOLATION' as const;
export const DA5_V5_INPUT_EOF_ABORT_REASON = 'DA5_V5_INPUT_EOF' as const;
export const DA5_V5_OS_SIGNAL_ABORT_REASON = 'DA5_V5_OS_SIGNAL' as const;
export type Da5V5HumanVerdict = 'PASS' | 'FAIL' | 'AMBIGUOUS';
export type Da5V5AttemptedOutcome =
  | 'PASS'
  | 'FAIL'
  | 'AMBIGUOUS'
  | 'ABORT'
  | 'FAIL_CLOSED';

export interface Da5V5HumanPrompt {
  readonly action: string;
  readonly allowed_response: readonly string[];
  readonly button: string;
  readonly do_not: string;
  readonly field: string;
  readonly screen: string;
}

export interface Da5V5HumanInput {
  request(prompt: Da5V5HumanPrompt, signal?: AbortSignal): Promise<string>;
}

interface Da5V5MachineStep {
  readonly command: string;
  readonly id: string;
  readonly kind: 'machine';
  readonly mutation: 'none' | 'task-owned-disposable';
  readonly timeout_milliseconds: number;
}

interface Da5V5HumanStep {
  readonly command_template?: string;
  readonly id: string;
  readonly kind: 'human';
  readonly mutation: 'none' | 'task-owned-disposable';
  readonly prompt: Da5V5HumanPrompt;
  readonly response: 'queue-count' | 'verdict';
}

interface Da5V5DelayStep {
  readonly id: string;
  readonly kind: 'delay';
  readonly milliseconds: number;
  readonly mutation: 'none';
}

export type Da5V5FlightPlanStep =
  | Da5V5DelayStep
  | Da5V5HumanStep
  | Da5V5MachineStep;

export interface Da5V5FlightPlan {
  readonly plan_id: 'da5-v5-fast-flight-v1';
  readonly steps: readonly Da5V5FlightPlanStep[];
  readonly version: 1;
}

const machineTimeout = 30_000;
const longMachineTimeout = 300_000;
const exactDedupeDelay = 5_250;

export const DA5_V5_FAST_FLIGHT_PLAN: Da5V5FlightPlan = deepFreeze({
  plan_id: 'da5-v5-fast-flight-v1',
  steps: buildFlightSteps(),
  version: 1,
});

export const DA5_V5_FAST_FLIGHT_PLAN_SHA256 = sha256(
  canonicalJson(DA5_V5_FAST_FLIGHT_PLAN),
);

export const DA5_V5_FLIGHT_PROTOCOL_VERSION = 2 as const;
export const DA5_V5_OPERATOR_COMMANDS = 'status | device-preflight | physical-tag-binding-confirm <PASS|FAIL|AMBIGUOUS> | android-install-confirm <PASS|FAIL|AMBIGUOUS> | employee-installation-transition-confirm <PASS|FAIL|AMBIGUOUS> | employee-ready-confirm <PASS|FAIL|AMBIGUOUS> | credential-field-ready <administrator|enrollment|employee> EMPTY_ACTIVE | credential-check <administrator|enrollment|employee> | credential-result-confirm <administrator|enrollment> <PASS|FAIL|AMBIGUOUS> | invitation-create | invitation-field-ready EMPTY_ACTIVE | invitation-check | checkpoint <name> <queue-items> | checkpoint-confirm <name> <PASS|FAIL|AMBIGUOUS> | dedupe-window-baseline <phase> | dedupe-window-check <phase> | tag-b-registration-arm | protected-review-arm <human-observed-queue-items> | protected-review-activate-tag-b | protected-review-cutover-tag-a | protected-review-terminal | offline-enter <ordinary|protected> | offline-restore <ordinary|protected> | gate-b-cold-prepare | ordinary-relaunch-prepare | accessibility-prepare | accessibility-check | accessibility-surface-confirm <surface> <PASS|FAIL|AMBIGUOUS> | accessibility-credential-field-ready <administrator|employee> EMPTY_ACTIVE | accessibility-credential-check <administrator|employee> | accessibility-cancel | standard-profile-check | cancellation-arm | cancellation-ui-confirm <PASS|FAIL|AMBIGUOUS> | cancellation-kill-background | cancellation-ready-confirm <PASS|FAIL|AMBIGUOUS> | protected-force-stop | protected-ready-confirm <PASS|FAIL|AMBIGUOUS> | abort | stop';

export function requireDa5V5FlightPlanBinding(
  line: string,
  alreadyBound = false,
): Readonly<{ readonly planDigest: string; readonly runNonce: string }> {
  const binding = /^flight-bind ([0-9a-f]{64}) ([0-9a-f]{64})$/u.exec(line);
  if (
    alreadyBound
    || binding === null
    || binding[2] !== DA5_V5_FAST_FLIGHT_PLAN_SHA256
  ) {
    throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
  }
  return Object.freeze({
    planDigest: binding[2],
    runNonce: binding[1] as string,
  });
}

export interface Da5V5FlightControllerOptions {
  readonly bindingSetId: string;
  readonly bindingInputsVerified: true;
  readonly childEntrypointPath: string;
  readonly childEnvironment: Readonly<Record<string, string>>;
  readonly credential: Buffer;
  readonly evidenceParentPath: string;
  readonly humanInput: Da5V5HumanInput;
  readonly repositoryRootPath: string;
  readonly runNonce: string;
  readonly runtimeGuardBinaryPath: string;
  readonly signal?: AbortSignal;
  readonly standardProfile: Da5V5CleanStateAttestationOptions['standardProfile'];
}

export interface Da5V5FlightControllerDependencies {
  readonly attest: typeof attestDa5V5CleanState;
  readonly createNonce: () => string;
  readonly seal: typeof sealDa5V5FlightReceipt;
  readonly spawnChild: typeof spawn;
  readonly wait: (milliseconds: number) => Promise<void>;
}

export interface Da5V5FlightRunResult {
  readonly attestation: Da5V5CleanStateAttestation;
  readonly attempted_outcome: Da5V5AttemptedOutcome;
  readonly cleanup: 'MATCH' | 'MISMATCH';
  readonly failure_reason: Da5V5FlightFailureReason | null;
  readonly fast_lane: 'MATCH' | 'STOP';
  readonly invalid_receipt_root: string | null;
  readonly plan_sha256: string;
  readonly receipt_root: string | null;
  readonly run_id: string;
}

export interface Da5V5FlightTerminalResult {
  readonly attempted_outcome: Da5V5AttemptedOutcome;
  readonly cleanup: 'MATCH' | 'MISMATCH';
  readonly failure_reason: Da5V5FlightFailureReason | null;
  readonly fast_lane: 'MATCH' | 'STOP';
  readonly invalid_receipt_root: Readonly<{
    readonly present: boolean;
    readonly sha256: string | null;
  }>;
  readonly plan_sha256: string;
  readonly receipt_sealed: boolean;
  readonly run_id: string;
}

export function da5V5FlightTerminalResult(
  result: Da5V5FlightRunResult,
): Da5V5FlightTerminalResult {
  return Object.freeze({
    attempted_outcome: result.attempted_outcome,
    cleanup: result.cleanup,
    failure_reason: result.failure_reason,
    fast_lane: result.fast_lane,
    invalid_receipt_root: Object.freeze({
      present: result.invalid_receipt_root !== null,
      sha256: result.invalid_receipt_root === null
        ? null
        : sha256(result.invalid_receipt_root),
    }),
    plan_sha256: result.plan_sha256,
    receipt_sealed: result.receipt_root !== null,
    run_id: result.run_id,
  });
}

export function da5V5FlightIdentity(
  bindingSetId: string,
  runNonce: string,
): Readonly<{ readonly receiptId: string; readonly runId: string }> {
  if (!/^[0-9a-f]{64}$/u.test(bindingSetId)) {
    throw new Error('DA5 V5 flight identity binding mismatch');
  }
  const validatedRunNonce = requireNonce(runNonce);
  return Object.freeze({
    receiptId: sha256(
      `receipt:${bindingSetId}:${validatedRunNonce}:${DA5_V5_FAST_FLIGHT_PLAN_SHA256}`,
    ).slice(0, 32),
    runId: sha256(`run:${bindingSetId}:${validatedRunNonce}`).slice(0, 32),
  });
}

export interface Da5V5FlightReceipt {
  readonly accessibility_restoration: 'MATCH' | 'MISMATCH' | 'NOT_REQUIRED';
  readonly attempted_outcome: Da5V5AttemptedOutcome;
  readonly authority_after: 'CONSUMED';
  readonly authority_before: 'FRESH_SEPARATE_HUMAN_AUTHORIZATION';
  readonly binding_set_id: string;
  readonly cleanup: 'MATCH' | 'MISMATCH';
  readonly failure_reason: Da5V5FlightFailureReason | null;
  readonly classification_candidate: 'ELIGIBLE' | 'STOP';
  readonly fast_lane_disqualifiers: readonly string[];
  readonly plan_sha256: string;
  readonly product_equality: Da5V5CleanStateAttestation['product_equality'];
  readonly receipt_id: string;
  readonly run_category: 'human_order_deviation' | 'pre_product_non_product' | 'product_result';
  readonly run_id: string;
  readonly schema_version: 1;
  readonly scoped_cleanup: Da5V5CleanStateAttestation;
}

export class Da5V5FlightController {
  private ran = false;
  private readonly dependencies: Da5V5FlightControllerDependencies;

  constructor(
    private readonly options: Da5V5FlightControllerOptions,
    dependencies: Partial<Da5V5FlightControllerDependencies> = {},
  ) {
    requireControllerOptions(options);
    this.dependencies = Object.freeze({
      attest: dependencies.attest ?? attestDa5V5CleanState,
      createNonce: dependencies.createNonce ?? (() => randomBytes(32).toString('hex')),
      seal: dependencies.seal ?? sealDa5V5FlightReceipt,
      spawnChild: dependencies.spawnChild ?? spawn,
      wait: dependencies.wait ?? (async (milliseconds) => {
        await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));
      }),
    });
  }

  async run(): Promise<Da5V5FlightRunResult> {
    if (this.ran) throw new Error('DA5 V5 flight has no resume or restart');
    this.ran = true;
    const runNonce = this.options.runNonce;
    const { runId } = da5V5FlightIdentity(this.options.bindingSetId, runNonce);
    const credential = this.options.credential;
    let attemptedOutcome: Da5V5AttemptedOutcome = 'FAIL_CLOSED';
    let failureReason: Da5V5FlightFailureReason | null = null;
    let accessibilityStarted = false;
    let productMutationStarted = false;
    let humanAssertionFailed = false;
    let childCommandFailed = false;
    let child: FlightChild | null = null;
    let spawnedChild: ChildProcess | null = null;
    let childPid: number | null = null;
    let invalidReceiptRoot: string | null = null;
    let receiptRoot: string | null = null;
    let attestation: Da5V5CleanStateAttestation | null = null;
    let childCloseProven = true;

    try {
      throwIfSignalled(this.options.signal);
      spawnedChild = this.dependencies.spawnChild(
        process.execPath,
        [this.options.childEntrypointPath],
        {
          detached: true,
          env: createChildEnvironment(this.options.childEnvironment),
          stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
        },
      );
      spawnedChild.once('error', () => undefined);
      childPid = spawnedChild.pid ?? null;
      child = new FlightChild(spawnedChild);
      childPid = child.pid();
      await child.writeCredential(credential);
      await child.waitForReady(machineTimeout, this.options.signal);
      await child.bind(runNonce, DA5_V5_FAST_FLIGHT_PLAN_SHA256, machineTimeout,
        this.options.signal);

      let order = 0;
      for (const step of DA5_V5_FAST_FLIGHT_PLAN.steps) {
        throwIfSignalled(this.options.signal);
        if (step.id === 'accessibility-prepare') accessibilityStarted = true;
        if (step.mutation === 'task-owned-disposable') productMutationStarted = true;
        if (step.kind === 'delay') {
          await waitWithSignal(this.dependencies.wait(step.milliseconds), this.options.signal);
          continue;
        }
        let command: string | null = step.kind === 'machine' ? step.command : null;
        if (step.kind === 'human') {
          const answer = await readHumanWithSignal(
            this.options.humanInput.request(step.prompt, this.options.signal),
            this.options.signal,
          );
          const parsed = parseHumanAnswer(answer, step.response);
          if (parsed === 'ABORT') {
            attemptedOutcome = 'ABORT';
            command = 'abort';
          } else if (step.response === 'queue-count') {
            command = requireCommandTemplate(step.command_template, String(parsed));
          } else {
            if (parsed === 'FAIL' || parsed === 'AMBIGUOUS') {
              attemptedOutcome = parsed;
              humanAssertionFailed = true;
            }
            command = step.command_template === undefined
              ? parsed === 'PASS' ? null : 'abort'
              : requireCommandTemplate(step.command_template, String(parsed));
          }
        }
        if (command === null) continue;
        const stepNonce = requireNonce(this.dependencies.createNonce());
        const outcome = await child.command(
          runNonce,
          stepNonce,
          order,
          command,
          step.kind === 'machine' ? step.timeout_milliseconds : longMachineTimeout,
          this.options.signal,
        );
        order += 1;
        if (outcome !== 'continue') {
          childCommandFailed = outcome === 'fail';
          if (attemptedOutcome === 'FAIL_CLOSED') {
            attemptedOutcome = outcome === 'abort' ? 'ABORT' : 'FAIL_CLOSED';
          }
          break;
        }
      }
      if (attemptedOutcome === 'FAIL_CLOSED' && !childCommandFailed) attemptedOutcome = 'PASS';
      const exit = await child.waitForExit(longMachineTimeout, this.options.signal);
      const expectedExit = attemptedOutcome === 'PASS' ? 0 : 1;
      if (exit !== expectedExit || child.endedBeforeTerminal()) {
        throw new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT');
      }
      if (attemptedOutcome === 'FAIL_CLOSED') {
        failureReason = 'CHILD_NONZERO_OR_EARLY_EXIT';
      }
    } catch (error: unknown) {
      failureReason = classifyFlightError(error);
      attemptedOutcome = attemptedOutcome === 'PASS' ? 'FAIL_CLOSED' : attemptedOutcome;
      try {
        if (child !== null) {
          await child.terminateBounded(longMachineTimeout);
        } else if (spawnedChild !== null) {
          await terminateDa5V5UnwrappedChild(spawnedChild, longMachineTimeout);
        }
      } catch {
        childCloseProven = false;
        failureReason = 'CLEANUP_OR_CHECKER_FAILURE';
        attemptedOutcome = 'FAIL_CLOSED';
      }
    } finally {
      credential.fill(0);
    }

    if (!childCloseProven || (child !== null && (!child.cleanupComplete() || child.cleanupFailed()))) {
      failureReason = 'CLEANUP_OR_CHECKER_FAILURE';
    }
    try {
      attestation = await this.dependencies.attest({
        childPid,
        operatorEntrypointPath: this.options.childEntrypointPath,
        productSnapshot: child?.productSnapshot() ?? unobservedProductSnapshot(),
        runtimeGuardBinaryPath: this.options.runtimeGuardBinaryPath,
        standardProfile: this.options.standardProfile,
      });
      if (attestation.status !== 'match') {
        failureReason = 'CLEANUP_OR_CHECKER_FAILURE';
      }
    } catch {
      failureReason = 'CLEANUP_OR_CHECKER_FAILURE';
      attestation = unavailableAttestation();
    }

    let cleanup: 'MATCH' | 'MISMATCH' = failureReason === 'CLEANUP_OR_CHECKER_FAILURE'
      ? 'MISMATCH'
      : 'MATCH';
    const classification = classifyDa5V5FastLane({
      accessibilityRestoration: accessibilityStarted
        ? child?.standardProfileRestored() === true ? 'MATCH' : 'MISMATCH'
        : 'NOT_REQUIRED',
      attemptedOutcome,
      bindingInputsUnchanged: this.options.bindingInputsVerified,
      cleanup,
      failureReason,
      humanAssertionFailed,
      productMutationStarted,
      productSnapshot: attestation.product_equality,
      taskOwnedDisposableOnly: true,
    });
    const receiptId = sha256(
      `receipt:${this.options.bindingSetId}:${runNonce}:${DA5_V5_FAST_FLIGHT_PLAN_SHA256}`,
    ).slice(0, 32);
    const receipt: Da5V5FlightReceipt = Object.freeze({
      accessibility_restoration: accessibilityStarted
        ? child?.standardProfileRestored() === true ? 'MATCH' : 'MISMATCH'
        : 'NOT_REQUIRED',
      attempted_outcome: attemptedOutcome,
      authority_after: 'CONSUMED',
      authority_before: 'FRESH_SEPARATE_HUMAN_AUTHORIZATION',
      binding_set_id: this.options.bindingSetId,
      cleanup,
      failure_reason: failureReason,
      classification_candidate: classification.status === 'MATCH' ? 'ELIGIBLE' : 'STOP',
      fast_lane_disqualifiers: classification.disqualifiers,
      plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
      product_equality: attestation.product_equality,
      receipt_id: receiptId,
      run_category: attemptedOutcome === 'PASS'
        ? 'product_result'
        : productMutationStarted ? 'human_order_deviation' : 'pre_product_non_product',
      run_id: runId,
      schema_version: 1,
      scoped_cleanup: attestation,
    });
    if (!childCloseProven) {
      return Object.freeze({
        attestation,
        attempted_outcome: 'FAIL_CLOSED',
        cleanup: 'MISMATCH',
        failure_reason: 'CLEANUP_OR_CHECKER_FAILURE',
        fast_lane: 'STOP',
        invalid_receipt_root: null,
        plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
        receipt_root: null,
        run_id: runId,
      });
    }
    try {
      receiptRoot = await this.dependencies.seal({
        evidenceParentPath: this.options.evidenceParentPath,
        receipt,
        repositoryRootPath: this.options.repositoryRootPath,
      });
    } catch (error: unknown) {
      failureReason = 'RECEIPT_SEAL_FAILURE';
      attemptedOutcome = 'FAIL_CLOSED';
      receiptRoot = null;
      invalidReceiptRoot = error instanceof Da5V5ReceiptSealError
        ? error.invalidRoot
        : null;
    }
    return Object.freeze({
      attestation,
      attempted_outcome: attemptedOutcome,
      cleanup,
      failure_reason: failureReason,
      fast_lane: failureReason === null && receiptRoot !== null
        ? classification.status
        : 'STOP',
      invalid_receipt_root: invalidReceiptRoot,
      plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
      receipt_root: receiptRoot,
      run_id: runId,
    });
  }
}

export function classifyDa5V5FastLane(input: Readonly<{
  readonly accessibilityRestoration: 'MATCH' | 'MISMATCH' | 'NOT_REQUIRED';
  readonly attemptedOutcome: Da5V5AttemptedOutcome;
  readonly bindingInputsUnchanged: boolean;
  readonly cleanup: 'MATCH' | 'MISMATCH';
  readonly failureReason: Da5V5FlightFailureReason | null;
  readonly humanAssertionFailed: boolean;
  readonly productMutationStarted: boolean;
  readonly productSnapshot: Da5V5CleanStateAttestation['product_equality'];
  readonly taskOwnedDisposableOnly: boolean;
}>): Readonly<{ readonly disqualifiers: readonly string[]; readonly status: 'MATCH' | 'STOP' }> {
  const disqualifiers: string[] = [];
  if (!input.bindingInputsUnchanged) disqualifiers.push('binding_drift');
  if (input.attemptedOutcome === 'PASS') disqualifiers.push('product_pass_ends_campaign');
  if (input.attemptedOutcome === 'FAIL_CLOSED') disqualifiers.push('fail_closed_attempt');
  if (input.humanAssertionFailed) disqualifiers.push('fail_or_ambiguous_assertion');
  if (input.failureReason !== null) disqualifiers.push('closed_failure_reason');
  if (input.accessibilityRestoration === 'MISMATCH') {
    disqualifiers.push('accessibility_not_restored');
  }
  if (input.cleanup !== 'MATCH') disqualifiers.push('cleanup_risk');
  if (input.productMutationStarted && !input.taskOwnedDisposableOnly) {
    disqualifiers.push('mutation_not_exclusively_task_owned_disposable');
  }
  if (input.productMutationStarted) {
    for (const [name, claim] of Object.entries(input.productSnapshot)) {
      if (name === 'schema_version') continue;
      if (!isProductClaim(claim) || claim.observation !== 'observed' || claim.equality !== 'match') {
        disqualifiers.push(`product_equality_${name}`);
      }
    }
  }
  return Object.freeze({
    disqualifiers: Object.freeze([...new Set(disqualifiers)].sort()),
    status: disqualifiers.length === 0 ? 'MATCH' : 'STOP',
  });
}

export interface Da5V5ReceiptSealDependencies {
  readonly chmod: typeof chmod;
  readonly readFile: (path: string) => Promise<Buffer>;
  readonly readdir: typeof readdir;
  readonly rename: typeof rename;
  readonly rm: typeof rm;
  readonly stat: (path: string) => Promise<Readonly<{
    isDirectory: () => boolean;
    isFile: () => boolean;
    mode: number;
  }>>;
  readonly syncDirectory: (path: string) => Promise<void>;
}

export class Da5V5ReceiptSealError extends Error {
  constructor(
    readonly absenceProven: boolean,
    readonly invalidRoot: string | null,
  ) {
    super('DA5 V5 receipt seal failed');
  }
}

export async function sealDa5V5FlightReceipt(options: Readonly<{
  readonly evidenceParentPath: string;
  readonly receipt: Da5V5FlightReceipt;
  readonly repositoryRootPath: string;
}>, dependencyOverrides: Partial<Da5V5ReceiptSealDependencies> = {}): Promise<string> {
  validateReceipt(options.receipt);
  const operations: Da5V5ReceiptSealDependencies = {
    chmod,
    readFile: async (path) => readFile(path),
    readdir,
    rename,
    rm,
    stat: async (path) => stat(path),
    syncDirectory,
    ...dependencyOverrides,
  };
  const requestedParent = resolve(options.evidenceParentPath);
  const requestedRepository = resolve(options.repositoryRootPath);
  await mkdir(requestedParent, { mode: 0o700, recursive: true });
  const [parent, repository] = await Promise.all([
    realpath(requestedParent),
    realpath(requestedRepository),
  ]);
  if (isWithin(repository, parent) || parent === repository) {
    throw new Error('DA5 V5 receipt root must be outside the repository');
  }
  const draft = await mkdtemp(join(parent, '.draft-da5-v5-'));
  const destination = join(parent, `flight-${options.receipt.receipt_id}`);
  let renamed = false;
  try {
    const { classification_candidate: classificationCandidate, ...claims } = options.receipt;
    const stagedReceipt = Object.freeze({
      authority: 'NON_AUTHORITATIVE_STAGED_CLAIMS',
      classification_candidate_eligible: classificationCandidate === 'ELIGIBLE',
      claims: Object.freeze(claims),
      schema_version: 1,
    });
    const receiptBytes = Buffer.from(`${canonicalJson(stagedReceipt)}\n`, 'utf8');
    const manifest = Object.freeze({
      files: Object.freeze([Object.freeze({
        bytes: receiptBytes.byteLength,
        mode: '0444',
        name: 'receipt.draft.json',
        sha256: sha256(receiptBytes),
      })]),
      plan_sha256: options.receipt.plan_sha256,
      receipt_id: options.receipt.receipt_id,
      schema_version: 1,
    });
    const manifestBytes = Buffer.from(`${canonicalJson(manifest)}\n`, 'utf8');
    const commitment = Object.freeze({
      authority: 'AUTHORITATIVE_ONLY_IN_VALIDATED_FINAL_ROOT',
      fast_lane: classificationCandidate === 'ELIGIBLE' ? 'MATCH' : 'STOP',
      manifest_sha256: sha256(manifestBytes),
      receipt_id: options.receipt.receipt_id,
      receipt_seal: 'MATCH',
      schema_version: 1,
      staged_receipt_sha256: sha256(receiptBytes),
    });
    const commitmentBytes = Buffer.from(`${canonicalJson(commitment)}\n`, 'utf8');
    await writeAndSync(join(draft, 'receipt.draft.json'), receiptBytes);
    await writeAndSync(join(draft, 'evidence-manifest.json'), manifestBytes);
    const [draftReceiptCheck, draftManifestCheck] = await Promise.all([
      operations.readFile(join(draft, 'receipt.draft.json')),
      operations.readFile(join(draft, 'evidence-manifest.json')),
    ]);
    if (
      sha256(draftReceiptCheck) !== commitment.staged_receipt_sha256
      || sha256(draftManifestCheck) !== commitment.manifest_sha256
    ) throw new Error('DA5 V5 staged receipt validation mismatch');
    draftReceiptCheck.fill(0);
    draftManifestCheck.fill(0);
    await writeAndSync(join(draft, 'seal-commitment.json'), commitmentBytes);
    receiptBytes.fill(0);
    manifestBytes.fill(0);
    commitmentBytes.fill(0);
    await operations.chmod(join(draft, 'receipt.draft.json'), 0o444);
    await operations.chmod(join(draft, 'evidence-manifest.json'), 0o444);
    await operations.chmod(join(draft, 'seal-commitment.json'), 0o444);
    await operations.syncDirectory(draft);
    await operations.chmod(draft, 0o555);
    await operations.rename(draft, destination);
    renamed = true;
    await operations.syncDirectory(parent);
    const destinationStatus = await operations.stat(destination);
    const receiptPath = join(destination, 'receipt.draft.json');
    const manifestPath = join(destination, 'evidence-manifest.json');
    const commitmentPath = join(destination, 'seal-commitment.json');
    const [names, receiptStatus, manifestStatus, commitmentStatus,
      sealedReceiptBytes, sealedManifestBytes, sealedCommitmentBytes] = await Promise.all([
      operations.readdir(destination),
      operations.stat(receiptPath),
      operations.stat(manifestPath),
      operations.stat(commitmentPath),
      operations.readFile(receiptPath),
      operations.readFile(manifestPath),
      operations.readFile(commitmentPath),
    ]);
    const sealedCommitment = parseClosedJson(sealedCommitmentBytes.toString('utf8'));
    if (
      !destinationStatus.isDirectory()
      || (destinationStatus.mode & 0o777) !== 0o555
      || canonicalJson([...names].sort())
        !== '["evidence-manifest.json","receipt.draft.json","seal-commitment.json"]'
      || !receiptStatus.isFile()
      || !manifestStatus.isFile()
      || !commitmentStatus.isFile()
      || (receiptStatus.mode & 0o777) !== 0o444
      || (manifestStatus.mode & 0o777) !== 0o444
      || (commitmentStatus.mode & 0o777) !== 0o444
      || sha256(sealedReceiptBytes) !== commitment.staged_receipt_sha256
      || sha256(sealedManifestBytes) !== commitment.manifest_sha256
      || canonicalJson(sealedCommitment) !== canonicalJson(commitment)
    ) {
      throw new Error('DA5 V5 receipt seal mismatch');
    }
    sealedReceiptBytes.fill(0);
    sealedManifestBytes.fill(0);
    sealedCommitmentBytes.fill(0);
    return destination;
  } catch {
    const cleanupTarget = renamed ? destination : draft;
    let cleanupFailed = false;
    try { await operations.chmod(cleanupTarget, 0o700); } catch { cleanupFailed = true; }
    try { await operations.rm(cleanupTarget, { force: true, recursive: true }); } catch {
      cleanupFailed = true;
    }
    let targetExists = false;
    try { await operations.stat(cleanupTarget); targetExists = true; } catch { targetExists = false; }
    if (!targetExists) throw new Da5V5ReceiptSealError(true, null);
    const invalidRoot = `${destination}.invalid-${randomBytes(8).toString('hex')}`;
    try {
      await operations.chmod(cleanupTarget, 0o700);
      const marker = Buffer.from(`${canonicalJson({
        authority: 'NON_AUTHORITATIVE_INVALID_SEAL',
        cleanup_operation_failed: cleanupFailed,
        receipt_id: options.receipt.receipt_id,
        receipt_seal: 'MISMATCH',
        schema_version: 1,
      })}\n`, 'utf8');
      await writeAndSync(join(cleanupTarget, 'INVALID_SEAL.json'), marker);
      marker.fill(0);
      await operations.chmod(join(cleanupTarget, 'INVALID_SEAL.json'), 0o444);
      await operations.syncDirectory(cleanupTarget);
      await operations.chmod(cleanupTarget, 0o555);
      await operations.rename(cleanupTarget, invalidRoot);
      await operations.syncDirectory(parent);
      throw new Da5V5ReceiptSealError(false, invalidRoot);
    } catch (markerError: unknown) {
      if (markerError instanceof Da5V5ReceiptSealError) throw markerError;
      throw new Da5V5ReceiptSealError(false, cleanupTarget);
    }
  }
}

type Da5V5FlightStepOutcome = 'abort' | 'continue' | 'fail' | 'stop';

interface Da5V5ActiveProtocolStep {
  readonly command: string;
  readonly order: number;
  readonly runNonce: string;
  readonly stepNonce: string;
  nextSequence: number;
  outcome: Da5V5FlightStepOutcome | null;
  readonly payloads: string[];
  snapshotFailed: boolean;
  terminalStage: number;
  cleanup: 'complete' | 'failed' | null;
}

export class Da5V5FlightProtocolValidator {
  private phase: 'startup' | 'ready' | 'binding' | 'bound' | 'step' | 'between' | 'terminal'
    = 'startup';
  private startupIndex = 0;
  private binding: Readonly<{ digest: string; runNonce: string }> | null = null;
  private step: Da5V5ActiveProtocolStep | null = null;

  beginBinding(runNonce: string, digest: string): void {
    if (
      this.phase !== 'ready'
      || !/^[0-9a-f]{64}$/u.test(runNonce)
      || digest !== DA5_V5_FAST_FLIGHT_PLAN_SHA256
    ) {
      throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
    }
    this.binding = Object.freeze({ digest, runNonce });
    this.phase = 'binding';
  }

  beginStep(runNonce: string, stepNonce: string, order: number, command: string): void {
    if (
      (this.phase !== 'bound' && this.phase !== 'between')
      || this.binding?.runNonce !== runNonce
      || !/^[0-9a-f]{64}$/u.test(stepNonce)
      || !Number.isSafeInteger(order)
      || order < 0
      || command.length === 0
      || command.length > 512
    ) {
      throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
    }
    this.step = {
      cleanup: null,
      command,
      nextSequence: 0,
      order,
      outcome: null,
      payloads: [],
      runNonce,
      snapshotFailed: false,
      stepNonce,
      terminalStage: 0,
    };
    this.phase = 'step';
  }

  observe(line: string): string | null {
    if (line.length === 0 || line.includes('\r') || line.includes('\0')) {
      throw new FlightFailure('UNEXPECTED_OUTPUT');
    }
    if (this.phase === 'startup') {
      const expected = da5V5FlightProtocolStartupLines()[this.startupIndex];
      if (line !== expected) throw protocolLineFailure(line);
      this.startupIndex += 1;
      if (this.startupIndex === da5V5FlightProtocolStartupLines().length) this.phase = 'ready';
      return null;
    }
    if (this.phase === 'binding') {
      const binding = this.binding;
      if (binding === null) throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
      const value = parseExactProtocolJson(line, 'da5_v5_flight_bound=', [
        'plan_digest', 'protocol_version', 'run_nonce',
      ]);
      if (
        value.plan_digest !== binding.digest
        || value.protocol_version !== DA5_V5_FLIGHT_PROTOCOL_VERSION
        || value.run_nonce !== binding.runNonce
      ) {
        throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
      }
      this.phase = 'bound';
      return null;
    }
    if (this.phase === 'step') {
      if (line === 'da5_v5_flight_protocol=mismatch') {
        throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
      }
      if (line.startsWith('da5_v5_flight_output=')) {
        return this.observeOutputFrame(line, false);
      }
      const step = this.requireStep();
      const value = parseExactProtocolJson(line, 'da5_v5_flight_step=', [
        'order', 'output_count', 'protocol_version', 'result', 'run_nonce', 'step_nonce',
      ]);
      if (
        value.order !== step.order
        || value.output_count !== step.nextSequence
        || value.protocol_version !== DA5_V5_FLIGHT_PROTOCOL_VERSION
        || value.run_nonce !== step.runNonce
        || value.step_nonce !== step.stepNonce
        || !['abort', 'continue', 'fail', 'stop'].includes(String(value.result))
      ) {
        throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
      }
      const outcome = value.result as Da5V5FlightStepOutcome;
      validateStepPayloads(step.command, step.payloads, outcome);
      step.outcome = outcome;
      this.phase = outcome === 'continue' ? 'between' : 'terminal';
      return null;
    }
    if (this.phase === 'terminal') {
      if (!line.startsWith('da5_v5_flight_output=')) throw protocolLineFailure(line);
      return this.observeOutputFrame(line, true);
    }
    throw protocolLineFailure(line);
  }

  ready(): boolean { return this.phase === 'ready'; }
  bound(): boolean { return this.phase === 'bound'; }

  stepOutcome(): Da5V5FlightStepOutcome | null {
    return this.phase === 'between' || this.phase === 'terminal'
      ? this.step?.outcome ?? null
      : null;
  }

  terminalComplete(): boolean {
    const step = this.step;
    if (this.phase !== 'terminal' || step === null || step.terminalStage < 2) return false;
    if (step.outcome === 'stop') {
      return step.cleanup === 'failed' || step.snapshotFailed || step.terminalStage === 3;
    }
    return step.terminalStage === 3;
  }

  assertClose(): void {
    if (!this.terminalComplete()) {
      throw new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT');
    }
  }

  private observeOutputFrame(line: string, terminal: boolean): string {
    const step = this.requireStep();
    const value = parseExactProtocolJson(line, 'da5_v5_flight_output=', [
      'order', 'payload', 'protocol_version', 'run_nonce', 'sequence', 'step_nonce',
    ]);
    if (
      value.order !== step.order
      || value.protocol_version !== DA5_V5_FLIGHT_PROTOCOL_VERSION
      || value.run_nonce !== step.runNonce
      || value.sequence !== step.nextSequence
      || value.step_nonce !== step.stepNonce
      || typeof value.payload !== 'string'
    ) {
      throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
    }
    const payload = decodeCanonicalPayload(value.payload);
    if (terminal) validateTerminalPayload(step, payload);
    else {
      step.payloads.push(payload);
      validateStepPayloadPrefix(step.command, step.payloads);
    }
    step.nextSequence += 1;
    return payload;
  }

  private requireStep(): Da5V5ActiveProtocolStep {
    if (this.step === null) throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
    return this.step;
  }
}

class FlightChild {
  private readonly lines: LineQueue;
  private readonly exitPromise: Promise<number>;
  private exitCode: number | null = null;
  private cleanupCompleteValue = false;
  private cleanupFailedValue = false;
  private productSnapshotValue: unknown = unobservedProductSnapshot();
  private standardProfileRestoredValue = false;
  private terminalSeen = false;
  private readonly protocol = new Da5V5FlightProtocolValidator();

  constructor(private readonly child: ChildProcess) {
    if (
      child.pid === undefined
      || child.stdin === null
      || child.stdout === null
      || child.stderr === null
      || child.stdio[3] === null
      || child.stdio[3] === undefined
      || !('write' in child.stdio[3])
    ) {
      throw new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT');
    }
    this.lines = new LineQueue(child, (line) => this.observe(line));
    this.exitPromise = new Promise<number>((resolvePromise) => {
      child.once('close', (code, signal) => {
        const normalized = signal === null && code !== null ? code : -1;
        this.exitCode = normalized;
        try {
          this.protocol.assertClose();
          this.lines.close();
        } catch (error: unknown) {
          this.lines.reject(error instanceof FlightFailure
            ? error
            : new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT'));
        }
        resolvePromise(normalized);
      });
    });
  }

  pid(): number {
    if (this.child.pid === undefined) throw new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT');
    return this.child.pid;
  }

  async writeCredential(credential: Buffer): Promise<void> {
    if (!isCredential(credential)) throw new FlightFailure('UNEXPECTED_OUTPUT');
    const pipe = this.child.stdio[3];
    if (pipe === null || pipe === undefined || !('write' in pipe) || !('end' in pipe)) {
      credential.fill(0);
      throw new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT');
    }
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const onError = (): void => {
        credential.fill(0);
        rejectPromise(new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT'));
      };
      pipe.once('error', onError);
      pipe.write(credential, (error?: Error | null) => {
        credential.fill(0);
        pipe.removeListener('error', onError);
        if (error !== undefined && error !== null) {
          rejectPromise(new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT'));
          return;
        }
        pipe.end(() => resolvePromise());
      });
    });
  }

  async waitForReady(timeout: number, signal?: AbortSignal): Promise<void> {
    const deadline = Date.now() + timeout;
    for (let index = 0; index < da5V5FlightProtocolStartupLines().length; index += 1) {
      await this.nextLine(deadline, signal);
    }
    if (!this.protocol.ready()) throw new FlightFailure('UNEXPECTED_OUTPUT');
  }

  async bind(
    runNonce: string,
    digest: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<void> {
    this.protocol.beginBinding(runNonce, digest);
    this.writeLine(`flight-bind ${runNonce} ${digest}`);
    await this.nextLine(Date.now() + timeout, signal);
    if (!this.protocol.bound()) throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
  }

  async command(
    runNonce: string,
    stepNonce: string,
    order: number,
    command: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<Da5V5FlightStepOutcome> {
    const frame = Buffer.from(command, 'utf8').toString('base64url');
    this.protocol.beginStep(runNonce, stepNonce, order, command);
    this.writeLine(`flight-step ${runNonce} ${stepNonce} ${order} ${frame}`);
    const deadline = Date.now() + timeout;
    while (this.protocol.stepOutcome() === null) await this.nextLine(deadline, signal);
    const outcome = this.protocol.stepOutcome();
    if (outcome === null) throw new FlightFailure('IPC_EOF');
    return outcome;
  }

  waitForExit(timeout: number, signal?: AbortSignal): Promise<number> {
    return bounded(this.exitPromise, timeout, signal).then((exit) => {
      this.lines.assertHealthy();
      return exit;
    });
  }

  async terminateBounded(timeout: number): Promise<void> {
    if (this.exitCode !== null) return;
    signalChildProcess(this.child, 'SIGTERM');
    try {
      await bounded(this.exitPromise, timeout);
      return;
    } catch {
      signalChildProcess(this.child, 'SIGKILL');
      try {
        await bounded(this.exitPromise, timeout);
      } catch {
        throw new FlightFailure('CLEANUP_OR_CHECKER_FAILURE');
      }
    }
  }

  cleanupComplete(): boolean { return this.cleanupCompleteValue; }
  cleanupFailed(): boolean { return this.cleanupFailedValue; }
  endedBeforeTerminal(): boolean { return !this.terminalSeen; }
  productSnapshot(): unknown { return this.productSnapshotValue; }
  standardProfileRestored(): boolean { return this.standardProfileRestoredValue; }

  private writeLine(line: string): void {
    if (this.child.stdin === null || this.child.stdin.destroyed) {
      throw new FlightFailure('IPC_EOF');
    }
    this.child.stdin.write(`${line}\n`);
  }

  private nextLine(deadline: number, signal?: AbortSignal): Promise<string> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new FlightFailure('MACHINE_STEP_TIMEOUT_OR_HANG');
    return this.lines.next(remaining, signal);
  }

  private observe(line: string): void {
    const payload = this.protocol.observe(line);
    if (payload === null) return;
    if (payload === 'da5_v5_cleanup_complete') this.cleanupCompleteValue = true;
    if (payload === 'da5_v5_cleanup_failed') this.cleanupFailedValue = true;
    if (isTerminalOperatorEvent(payload) || payload === 'da5_v5_cleanup_failed') {
      this.terminalSeen = true;
    }
    if (payload === 'da5_v5_standard_profile_binding=match') {
      this.standardProfileRestoredValue = true;
    }
    if (payload.startsWith('da5_v5_precleanup_snapshot=')) {
      this.productSnapshotValue = parseClosedJson(
        payload.slice('da5_v5_precleanup_snapshot='.length),
      );
    }
  }
}

class LineQueue {
  private readonly queue: string[] = [];
  private readonly waiters: Array<(value: string | null) => void> = [];
  private closedValue = false;
  private failure: FlightFailure | null = null;
  private pending = '';
  private readonly decoder = new StringDecoder('utf8');
  private bytes = 0;

  constructor(
    child: ChildProcess,
    private readonly observe: (line: string) => void,
  ) {
    child.stdout?.on('data', (chunk: Buffer) => this.ingest(chunk));
    child.stderr?.on('data', (chunk: Buffer) => {
      chunk.fill(0);
      this.fail(new FlightFailure('UNEXPECTED_OUTPUT'));
    });
    child.stdout?.once('error', () => this.fail(new FlightFailure('IPC_EOF')));
    child.stderr?.once('error', () => this.fail(new FlightFailure('IPC_EOF')));
    child.once('error', () => this.fail(new FlightFailure('CHILD_NONZERO_OR_EARLY_EXIT')));
  }

  next(timeout: number, signal?: AbortSignal): Promise<string> {
    if (this.failure !== null) return Promise.reject(this.failure);
    const available = this.queue.shift();
    if (available !== undefined) return Promise.resolve(available);
    if (this.closedValue) return Promise.reject(new FlightFailure('IPC_EOF'));
    return bounded(new Promise<string>((resolvePromise, rejectPromise) => {
      this.waiters.push((value) => {
        if (value === null) rejectPromise(this.failure ?? new FlightFailure('IPC_EOF'));
        else resolvePromise(value);
      });
    }), timeout, signal);
  }

  close(): void {
    this.closedValue = true;
    const tail = this.decoder.end();
    if (tail.length > 0) this.pending += tail;
    if (this.pending.length > 0) this.fail(new FlightFailure('UNEXPECTED_OUTPUT'));
    this.flushWaiters();
  }

  reject(error: FlightFailure): void {
    this.fail(error);
  }

  assertHealthy(): void {
    if (this.failure !== null) throw this.failure;
  }

  private ingest(chunk: Buffer): void {
    this.bytes += chunk.length;
    if (this.bytes > 4 * 1024 * 1024) {
      chunk.fill(0);
      this.fail(new FlightFailure('UNEXPECTED_OUTPUT'));
      return;
    }
    this.pending += this.decoder.write(chunk);
    chunk.fill(0);
    if (Buffer.byteLength(this.pending) > 64 * 1024) {
      this.fail(new FlightFailure('UNEXPECTED_OUTPUT'));
      return;
    }
    while (true) {
      const newline = this.pending.indexOf('\n');
      if (newline < 0) return;
      const line = this.pending.slice(0, newline).replace(/\r$/u, '');
      this.pending = this.pending.slice(newline + 1);
      try {
        this.observe(line);
      } catch (error: unknown) {
        this.fail(error instanceof FlightFailure
          ? error
          : new FlightFailure('UNEXPECTED_OUTPUT'));
        return;
      }
      this.queue.push(line);
      this.flushWaiters();
    }
  }

  private fail(error: FlightFailure): void {
    this.failure ??= error;
    this.closedValue = true;
    this.flushWaiters();
  }

  private flushWaiters(): void {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (waiter === undefined) return;
      const line = this.queue.shift();
      waiter(line ?? null);
    }
  }
}

class FlightFailure extends Error {
  constructor(readonly reason: Da5V5FlightFailureReason) {
    super(`DA5 V5 flight failed: ${reason}`);
  }
}

export async function terminateDa5V5UnwrappedChild(
  child: ChildProcess,
  timeout: number,
): Promise<void> {
  const exit = new Promise<void>((resolvePromise) => {
    child.once('close', () => resolvePromise());
  });
  signalChildProcess(child, 'SIGTERM');
  try {
    await bounded(exit, timeout);
  } catch {
    signalChildProcess(child, 'SIGKILL');
    try {
      await bounded(exit, timeout);
    } catch {
      throw new FlightFailure('CLEANUP_OR_CHECKER_FAILURE');
    }
  }
}

function signalChildProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (pid !== undefined && pid > 1) {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // Fall back to the direct child; clean-state attestation checks escaped descendants.
    }
  }
  try { child.kill(signal); } catch { /* final attestation remains authoritative */ }
}

function buildFlightSteps(): readonly Da5V5FlightPlanStep[] {
  const steps: Da5V5FlightPlanStep[] = [
    machine('device-preflight', 'device-preflight'),
    humanCommand('physical-tags-ready', prompt(
      'Device standard profile / physical Tag set', 'none', 'none',
      'Confirm only the bound device and assigned, unassigned and unrelated Tags are ready.',
      'Do not present a Tag yet.',
    ), 'physical-tag-binding-confirm {response}'),
    humanCommand('install-ready', prompt(
      'Android home screen', 'none', 'none',
      'Confirm the screen-unlocked bound device is ready for exact APK installation.',
      'Do not install, open or change the Product manually.',
    ), 'android-install-confirm {response}', 'none', longMachineTimeout),
    ...credentialSequence('administrator'),
    humanCommand('administrator-result', credentialResultPrompt('administrator'),
      'credential-result-confirm administrator {response}'),
    humanOnly('admin-setup-actions', prompt(
      'Administrator setup', 'Customer assignment / Preview 2', 'Abbrechen / Abmelden',
      'Assign Tag A to Customer A, run and safely leave Admin Setup Preview 2, then verify signed-out rejection.',
      'Do not present Tag B/X, relogin out of order, or create a lifecycle action.',
    ), 'task-owned-disposable'),
    machine('invitation-create', 'invitation-create', 'task-owned-disposable', longMachineTimeout),
    ...credentialSequence('enrollment'),
    humanCommand('enrollment-result', credentialResultPrompt('enrollment'),
      'credential-result-confirm enrollment {response}'),
    humanOnly('invitation-empty-active', prompt(
      'Als Beschäftigter beitreten', 'Einladungsgeheimnis', 'Einladung sicher einlösen',
      'Activate Einladungsgeheimnis and confirm it is exactly empty and active.',
      'Do not type, paste, expose or submit an invitation secret.',
    )),
    machine('invitation-field-ready', 'invitation-field-ready EMPTY_ACTIVE'),
    machine('invitation-secret', 'invitation-check', 'none', longMachineTimeout),
    humanCommand('employee-install-transition', prompt(
      'Als Beschäftigter beitreten / Employee scan / TapTim.e — Anmeldung',
      'Einladungsgeheimnis / scan status', 'Einladung sicher einlösen / Abmelden',
      'Press Einladung sicher einlösen once, confirm Bereit zum Scannen, sign out once and confirm TapTim.e — Anmeldung.',
      'Do not repeat redemption, install, clear, relaunch or authenticate again.',
    ), 'employee-installation-transition-confirm {response}', 'task-owned-disposable'),
    ...credentialSequence('employee'),
    humanCommand('employee-ready', prompt(
      'TapTim.e — Anmeldung / Employee scan screen',
      'E-Mail-Adresse / Passwort / scan status', 'Anmelden',
      `Press Anmelden once for ${SYNTHETIC_AUTH_EMAIL} and confirm Bereit zum Scannen.`,
      'Do not edit the injected password, present a Tag or trigger a manual action.',
    ), 'employee-ready-confirm {response}'),
    machine('tag-b-registration-arm', 'tag-b-registration-arm'),
    humanOnly('gate-a-rejections', prompt(
      'Employee / signed-out rejection surfaces', 'none', 'none',
      'Present only the prompted unassigned Tag B and unrelated Tag X and verify safe rejection.',
      'Do not present Tag A or create a lifecycle action.',
    ), 'task-owned-disposable'),
    ...checkpoint('gate-a-setup-rejections', 0, 'Gate A summary'),
    machine('gate-b-cold-prepare', 'gate-b-cold-prepare'),
    ...checkpoint('gate-b-cold', 0, 'Cold Employee scan: present assigned Tag A once'),
    ...checkpoint('gate-b-duplicate', 0, 'Present the same Tag A once within the dedupe window'),
    machine('gate-b-baseline', 'dedupe-window-baseline gate-b-customer'),
    delay('gate-b-dedupe-wait'),
    machine('gate-b-dedupe-check', 'dedupe-window-check gate-b-customer'),
    ...checkpoint('gate-b-background', 0, 'Background the Product and present Tag A for the opposite action'),
    ...onlinePair('gate-c-customer', 'Customer', 'NFC then manual'),
    ...onlinePair('gate-c-project', 'Project', 'manual Start then Stop'),
    ...onlinePair('gate-c-general', 'General Work', 'manual Start then Stop'),
    machine('offline-enter-ordinary', 'offline-enter ordinary'),
    ...offlinePair('gate-d-customer', 'Customer', 1, 2),
    ...offlinePair('gate-d-project', 'Project', 3, 4),
    ...offlinePair('gate-d-general', 'General Work', 5, 6),
    machine('ordinary-relaunch-prepare', 'ordinary-relaunch-prepare'),
    ...checkpoint('gate-d-ordinary-relaunch', 6, 'Cold relaunch with the ordinary FIFO retained'),
    machine('offline-restore-ordinary', 'offline-restore ordinary'),
    ...checkpoint('gate-d-ordinary-synchronized', 0, 'Ordinary FIFO synchronized in exact order'),
    machine('cancellation-arm', 'cancellation-arm'),
    humanCommand('cancellation-ui', prompt(
      'Employee cancellable action', 'target action', 'Cancel / background',
      'Begin only the named cancellable action and confirm its cancelled UI.',
      'Do not repeat the action.',
    ), 'cancellation-ui-confirm {response}', 'task-owned-disposable'),
    machine('cancellation-kill', 'cancellation-kill-background'),
    humanCommand('cancellation-ready', prompt(
      'Employee cold relaunch', 'scan status', 'none',
      'Confirm the cancelled action produced no replay and the Product is ready.',
      'Do not repeat or repair the action.',
    ), 'cancellation-ready-confirm {response}'),
    ...checkpoint('gate-d-cancellation', 0, 'Cancellation null result'),
    humanQueue('protected-arm-queue', prompt(
      'Employee sync queue', 'pending count', 'none',
      'Enter the exact visible non-negative integer queue count before the Protected fixture.',
      'Do not clear, retry or synchronize anything.',
    ), 'protected-review-arm {response}'),
    machine('protected-activate-tag-b', 'protected-review-activate-tag-b', 'task-owned-disposable'),
    ...checkpoint('gate-d-fixture-tag-b-activated', 0, 'Tag B assignment activation'),
    ...checkpoint('gate-d-fixture-tag-b-started', 0, 'Present Tag B once to start Customer B'),
    machine('gate-d-tag-b-baseline', 'dedupe-window-baseline gate-d-tag-b'),
    machine('offline-enter-protected', 'offline-enter protected'),
    ...checkpoint('gate-d-fixture-pre-cutover-pending', 1, 'Present Tag A once before cutover'),
    machine('gate-d-tag-a-baseline', 'dedupe-window-baseline gate-d-tag-a'),
    machine('protected-cutover', 'protected-review-cutover-tag-a', 'task-owned-disposable'),
    ...checkpoint('gate-d-fixture-cutover', 1, 'Tag A cutover completed'),
    delay('gate-d-protected-dedupe-wait'),
    machine('gate-d-tag-a-check', 'dedupe-window-check gate-d-tag-a'),
    humanOnly('gate-d-tag-a-after-cutover', prompt(
      'Employee offline scan', 'scan target', 'none',
      'Present Tag A exactly once after cutover.',
      'Do not retry, adjudicate or change connectivity.',
    ), 'task-owned-disposable'),
    machine('gate-d-tag-b-check', 'dedupe-window-check gate-d-tag-b'),
    ...checkpoint('gate-d-fixture-all-pending', 3, 'Present Tag B once as the intended successor'),
    machine('offline-restore-protected', 'offline-restore protected'),
    ...checkpoint('gate-d-protected-terminal', 0, 'Protected/review sequence reconciled in exact order'),
    machine('protected-terminal', 'protected-review-terminal'),
    machine('protected-force-stop', 'protected-force-stop'),
    humanCommand('protected-ready', prompt(
      'Protected/review cold relaunch', 'protected state', 'none',
      'Open once and confirm the same protected/review-required state is retained.',
      'Do not adjudicate, clear, retry or mutate the fixture.',
    ), 'protected-ready-confirm {response}'),
    ...checkpoint('gate-d-protected-relaunch', 0, 'Protected state retained after cold relaunch'),
    machine('accessibility-prepare', 'accessibility-prepare'),
    humanOnly('accessibility-enable', prompt(
      'Android Accessibility settings', 'font scale / TalkBack provider', 'Enable',
      'Enable only the bound TalkBack provider and set font scale to 2.0.',
      'Do not change another setting; restoration to the standard profile remains mandatory.',
    )),
    machine('accessibility-check', 'accessibility-check'),
    ...accessibilitySteps(),
    ...checkpoint('gate-e-accessibility', 0, 'All eight accessibility surfaces'),
    humanOnly('accessibility-restore', prompt(
      'Android Accessibility settings', 'font scale / active services', 'Disable',
      'Restore font scale 1.0, accessibility disabled and no active service.',
      'Do not continue until the complete standard profile is visibly restored.',
    )),
    machine('standard-profile-check', 'standard-profile-check'),
    ...checkpoint('gate-f-final', 0, 'Final disclosure-safe Product truth'),
    machine('stop', 'stop', 'none', longMachineTimeout),
  ];
  return Object.freeze(steps);
}

function accessibilitySteps(): Da5V5FlightPlanStep[] {
  const steps: Da5V5FlightPlanStep[] = [];
  for (const surface of DA5_V5_ACCESSIBILITY_SURFACE_PLAN) {
    if (surface === 'administrator-setup') {
      steps.push(...accessibilityCredentialSequence('administrator'));
    }
    if (surface === 'employee-navigation') {
      steps.push(...accessibilityCredentialSequence('employee'));
    }
    const reauthentication = accessibilityReauthentication(surface);
    steps.push(humanCommand(`accessibility-${surface}`, prompt(
      reauthentication === null
        ? `Accessibility surface: ${surface}`
        : `TapTim.e — Anmeldung → Accessibility surface: ${surface}`,
      reauthentication === null
        ? 'focus order / labels / state / layout'
        : 'E-Mail-Adresse / Passwort / focus order / labels / state / layout',
      reauthentication === null ? 'none' : 'Anmelden',
      reauthentication === null
        ? `Inspect only ${surface} and confirm every required accessibility/layout property.`
        : `Press Anmelden once for ${credentialEmail(reauthentication)}; answer PASS only when ${surface} is visible and every required accessibility/layout property matches.`,
      reauthentication === null
        ? 'Do not mutate Product, setup, queue, sync, fixture or lifecycle state.'
        : 'Do not edit the injected password, submit twice or mutate setup, queue, sync, fixture or lifecycle state.',
    ), `accessibility-surface-confirm ${surface} {response}`));
  }
  return steps;
}

function credentialSequence(
  role: 'administrator' | 'employee' | 'enrollment',
): Da5V5FlightPlanStep[] {
  const button = credentialButton(role);
  const email = credentialEmail(role);
  return [
    humanOnly(`${role}-empty-active`, prompt(
      'TapTim.e — Anmeldung', 'E-Mail-Adresse / Passwort', button,
      `Type ${email} into E-Mail-Adresse, activate Passwort and confirm Passwort is exactly empty and active.`,
      `Do not type or paste the password and do not press ${button} yet.`,
    )),
    machine(`${role}-field-ready`, `credential-field-ready ${role} EMPTY_ACTIVE`),
    machine(`${role}-credential`, `credential-check ${role}`, 'none', longMachineTimeout),
  ];
}

function accessibilityCredentialSequence(
  role: 'administrator' | 'employee',
): Da5V5FlightPlanStep[] {
  return [
    humanOnly(`accessibility-${role}-empty-active`, prompt(
      'TapTim.e — Anmeldung', 'E-Mail-Adresse / Passwort', 'Anmelden',
      `Type ${credentialEmail(role)} into E-Mail-Adresse, activate Passwort and confirm Passwort is exactly empty and active.`,
      'Do not type or paste the password and do not press Anmelden yet.',
    )),
    machine(
      `accessibility-${role}-field-ready`,
      `accessibility-credential-field-ready ${role} EMPTY_ACTIVE`,
    ),
    machine(
      `accessibility-${role}-credential`,
      `accessibility-credential-check ${role}`,
      'none',
      longMachineTimeout,
    ),
  ];
}

function credentialResultPrompt(
  role: 'administrator' | 'enrollment',
): Da5V5HumanPrompt {
  const email = credentialEmail(role);
  const button = credentialButton(role);
  const destination = role === 'administrator'
    ? 'Administrator setup'
    : 'Als Beschäftigter beitreten';
  return prompt(
    'TapTim.e — Anmeldung', 'E-Mail-Adresse / Passwort', button,
    `Press ${button} once for ${email}; answer PASS only when ${destination} is visible.`,
    'If Passwort is empty/not-filled-looking or doubtful, login is rejected or another surface appears, answer FAIL or AMBIGUOUS; do not submit twice.',
  );
}

function credentialEmail(
  role: 'administrator' | 'employee' | 'enrollment',
): string {
  if (role === 'administrator') return SYNTHETIC_ADMIN_AUTH_EMAIL;
  if (role === 'enrollment') return SYNTHETIC_ENROLLMENT_AUTH_EMAIL;
  return SYNTHETIC_AUTH_EMAIL;
}

function credentialButton(role: 'administrator' | 'employee' | 'enrollment'): string {
  return role === 'enrollment' ? 'Mit Einladung beitreten' : 'Anmelden';
}

function accessibilityReauthentication(
  surface: (typeof DA5_V5_ACCESSIBILITY_SURFACE_PLAN)[number],
): 'administrator' | 'employee' | null {
  if (surface === 'administrator-setup') return 'administrator';
  if (surface === 'employee-navigation') return 'employee';
  return null;
}

function checkpoint(
  checkpointName: Da5V5Checkpoint,
  queueItems: number,
  action: string,
): Da5V5FlightPlanStep[] {
  return [
    humanOnly(`${checkpointName}-action`, prompt(
      checkpointName, 'Product state', 'prompted action', action,
      'Do not perform any unprompted action, retry, repair or change order.',
    ), checkpointName.startsWith('gate-') ? 'task-owned-disposable' : 'none'),
    machine(`${checkpointName}-observe`, `checkpoint ${checkpointName} ${queueItems}`),
    humanCommand(`${checkpointName}-confirm`, prompt(
      checkpointName, 'expected versus observed result', 'none',
      'Confirm the exact visible checkpoint result.',
      'Do not infer an unavailable or unobserved field.',
    ), `checkpoint-confirm ${checkpointName} {response}`),
  ];
}

function onlinePair(
  phase: 'gate-c-customer' | 'gate-c-general' | 'gate-c-project',
  label: string,
  action: string,
): Da5V5FlightPlanStep[] {
  const first = `${phase}-first` as Da5V5Checkpoint;
  const complete = `${phase}-complete` as Da5V5Checkpoint;
  return [
    ...checkpoint(first, 0, `${label}: ${action} first action`),
    machine(`${phase}-baseline`, `dedupe-window-baseline ${phase}`),
    delay(`${phase}-wait`),
    machine(`${phase}-check`, `dedupe-window-check ${phase}`),
    ...checkpoint(complete, 0, `${label}: intended opposite action`),
  ];
}

function offlinePair(
  phase: 'gate-d-customer' | 'gate-d-general' | 'gate-d-project',
  label: string,
  firstQueue: number,
  secondQueue: number,
): Da5V5FlightPlanStep[] {
  const first = `${phase}-first-pending` as Da5V5Checkpoint;
  const complete = `${phase}-complete-pending` as Da5V5Checkpoint;
  return [
    ...checkpoint(first, firstQueue, `${label}: first controlled-offline action`),
    machine(`${phase}-baseline`, `dedupe-window-baseline ${phase}`),
    delay(`${phase}-wait`),
    machine(`${phase}-check`, `dedupe-window-check ${phase}`),
    ...checkpoint(complete, secondQueue, `${label}: intended opposite offline action`),
  ];
}

function machine(
  id: string,
  command: string,
  mutation: Da5V5MachineStep['mutation'] = 'none',
  timeout_milliseconds = machineTimeout,
): Da5V5MachineStep {
  return { command, id, kind: 'machine', mutation, timeout_milliseconds };
}

function delay(id: string): Da5V5DelayStep {
  return { id, kind: 'delay', milliseconds: exactDedupeDelay, mutation: 'none' };
}

function humanOnly(
  id: string,
  humanPrompt: Da5V5HumanPrompt,
  mutation: Da5V5HumanStep['mutation'] = 'none',
): Da5V5HumanStep {
  return { id, kind: 'human', mutation, prompt: humanPrompt, response: 'verdict' };
}

function humanCommand(
  id: string,
  humanPrompt: Da5V5HumanPrompt,
  command_template: string,
  mutation: Da5V5HumanStep['mutation'] = 'none',
  _timeout = machineTimeout,
): Da5V5HumanStep {
  return { command_template, id, kind: 'human', mutation, prompt: humanPrompt, response: 'verdict' };
}

function humanQueue(
  id: string,
  humanPrompt: Da5V5HumanPrompt,
  command_template: string,
): Da5V5HumanStep {
  return {
    command_template,
    id,
    kind: 'human',
    mutation: 'none',
    prompt: Object.freeze({
      ...humanPrompt,
      allowed_response: Object.freeze(['NON_NEGATIVE_INTEGER', 'ABORT']),
    }),
    response: 'queue-count',
  };
}

function prompt(
  screen: string,
  field: string,
  button: string,
  action: string,
  doNot: string,
): Da5V5HumanPrompt {
  return {
    action,
    allowed_response: Object.freeze(['PASS', 'FAIL', 'AMBIGUOUS', 'ABORT']),
    button,
    do_not: doNot,
    field,
    screen,
  };
}

function parseHumanAnswer(
  raw: string,
  response: 'queue-count' | 'verdict',
): Da5V5HumanVerdict | 'ABORT' | number {
  const value = raw;
  if (value === 'ABORT') return value;
  if (response === 'verdict' && ['PASS', 'FAIL', 'AMBIGUOUS'].includes(value)) {
    return value as Da5V5HumanVerdict;
  }
  if (response === 'queue-count' && /^(?:0|[1-9][0-9]*)$/u.test(value)) {
    const count = Number(value);
    if (Number.isSafeInteger(count)) return count;
  }
  throw new FlightFailure('UNEXPECTED_OUTPUT');
}

function requireCommandTemplate(template: string | undefined, response: string): string {
  if (template === undefined || !template.includes('{response}')) {
    throw new FlightFailure('UNEXPECTED_OUTPUT');
  }
  return template.replace('{response}', response);
}

type PayloadMatcher = string | RegExp;

export function da5V5FlightProtocolStartupLines(): readonly string[] {
  return Object.freeze([
    'da5_v5_ready',
    `da5_v5_public_manifest=${JSON.stringify(DA5_V5_PUBLIC_MANIFEST)}`,
    `da5_v5_accessibility_surface_plan=${DA5_V5_ACCESSIBILITY_SURFACE_PLAN.join(',')}`,
    `operator_commands=${DA5_V5_OPERATOR_COMMANDS}`,
    'sensitive_values_are_never_printed',
  ]);
}

function protocolLineFailure(line: string): FlightFailure {
  return new FlightFailure(
    line.startsWith('da5_v5_flight_')
      ? 'NONCE_OR_ORDER_MISMATCH'
      : 'UNEXPECTED_OUTPUT',
  );
}

function parseExactProtocolJson(
  line: string,
  prefix: string,
  keys: readonly string[],
): Record<string, unknown> {
  if (!line.startsWith(prefix)) throw protocolLineFailure(line);
  const value = parseClosedJson(line.slice(prefix.length));
  if (!hasExactKeys(value, keys)) throw new FlightFailure('UNEXPECTED_OUTPUT');
  return value;
}

function decodeCanonicalPayload(value: string): string {
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new FlightFailure('UNEXPECTED_OUTPUT');
  }
  const bytes = Buffer.from(value, 'base64url');
  const decoded = bytes.toString('utf8');
  if (
    bytes.toString('base64url') !== value
    || Buffer.from(decoded, 'utf8').toString('base64url') !== value
    || decoded.length === 0
    || decoded.length > 64 * 1024
    || /[\r\n\0]/u.test(decoded)
  ) {
    bytes.fill(0);
    throw new FlightFailure('UNEXPECTED_OUTPUT');
  }
  bytes.fill(0);
  return decoded;
}

const matchResult = '(?:match|mismatch)';
const safeEvent = /^synthetic_e2e_event=(?:assignment_armed|assignment_fingerprint_mismatch|tag_a_assigned|redemption_interruption_armed|redemption_interrupted|redemption_paused|da5_v5_tag_b_registration_armed|da5_v5_tag_b_registration_fingerprint_mismatch|da5_v5_tag_b_registered_unassigned|api_(?:administration|employee_enrollment|lifecycle|mobile_work|offline_synchronization|scan_context|session|time_entry_export|time_review)_unavailable)$/u;

function commandPayloadAlternatives(command: string): readonly (readonly PayloadMatcher[])[] {
  let alternatives: readonly (readonly PayloadMatcher[])[];
  if (command === 'abort' || command === 'stop') alternatives = [[]];
  else if (command === 'status') alternatives = [[/^da5_v5_status=\{.+\}$/u]];
  else if (command === 'device-preflight') {
    alternatives = [[new RegExp(`^da5_v5_device_preflight=${matchResult}$`, 'u')]];
  } else if (/^physical-tag-binding-confirm /u.test(command)) {
    alternatives = command.endsWith(' PASS') ? [['da5_v5_physical_tag_binding=human_confirmed']] : [[]];
  } else if (/^android-install-confirm /u.test(command)) {
    alternatives = command.endsWith(' PASS')
      ? [['da5_v5_android_install=match'], [/^da5_v5_android_install=mismatch category=[a-z_]+ cleanup_status=[a-z_]+ cleanup_substage=[a-z0-9_]+$/u]]
      : [[]];
  } else if (/^employee-installation-transition-confirm /u.test(command)) {
    alternatives = [
      ['da5_v5_invitation_redemption=match', 'da5_v5_employee_package_clear=match', 'da5_v5_employee_installation_transition=employee-prepared'],
      ['da5_v5_invitation_redemption=match', 'da5_v5_employee_package_clear=mismatch', 'da5_v5_employee_installation_transition=mismatch'],
      ['da5_v5_invitation_redemption=match', 'da5_v5_employee_installation_transition=mismatch'],
      ['da5_v5_invitation_redemption=match', /^da5_v5_android_install=mismatch category=[a-z_]+ cleanup_status=[a-z_]+ cleanup_substage=[a-z0-9_]+$/u],
      ['da5_v5_invitation_redemption=mismatch'],
    ];
  } else if (/^employee-ready-confirm /u.test(command)) {
    alternatives = [
      ['synthetic_credential_result=match', /^da5_v5_employee_ready=(?:READY|MISMATCH)$/u],
      ['synthetic_credential_result=mismatch'],
    ];
  } else if (/^credential-field-ready /u.test(command)) {
    alternatives = [[new RegExp(`^synthetic_credential_field_ready=${matchResult}$`, 'u')]];
  } else if (/^credential-result-confirm /u.test(command)) {
    alternatives = [[new RegExp(`^synthetic_credential_result=${matchResult}$`, 'u')]];
  } else if (/^credential-check /u.test(command)) {
    alternatives = [
      ['synthetic_password_binding=match', 'synthetic_credential_injection=pending_result_gate'],
      ['synthetic_password_binding=mismatch'],
      [],
    ];
  } else if (command === 'invitation-create') {
    alternatives = [
      ['da5_v5_invitation_creation=match', 'da5_v5_invitation_counters=created'],
      ['da5_v5_invitation_creation=mismatch'],
    ];
  } else if (command === 'invitation-field-ready EMPTY_ACTIVE') {
    alternatives = [[new RegExp(`^da5_v5_invitation_field_ready=${matchResult}$`, 'u')]];
  } else if (command === 'invitation-check') {
    alternatives = [
      ['da5_v5_invitation_binding=match', 'da5_v5_invitation_injection=pending_redemption_result'],
      ['da5_v5_invitation_binding=mismatch'],
    ];
  } else if (/^accessibility-credential-field-ready /u.test(command)) {
    alternatives = [[new RegExp(`^da5_v5_accessibility_credential_field_ready=${matchResult}$`, 'u')]];
  } else if (/^accessibility-credential-check /u.test(command)) {
    alternatives = [
      ['da5_v5_accessibility_password_binding=match', 'da5_v5_accessibility_credential_injection=pending_surface_result'],
      ['da5_v5_accessibility_password_binding=mismatch'],
      [],
    ];
  } else if (/^accessibility-surface-confirm /u.test(command)) {
    alternatives = [
      [/^da5_v5_accessibility_surface=\{"result":"(?:match|mismatch)","surface":"[a-z-]+"\}$/u],
      ['da5_v5_accessibility_credential_result=match', /^da5_v5_accessibility_surface=\{"result":"(?:match|mismatch)","surface":"[a-z-]+"\}$/u],
      ['da5_v5_accessibility_credential_result=mismatch'],
    ];
  } else if (command === 'accessibility-cancel') {
    alternatives = [['da5_v5_accessibility_cancelled=restore_required'], []];
  } else if (command === 'accessibility-prepare') {
    alternatives = [[/^da5_v5_accessibility_prepare=(?:match restore_required=armed|mismatch)$/u]];
  } else if (command === 'accessibility-check') {
    alternatives = [[new RegExp(`^da5_v5_accessibility_binding=${matchResult}$`, 'u')], []];
  } else if (command === 'standard-profile-check') {
    alternatives = [
      ['da5_v5_standard_profile_binding=match'],
      ['da5_v5_standard_profile_binding=mismatch', 'da5_v5_accessibility_restore_required=match'],
    ];
  } else if (/^checkpoint /u.test(command)) {
    alternatives = [[/^da5_v5_checkpoint_observation=\{"expected":(?:null|\{.+\}),"observed":\{.+\},"result":"(?:match|mismatch)"\}$/u]];
  } else if (/^checkpoint-confirm /u.test(command)) {
    alternatives = [[new RegExp(`^da5_v5_checkpoint_confirmation=${matchResult}$`, 'u')]];
  } else if (/^dedupe-window-baseline /u.test(command)) {
    alternatives = [[new RegExp(`^dedupe_window_baseline=${matchResult}$`, 'u')]];
  } else if (/^dedupe-window-check /u.test(command)) {
    alternatives = [[new RegExp(`^dedupe_window_elapsed=${matchResult}$`, 'u')]];
  } else if (command === 'tag-b-registration-arm') {
    alternatives = [[safeEvent, 'da5_v5_tag_b_registration=armed'], []];
  } else if (/^protected-review-arm /u.test(command)) {
    alternatives = [[/^da5_v5_human_queue_observation=\{"expected":0,"observed":[0-9]+,"result":"(?:match|mismatch)","source":"human-visible-product-observation"\}$/u, /^protected_review_(?:fixture=armed|fixture=mismatch)$/u]];
  } else if (/^protected-review-/u.test(command)) {
    alternatives = [[/^protected_review_(?:tag_b=active|tag_a_cutover=match|fixture_checkpoint=match|fixture=mismatch)$/u]];
  } else if (/^offline-(?:enter|restore) /u.test(command)) {
    alternatives = [[new RegExp(`^da5_v5_offline_(?:enter|restore)=${matchResult}$`, 'u')]];
  } else if (/^(?:gate-b-cold-prepare|ordinary-relaunch-prepare|cancellation-arm|cancellation-ui-confirm |cancellation-kill-background|cancellation-ready-confirm |protected-force-stop|protected-ready-confirm )/u.test(command)) {
    alternatives = [[new RegExp(`^da5_v5_(?:cold_dispatch_preparation|ordinary_relaunch_preparation|cancellation|cancellation_ui|cancellation_process_absent|cancellation_ready|protected_relaunch_preparation|protected_state_retained)=${matchResult}$`, 'u')]];
  } else {
    throw new FlightFailure('UNEXPECTED_OUTPUT');
  }
  return alternatives;
}

function matcherAccepts(matcher: PayloadMatcher, payload: string): boolean {
  return typeof matcher === 'string' ? payload === matcher : matcher.test(payload);
}

function validateStepPayloadPrefix(command: string, payloads: readonly string[]): void {
  const alternatives = commandPayloadAlternatives(command);
  if (!alternatives.some((alternative) => payloads.every((payload, index) => (
    alternative[index] !== undefined && matcherAccepts(alternative[index], payload)
  )))) throw new FlightFailure('UNEXPECTED_OUTPUT');
}

function validateStepPayloads(
  command: string,
  payloads: readonly string[],
  outcome: Da5V5FlightStepOutcome,
): void {
  const alternatives = commandPayloadAlternatives(command);
  if (!alternatives.some((alternative) => (
    alternative.length === payloads.length
    && payloads.every((payload, index) => matcherAccepts(alternative[index] as PayloadMatcher, payload))
  ))) throw new FlightFailure('UNEXPECTED_OUTPUT');
  if (outcome === 'continue' && command === 'abort') throw new FlightFailure('UNEXPECTED_OUTPUT');
  if (outcome === 'stop' && command !== 'stop') throw new FlightFailure('UNEXPECTED_OUTPUT');
}

function validateTerminalPayload(step: Da5V5ActiveProtocolStep, payload: string): void {
  if (step.terminalStage === 0) {
    if (payload === 'da5_v5_precleanup_snapshot_failed') step.snapshotFailed = true;
    else if (payload.startsWith('da5_v5_precleanup_snapshot=')) {
      requireDa5V5ProductSnapshotClaim(parseClosedJson(
        payload.slice('da5_v5_precleanup_snapshot='.length),
      ));
    } else throw new FlightFailure('UNEXPECTED_OUTPUT');
    step.terminalStage = 1;
    return;
  }
  if (step.terminalStage === 1) {
    if (payload === 'da5_v5_cleanup_complete') step.cleanup = 'complete';
    else if (payload === 'da5_v5_cleanup_failed') step.cleanup = 'failed';
    else throw new FlightFailure('UNEXPECTED_OUTPUT');
    step.terminalStage = 2;
    return;
  }
  if (step.terminalStage !== 2 || !isTerminalOperatorEvent(payload)) {
    throw new FlightFailure('UNEXPECTED_OUTPUT');
  }
  if (
    (step.outcome === 'abort' && payload !== 'da5_v5_aborted')
    || (step.outcome === 'stop' && payload !== 'da5_v5_stopped')
  ) throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
  step.terminalStage = 3;
}

function isTerminalOperatorEvent(value: string): boolean {
  return /^(?:da5_v5_aborted|da5_v5_checkpoint=mismatch|da5_v5_credential_binding=mismatch|da5_v5_device_checkpoint=mismatch|da5_v5_dedupe_window=mismatch|da5_v5_fixture=mismatch|da5_v5_interrupted|da5_v5_offline_control=mismatch|da5_v5_stopped|operator_command_failed|operator_command_rejected)$/u.test(value);
}

function createChildEnvironment(
  input: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    if (
      name === 'TAPTIME_SYNTHETIC_E2E_PASSWORD'
      || name === 'TAPTIME_DA5_V5_FLIGHT_EVIDENCE_PARENT'
      || name === 'TAPTIME_DA5_V5_BINDING_SET_ID'
      || /[\0=]/u.test(name)
      || value.includes('\0')
    ) {
      continue;
    }
    result[name] = value;
  }
  return result;
}

function requireControllerOptions(options: Da5V5FlightControllerOptions): void {
  if (
    !/^[0-9a-f]{64}$/u.test(options.bindingSetId)
    || options.bindingInputsVerified !== true
    || !isAbsolute(options.childEntrypointPath)
    || !isAbsolute(options.evidenceParentPath)
    || typeof options.humanInput !== 'object'
    || options.humanInput === null
    || typeof options.humanInput.request !== 'function'
    || !isAbsolute(options.repositoryRootPath)
    || !/^[0-9a-f]{64}$/u.test(options.runNonce)
    || !isAbsolute(options.runtimeGuardBinaryPath)
    || !isCredential(options.credential)
  ) {
    throw new Error('DA5 V5 flight controller binding mismatch');
  }
}

function validateReceipt(receipt: Da5V5FlightReceipt): void {
  if (
    !hasExactKeys(receipt, [
      'accessibility_restoration',
      'attempted_outcome',
      'authority_after',
      'authority_before',
      'binding_set_id',
      'classification_candidate',
      'cleanup',
      'failure_reason',
      'fast_lane_disqualifiers',
      'plan_sha256',
      'product_equality',
      'receipt_id',
      'run_category',
      'run_id',
      'schema_version',
      'scoped_cleanup',
    ])
    || receipt.schema_version !== 1
    || !/^[0-9a-f]{64}$/u.test(receipt.binding_set_id)
    || !/^[0-9a-f]{64}$/u.test(receipt.plan_sha256)
    || receipt.plan_sha256 !== DA5_V5_FAST_FLIGHT_PLAN_SHA256
    || !/^[0-9a-f]{32}$/u.test(receipt.receipt_id)
    || !/^[0-9a-f]{32}$/u.test(receipt.run_id)
    || receipt.authority_after !== 'CONSUMED'
    || receipt.authority_before !== 'FRESH_SEPARATE_HUMAN_AUTHORIZATION'
    || !['MATCH', 'MISMATCH', 'NOT_REQUIRED'].includes(receipt.accessibility_restoration)
    || !['PASS', 'FAIL', 'AMBIGUOUS', 'ABORT', 'FAIL_CLOSED']
      .includes(receipt.attempted_outcome)
    || !['MATCH', 'MISMATCH'].includes(receipt.cleanup)
    || !['ELIGIBLE', 'STOP'].includes(receipt.classification_candidate)
    || !['human_order_deviation', 'pre_product_non_product', 'product_result']
      .includes(receipt.run_category)
    || (receipt.failure_reason !== null
      && !DA5_V5_FLIGHT_FAILURE_REASONS.includes(receipt.failure_reason))
    || !Array.isArray(receipt.fast_lane_disqualifiers)
    || receipt.fast_lane_disqualifiers.some((value) => (
      typeof value !== 'string'
      || !/^(?:accessibility_not_restored|binding_drift|cleanup_risk|closed_failure_reason|fail_closed_attempt|fail_or_ambiguous_assertion|mutation_not_exclusively_task_owned_disposable|product_pass_ends_campaign|product_equality_(?:aggregates|invariants|queue|tag_roles))$/u.test(value)
    ))
    || new Set(receipt.fast_lane_disqualifiers).size
      !== receipt.fast_lane_disqualifiers.length
  ) {
    throw new Error('DA5 V5 receipt schema mismatch');
  }
  const product = requireDa5V5ProductSnapshotClaim(receipt.product_equality);
  validateCleanStateAttestation(receipt.scoped_cleanup);
  if (
    canonicalJson(product) !== canonicalJson(receipt.product_equality)
    || canonicalJson(product) !== canonicalJson(receipt.scoped_cleanup.product_equality)
    || (receipt.classification_candidate === 'ELIGIBLE' && (
      receipt.cleanup !== 'MATCH'
      || receipt.failure_reason !== null
      || receipt.fast_lane_disqualifiers.length !== 0
      || receipt.attempted_outcome === 'PASS'
      || receipt.scoped_cleanup.status !== 'match'
      || receipt.accessibility_restoration === 'MISMATCH'
    ))
    || (receipt.classification_candidate === 'STOP'
      && receipt.fast_lane_disqualifiers.length === 0)
  ) {
    throw new Error('DA5 V5 receipt claim mismatch');
  }
  const encoded = canonicalJson(receipt).toLowerCase();
  for (const forbidden of ['password', 'credential', 'serial', 'raw_uid', 'personal_data']) {
    if (encoded.includes(`"${forbidden}"`)) {
      throw new Error('DA5 V5 receipt disclosure mismatch');
    }
  }
}

function validateCleanStateAttestation(value: Da5V5CleanStateAttestation): void {
  if (
    !hasExactKeys(value, [
      'android',
      'bound_postgres_processes',
      'checked_ports',
      'operator_processes',
      'owned_listeners',
      'product_equality',
      'schema_version',
      'status',
      'task_roots',
    ])
    || value.schema_version !== 1
    || canonicalJson(value.checked_ports) !== '[3000,54321,55435]'
    || [
      value.android,
      value.bound_postgres_processes,
      value.operator_processes,
      value.owned_listeners,
      value.status,
      value.task_roots,
    ].some((claim) => claim !== 'match' && claim !== 'mismatch')
    || (value.status === 'match' && [
      value.android,
      value.bound_postgres_processes,
      value.operator_processes,
      value.owned_listeners,
      value.task_roots,
    ].some((claim) => claim !== 'match'))
  ) {
    throw new Error('DA5 V5 clean-state receipt mismatch');
  }
  requireDa5V5ProductSnapshotClaim(value.product_equality);
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expectedKeys[index]);
}

function unavailableAttestation(): Da5V5CleanStateAttestation {
  return Object.freeze({
    android: 'mismatch',
    bound_postgres_processes: 'mismatch',
    checked_ports: Object.freeze([3_000, 54_321, 55_435] as const),
    operator_processes: 'mismatch',
    owned_listeners: 'mismatch',
    product_equality: unobservedProductSnapshot(),
    schema_version: 1,
    status: 'mismatch',
    task_roots: 'mismatch',
  });
}

function unobservedProductSnapshot(): Da5V5CleanStateAttestation['product_equality'] {
  const unobserved = Object.freeze({ equality: 'unproved', observation: 'unobserved' } as const);
  return Object.freeze({
    aggregates: unobserved,
    invariants: unobserved,
    queue: Object.freeze({ ...unobserved, reason: 'operator_schema_has_no_queue_field' }),
    schema_version: 1,
    tag_roles: unobserved,
  });
}

async function writeAndSync(path: string, bytes: Buffer): Promise<void> {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

function parseClosedJson(value: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new FlightFailure('UNEXPECTED_OUTPUT'); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new FlightFailure('UNEXPECTED_OUTPUT');
  }
  return parsed as Record<string, unknown>;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new FlightFailure('UNEXPECTED_OUTPUT');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireNonce(value: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new FlightFailure('NONCE_OR_ORDER_MISMATCH');
  return value;
}

function isCredential(value: Buffer): boolean {
  return value.length === 64 && value.every((byte) => (
    (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
  ));
}

function isProductClaim(value: unknown): value is Readonly<{
  readonly equality: string;
  readonly observation: string;
}> {
  return typeof value === 'object' && value !== null && 'equality' in value && 'observation' in value;
}

function classifyFlightError(error: unknown): Da5V5FlightFailureReason {
  if (error instanceof FlightFailure) return error.reason;
  return 'UNEXPECTED_OUTPUT';
}

function throwIfSignalled(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw abortFlightFailure(signal);
}

function bounded<T>(operation: Promise<T>, timeout: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    let settled = false;
    const timer = setTimeout(() => finish(new FlightFailure('MACHINE_STEP_TIMEOUT_OR_HANG')),
      timeout);
    const onAbort = (): void => finish(abortFlightFailure(signal));
    const finish = (error?: Error, value?: T): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error !== undefined) rejectPromise(error);
      else resolvePromise(value as T);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted === true) onAbort();
    void operation.then((value) => finish(undefined, value), (error: unknown) => (
      finish(error instanceof Error ? error : new FlightFailure('UNEXPECTED_OUTPUT'))
    ));
  });
}

function readHumanWithSignal(operation: Promise<string>, signal?: AbortSignal): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const onAbort = (): void => rejectPromise(abortFlightFailure(signal));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted === true) onAbort();
    void operation.then(
      (value) => {
        signal?.removeEventListener('abort', onAbort);
        resolvePromise(value);
      },
      () => {
        signal?.removeEventListener('abort', onAbort);
        rejectPromise(signal?.aborted === true
          ? abortFlightFailure(signal)
          : new FlightFailure('IPC_EOF'));
      },
    );
  });
}

function abortFlightFailure(signal?: AbortSignal): FlightFailure {
  if (signal?.reason === DA5_V5_INPUT_ORDER_ABORT_REASON) {
    return new FlightFailure('NONCE_OR_ORDER_MISMATCH');
  }
  if (signal?.reason === DA5_V5_INPUT_EOF_ABORT_REASON) {
    return new FlightFailure('IPC_EOF');
  }
  return new FlightFailure('SIGNAL');
}

function waitWithSignal(operation: Promise<void>, signal?: AbortSignal): Promise<void> {
  return readHumanWithSignal(operation.then(() => ''), signal).then(() => undefined);
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function isAbsolute(path: string): boolean {
  return resolve(path) === path && !path.includes('\0');
}
