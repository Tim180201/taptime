import { closeSync, read } from 'node:fs';
import { createInterface, type Interface } from 'node:readline';
import { Writable } from 'node:stream';
import { Da5V5InputOwnership } from './Da5V5OperatorLifecycle.js';

export const DA5_V5_CREDENTIAL_FD = 3;
export const DA5_V5_CREDENTIAL_FRAME_BYTES = 64;
const credentialFrameMaximumBytes = DA5_V5_CREDENTIAL_FRAME_BYTES + 1;
const credentialFrameTimeoutMilliseconds = 5_000;

export async function readDa5V5FlightCredential(
  input: NodeJS.ReadStream,
  publishReady: () => void,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (!input.isTTY) {
    throw new Error('DA5 V5 credential input requires an interactive terminal');
  }

  const mutedOutput = createMutedOutput();
  const secretInput = createInterface({
    input,
    output: mutedOutput,
    terminal: true,
    historySize: 0,
  });
  let capture: ReturnType<typeof captureCredential> | null = null;
  try {
    capture = captureCredential(secretInput, input);
    void capture.result.catch(() => undefined);
    publishReady();
    const candidate = await awaitCredentialCapture(capture.result, signal);
    capture.release(candidate);
    return candidate;
  } finally {
    capture?.destroy();
    secretInput.close();
    mutedOutput.destroy();
  }
}

function awaitCredentialCapture(
  operation: Promise<Buffer>,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (signal === undefined) return operation;
  return new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const onAbort = (): void => rejectPromise(new Error('DA5 V5 credential input cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    void operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolvePromise(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        rejectPromise(error);
      },
    );
  });
}

export function readDa5V5CredentialFrame(
  fileDescriptor: number = DA5_V5_CREDENTIAL_FD,
  timeoutMilliseconds: number = credentialFrameTimeoutMilliseconds,
): Promise<Buffer> {
  if (
    !Number.isSafeInteger(fileDescriptor)
    || fileDescriptor < DA5_V5_CREDENTIAL_FD
    || !Number.isSafeInteger(timeoutMilliseconds)
    || timeoutMilliseconds < 1
    || timeoutMilliseconds > 30_000
  ) {
    return Promise.reject(new Error('DA5 V5 credential frame binding is invalid'));
  }

  const observed = Buffer.alloc(credentialFrameMaximumBytes);
  return new Promise<Buffer>((resolvePromise, rejectPromise) => {
    let closed = false;
    let offset = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new Error('DA5 V5 credential frame timed out'));
    }, timeoutMilliseconds);

    const closeDescriptor = (): Error | undefined => {
      if (closed) return undefined;
      closed = true;
      try {
        closeSync(fileDescriptor);
        return undefined;
      } catch {
        return new Error('DA5 V5 credential frame close failed');
      }
    };

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const closeError = closeDescriptor();
      if (
        error === undefined
        && closeError === undefined
        && offset === DA5_V5_CREDENTIAL_FRAME_BYTES
        && isExactLowercaseHexCredential(observed.subarray(0, offset))
      ) {
        const credential = Buffer.alloc(DA5_V5_CREDENTIAL_FRAME_BYTES);
        observed.copy(credential, 0, 0, DA5_V5_CREDENTIAL_FRAME_BYTES);
        observed.fill(0);
        resolvePromise(credential);
        return;
      }
      observed.fill(0);
      rejectPromise(error ?? closeError ?? new Error('DA5 V5 credential frame rejected'));
    };

    const readNext = (): void => {
      read(
        fileDescriptor,
        observed,
        offset,
        credentialFrameMaximumBytes - offset,
        null,
        (error, bytesRead) => {
          if (settled) return;
          if (error !== null) {
            finish(new Error('DA5 V5 credential frame read failed'));
            return;
          }
          if (bytesRead === 0) {
            finish();
            return;
          }
          offset += bytesRead;
          if (offset > DA5_V5_CREDENTIAL_FRAME_BYTES) {
            finish(new Error('DA5 V5 credential frame rejected'));
            return;
          }
          readNext();
        },
      );
    };

    readNext();
  });
}

export async function readDa5V5HiddenCredential(
  ownership: Da5V5InputOwnership,
  input: NodeJS.ReadStream,
  publishReady: () => void,
): Promise<Buffer> {
  if (ownership.command() === null || !input.isTTY) {
    throw new Error('DA5 V5 credential input requires an interactive terminal');
  }

  const mutedOutput = createMutedOutput();
  let secretInput: Interface | null = null;
  let capture: ReturnType<typeof captureCredential> | null = null;
  try {
    secretInput = ownership.transferCommandToSecret(() => createInterface({
      input,
      output: mutedOutput,
      terminal: true,
      historySize: 0,
    }));
    capture = captureCredential(secretInput, input);
    void capture.result.catch(() => undefined);
    publishReady();
    const candidate = await capture.result;
    capture.release(candidate);
    return candidate;
  } finally {
    capture?.destroy();
    if (secretInput !== null) ownership.releaseSecret(secretInput);
    mutedOutput.destroy();
  }
}

function createMutedOutput(): Writable {
  return new Writable({
    decodeStrings: true,
    write(chunk, _encoding, callback) {
      if (Buffer.isBuffer(chunk)) chunk.fill(0);
      callback();
    },
  });
}

function captureCredential(
  input: Interface,
  rawInput: NodeJS.ReadStream,
): Readonly<{
  destroy(): void;
  release(candidate: Buffer): void;
  result: Promise<Buffer>;
}> {
  let retainedCandidate: Buffer | null = null;
  let settled = false;
  let cancel = (): void => undefined;
  let detachListeners = (): void => undefined;
  const result = new Promise<Buffer>((resolvePromise, rejectPromise) => {
    let lineTerminated = false;
    let optionalLineFeedPending = false;
    const rejectCapture = (message: string): void => {
      if (settled) return;
      settled = true;
      retainedCandidate?.fill(0);
      retainedCandidate = null;
      detachListeners();
      rejectPromise(new Error(message));
    };
    const onClose = (): void => {
      rejectCapture('DA5 V5 credential input closed');
    };
    const onError = (): void => {
      rejectCapture('DA5 V5 credential input failed');
    };
    const onUnexpectedLine = (): void => {
      rejectCapture('DA5 V5 credential input rejected');
    };
    const onRawData = (chunk: Buffer | string): void => {
      if (settled) {
        if (Buffer.isBuffer(chunk)) chunk.fill(0);
        return;
      }
      const observed = Buffer.from(chunk);
      try {
        for (const byte of observed) {
          if (!lineTerminated) {
            if (byte === 0x0d) {
              lineTerminated = true;
              optionalLineFeedPending = true;
            } else if (byte === 0x0a) {
              lineTerminated = true;
            }
            continue;
          }
          if (optionalLineFeedPending && byte === 0x0a) {
            optionalLineFeedPending = false;
            continue;
          }
          rejectCapture('DA5 V5 credential input rejected');
          break;
        }
      } finally {
        observed.fill(0);
        if (Buffer.isBuffer(chunk)) chunk.fill(0);
      }
    };
    detachListeners = (): void => {
      input.off('close', onClose);
      input.off('error', onError);
      input.off('line', onUnexpectedLine);
      rawInput.off('close', onClose);
      rawInput.off('data', onRawData);
      rawInput.off('end', onClose);
      rawInput.off('error', onError);
    };
    cancel = (): void => rejectCapture('DA5 V5 credential input cancelled');
    input.once('close', onClose);
    input.once('error', onError);
    input.on('line', onUnexpectedLine);
    rawInput.once('close', onClose);
    rawInput.on('data', onRawData);
    rawInput.once('end', onClose);
    rawInput.once('error', onError);
    input.question('', (answer) => {
      if (settled) return;
      let candidate: Buffer;
      try {
        candidate = Buffer.from(answer, 'utf8');
      } catch {
        rejectCapture('DA5 V5 credential input failed');
        return;
      }
      if (isExactLowercaseHexCredential(candidate)) {
        retainedCandidate = candidate;
      } else {
        candidate.fill(0);
      }
      queueMicrotask(() => {
        if (settled) return;
        if (!lineTerminated) {
          rejectCapture('DA5 V5 credential input closed');
          return;
        }
        settled = true;
        detachListeners();
        resolvePromise(retainedCandidate ?? Buffer.alloc(0));
      });
    });
  });
  return Object.freeze({
    destroy(): void {
      cancel();
      retainedCandidate?.fill(0);
      retainedCandidate = null;
      detachListeners();
    },
    release(candidate: Buffer): void {
      if (retainedCandidate === candidate) retainedCandidate = null;
    },
    result,
  });
}

function isExactLowercaseHexCredential(candidate: Buffer): boolean {
  if (candidate.length !== 64) return false;
  return candidate.every((byte) => (
    (byte >= 0x30 && byte <= 0x39)
    || (byte >= 0x61 && byte <= 0x66)
  ));
}
