import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Da5V5ValidationBuildProcessController,
} from '../../scripts/da5V5ValidationBuildProcess.mjs';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('DA5 V5 Validation build child lifecycle', () => {
  it('latches a parent-only signal and settles the process group before failure', async () => {
    const child = Object.assign(new EventEmitter(), {
      pid: 42,
      stderr: new EventEmitter(),
      stdout: new EventEmitter(),
    });
    const killProcessGroup = vi.fn((_pid: number, signal: string) => {
      if (signal === 'SIGTERM') {
        queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
      }
    });
    const controller = new Da5V5ValidationBuildProcessController({
      killProcessGroup,
      spawnChild: vi.fn(() => child),
      terminationTimeoutMilliseconds: 100,
    });

    const running = controller.run('synthetic-build', [], {
      environment: {},
    });
    const interrupted = controller.interrupt('SIGTERM');
    await expect(running).rejects.toThrow(/interrupted by SIGTERM/u);
    await expect(interrupted).resolves.toBeUndefined();
    await expect(controller.settle()).resolves.toBeUndefined();
    await expect(controller.checkpoint())
      .rejects.toThrow(/interrupted by SIGTERM/u);
    expect(killProcessGroup).toHaveBeenCalledWith(42, 'SIGTERM');
    expect(killProcessGroup).not.toHaveBeenCalledWith(42, 'SIGKILL');
    await expect(controller.run('second', []))
      .rejects.toThrow(/interrupted by SIGTERM/u);
    const publication = syntheticReceipt();
    expect(() => controller.commitPublication(publication))
      .toThrow(/interrupted by SIGTERM/u);
    expect(publication.isRevocable()).toBe(true);
  });

  it('escalates once and fails bounded when a child cannot settle', async () => {
    const child = Object.assign(new EventEmitter(), {
      pid: 84,
      stderr: new EventEmitter(),
      stdout: new EventEmitter(),
    });
    const scheduled: Array<() => void> = [];
    const controller = new Da5V5ValidationBuildProcessController({
      clearScheduledTimeout: vi.fn(),
      killProcessGroup: vi.fn(),
      scheduleTimeout: (callback: () => void) => {
        scheduled.push(callback);
        return scheduled.length;
      },
      spawnChild: vi.fn(() => child),
    });
    const running = controller.run('synthetic-build', []);
    const interrupted = controller.interrupt('SIGINT');
    scheduled.shift()?.();
    await vi.waitFor(() => expect(scheduled).toHaveLength(1));
    scheduled.shift()?.();
    await expect(interrupted).rejects.toThrow(/cleanup timed out/u);
    child.emit('close', null, 'SIGKILL');
    await expect(running).rejects.toThrow(/interrupted by SIGINT/u);
  });

  it('rolls back when a parent interrupt wins before publication commit', async () => {
    const controller = new Da5V5ValidationBuildProcessController();
    const publication = syntheticReceipt();
    await controller.interrupt('SIGINT');
    expect(() => controller.commitPublication(publication))
      .toThrow(/interrupted by SIGINT/u);
    publication.rollback();
    expect(publication.state()).toBe('rolled_back');
    expect(controller.getInterruptedSignal()).toBe('SIGINT');
  });

  it('commits atomically before a late signal and retains successful state', async () => {
    const controller = new Da5V5ValidationBuildProcessController();
    const publication = syntheticReceipt();
    controller.commitPublication(publication);
    await controller.interrupt('SIGTERM');
    expect(publication.state()).toBe('committed');
    expect(controller.getInterruptedSignal()).toBeNull();
    await expect(controller.checkpoint()).resolves.toBeUndefined();
  });

  it('keeps cleanup ownership through repeated real process signals', async () => {
    const root = mkdtempSync(
      join(tmpdir(), 'taptime-da5-validation-signal-'),
    );
    temporaryRoots.push(root);
    const outputDirectory = join(root, 'output');
    const androidDirectory = join(root, 'android');
    const packageJsonPath = join(root, 'package.json');
    const packageJsonBeforeBuild = '{"name":"synthetic-mobile"}\n';
    const signalModule = new URL(
      '../../scripts/da5V5ValidationBuildProcess.mjs',
      import.meta.url,
    ).href;
    const childScript = `
      import {
        mkdirSync,
        rmSync,
        writeFileSync,
      } from 'node:fs';
      import { join } from 'node:path';
      import {
        Da5V5ValidationBuildSignalLatch,
      } from ${JSON.stringify(signalModule)};

      const root = ${JSON.stringify(root)};
      const outputDirectory = join(root, 'output');
      const androidDirectory = join(root, 'android');
      const packageJsonPath = join(root, 'package.json');
      const packageJsonBeforeBuild = ${JSON.stringify(packageJsonBeforeBuild)};
      mkdirSync(outputDirectory);
      mkdirSync(join(outputDirectory, '.validation-staging'));
      mkdirSync(join(outputDirectory, 'validation-publication'));
      writeFileSync(join(outputDirectory, '.validation-lock'), 'owned');
      mkdirSync(androidDirectory);
      writeFileSync(join(androidDirectory, 'generated'), 'owned');
      writeFileSync(packageJsonPath, '{"name":"mutated"}\\n');

      let interruptedSignal = null;
      let releaseInterrupt;
      const interrupted = new Promise((resolve) => {
        releaseInterrupt = resolve;
      });
      const signals = new Da5V5ValidationBuildSignalLatch({
        interrupt(signal) {
          interruptedSignal ??= signal;
          releaseInterrupt();
          return Promise.resolve();
        },
      });
      const keepAlive = setInterval(() => undefined, 1_000);

      process.stdout.write('ready\\n');
      await interrupted;
      process.stdout.write('cleanup-started\\n');
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        rmSync(join(outputDirectory, '.validation-lock'));
        rmSync(join(outputDirectory, '.validation-staging'), {
          recursive: true,
        });
        rmSync(join(outputDirectory, 'validation-publication'), {
          recursive: true,
        });
        writeFileSync(packageJsonPath, packageJsonBeforeBuild);
        rmSync(androidDirectory, { recursive: true });
        await signals.settle();
      } finally {
        signals.close();
        clearInterval(keepAlive);
      }
      process.stdout.write('cleanup-complete\\n');
      process.exitCode = interruptedSignal === 'SIGINT' ? 130 : 143;
    `;
    const child = spawn(
      process.execPath,
      ['--input-type=module', '--eval', childScript],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += Buffer.from(chunk).toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += Buffer.from(chunk).toString('utf8');
    });

    await vi.waitFor(() => expect(stdout).toContain('ready\n'));
    expect(child.kill('SIGINT')).toBe(true);
    await vi.waitFor(() => expect(stdout).toContain('cleanup-started\n'));
    expect(child.kill('SIGINT')).toBe(true);
    const [code, signal] = await once(child, 'exit');

    expect({ code, signal, stderr }).toEqual({
      code: 130,
      signal: null,
      stderr: '',
    });
    expect(stdout).toContain('cleanup-complete\n');
    expect(readFileSync(packageJsonPath, 'utf8'))
      .toBe(packageJsonBeforeBuild);
    expect(readdirSync(outputDirectory)).toEqual([]);
    expect(() => readFileSync(join(androidDirectory, 'generated')))
      .toThrow();
  });
});

function syntheticReceipt() {
  let state = 'revocable';
  return {
    commit() {
      if (state !== 'revocable') throw new Error('invalid commit');
      state = 'committed';
    },
    isRevocable() {
      return state === 'revocable';
    },
    rollback() {
      if (state !== 'revocable') throw new Error('invalid rollback');
      state = 'rolled_back';
    },
    state() {
      return state;
    },
  };
}
