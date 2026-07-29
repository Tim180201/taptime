import { spawn } from 'node:child_process';

import {
  createDa5V5AdbChildEnvironment,
} from './da5V5AdbChildEnvironment.mjs';

export const DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES =
  Object.freeze({
    childExitMismatch: 'adb_child_exit_mismatch',
    childTimeoutMismatch: 'adb_child_timeout_mismatch',
    childTransportMismatch: 'adb_child_transport_mismatch',
    stdinPipeAbortMismatch: 'adb_stdin_pipe_abort_mismatch',
  });

const adbServerArguments = Object.freeze([
  '-H',
  '127.0.0.1',
  '-P',
  '5037',
]);
const outputMaximumBytes = 4 * 1024 * 1024;
const writeChunkBytes = 1024 * 1024;

export class SystemDa5V5ValidationInstallStreamRunner {
  constructor(dependencies = {}) {
    this.dependencies = Object.freeze({
      environment: dependencies.environment ?? process.env,
      spawn: dependencies.spawn ?? spawn,
    });
  }

  install(arguments_, options = {}) {
    return runInstallStream(arguments_, options, this.dependencies);
  }
}

function runInstallStream(arguments_, options, dependencies) {
  return new Promise((resolvePromise) => {
    const mismatch = (
      category,
      childTerminal = false,
      stdoutTerminal = false,
    ) => Object.freeze({
      category,
      childTerminal,
      status: 'mismatch',
      stdoutTerminal,
    });
    const transportMismatch = () => mismatch(
      DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
        .childTransportMismatch,
    );
    if (
      !Array.isArray(arguments_)
      || arguments_.some((argument) => (
        typeof argument !== 'string'
        || argument.length === 0
        || /[\0\r\n]/u.test(argument)
      ))
      || !Buffer.isBuffer(options.stdinBytes)
      || options.stdinBytes.length === 0
      || !Number.isSafeInteger(options.timeoutMilliseconds)
      || options.timeoutMilliseconds <= 0
      || options.signal?.aborted === true
    ) {
      resolvePromise(transportMismatch());
      return;
    }

    let environment;
    let child;
    try {
      environment = createDa5V5AdbChildEnvironment(
        dependencies.environment,
      );
      child = dependencies.spawn(
        'adb',
        [...adbServerArguments, ...arguments_],
        {
          env: environment,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
    } catch {
      resolvePromise(transportMismatch());
      return;
    }

    const stdinBytes = options.stdinBytes;
    const timeoutMilliseconds = options.timeoutMilliseconds;
    const terminationBudget = Math.min(
      2_000,
      Math.max(50, Math.floor(timeoutMilliseconds / 2)),
    );
    const terminationGrace = Math.min(
      1_000,
      Math.max(10, Math.floor(terminationBudget / 2)),
    );
    let childClosed = false;
    let childCode;
    let childSignal;
    let firstFailureCategory;
    let forceKillSent = false;
    let forceKillTimeout;
    let forceSettleTimeout;
    let offset = 0;
    let settled = false;
    let stdinFinished = false;
    let stdinPipeAborted = false;
    let stdout = '';
    let stdoutBytes = 0;
    let stdoutEnded = false;
    let stderrBytes = 0;

    const timeout = setTimeout(() => {
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTimeoutMismatch,
      );
    }, Math.max(0, timeoutMilliseconds - terminationBudget));
    const hardTimeout = setTimeout(() => {
      firstFailureCategory ??=
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTimeoutMismatch;
      forceKill();
      finishMismatch(true);
    }, timeoutMilliseconds);

    function abort() {
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      );
    }

    function terminate(category) {
      if (settled || firstFailureCategory !== undefined) return;
      firstFailureCategory = category;
      try {
        child.kill('SIGTERM');
      } catch {
        // The bounded forced settlement remains authoritative.
      }
      forceKillTimeout = setTimeout(forceKill, terminationGrace);
      forceSettleTimeout = setTimeout(() => {
        forceKill();
        finishMismatch(true);
      }, terminationBudget);
    }

    function forceKill() {
      if (forceKillSent) return;
      forceKillSent = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // The Promise still settles at the absolute timeout.
      }
    }

    function removeListeners() {
      options.signal?.removeEventListener('abort', abort);
      child.removeListener('error', onChildError);
      child.removeListener('close', onChildClose);
      child.stdout.removeListener('data', onStdoutData);
      child.stdout.removeListener('end', onStdoutEnd);
      child.stdout.removeListener('error', onStdoutError);
      child.stderr.removeListener('data', onStderrData);
      child.stderr.removeListener('error', onStderrError);
      if (child.stdin !== null) {
        child.stdin.removeListener('drain', writeStdin);
        child.stdin.removeListener('error', onStdinError);
        child.stdin.removeListener('finish', onStdinFinish);
      }
    }

    function finish(outcome, abandoned = false) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(hardTimeout);
      clearTimeout(forceKillTimeout);
      clearTimeout(forceSettleTimeout);
      removeListeners();
      if (abandoned) {
        absorbLateChildErrors(child);
        try {
          child.stdin?.destroy();
          child.stdout.destroy();
          child.stderr.destroy();
          child.unref?.();
        } catch {
          // Resource abandonment cannot prevent terminal settlement.
        }
      }
      resolvePromise(outcome);
    }

    function finishMismatch(abandoned = false) {
      finish(
        mismatch(
          firstFailureCategory
            ?? DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
              .childTransportMismatch,
          childClosed,
          stdoutEnded,
        ),
        abandoned,
      );
    }

    function maybeFinish() {
      if (settled || !childClosed || !stdoutEnded) return;
      if (firstFailureCategory !== undefined) {
        finishMismatch();
        return;
      }
      if (childCode !== 0 || childSignal !== null) {
        finish(mismatch(
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
            .childExitMismatch,
          true,
          true,
        ));
        return;
      }
      if (!stdinFinished && !stdinPipeAborted) {
        return;
      }
      if (stdinPipeAborted && offset < stdinBytes.length) {
        finish(mismatch(
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
            .stdinPipeAbortMismatch,
          true,
          true,
        ));
        return;
      }
      finish(Object.freeze({
        status: 'match',
        stdinTerminal: stdinPipeAborted
          ? 'all_bytes_submitted_then_pipe_closed'
          : 'finished',
        stdout,
      }));
    }

    function onStdoutData(chunk) {
      if (firstFailureCategory !== undefined) return;
      const chunkBytes = Buffer.byteLength(chunk);
      if (stdoutBytes + chunkBytes > outputMaximumBytes) {
        terminate(
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
            .childTransportMismatch,
        );
        return;
      }
      stdoutBytes += chunkBytes;
      stdout += chunk;
    }

    function onStdoutEnd() {
      stdoutEnded = true;
      maybeFinish();
    }

    function onStderrData(chunk) {
      if (firstFailureCategory !== undefined) return;
      stderrBytes += chunk.length;
      if (stderrBytes > outputMaximumBytes) {
        terminate(
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
            .childTransportMismatch,
        );
      }
    }

    function onStdoutError() {
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      );
    }

    function onStderrError() {
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      );
    }

    function onStdinError(error) {
      if (
        error?.code === 'EPIPE'
        || error?.code === 'ECONNRESET'
      ) {
        stdinPipeAborted = true;
        child.stdin?.removeListener('drain', writeStdin);
        maybeFinish();
        return;
      }
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      );
    }

    function onStdinFinish() {
      stdinFinished = true;
      maybeFinish();
    }

    function onChildError() {
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      );
    }

    function onChildClose(code, signal) {
      if (childClosed) return;
      childClosed = true;
      childCode = code;
      childSignal = signal;
      maybeFinish();
    }

    function writeStdin() {
      if (
        settled
        || firstFailureCategory !== undefined
        || stdinPipeAborted
        || child.stdin === null
      ) {
        return;
      }
      try {
        while (offset < stdinBytes.length) {
          const end = Math.min(
            offset + writeChunkBytes,
            stdinBytes.length,
          );
          const writable = child.stdin.write(
            stdinBytes.subarray(offset, end),
          );
          offset = end;
          if (!writable) return;
        }
        child.stdin.end();
      } catch (error) {
        onStdinError(error);
      }
    }

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', onStdoutData);
    child.stdout.once('end', onStdoutEnd);
    child.stdout.once('error', onStdoutError);
    child.stderr.on('data', onStderrData);
    child.stderr.once('error', onStderrError);
    child.once('error', onChildError);
    child.once('close', onChildClose);
    if (child.stdin === null) {
      terminate(
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      );
      return;
    }
    child.stdin.on('drain', writeStdin);
    child.stdin.once('error', onStdinError);
    child.stdin.once('finish', onStdinFinish);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted === true) {
      abort();
      return;
    }
    writeStdin();
  });
}

function absorbLateChildErrors(child) {
  const ignore = () => {};
  child.on('error', ignore);
  child.stdin?.on('error', ignore);
  child.stdout.on('error', ignore);
  child.stderr.on('error', ignore);
}
