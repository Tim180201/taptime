import { spawn } from 'node:child_process';

const DEFAULT_TERMINATION_TIMEOUT_MILLISECONDS = 5_000;

export class Da5V5ValidationBuildSignalLatch {
  constructor(controller, target = process) {
    if (
      typeof controller?.interrupt !== 'function'
      || typeof target?.on !== 'function'
      || typeof target?.removeListener !== 'function'
    ) {
      throw new Error(
        'DA5 V5 Validation signal lifecycle is unavailable',
      );
    }
    this.controller = controller;
    this.target = target;
    this.flight = null;
    this.failure = null;
    this.closed = false;
    this.handlers = new Map(
      ['SIGINT', 'SIGTERM'].map((signal) => [
        signal,
        () => this.interrupt(signal),
      ]),
    );
    for (const [signal, handler] of this.handlers) {
      this.target.on(signal, handler);
    }
  }

  interrupt(signal) {
    if (this.closed || this.flight !== null) {
      return;
    }
    this.flight = Promise.resolve()
      .then(() => this.controller.interrupt(signal))
      .catch((error) => {
        this.failure ??= error;
      });
  }

  async settle() {
    if (this.flight !== null) {
      await this.flight;
    }
    if (this.failure !== null) {
      throw this.failure;
    }
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const [signal, handler] of this.handlers) {
      this.target.removeListener(signal, handler);
    }
  }
}

export class Da5V5ValidationBuildProcessController {
  constructor(dependencies = {}) {
    this.spawnChild = dependencies.spawnChild ?? spawn;
    this.killProcessGroup = dependencies.killProcessGroup
      ?? ((pid, signal) => process.kill(-pid, signal));
    this.scheduleTimeout = dependencies.scheduleTimeout ?? setTimeout;
    this.clearScheduledTimeout =
      dependencies.clearScheduledTimeout ?? clearTimeout;
    this.terminationTimeoutMilliseconds =
      dependencies.terminationTimeoutMilliseconds
      ?? DEFAULT_TERMINATION_TIMEOUT_MILLISECONDS;
    this.active = null;
    this.interruptedSignal = null;
    this.signalAcceptanceOpen = true;
    this.terminationFlight = null;
  }

  async run(command, args, options = {}) {
    this.assertAvailable();
    const capture = options.capture === true;
    const child = this.spawnChild(command, args, {
      cwd: options.cwd,
      detached: true,
      encoding: undefined,
      env: options.environment,
      stdio: capture
        ? ['ignore', 'pipe', 'pipe']
        : ['ignore', 'inherit', 'inherit'],
    });
    const stdout = [];
    const stderr = [];
    if (capture) {
      child.stdout?.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
      child.stderr?.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    }
    const exit = new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      child.once('error', (error) => finish({ error }));
      child.once('close', (code, signal) => finish({ code, signal }));
    });
    const active = { child, exit };
    this.active = active;

    const result = await exit;
    if (this.active === active) {
      this.active = null;
    }
    if (this.interruptedSignal !== null) {
      throw new Error(
        `DA5 V5 Validation build interrupted by ${this.interruptedSignal}`,
      );
    }
    if (
      'error' in result
      || result.code !== 0
      || result.signal !== null
    ) {
      const detail = capture
        ? Buffer.concat(stderr).toString('utf8').trim()
        : '';
      throw new Error(
        `DA5 V5 Validation build command failed: ${command}`
        + (detail.length === 0 ? '' : ` (${detail})`),
        'error' in result ? { cause: result.error } : undefined,
      );
    }
    return Object.freeze({
      stderr: Buffer.concat(stderr).toString('utf8'),
      stdout: Buffer.concat(stdout).toString('utf8'),
    });
  }

  interrupt(signal) {
    if (signal !== 'SIGINT' && signal !== 'SIGTERM') {
      return Promise.reject(
        new Error('DA5 V5 Validation interrupt signal is invalid'),
      );
    }
    if (!this.signalAcceptanceOpen) {
      return Promise.resolve();
    }
    this.interruptedSignal ??= signal;
    if (this.active === null) {
      return Promise.resolve();
    }
    if (this.terminationFlight === null) {
      this.terminationFlight = this.terminate(this.active)
        .finally(() => {
          this.terminationFlight = null;
        });
    }
    return this.terminationFlight;
  }

  async settle() {
    if (this.terminationFlight !== null) {
      await this.terminationFlight;
    }
    if (this.active !== null) {
      throw new Error(
        'DA5 V5 Validation child process remained active during cleanup',
      );
    }
  }

  async checkpoint() {
    await new Promise((resolve) => setImmediate(resolve));
    if (this.interruptedSignal !== null) {
      throw new Error(
        `DA5 V5 Validation build interrupted by ${this.interruptedSignal}`,
      );
    }
  }

  commitPublication(publication) {
    if (
      typeof publication !== 'object'
      || publication === null
      || typeof publication.commit !== 'function'
      || typeof publication.isRevocable !== 'function'
    ) {
      throw new Error(
        'DA5 V5 Validation publication receipt is unavailable',
      );
    }
    if (this.interruptedSignal !== null) {
      throw new Error(
        `DA5 V5 Validation build interrupted by ${this.interruptedSignal}`,
      );
    }
    if (
      !this.signalAcceptanceOpen
      || publication.isRevocable() !== true
    ) {
      throw new Error(
        'DA5 V5 Validation publication commit state mismatch',
      );
    }
    this.signalAcceptanceOpen = false;
    publication.commit();
  }

  getInterruptedSignal() {
    return this.interruptedSignal;
  }

  async terminate(active) {
    this.signalGroup(active.child, 'SIGTERM');
    const graceful = await this.waitBounded(active.exit);
    if (graceful) {
      return;
    }
    this.signalGroup(active.child, 'SIGKILL');
    if (!await this.waitBounded(active.exit)) {
      throw new Error(
        'DA5 V5 Validation child process cleanup timed out',
      );
    }
  }

  signalGroup(child, signal) {
    if (!Number.isSafeInteger(child.pid) || child.pid <= 0) {
      throw new Error(
        'DA5 V5 Validation child process group is unavailable',
      );
    }
    try {
      this.killProcessGroup(child.pid, signal);
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        throw error;
      }
    }
  }

  waitBounded(operation) {
    return new Promise((resolve) => {
      let settled = false;
      const timeout = this.scheduleTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, this.terminationTimeoutMilliseconds);
      void operation.then(() => {
        if (!settled) {
          settled = true;
          this.clearScheduledTimeout(timeout);
          resolve(true);
        }
      });
    });
  }

  assertAvailable() {
    if (this.interruptedSignal !== null) {
      throw new Error(
        `DA5 V5 Validation build interrupted by ${this.interruptedSignal}`,
      );
    }
    if (this.active !== null) {
      throw new Error('DA5 V5 Validation build child overlap rejected');
    }
  }
}
