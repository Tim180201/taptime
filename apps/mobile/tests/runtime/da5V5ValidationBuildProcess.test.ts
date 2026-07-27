import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  Da5V5ValidationBuildProcessController,
} from '../../scripts/da5V5ValidationBuildProcess.mjs';

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
