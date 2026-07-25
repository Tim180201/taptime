import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import {
  DA5_V5_ADB_SERVER_SOCKET,
  createDa5V5AdbChildEnvironment,
} from '../../scripts/da5V5AdbChildEnvironment.mjs';
import {
  SystemDa5V5AndroidAdbRunner,
} from '../../scripts/da5V5AndroidDevice.mjs';

describe('DA5 V5 ADB child-process boundary', () => {
  it('passes only PATH and the fixed loopback socket and also pins routing with CLI arguments',
    async () => {
      let observedArguments: readonly string[] = [];
      let observedEnvironment: Readonly<Record<string, string | undefined>> = {};
      let spawnCount = 0;
      const spawnCommand = (
        _command: string,
        arguments_: readonly string[],
        options: { readonly env?: Readonly<Record<string, string | undefined>> },
      ) => {
        spawnCount += 1;
        observedArguments = arguments_;
        observedEnvironment = options.env ?? {};
        return fakeAdbChild('List of devices attached\n');
      };
      const runner = new SystemDa5V5AndroidAdbRunner({
        environment: {
          AWS_SECRET_ACCESS_KEY: 'must-not-cross',
          DATABASE_URL: 'postgresql://secret',
          HOME: '/private/home',
          PATH: '/safe/bin',
          TAPTIME_DA5_V5_TAG_A_FINGERPRINT: 'must-not-cross',
          TAPTIME_SYNTHETIC_E2E_PASSWORD: 'must-not-cross',
        },
        spawn: spawnCommand as never,
      });

      await expect(runner.run(['devices', '-l'])).resolves.toBe(
        'List of devices attached\n',
      );
      expect(spawnCount).toBe(1);
      expect(observedArguments).toEqual([
        '-H',
        '127.0.0.1',
        '-P',
        '5037',
        'devices',
        '-l',
      ]);
      expect(observedEnvironment).toEqual({
        ADB_SERVER_SOCKET: DA5_V5_ADB_SERVER_SOCKET,
        PATH: '/safe/bin',
      });
    });

  it.each([
    'ADB_SERVER_SOCKET',
    'ADB_VENDOR_KEYS',
    'ADB_MDNS_AUTO_CONNECT',
    'ANDROID_ADB_SERVER_ADDRESS',
    'ANDROID_ADB_SERVER_PORT',
    'ANDROID_SERIAL',
  ])('rejects hostile %s routing input before spawning adb', async (name) => {
    let spawnCount = 0;
    const spawnCommand = () => {
      spawnCount += 1;
      return fakeAdbChild('');
    };
    const runner = new SystemDa5V5AndroidAdbRunner({
      environment: {
        [name]: 'hostile',
        PATH: '/safe/bin',
      },
      spawn: spawnCommand as never,
    });

    await expect(runner.run(['devices', '-l'])).rejects.toThrow(
      /routing environment override is forbidden/,
    );
    expect(spawnCount).toBe(0);
  });

  it('rejects an unavailable or control-character PATH', () => {
    for (const environment of [
      {},
      { PATH: '' },
      { PATH: '/safe/bin\n/hostile' },
    ]) {
      expect(() => createDa5V5AdbChildEnvironment(environment)).toThrow(
        /child PATH is unavailable/,
      );
    }
  });

  it('digests exact non-UTF8 stdout bytes and settles only after child close', async () => {
    const child = controlledAdbChild();
    let observedArguments: readonly string[] = [];
    const runner = new SystemDa5V5AndroidAdbRunner({
      environment: { PATH: '/safe/bin' },
      spawn: ((
        _command: string,
        arguments_: readonly string[],
      ) => {
        observedArguments = arguments_;
        return child;
      }) as never,
    });
    const chunks = [
      Buffer.from([0xff, 0x00, 0xc3, 0x28]),
      Buffer.from([0x80, 0x81, 0xfe, 0x7f, 0x0a]),
    ];
    const expected = Buffer.concat(chunks);
    const operation = runner.runBinaryDigest(
      ['-s', 'opaque-device', 'shell', '-T', 'cat', '--', '/data/app/exact/base.apk'],
      { maximumBytes: expected.length, timeoutMilliseconds: 5_000 },
    );
    const settlement = observeSettlement(operation);

    for (const chunk of chunks) {
      child.stdout.write(chunk);
    }
    await flushMicrotasks();
    expect(settlement.state()).toBe('pending');

    child.emit('close', 0);
    await expect(operation).resolves.toEqual({
      bytes: expected.length,
      sha256: createHash('sha256').update(expected).digest('hex'),
    });
    expect(observedArguments).toEqual([
      '-H',
      '127.0.0.1',
      '-P',
      '5037',
      '-s',
      'opaque-device',
      'shell',
      '-T',
      'cat',
      '--',
      '/data/app/exact/base.apk',
    ]);
  });

  it('kills on maximumBytes overflow but rejects only after child close', async () => {
    const child = controlledAdbChild();
    const runner = binaryRunner(child);
    const operation = runner.runBinaryDigest(['devices'], {
      maximumBytes: 4,
      timeoutMilliseconds: 5_000,
    });
    const settlement = observeSettlement(operation);

    child.stdout.write(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]));
    await flushMicrotasks();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settlement.state()).toBe('pending');

    child.emit('close', 0);
    await expect(operation).rejects.toThrow(/output exceeded its bound/);
  });

  it('keeps abort rejection pending until the child closes', async () => {
    const child = controlledAdbChild();
    const runner = binaryRunner(child);
    const controller = new AbortController();
    const operation = runner.runBinaryDigest(['devices'], {
      maximumBytes: 4,
      signal: controller.signal,
      timeoutMilliseconds: 5_000,
    });
    const settlement = observeSettlement(operation);

    controller.abort();
    await flushMicrotasks();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settlement.state()).toBe('pending');

    child.emit('close', null, 'SIGTERM');
    await expect(operation).rejects.toThrow(/command aborted/);
  });

  it('keeps child-process errors pending until the child closes', async () => {
    const child = controlledAdbChild();
    const runner = binaryRunner(child);
    const operation = runner.runBinaryDigest(['devices'], {
      maximumBytes: 4,
      timeoutMilliseconds: 5_000,
    });
    const settlement = observeSettlement(operation);

    child.emit('error', new Error('synthetic child failure'));
    await flushMicrotasks();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settlement.state()).toBe('pending');

    child.emit('close', 1);
    await expect(operation).rejects.toThrow(/device command failed/);
  });

  it.each([
    [
      'child-process',
      (child: ControlledAdbChild) => {
        child.emit('error', new Error('synthetic child failure'));
      },
      /device command failed/,
    ],
    [
      'stdout-stream',
      (child: ControlledAdbChild) => {
        child.stdout.emit('error', new Error('synthetic stdout failure'));
      },
      /device command failed/,
    ],
    [
      'stderr-stream',
      (child: ControlledAdbChild) => {
        child.stderr.emit('error', new Error('synthetic stderr failure'));
      },
      /device command failed/,
    ],
    [
      'stdin-stream',
      (child: ControlledAdbChild) => {
        child.stdin.emit('error', new Error('synthetic stdin failure'));
      },
      /device input failed/,
    ],
  ] as const)(
    'keeps stdin %s errors and input lifetime pending until child close',
    async (_label, fail, expectedError) => {
      const child = controlledAdbChild();
      const runner = stdinRunner(child);
      const stdinBytes = Buffer.from('verified-apk-snapshot');
      const operation = runner.run(['shell', '-T', 'cat'], {
        stdinBytes,
        timeoutMilliseconds: 5_000,
      });
      const settlement = observeSettlement(operation);
      const inputLifetime = observeInputLifetime(operation);

      fail(child);
      await flushMicrotasks();
      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(settlement.state()).toBe('pending');
      expect(inputLifetime.released()).toBe(false);
      expect(stdinBytes.toString('utf8')).toBe('verified-apk-snapshot');

      child.emit('close', 1);
      await expect(operation).rejects.toThrow(expectedError);
      expect(inputLifetime.released()).toBe(true);
      expectRunnerListenersRemoved(child);
    },
  );

  it('keeps stdin abort and input lifetime pending until child close', async () => {
    const child = controlledAdbChild();
    const runner = stdinRunner(child);
    const controller = new AbortController();
    const stdinBytes = Buffer.from('verified-apk-snapshot');
    const operation = runner.run(['shell', '-T', 'cat'], {
      signal: controller.signal,
      stdinBytes,
      timeoutMilliseconds: 5_000,
    });
    const settlement = observeSettlement(operation);
    const inputLifetime = observeInputLifetime(operation);

    controller.abort();
    child.stdout.emit('error', new Error('later stdout failure'));
    child.stdin.emit('error', new Error('later stdin failure'));
    await flushMicrotasks();
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settlement.state()).toBe('pending');
    expect(inputLifetime.released()).toBe(false);

    child.emit('close', null, 'SIGTERM');
    await expect(operation).rejects.toThrow(/command aborted/);
    expect(inputLifetime.released()).toBe(true);
    expectRunnerListenersRemoved(child);
  });

  it('keeps stdin output overflow and input lifetime pending until child close', async () => {
    const child = controlledAdbChild();
    const runner = stdinRunner(child);
    const stdinBytes = Buffer.from('verified-apk-snapshot');
    const operation = runner.run(['shell', '-T', 'cat'], {
      stdinBytes,
      timeoutMilliseconds: 5_000,
    });
    const settlement = observeSettlement(operation);
    const inputLifetime = observeInputLifetime(operation);

    child.stdout.write(Buffer.alloc((4 * 1024 * 1024) + 1, 0x61));
    await flushMicrotasks();
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settlement.state()).toBe('pending');
    expect(inputLifetime.released()).toBe(false);

    child.emit('close', 0);
    await expect(operation).rejects.toThrow(/output exceeded its bound/);
    expect(inputLifetime.released()).toBe(true);
    expectRunnerListenersRemoved(child);
  });

  it('keeps stdin timeout pending through SIGTERM and SIGKILL until child close', async () => {
    vi.useFakeTimers();
    try {
      const child = controlledAdbChild();
      const runner = stdinRunner(child);
      const stdinBytes = Buffer.from('verified-apk-snapshot');
      const operation = runner.run(['shell', '-T', 'cat'], {
        stdinBytes,
        timeoutMilliseconds: 10,
      });
      const settlement = observeSettlement(operation);
      const inputLifetime = observeInputLifetime(operation);

      await vi.advanceTimersByTimeAsync(10);
      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(child.kill).toHaveBeenLastCalledWith('SIGTERM');
      expect(settlement.state()).toBe('pending');
      expect(inputLifetime.released()).toBe(false);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(child.kill).toHaveBeenCalledTimes(2);
      expect(child.kill).toHaveBeenLastCalledWith('SIGKILL');
      expect(settlement.state()).toBe('pending');
      expect(inputLifetime.released()).toBe(false);

      child.emit('close', null, 'SIGKILL');
      await expect(operation).rejects.toThrow(/command timed out/);
      expect(inputLifetime.released()).toBe(true);
      expectRunnerListenersRemoved(child);
    } finally {
      vi.useRealTimers();
    }
  });
});

function fakeAdbChild(stdoutValue: string) {
  const child = new EventEmitter() as EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    stderr: PassThrough;
    stdin: PassThrough;
    stdout: PassThrough;
  };
  child.kill = vi.fn();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  queueMicrotask(() => {
    child.stdout.end(stdoutValue);
    child.stderr.end();
    child.emit('close', 0);
  });
  return child;
}

function controlledAdbChild() {
  const child = new EventEmitter() as EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    stderr: PassThrough;
    stdin: PassThrough;
    stdout: PassThrough;
  };
  child.kill = vi.fn();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  return child;
}

function binaryRunner(child: ReturnType<typeof controlledAdbChild>) {
  return new SystemDa5V5AndroidAdbRunner({
    environment: { PATH: '/safe/bin' },
    spawn: (() => child) as never,
  });
}

type ControlledAdbChild = ReturnType<typeof controlledAdbChild>;

function stdinRunner(child: ControlledAdbChild) {
  return new SystemDa5V5AndroidAdbRunner({
    environment: { PATH: '/safe/bin' },
    spawn: (() => child) as never,
  });
}

function observeSettlement(operation: Promise<unknown>): {
  state(): 'fulfilled' | 'pending' | 'rejected';
} {
  let state: 'fulfilled' | 'pending' | 'rejected' = 'pending';
  void operation.then(
    () => {
      state = 'fulfilled';
    },
    () => {
      state = 'rejected';
    },
  );
  return {
    state: () => state,
  };
}

function observeInputLifetime(operation: Promise<unknown>): {
  released(): boolean;
} {
  let released = false;
  void operation.then(
    () => {
      released = true;
    },
    () => {
      released = true;
    },
  );
  return {
    released: () => released,
  };
}

function expectRunnerListenersRemoved(child: ControlledAdbChild): void {
  expect(child.listenerCount('error')).toBe(0);
  expect(child.stdout.listenerCount('data')).toBe(0);
  expect(child.stdout.listenerCount('error')).toBe(0);
  expect(child.stderr.listenerCount('data')).toBe(0);
  expect(child.stderr.listenerCount('error')).toBe(0);
  expect(child.stdin.listenerCount('drain')).toBe(0);
  expect(child.stdin.listenerCount('error')).toBe(0);
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
