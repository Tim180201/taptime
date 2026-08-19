import { createHash, randomBytes } from 'node:crypto';
import {
  closeSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeSync,
} from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { O_CREAT, O_EXCL, O_NOFOLLOW, O_RDONLY, O_WRONLY } from 'node:constants';
import { join, relative, resolve, sep } from 'node:path';
import {
  DA5_V5_FAST_FLIGHT_PLAN_SHA256,
  DA5_V5_INPUT_EOF_ABORT_REASON,
  DA5_V5_INPUT_ORDER_ABORT_REASON,
  DA5_V5_OS_SIGNAL_ABORT_REASON,
  da5V5FlightIdentity,
  type Da5V5FlightRunResult,
  type Da5V5HumanInput,
  type Da5V5HumanPrompt,
} from './Da5V5FlightController.js';
import { Da5V5FlightCredentialCapture } from './Da5V5SecretInput.js';

export const DA5_V5_TERMINAL_OUTCOME_CLASSES = Object.freeze([
  'PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN',
  'PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN',
  'PRE_CONTROLLER_TERMINAL_IO_FAILURE_NO_CHILD_PROVEN',
  'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN',
  'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED',
  'CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED',
  'CONTROLLER_MANAGED_OR_UNPROVEN',
] as const);

export type Da5V5TerminalOutcomeClass =
  (typeof DA5_V5_TERMINAL_OUTCOME_CLASSES)[number];
export type Da5V5TerminalInputState =
  | 'DETACHED'
  | 'QUARANTINED'
  | 'FLIGHT_INPUT'
  | 'HUMAN_INPUT'
  | 'ACK'
  | 'CLOSED';

export const DA5_V5_FLIGHT_CREDENTIAL_PROMPT: Da5V5HumanPrompt = Object.freeze({
  action: 'Enter the bound credential exactly once through hidden terminal input.',
  allowed_response: Object.freeze(['EXACT_64_LOWERCASE_HEX_SECRET']),
  button: 'none',
  do_not: 'Do not paste to a visible field, log, file, environment or clipboard.',
  field: 'hidden credential input',
  screen: 'DA5 V5 Flight Supervisor',
});

export interface Da5V5FlightSupervisorController {
  run(): Promise<Da5V5FlightRunResult>;
}

export interface Da5V5FlightSupervisorOptions {
  readonly bindingSetId: string;
  readonly createController: (input: Readonly<{
    readonly credential: Buffer;
    readonly humanInput: Da5V5HumanInput;
    readonly runNonce: string;
    readonly signal: AbortSignal;
  }>) => Da5V5FlightSupervisorController;
  readonly credentialPrompt?: Da5V5HumanPrompt;
  readonly evidenceParentPath: string;
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WriteStream;
  readonly repositoryRootPath: string;
}

export type Da5V5TerminalEnvelopeFaultPoint =
  | 'parent-validate'
  | 'collision-check'
  | 'stage-mkdir'
  | 'receipt-open'
  | 'receipt-write'
  | 'receipt-fsync'
  | 'receipt-chmod'
  | 'manifest-open'
  | 'manifest-write'
  | 'manifest-fsync'
  | 'manifest-chmod'
  | 'stage-fsync'
  | 'stage-chmod'
  | 'pending-rename'
  | 'parent-fsync'
  | 'pending-reread'
  | 'pending-validate'
  | 'final-collision-check'
  | 'final-rename';

export interface Da5V5FlightSupervisorDependencies {
  readonly createRunNonce: () => string;
  readonly fault: (point: Da5V5TerminalEnvelopeFaultPoint) => void;
  readonly installSignalHandlers: (handler: () => void) => () => void;
  readonly outputFlushTimeoutMilliseconds: number;
  readonly verifySameTty: (input: NodeJS.ReadStream, output: NodeJS.WriteStream) => boolean;
}

export interface Da5V5FlightSupervisorResult {
  readonly close_acknowledged: boolean;
  readonly evidence_status: 'SEALED' | 'EVIDENCE_UNSEALED';
  readonly exit_code: 0 | 1;
  readonly final_root: string | null;
  readonly outcome_class: Da5V5TerminalOutcomeClass | 'EVIDENCE_UNSEALED';
  readonly run_id: string;
  readonly terminal_outcome_published: boolean;
}

const DA5_V5_TERMINAL_OUTPUT_ABORT_REASON = 'DA5_V5_TERMINAL_OUTPUT_FAILURE' as const;
const defaultOutputFlushTimeoutMilliseconds = 5_000;

export class Da5V5FlightSupervisorStartError extends Error {
  constructor(readonly code: 'INPUT_ALREADY_ATTACHED' | 'INPUT_ENCODING_ACTIVE'
    | 'INPUT_OWNER_PRESENT' | 'RAW_MODE_SETUP_FAILED' | 'RAW_MODE_UNAVAILABLE'
    | 'SAME_TTY_REQUIRED' | 'TTY_REQUIRED') {
    super('DA5 V5 flight supervisor start rejected');
  }
}

export async function runDa5V5FlightSupervisor(
  options: Da5V5FlightSupervisorOptions,
  dependencies: Partial<Da5V5FlightSupervisorDependencies> = {},
): Promise<Da5V5FlightSupervisorResult> {
  requireSupervisorOptions(options);
  const operations: Da5V5FlightSupervisorDependencies = Object.freeze({
    createRunNonce: dependencies.createRunNonce
      ?? (() => randomBytes(32).toString('hex')),
    fault: dependencies.fault ?? (() => undefined),
    installSignalHandlers: dependencies.installSignalHandlers
      ?? installPersistentSignalHandlers,
    outputFlushTimeoutMilliseconds: requireOutputFlushTimeout(
      dependencies.outputFlushTimeoutMilliseconds
        ?? defaultOutputFlushTimeoutMilliseconds,
    ),
    verifySameTty: dependencies.verifySameTty ?? verifySameTerminalDevice,
  });
  const controllerAbort = new AbortController();
  const postCommitAbort = new AbortController();
  let postCommitPhase = false;
  let signalLatch = 0;
  let outputFailureLatch = 0;
  const uninstallSignals = operations.installSignalHandlers(() => {
    signalLatch += 1;
    if (postCommitPhase) {
      if (!postCommitAbort.signal.aborted) {
        postCommitAbort.abort(DA5_V5_OS_SIGNAL_ABORT_REASON);
      }
      return;
    }
    if (!controllerAbort.signal.aborted) {
      controllerAbort.abort(DA5_V5_OS_SIGNAL_ABORT_REASON);
    }
  });
  const outputOwner = new Da5V5TerminalOutputOwner(
    options.output,
    operations.outputFlushTimeoutMilliseconds,
    () => {
      outputFailureLatch += 1;
      if (!controllerAbort.signal.aborted) {
        controllerAbort.abort(DA5_V5_TERMINAL_OUTPUT_ABORT_REASON);
      }
      if (!postCommitAbort.signal.aborted) {
        postCommitAbort.abort(DA5_V5_TERMINAL_OUTPUT_ABORT_REASON);
      }
    },
  );
  const inputOwner = new Da5V5TerminalInputOwner(
    options.input,
    options.output,
    outputOwner,
    controllerAbort,
    postCommitAbort,
    operations.verifySameTty,
  );
  let credential: Buffer | null = null;
  let envelope: Da5V5TerminalEnvelope | null = null;
  let finalRoot: string | null = null;
  let outcomeClass: Da5V5TerminalOutcomeClass | 'EVIDENCE_UNSEALED' =
    'EVIDENCE_UNSEALED';
  let evidenceStatus: 'SEALED' | 'EVIDENCE_UNSEALED' = 'EVIDENCE_UNSEALED';
  let expectedInnerReceiptRoot: string | null = null;
  let controllerResult: Da5V5FlightRunResult | null = null;
  let controllerReturned = false;
  let runId = 'unavailable';
  let closeAcknowledged = false;
  let terminalOutcomePublished = false;

  try {
    outputOwner.attach();
    inputOwner.attach();
    const runNonce = requireNonce(operations.createRunNonce());
    const identity = da5V5FlightIdentity(options.bindingSetId, runNonce);
    runId = identity.runId;
    expectedInnerReceiptRoot = join(
      options.evidenceParentPath,
      `flight-${identity.receiptId}`,
    );
    envelope = new Da5V5TerminalEnvelope({
      bindingSetId: options.bindingSetId,
      evidenceParentPath: options.evidenceParentPath,
      expectedInnerReceiptRoot,
      fault: operations.fault,
      repositoryRootPath: options.repositoryRootPath,
      runId,
    });
    try {
      envelope.prepare();
    } catch {
      outcomeClass = 'EVIDENCE_UNSEALED';
    }

    if (envelope?.prepared() === true) {
      await inputOwner.drainBarrier();
      if (controllerAbort.signal.aborted) {
        outcomeClass = preControllerAbortClass(
          controllerAbort.signal,
          signalLatch,
          outputFailureLatch,
        );
      } else {
        try {
          credential = await inputOwner.requestCredential(
            options.credentialPrompt ?? DA5_V5_FLIGHT_CREDENTIAL_PROMPT,
            controllerAbort.signal,
          );
          await inputOwner.drainBarrier();
          if (controllerAbort.signal.aborted) {
            outcomeClass = preControllerAbortClass(
              controllerAbort.signal,
              signalLatch,
              outputFailureLatch,
            );
          } else {
            let controller: Da5V5FlightSupervisorController;
            try {
              controller = options.createController({
                credential,
                humanInput: inputOwner,
                runNonce,
                signal: controllerAbort.signal,
              });
            } catch {
              controller = null as unknown as Da5V5FlightSupervisorController;
              outcomeClass = 'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN';
            }
            if (outcomeClass !== 'PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN') {
              if (controllerAbort.signal.aborted) {
                outcomeClass = preControllerAbortClass(
                  controllerAbort.signal,
                  signalLatch,
                  outputFailureLatch,
                );
              } else {
                outcomeClass = 'CONTROLLER_MANAGED_OR_UNPROVEN';
                try {
                  controllerResult = await controller.run();
                  controllerReturned = true;
                  outcomeClass = controllerResult.run_id !== runId
                    || controllerResult.plan_sha256 !== DA5_V5_FAST_FLIGHT_PLAN_SHA256
                    ? 'CONTROLLER_MANAGED_OR_UNPROVEN'
                    : controllerResult.receipt_root === expectedInnerReceiptRoot
                      ? 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED'
                      : 'CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED';
                } catch {
                  outcomeClass = 'CONTROLLER_MANAGED_OR_UNPROVEN';
                }
              }
            }
          }
        } catch {
          outcomeClass = preControllerAbortClass(
            controllerAbort.signal,
            signalLatch,
            outputFailureLatch,
          );
        } finally {
          credential?.fill(0);
          credential = null;
        }
      }

      inputOwner.closeFlightInput();
      await inputOwner.drainBarrier();
      try {
        const classifiedOutcome = outcomeClass;
        const committed = envelope.commit(() => {
          if (classifiedOutcome.startsWith('CONTROLLER_')) {
            if (
              inputOwner.state() !== 'QUARANTINED'
              || !controllerReturned
              || inputOwner.violationLatch() !== 0
              || signalLatch !== 0
              || controllerAbort.signal.aborted
            ) {
              return 'CONTROLLER_MANAGED_OR_UNPROVEN';
            }
            return classifiedOutcome;
          }
          if (outputFailureLatch > 0) {
            return 'PRE_CONTROLLER_TERMINAL_IO_FAILURE_NO_CHILD_PROVEN';
          }
          if (signalLatch > 0) return 'PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN';
          if (inputOwner.state() !== 'QUARANTINED' || controllerAbort.signal.aborted) {
            return 'PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN';
          }
          return classifiedOutcome;
        });
        finalRoot = committed.finalPath;
        outcomeClass = committed.outcome;
        evidenceStatus = 'SEALED';
      } catch {
        outcomeClass = 'EVIDENCE_UNSEALED';
        evidenceStatus = 'EVIDENCE_UNSEALED';
        finalRoot = null;
      }
    }

    inputOwner.closeFlightInput();
    postCommitPhase = true;
    const terminalPublicationReady = inputOwner.beginTerminalPublication();
    if (terminalPublicationReady) {
      try {
        await publishTerminalOutcome(outputOwner, {
          evidenceStatus,
          outcomeClass,
          runId,
        }, postCommitAbort.signal);
        terminalOutcomePublished = !outputOwner.failed()
          && !postCommitAbort.signal.aborted;
      } catch {
        terminalOutcomePublished = false;
      }
    }
    if (terminalOutcomePublished && inputOwner.armCloseAcknowledgement()) {
      closeAcknowledged = await inputOwner.requestClose(
        postCommitAbort.signal,
      ).catch(() => false);
    }
  } finally {
    zeroBuffer(credential);
    credential = null;
    inputOwner.close();
    outputOwner.close();
    uninstallSignals();
  }

  const exitCode = controllerResult !== null
    && outcomeClass === 'CONTROLLER_RETURNED_INNER_RECEIPT_SEALED'
    && controllerResult.failure_reason === null
    && controllerResult.cleanup === 'MATCH'
    && controllerResult.attempted_outcome === 'PASS'
    && controllerResult.plan_sha256 === DA5_V5_FAST_FLIGHT_PLAN_SHA256
    && controllerResult.receipt_root === expectedInnerReceiptRoot
    && controllerResult.run_id === runId
    && inputOwner.violationLatch() === 0
    && !inputOwner.restorationFailed()
    && signalLatch === 0
    && outputFailureLatch === 0
    && !controllerAbort.signal.aborted
    && evidenceStatus === 'SEALED'
    && terminalOutcomePublished
    && closeAcknowledged
    ? 0
    : 1;
  return Object.freeze({
    close_acknowledged: closeAcknowledged,
    evidence_status: evidenceStatus,
    exit_code: exitCode,
    final_root: finalRoot,
    outcome_class: outcomeClass,
    run_id: runId,
    terminal_outcome_published: terminalOutcomePublished,
  });
}

class Da5V5TerminalOutputOwner {
  private activeWrite = false;
  private attached = false;
  private closed = false;
  private failedValue = false;
  private unusableValue = false;
  private readonly failureAbort = new AbortController();

  constructor(
    private readonly output: NodeJS.WriteStream,
    private readonly timeoutMilliseconds: number,
    private readonly onFailure: () => void,
  ) {}

  attach(): void {
    if (this.attached || this.closed) {
      throw new Da5V5FlightSupervisorStartError('INPUT_ALREADY_ATTACHED');
    }
    this.output.on('error', this.onOutputFailure);
    this.output.on('close', this.onOutputFailure);
    this.attached = true;
    if (this.output.destroyed || this.output.writableEnded) this.latchFailure();
  }

  failed(): boolean {
    return this.failedValue || this.unusableValue;
  }

  write(
    value: string,
    signal?: AbortSignal,
    afterFlush?: () => void,
  ): Promise<void> {
    if (
      !this.attached
      || this.closed
      || this.failedValue
      || this.unusableValue
      || this.activeWrite
      || value.length === 0
      || signal?.aborted === true
    ) {
      return Promise.reject(terminalOutputError());
    }
    this.activeWrite = true;
    return new Promise<void>((resolvePromise, rejectPromise) => {
      let settled = false;
      const timer = setTimeout(() => this.latchFailure(), this.timeoutMilliseconds);
      const finish = (success: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        this.failureAbort.signal.removeEventListener('abort', onFailure);
        this.activeWrite = false;
        if (!success) {
          rejectPromise(terminalOutputError());
          return;
        }
        try {
          afterFlush?.();
          resolvePromise();
        } catch {
          rejectPromise(terminalOutputError());
        }
      };
      const onAbort = (): void => this.latchUnusable();
      const onFailure = (): void => finish(false);
      signal?.addEventListener('abort', onAbort, { once: true });
      this.failureAbort.signal.addEventListener('abort', onFailure, { once: true });
      if (signal?.aborted === true) {
        finish(false);
        return;
      }
      if (this.failureAbort.signal.aborted) {
        finish(false);
        return;
      }
      try {
        this.output.write(value, (error) => {
          if (settled) return;
          if (error !== undefined && error !== null) {
            this.latchFailure();
            finish(false);
            return;
          }
          finish(!this.failedValue && !this.unusableValue && signal?.aborted !== true);
        });
      } catch {
        this.latchFailure();
        finish(false);
      }
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.latchUnusable();
    try { this.output.off('error', this.onOutputFailure); } catch { /* output is closing */ }
    try { this.output.off('close', this.onOutputFailure); } catch { /* output is closing */ }
    this.attached = false;
  }

  private readonly onOutputFailure = (): void => this.latchFailure();

  private latchFailure(): void {
    if (this.failedValue) return;
    this.failedValue = true;
    this.onFailure();
    if (!this.failureAbort.signal.aborted) {
      this.failureAbort.abort(DA5_V5_TERMINAL_OUTPUT_ABORT_REASON);
    }
  }

  private latchUnusable(): void {
    if (this.unusableValue) return;
    this.unusableValue = true;
    if (!this.failureAbort.signal.aborted) this.failureAbort.abort();
  }
}

export class Da5V5TerminalInputOwner implements Da5V5HumanInput {
  private active: ActiveCapture | null = null;
  private attached = false;
  private acknowledgementPrepared = false;
  private acknowledgementStarted = false;
  private closed = false;
  private flightInputClosed = false;
  private orderViolated = false;
  private orderViolationLatch = 0;
  private settleScheduled = false;
  private stateValue: Da5V5TerminalInputState = 'DETACHED';
  private terminalRestorationFailed = false;
  private terminalPublicationPrepared = false;
  private terminalPublicationViolationLatch = 0;
  private wasRaw = false;

  constructor(
    private readonly input: NodeJS.ReadStream,
    private readonly output: NodeJS.WriteStream,
    private readonly outputOwner: Da5V5TerminalOutputOwner,
    private readonly controllerAbort: AbortController,
    private readonly postCommitAbort: AbortController,
    private readonly verifySameTty: (
      input: NodeJS.ReadStream,
      output: NodeJS.WriteStream,
    ) => boolean,
  ) {}

  attach(): void {
    if (this.attached) throw new Da5V5FlightSupervisorStartError('INPUT_ALREADY_ATTACHED');
    if (this.input.isTTY !== true || this.output.isTTY !== true) {
      throw new Da5V5FlightSupervisorStartError('TTY_REQUIRED');
    }
    if (!this.verifySameTty(this.input, this.output)) {
      throw new Da5V5FlightSupervisorStartError('SAME_TTY_REQUIRED');
    }
    if (this.input.readableEncoding !== null) {
      throw new Da5V5FlightSupervisorStartError('INPUT_ENCODING_ACTIVE');
    }
    if (
      this.input.listenerCount('data') !== 0
      || this.input.listenerCount('readable') !== 0
      || this.input.readableFlowing === true
    ) {
      throw new Da5V5FlightSupervisorStartError('INPUT_OWNER_PRESENT');
    }
    if (typeof this.input.setRawMode !== 'function') {
      throw new Da5V5FlightSupervisorStartError('RAW_MODE_UNAVAILABLE');
    }
    this.wasRaw = this.input.isRaw === true;
    this.stateValue = 'QUARANTINED';
    this.input.on('data', this.onData);
    this.input.once('end', this.onEnd);
    this.input.once('close', this.onEnd);
    this.input.on('error', this.onError);
    try {
      this.input.setRawMode(true);
      this.input.resume();
      this.attached = true;
    } catch {
      try { this.input.setRawMode(this.wasRaw); } catch { /* best-effort restoration */ }
      try { this.input.pause(); } catch { /* best-effort restoration */ }
      this.detachListeners();
      this.stateValue = 'CLOSED';
      throw new Da5V5FlightSupervisorStartError('RAW_MODE_SETUP_FAILED');
    }
  }

  state(): Da5V5TerminalInputState {
    return this.stateValue;
  }

  violationLatch(): number {
    return this.orderViolationLatch;
  }

  restorationFailed(): boolean {
    return this.terminalRestorationFailed;
  }

  closeFlightInput(): void {
    if (this.flightInputClosed) return;
    this.flightInputClosed = true;
    if (this.active !== null) this.markOrderViolation();
  }

  beginTerminalPublication(): boolean {
    if (
      this.closed
      || !this.attached
      || !this.flightInputClosed
      || this.active !== null
      || this.stateValue !== 'QUARANTINED'
    ) {
      return false;
    }
    this.terminalPublicationPrepared = true;
    this.terminalPublicationViolationLatch = this.orderViolationLatch;
    this.orderViolated = false;
    return true;
  }

  armCloseAcknowledgement(): boolean {
    if (
      !this.terminalPublicationPrepared
      || this.closed
      || !this.attached
      || this.active !== null
      || this.orderViolated
      || this.orderViolationLatch !== this.terminalPublicationViolationLatch
      || this.stateValue !== 'QUARANTINED'
    ) {
      return false;
    }
    this.acknowledgementPrepared = true;
    return true;
  }

  async requestCredential(
    prompt: Da5V5HumanPrompt,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const result = await this.beginCapture(
      'credential',
      'FLIGHT_INPUT',
      `${JSON.stringify(prompt)}\n`,
      signal,
    );
    if (!Buffer.isBuffer(result)) throw new Error('DA5 V5 flight input rejected');
    return result;
  }

  async request(prompt: Da5V5HumanPrompt, signal?: AbortSignal): Promise<string> {
    const response = await this.beginCapture(
      'human',
      'HUMAN_INPUT',
      `da5_v5_human_prompt=${canonicalJson(prompt)}\n`
        + `response[${prompt.allowed_response.join('|')}]> `,
      signal,
    );
    if (typeof response !== 'string') throw new Error('DA5 V5 Human input rejected');
    return response;
  }

  async requestClose(signal?: AbortSignal): Promise<boolean> {
    if (this.closed) return false;
    this.cancelActive(true);
    this.stateValue = 'QUARANTINED';
    const response = await this.beginCapture(
      'ack',
      'ACK',
      `${JSON.stringify({
        action: 'Acknowledge the published terminal outcome status and close this Supervisor.',
        allowed_response: ['CLOSE'],
        button: 'none',
        do_not: 'Do not enter a credential, PASS, command, retry, resume, or start request.',
        field: 'terminal outcome acknowledgement',
        screen: 'DA5 V5 Flight Supervisor',
      })}\n`,
      signal,
    );
    return response === true;
  }

  async drainBarrier(): Promise<void> {
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
  }

  close(): void {
    if (!this.attached && this.stateValue === 'CLOSED') return;
    this.closed = true;
    this.cancelActive(true);
    this.detachListeners();
    const restoreTerminal = this.attached;
    this.attached = false;
    this.stateValue = 'CLOSED';
    if (restoreTerminal) {
      try { this.input.setRawMode(this.wasRaw); } catch { this.terminalRestorationFailed = true; }
      try { this.input.pause(); } catch { this.terminalRestorationFailed = true; }
    }
  }

  private beginCapture(
    kind: ActiveCapture['kind'],
    openState: 'FLIGHT_INPUT' | 'HUMAN_INPUT' | 'ACK',
    prompt: string,
    signal?: AbortSignal,
  ): Promise<Buffer | string | true> {
    if (
      this.closed
      || !this.attached
      || this.stateValue !== 'QUARANTINED'
      || this.active !== null
      || this.orderViolated
      || (kind === 'ack'
        ? !this.acknowledgementPrepared || this.acknowledgementStarted
        : this.flightInputClosed)
      || signal?.aborted === true
    ) {
      return Promise.reject(new Error('DA5 V5 terminal input order mismatch'));
    }
    return new Promise<Buffer | string | true>((resolvePromise, rejectPromise) => {
      const capture: ActiveCapture = {
        buffer: kind === 'credential' ? null : Buffer.alloc(64),
        credential: kind === 'credential' ? new Da5V5FlightCredentialCapture() : null,
        gated: false,
        kind,
        offset: 0,
        openState,
        reject: rejectPromise,
        resolve: resolvePromise,
        signal,
        terminated: false,
      };
      if (kind === 'ack') this.acknowledgementStarted = true;
      const onAbort = (): void => this.failActive(false);
      capture.onAbort = onAbort;
      signal?.addEventListener('abort', onAbort, { once: true });
      this.active = capture;
      try {
        void this.outputOwner.write(prompt, signal, () => {
          if (this.active !== capture || this.orderViolated || signal?.aborted === true) {
            return;
          }
          capture.gated = true;
          this.stateValue = openState;
        }).then(() => {
          if (
            this.active !== capture
            || !capture.gated
            || this.orderViolated
            || signal?.aborted === true
          ) {
            this.failActive(false);
          }
        }, () => this.failActive(false));
      } catch {
        this.failActive(false);
      }
    });
  }

  private readonly onData = (value: Buffer | string): void => {
    if (!Buffer.isBuffer(value)) {
      this.markOrderViolation();
      return;
    }
    if (
      this.closed
      || this.stateValue === 'CLOSED'
    ) {
      value.fill(0);
      return;
    }
    const capture = this.active;
    if (
      this.stateValue === 'QUARANTINED'
      || capture === null
      || !capture.gated
      || this.stateValue !== capture.openState
    ) {
      value.fill(0);
      this.markOrderViolation();
      return;
    }
    try {
      if (capture.kind === 'credential') {
        capture.credential?.push(value);
        if (capture.credential?.terminated() === true) this.scheduleSettle(capture);
      } else {
        this.pushNonSecret(capture, value);
        if (capture.terminated) this.scheduleSettle(capture);
      }
    } catch {
      value.fill(0);
      this.markOrderViolation();
    }
  };

  private readonly onEnd = (): void => {
    if (this.closed) return;
    this.closed = true;
    this.stateValue = 'CLOSED';
    this.failActive(false);
    if (!this.controllerAbort.signal.aborted) {
      this.controllerAbort.abort(DA5_V5_INPUT_EOF_ABORT_REASON);
    }
    if (!this.postCommitAbort.signal.aborted) {
      this.postCommitAbort.abort(DA5_V5_INPUT_EOF_ABORT_REASON);
    }
  };

  private readonly onError = (): void => this.onEnd();

  private pushNonSecret(capture: ActiveCapture, chunk: Buffer): void {
    let invalid = false;
    try {
      for (const byte of chunk) {
        if (capture.terminated) {
          invalid = true;
          continue;
        }
        if (byte === 0x0d || byte === 0x0a) {
          capture.terminated = true;
          continue;
        }
        if (
          capture.buffer === null
          || capture.offset >= capture.buffer.byteLength
          || !((byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x5a))
        ) {
          invalid = true;
          continue;
        }
        capture.buffer[capture.offset] = byte;
        capture.offset += 1;
      }
    } finally {
      chunk.fill(0);
    }
    if (invalid) throw new Error('DA5 V5 terminal input rejected');
  }

  private scheduleSettle(capture: ActiveCapture): void {
    if (this.settleScheduled) return;
    this.settleScheduled = true;
    setImmediate(() => setImmediate(() => {
      this.settleScheduled = false;
      if (this.active !== capture || this.orderViolated || !capture.gated) return;
      try {
        let result: Buffer | string | true;
        if (capture.kind === 'credential') {
          result = capture.credential?.settle()
            ?? (() => { throw new Error('DA5 V5 flight input rejected'); })();
        } else {
          if (!capture.terminated || capture.offset === 0 || capture.buffer === null) {
            throw new Error('DA5 V5 terminal input rejected');
          }
          if (capture.kind === 'ack') {
            const matched = capture.offset === 5
              && capture.buffer.subarray(0, capture.offset).equals(Buffer.from('CLOSE', 'ascii'));
            if (!matched) throw new Error('DA5 V5 terminal input rejected');
            result = true;
          } else {
            result = capture.buffer.subarray(0, capture.offset).toString('ascii');
          }
        }
        this.releaseCapture(capture);
        this.stateValue = 'QUARANTINED';
        capture.resolve(result);
      } catch {
        this.markOrderViolation();
      }
    }));
  }

  private markOrderViolation(): void {
    this.orderViolated = true;
    this.orderViolationLatch += 1;
    if (!this.controllerAbort.signal.aborted) {
      this.controllerAbort.abort(DA5_V5_INPUT_ORDER_ABORT_REASON);
    }
    this.failActive(false);
  }

  private failActive(markViolation: boolean): void {
    if (markViolation) this.orderViolated = true;
    const capture = this.active;
    if (capture === null) return;
    this.releaseCapture(capture);
    this.stateValue = this.closed ? 'CLOSED' : 'QUARANTINED';
    capture.reject(new Error('DA5 V5 terminal input rejected'));
  }

  private cancelActive(reject: boolean): void {
    const capture = this.active;
    if (capture === null) return;
    this.releaseCapture(capture);
    if (reject) capture.reject(new Error('DA5 V5 terminal input rejected'));
  }

  private releaseCapture(capture: ActiveCapture): void {
    capture.signal?.removeEventListener('abort', capture.onAbort ?? (() => undefined));
    capture.credential?.destroy();
    capture.buffer?.fill(0);
    this.active = null;
  }

  private detachListeners(): void {
    this.input.off('data', this.onData);
    this.input.off('end', this.onEnd);
    this.input.off('close', this.onEnd);
    this.input.off('error', this.onError);
  }
}

interface ActiveCapture {
  readonly buffer: Buffer | null;
  readonly credential: Da5V5FlightCredentialCapture | null;
  gated: boolean;
  readonly kind: 'credential' | 'human' | 'ack';
  offset: number;
  onAbort?: () => void;
  readonly openState: 'FLIGHT_INPUT' | 'HUMAN_INPUT' | 'ACK';
  readonly reject: (error: Error) => void;
  readonly resolve: (value: Buffer | string | true) => void;
  readonly signal?: AbortSignal;
  terminated: boolean;
}

class Da5V5TerminalEnvelope {
  private commitAttempted = false;
  private fileExpectations: readonly BoundFileExpectation[] = Object.freeze([]);
  private parentIdentity: BoundDirectoryIdentity | null = null;
  private pendingPath: string | null = null;
  private pendingIdentity: BoundDirectoryIdentity | null = null;
  private preparedValue = false;
  private readonly finalPaths: Readonly<Record<Da5V5TerminalOutcomeClass, string>>;
  private readonly commitResults: Readonly<Record<
    Da5V5TerminalOutcomeClass,
    Readonly<{ readonly finalPath: string; readonly outcome: Da5V5TerminalOutcomeClass }>
  >>;

  constructor(private readonly options: Readonly<{
    readonly bindingSetId: string;
    readonly evidenceParentPath: string;
    readonly expectedInnerReceiptRoot: string;
    readonly fault: (point: Da5V5TerminalEnvelopeFaultPoint) => void;
    readonly repositoryRootPath: string;
    readonly runId: string;
  }>) {
    this.finalPaths = Object.freeze(Object.fromEntries(
      DA5_V5_TERMINAL_OUTCOME_CLASSES.map((outcome) => [
        outcome,
        join(options.evidenceParentPath, `flight-terminal-${options.runId}-${outcome}`),
      ]),
    ) as Record<Da5V5TerminalOutcomeClass, string>);
    this.commitResults = Object.freeze(Object.fromEntries(
      DA5_V5_TERMINAL_OUTCOME_CLASSES.map((outcome) => [
        outcome,
        Object.freeze({ finalPath: this.finalPaths[outcome], outcome }),
      ]),
    ) as Record<
      Da5V5TerminalOutcomeClass,
      Readonly<{ readonly finalPath: string; readonly outcome: Da5V5TerminalOutcomeClass }>
    >);
  }

  prepared(): boolean {
    return this.preparedValue;
  }

  prepare(): void {
    this.options.fault('parent-validate');
    const parentIdentity = requirePrivateEvidenceParent(
      this.options.evidenceParentPath,
      this.options.repositoryRootPath,
    );
    const parent = parentIdentity.realpath;
    const stage = join(parent, `.flight-terminal-${this.options.runId}.stage`);
    const pending = join(parent, `.flight-terminal-${this.options.runId}.pending`);
    this.options.fault('collision-check');
    assertPathsAbsent([stage, pending, ...Object.values(this.finalPaths)]);
    const mapping = Object.freeze(Object.fromEntries(
      DA5_V5_TERMINAL_OUTCOME_CLASSES.map((outcome) => [outcome, this.finalPaths[outcome]]),
    ));
    const receipt = Object.freeze({
      authority: 'NON_AUTHORITATIVE_PENDING_PATH_ONLY',
      binding_set_id: this.options.bindingSetId,
      commit_rule: 'ONLY_THE_SELECTED_FINAL_PATH_RENAME_CLASSIFIES_THE_OUTCOME',
      expected_inner_receipt_root: this.options.expectedInnerReceiptRoot,
      inner_receipt_authority: 'CONTROLLER_RECEIPT_ONLY',
      limitations: Object.freeze([
        'NO_PRODUCT_OR_CLEANUP_CLAIM',
        'NO_DYNAMIC_INNER_DIGEST',
        'UNCATCHABLE_PROCESS_LOSS_EXCLUDED',
      ]),
      outcome_path_mapping: mapping,
      plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
      run_id: this.options.runId,
      schema_version: 1,
    });
    const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8');
    const manifestBytes = Buffer.from(`${canonicalJson(Object.freeze({
      authority: 'NON_AUTHORITATIVE_PENDING_PATH_ONLY',
      files: Object.freeze([
        Object.freeze({
          bytes: receiptBytes.byteLength,
          mode: '0444',
          name: 'terminal-receipt.json',
          sha256: sha256(receiptBytes),
        }),
        Object.freeze({
          mode: '0444',
          name: 'evidence-manifest.json',
          self_digest: 'EXTERNAL_ONLY_TO_AVOID_SELF_REFERENCE',
        }),
      ]),
      schema_version: 1,
    }))}\n`, 'utf8');
    try {
      this.options.fault('stage-mkdir');
      mkdirSync(stage, { mode: 0o700 });
      const stageBeforeSeal = captureDirectoryIdentity(stage, 0o700);
      const receiptExpectation = writeExclusiveAndSync(
        join(stage, 'terminal-receipt.json'),
        receiptBytes,
        this.options.fault,
        'receipt',
      );
      const manifestExpectation = writeExclusiveAndSync(
        join(stage, 'evidence-manifest.json'),
        manifestBytes,
        this.options.fault,
        'manifest',
      );
      this.options.fault('stage-fsync');
      sealDirectory(stage, stageBeforeSeal, this.options.fault);
      const stageIdentity = captureDirectoryIdentity(stage, 0o555);
      assertSameNode(stageBeforeSeal, stageIdentity);
      this.options.fault('pending-rename');
      assertPathsAbsent([pending]);
      renameSync(stage, pending);
      const pendingIdentity = captureDirectoryIdentity(pending, 0o555);
      assertSameNode(stageIdentity, pendingIdentity);
      this.options.fault('parent-fsync');
      syncDirectory(parent, parentIdentity);
      this.options.fault('pending-reread');
      this.options.fault('pending-validate');
      const fileExpectations = Object.freeze([
        receiptExpectation,
        manifestExpectation,
      ]);
      validateEvidenceRoot(
        parent,
        parentIdentity,
        pending,
        pendingIdentity,
        fileExpectations,
      );
      this.parentIdentity = parentIdentity;
      this.pendingPath = pending;
      this.pendingIdentity = pendingIdentity;
      this.fileExpectations = fileExpectations;
      this.preparedValue = true;
    } catch {
      throw new Error('DA5 V5 terminal envelope preparation failed');
    } finally {
      receiptBytes.fill(0);
      manifestBytes.fill(0);
    }
  }

  commit(
    selectOutcome: () => Da5V5TerminalOutcomeClass,
  ): Readonly<{ readonly finalPath: string; readonly outcome: Da5V5TerminalOutcomeClass }> {
    if (
      this.commitAttempted
      || !this.preparedValue
      || this.pendingPath === null
      || this.pendingIdentity === null
      || this.parentIdentity === null
    ) {
      throw new Error('DA5 V5 terminal envelope commit mismatch');
    }
    this.commitAttempted = true;
    this.options.fault('final-collision-check');
    assertPathsAbsent(Object.values(this.finalPaths));
    this.options.fault('final-rename');
    validateEvidenceRoot(
      this.options.evidenceParentPath,
      this.parentIdentity,
      this.pendingPath,
      this.pendingIdentity,
      this.fileExpectations,
    );
    assertPathsAbsent(Object.values(this.finalPaths));
    const outcome = selectOutcome();
    const committed = this.commitResults[outcome];
    renameSync(this.pendingPath, committed.finalPath);
    return committed;
  }
}

interface BoundDirectoryIdentity {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly nlink: bigint;
  readonly realpath: string;
  readonly uid: bigint;
}

interface BoundFileExpectation {
  readonly bytes: bigint;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly name: 'evidence-manifest.json' | 'terminal-receipt.json';
  readonly nlink: bigint;
  readonly sha256: string;
  readonly uid: bigint;
}

function writeExclusiveAndSync(
  path: string,
  bytes: Buffer,
  fault: (point: Da5V5TerminalEnvelopeFaultPoint) => void,
  kind: 'receipt' | 'manifest',
): BoundFileExpectation {
  fault(`${kind}-open`);
  const descriptor = openSync(path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    requireRegularFile(opened, 0o600, 1n);
    fault(`${kind}-write`);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = writeSync(
        descriptor,
        bytes,
        offset,
        bytes.byteLength - offset,
      );
      if (written <= 0) throw new Error('DA5 V5 terminal envelope write mismatch');
      offset += written;
    }
    fault(`${kind}-fsync`);
    fsyncSync(descriptor);
    fault(`${kind}-chmod`);
    fchmodSync(descriptor, 0o444);
    fsyncSync(descriptor);
    const sealed = fstatSync(descriptor, { bigint: true });
    requireRegularFile(sealed, 0o444, 1n);
    if (sealed.size !== BigInt(bytes.byteLength)) {
      throw new Error('DA5 V5 terminal envelope file mismatch');
    }
    return Object.freeze({
      bytes: sealed.size,
      dev: sealed.dev,
      ino: sealed.ino,
      mode: sealed.mode,
      name: kind === 'receipt' ? 'terminal-receipt.json' : 'evidence-manifest.json',
      nlink: sealed.nlink,
      sha256: sha256(bytes),
      uid: sealed.uid,
    });
  } finally { closeSync(descriptor); }
}

function sealDirectory(
  path: string,
  expected: BoundDirectoryIdentity,
  fault: (point: Da5V5TerminalEnvelopeFaultPoint) => void,
): void {
  const descriptor = openSync(path, O_RDONLY | O_NOFOLLOW);
  try {
    assertDirectoryDescriptor(descriptor, expected, 0o700);
    fsyncSync(descriptor);
    fault('stage-chmod');
    fchmodSync(descriptor, 0o555);
    fsyncSync(descriptor);
    const sealed = fstatSync(descriptor, { bigint: true });
    requireDirectory(sealed, 0o555);
    if (!sameNodeStats(sealed, expected)) {
      throw new Error('DA5 V5 terminal envelope root mismatch');
    }
  } finally { closeSync(descriptor); }
}

function syncDirectory(path: string, expected: BoundDirectoryIdentity): void {
  const descriptor = openSync(path, O_RDONLY | O_NOFOLLOW);
  try {
    assertDirectoryDescriptor(descriptor, expected, permissionBits(expected.mode));
    fsyncSync(descriptor);
  } finally { closeSync(descriptor); }
}

function requirePrivateEvidenceParent(
  path: string,
  repositoryRootPath: string,
): BoundDirectoryIdentity {
  if (resolve(path) !== path || path.includes('\0')) {
    throw new Error('DA5 V5 terminal evidence parent mismatch');
  }
  const parent = realpathSync(path);
  const repository = realpathSync(repositoryRootPath);
  const requestedStatus = lstatSync(path, { bigint: true });
  if (
    parent !== path
    || !requestedStatus.isDirectory()
    || requestedStatus.isSymbolicLink()
    || typeof process.geteuid !== 'function'
    || requestedStatus.uid !== BigInt(process.geteuid())
    || (requestedStatus.mode & 0o022n) !== 0n
    || isWithin(repository, parent)
  ) {
    throw new Error('DA5 V5 terminal evidence parent mismatch');
  }
  const identity = captureDirectoryIdentity(path, permissionBits(requestedStatus.mode));
  if (!sameNodeStats(requestedStatus, identity)) {
    throw new Error('DA5 V5 terminal evidence parent mismatch');
  }
  return identity;
}

function captureDirectoryIdentity(path: string, permissions: number): BoundDirectoryIdentity {
  const before = lstatSync(path, { bigint: true });
  requireDirectory(before, permissions);
  if (before.isSymbolicLink() || realpathSync(path) !== path) {
    throw new Error('DA5 V5 terminal envelope directory mismatch');
  }
  const descriptor = openSync(path, O_RDONLY | O_NOFOLLOW);
  try {
    const inside = fstatSync(descriptor, { bigint: true });
    requireDirectory(inside, permissions);
    const after = lstatSync(path, { bigint: true });
    requireDirectory(after, permissions);
    if (!sameNodeStats(before, inside) || !sameNodeStats(inside, after)) {
      throw new Error('DA5 V5 terminal envelope directory mismatch');
    }
    return Object.freeze({
      dev: inside.dev,
      ino: inside.ino,
      mode: inside.mode,
      nlink: inside.nlink,
      realpath: path,
      uid: inside.uid,
    });
  } finally { closeSync(descriptor); }
}

function validateEvidenceRoot(
  parentPath: string,
  parentIdentity: BoundDirectoryIdentity,
  rootPath: string,
  rootIdentity: BoundDirectoryIdentity,
  files: readonly BoundFileExpectation[],
): void {
  assertDirectoryIdentity(parentPath, parentIdentity, false);
  assertDirectoryIdentity(rootPath, rootIdentity, true);
  const names = readdirSync(rootPath).sort();
  if (canonicalJson(names) !== '["evidence-manifest.json","terminal-receipt.json"]') {
    throw new Error('DA5 V5 terminal envelope inventory mismatch');
  }
  const inodes = new Set<string>();
  for (const file of files) {
    const filePath = join(rootPath, file.name);
    const before = lstatSync(filePath, { bigint: true });
    assertFileIdentity(before, file);
    const descriptor = openSync(filePath, O_RDONLY | O_NOFOLLOW);
    let observed: Buffer | null = null;
    try {
      const insideBeforeRead = fstatSync(descriptor, { bigint: true });
      assertFileIdentity(insideBeforeRead, file);
      observed = readFileSync(descriptor);
      const insideAfterRead = fstatSync(descriptor, { bigint: true });
      assertFileIdentity(insideAfterRead, file);
      if (
        BigInt(observed.byteLength) !== file.bytes
        || sha256(observed) !== file.sha256
      ) {
        throw new Error('DA5 V5 terminal envelope payload mismatch');
      }
    } finally {
      observed?.fill(0);
      closeSync(descriptor);
    }
    const after = lstatSync(filePath, { bigint: true });
    assertFileIdentity(after, file);
    const inode = `${file.dev.toString(10)}:${file.ino.toString(10)}`;
    if (inodes.has(inode)) {
      throw new Error('DA5 V5 terminal envelope inode mismatch');
    }
    inodes.add(inode);
  }
  assertDirectoryIdentity(rootPath, rootIdentity, true);
  assertDirectoryIdentity(parentPath, parentIdentity, false);
}

function assertDirectoryIdentity(
  path: string,
  expected: BoundDirectoryIdentity,
  compareLinkCount: boolean,
): void {
  if (realpathSync(path) !== expected.realpath) {
    throw new Error('DA5 V5 terminal envelope directory mismatch');
  }
  const before = lstatSync(path, { bigint: true });
  requireDirectory(before, permissionBits(expected.mode));
  if (before.isSymbolicLink() || !sameDirectoryStats(before, expected, compareLinkCount)) {
    throw new Error('DA5 V5 terminal envelope directory mismatch');
  }
  const descriptor = openSync(path, O_RDONLY | O_NOFOLLOW);
  try {
    const inside = fstatSync(descriptor, { bigint: true });
    requireDirectory(inside, permissionBits(expected.mode));
    if (!sameDirectoryStats(inside, expected, compareLinkCount)) {
      throw new Error('DA5 V5 terminal envelope directory mismatch');
    }
  } finally { closeSync(descriptor); }
  const after = lstatSync(path, { bigint: true });
  if (!sameDirectoryStats(after, expected, compareLinkCount)) {
    throw new Error('DA5 V5 terminal envelope directory mismatch');
  }
}

function assertDirectoryDescriptor(
  descriptor: number,
  expected: BoundDirectoryIdentity,
  permissions: number,
): void {
  const observed = fstatSync(descriptor, { bigint: true });
  requireDirectory(observed, permissions);
  if (!sameNodeStats(observed, expected)) {
    throw new Error('DA5 V5 terminal envelope directory mismatch');
  }
}

function assertFileIdentity(
  observed: BigIntStats,
  expected: BoundFileExpectation,
): void {
  requireRegularFile(observed, permissionBits(expected.mode), 1n);
  if (
    observed.dev !== expected.dev
    || observed.ino !== expected.ino
    || observed.uid !== expected.uid
    || observed.mode !== expected.mode
    || observed.nlink !== expected.nlink
    || observed.size !== expected.bytes
  ) {
    throw new Error('DA5 V5 terminal envelope file identity mismatch');
  }
}

function assertPathsAbsent(paths: readonly string[]): void {
  for (const path of paths) {
    try {
      lstatSync(path, { bigint: true });
    } catch (error) {
      if (isMissingPathError(error)) continue;
      throw error;
    }
    throw new Error('DA5 V5 terminal envelope collision');
  }
}

function requireDirectory(status: BigIntStats, permissions: number): void {
  if (!status.isDirectory() || permissionBits(status.mode) !== permissions) {
    throw new Error('DA5 V5 terminal envelope directory mismatch');
  }
}

function requireRegularFile(
  status: BigIntStats,
  permissions: number,
  links: bigint,
): void {
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || permissionBits(status.mode) !== permissions
    || status.nlink !== links
  ) {
    throw new Error('DA5 V5 terminal envelope file mismatch');
  }
}

function assertSameNode(
  expected: BoundDirectoryIdentity,
  observed: BoundDirectoryIdentity,
): void {
  if (!sameNodeStats(expected, observed)) {
    throw new Error('DA5 V5 terminal envelope root mismatch');
  }
}

function sameNodeStats(
  left: Pick<BigIntStats, 'dev' | 'ino' | 'uid'>,
  right: Pick<BigIntStats, 'dev' | 'ino' | 'uid'>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid;
}

function sameDirectoryStats(
  observed: BigIntStats,
  expected: BoundDirectoryIdentity,
  compareLinkCount: boolean,
): boolean {
  return sameNodeStats(observed, expected)
    && observed.mode === expected.mode
    && (!compareLinkCount || observed.nlink === expected.nlink);
}

function permissionBits(mode: bigint): number {
  return Number(mode & 0o777n);
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function preControllerAbortClass(
  signal: AbortSignal,
  signalLatch: number,
  outputFailureLatch: number,
): Da5V5TerminalOutcomeClass {
  if (
    outputFailureLatch > 0
    || signal.reason === DA5_V5_TERMINAL_OUTPUT_ABORT_REASON
  ) {
    return 'PRE_CONTROLLER_TERMINAL_IO_FAILURE_NO_CHILD_PROVEN';
  }
  return signalLatch > 0 || signal.reason === DA5_V5_OS_SIGNAL_ABORT_REASON
    ? 'PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN'
    : 'PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN';
}

async function publishTerminalOutcome(
  output: Da5V5TerminalOutputOwner,
  value: Readonly<{
    readonly evidenceStatus: 'SEALED' | 'EVIDENCE_UNSEALED';
    readonly outcomeClass: Da5V5TerminalOutcomeClass | 'EVIDENCE_UNSEALED';
    readonly runId: string;
  }>,
  signal?: AbortSignal,
): Promise<void> {
  await output.write(`da5_v5_flight_terminal=${canonicalJson(Object.freeze({
    authority: 'CONSUMED',
    close_ack: 'REQUIRED',
    evidence_status: value.evidenceStatus,
    outcome_class: value.outcomeClass,
    product_and_cleanup_authority: 'INNER_CONTROLLER_RECEIPT_ONLY',
    retry_resume_or_start: 'FORBIDDEN',
    run_id: value.runId,
    schema_version: 1,
  }))}\n`, signal);
}

function installPersistentSignalHandlers(handler: () => void): () => void {
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
  process.on('SIGHUP', handler);
  return () => {
    process.removeListener('SIGINT', handler);
    process.removeListener('SIGTERM', handler);
    process.removeListener('SIGHUP', handler);
  };
}

function verifySameTerminalDevice(
  input: NodeJS.ReadStream,
  output: NodeJS.WriteStream,
): boolean {
  const inputFd = (input as NodeJS.ReadStream & { readonly fd?: unknown }).fd;
  const outputFd = (output as NodeJS.WriteStream & { readonly fd?: unknown }).fd;
  if (!Number.isSafeInteger(inputFd) || !Number.isSafeInteger(outputFd)) return false;
  try {
    const inputStatus = fstatSync(inputFd as number);
    const outputStatus = fstatSync(outputFd as number);
    return inputStatus.isCharacterDevice()
      && outputStatus.isCharacterDevice()
      && inputStatus.dev === outputStatus.dev
      && inputStatus.ino === outputStatus.ino
      && inputStatus.rdev === outputStatus.rdev;
  } catch {
    return false;
  }
}

function requireSupervisorOptions(options: Da5V5FlightSupervisorOptions): void {
  if (
    !/^[0-9a-f]{64}$/u.test(options.bindingSetId)
    || resolve(options.evidenceParentPath) !== options.evidenceParentPath
    || resolve(options.repositoryRootPath) !== options.repositoryRootPath
    || typeof options.createController !== 'function'
  ) {
    throw new Error('DA5 V5 flight supervisor binding mismatch');
  }
}

function requireNonce(value: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error('DA5 V5 flight supervisor nonce mismatch');
  }
  return value;
}

function requireOutputFlushTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 30_000) {
    throw new Error('DA5 V5 terminal output binding mismatch');
  }
  return value;
}

function terminalOutputError(): Error {
  return new Error('DA5 V5 terminal output failed');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('DA5 V5 terminal encoding mismatch');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function zeroBuffer(value: Buffer | null): void {
  value?.fill(0);
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && resolve(path) !== path);
}
