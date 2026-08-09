import { createInterface, type Interface } from 'node:readline';
import { Writable } from 'node:stream';
import { Da5V5InputOwnership } from './Da5V5OperatorLifecycle.js';

export async function readDa5V5HiddenCredential(
  ownership: Da5V5InputOwnership,
  input: NodeJS.ReadStream,
  publishReady: () => void,
): Promise<Buffer> {
  if (ownership.command() === null || !input.isTTY) {
    throw new Error('DA5 V5 credential input requires an interactive terminal');
  }

  const mutedOutput = new Writable({
    decodeStrings: true,
    write(chunk, _encoding, callback) {
      if (Buffer.isBuffer(chunk)) chunk.fill(0);
      callback();
    },
  });
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
