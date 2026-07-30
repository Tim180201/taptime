import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  SystemDa5V5AndroidAdbRunner,
} from '../../scripts/da5V5AndroidDevice.mjs';
import {
  DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES,
  SystemDa5V5ValidationInstallStreamRunner,
} from '../../scripts/da5V5ValidationInstallStream.mjs';

const installWriteArguments = [
  '-s',
  'SAFE-SERIAL',
  'shell',
  '-T',
  '-x',
  'cmd',
  'package',
  'install-write',
  '-S',
  '262144',
  '42',
  'base.apk',
  '-',
] as const;
const childEnvironment = Object.freeze({
  PATH: process.env.PATH ?? '/usr/bin:/bin',
});

describe('DA5 V5 Validation package install stream terminal evidence', () => {
  it('reports a child-start failure only as the fixed transport category', async () => {
    const runner = new SystemDa5V5ValidationInstallStreamRunner({
      environment: childEnvironment,
      spawn: (() => {
        throw new Error('SECRET CHILD START DETAIL');
      }) as unknown as typeof spawn,
    });

    await expect(runner.write(installWriteArguments, {
      stdinBytes: Buffer.from('complete'),
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      category:
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTransportMismatch,
      childTerminal: false,
      status: 'mismatch',
      stdoutTerminal: false,
    });
  });

  it('accepts only a fully written stream with actual child/stdout completion', async () => {
    const runner = createRunner(`
      let bytes = 0;
      process.stdin.on('data', (chunk) => {
        bytes += chunk.length;
      });
      process.stdin.on('end', () => {
        process.stdout.write(
          bytes === 262144
            ? 'Success: streamed 262144 bytes\\n'
            : 'Failure [size]\\n',
        );
      });
    `);

    await expect(runner.write(installWriteArguments, {
      stdinBytes: Buffer.alloc(262_144, 0x41),
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      status: 'match',
      stdinTerminal: 'finished',
      stdout: 'Success: streamed 262144 bytes\n',
    });
  });

  it('waits through an early EPIPE until child and stdout are terminal, unlike the old generic path', async () => {
    const childSource = `
      const { closeSync } = require('node:fs');
      closeSync(0);
      setTimeout(() => {
        process.stdout.write(
          'Success: streamed 262144 bytes\\n',
          () => process.exit(0),
        );
      }, 40);
    `;
    const input = Buffer.alloc(8 * 1024 * 1024, 0x42);
    const runner = createRunner(childSource);

    await expect(runner.write(installWriteArguments, {
      stdinBytes: input,
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      status: 'match',
      stdinTerminal: 'partial_then_pipe_closed',
      stdout: 'Success: streamed 262144 bytes\n',
    });

    const oldRunner = new SystemDa5V5AndroidAdbRunner({
      environment: childEnvironment,
      spawn: spawnNodeChild(childSource),
    });
    await expect(oldRunner.run(installWriteArguments, {
      stdinBytes: Buffer.from(input),
      timeoutMilliseconds: 5_000,
    })).rejects.toThrow('DA5 V5 Android device input failed');
  });

  it('preserves a terminal Failure receipt after a partial EPIPE for the strict parser boundary', async () => {
    const runner = createRunner(`
      const { closeSync } = require('node:fs');
      closeSync(0);
      setTimeout(() => {
        process.stdout.write(
          'Failure [INSTALL_FAILED_INVALID_APK: bounded]\\n',
          () => process.exit(0),
        );
      }, 40);
    `);

    await expect(runner.write(installWriteArguments, {
      stdinBytes: Buffer.alloc(8 * 1024 * 1024, 0x43),
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      status: 'match',
      stdinTerminal: 'partial_then_pipe_closed',
      stdout: 'Failure [INSTALL_FAILED_INVALID_APK: bounded]\n',
    });
  });

  it('passes a terminal PackageManager Failure after a fully submitted EPIPE only to the strict parser boundary', async () => {
    const runner = createRunner(`
      const { closeSync } = require('node:fs');
      closeSync(0);
      setTimeout(() => {
        process.stdout.write(
          'Failure [INSTALL_FAILED_INVALID_APK: bounded]\\n',
          () => process.exit(0),
        );
      }, 40);
    `);

    await expect(runner.write(installWriteArguments, {
      stdinBytes: Buffer.alloc(1024 * 1024, 0x43),
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      status: 'match',
      stdinTerminal: 'all_bytes_submitted_then_pipe_closed',
      stdout: 'Failure [INSTALL_FAILED_INVALID_APK: bounded]\n',
    });
  });

  it('lets the absolute timeout dominate a late Success receipt', async () => {
    const runner = createRunner(`
      process.stdin.resume();
      process.stdin.on('end', () => {
        setTimeout(() => {
          process.stdout.write('Success\\n');
        }, 400);
      });
    `);

    const result = await runner.write(installWriteArguments, {
      stdinBytes: Buffer.from('complete'),
      timeoutMilliseconds: 200,
    });

    expect(result).toMatchObject({
      category:
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTimeoutMismatch,
      status: 'mismatch',
    });
    expect(result).not.toHaveProperty('stdout');
  });

  it('waits for delayed stdout and stdin terminal events after child close and ignores duplicate close events', async () => {
    const stdin = createDeferredFinishStdin();
    const stdout = new PassThrough();
    const child = createControlledChild(stdout, stdin);
    const runner = new SystemDa5V5ValidationInstallStreamRunner({
      environment: childEnvironment,
      spawn: (() => child) as unknown as typeof spawn,
    });
    let settled = false;
    const outcome = runner.write(installWriteArguments, {
      stdinBytes: Buffer.from('complete'),
      timeoutMilliseconds: 2_000,
    }).then((value) => {
      settled = true;
      return value;
    });

    await new Promise<void>((resolvePromise) => {
      setImmediate(() => {
        stdout.write('Success: streamed 262144 bytes\n');
        child.emit('close', 0, null);
        child.emit('close', 0, null);
        resolvePromise();
      });
    });
    expect(settled).toBe(false);

    stdout.end();
    await new Promise<void>((resolvePromise) => {
      setImmediate(resolvePromise);
    });
    expect(settled).toBe(false);

    stdin.emit('finish');
    await expect(outcome).resolves.toEqual({
      status: 'match',
      stdinTerminal: 'finished',
      stdout: 'Success: streamed 262144 bytes\n',
    });
  });

  it('terminates a hung child within the bound and reports only timeout evidence', async () => {
    const runner = createRunner(`
      process.stdout.write('SECRET PARTIAL PACKAGE MANAGER OUTPUT');
      process.stdin.resume();
      setInterval(() => {}, 1000);
    `);

    const result = await runner.write(installWriteArguments, {
      stdinBytes: Buffer.from('bounded'),
      timeoutMilliseconds: 250,
    });

    expect(result).toMatchObject({
      category:
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childTimeoutMismatch,
      status: 'mismatch',
    });
    expect(result).not.toHaveProperty('stdout');
    expect(result).not.toHaveProperty('error');
  });

  it('distinguishes a nonzero child exit after complete stdin/stdout settlement', async () => {
    const runner = createRunner(`
      process.stdin.resume();
      process.stdin.on('end', () => {
        process.stdout.write('Success: streamed 262144 bytes\\n', () => {
          process.exitCode = 17;
        });
      });
    `);

    await expect(runner.write(installWriteArguments, {
      stdinBytes: Buffer.from('complete'),
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      category:
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES
          .childExitMismatch,
      childTerminal: true,
      status: 'mismatch',
      stdoutTerminal: true,
    });
  });

  it('returns a fully closed malformed receipt only to the existing strict parser boundary', async () => {
    const runner = createRunner(`
      process.stdin.resume();
      process.stdin.on('end', () => {
        process.stdout.write('Success \\n');
      });
    `);

    await expect(runner.write(installWriteArguments, {
      stdinBytes: Buffer.from('complete'),
      timeoutMilliseconds: 2_000,
    })).resolves.toEqual({
      status: 'match',
      stdinTerminal: 'finished',
      stdout: 'Success \n',
    });
  });
});

function createRunner(source: string) {
  return new SystemDa5V5ValidationInstallStreamRunner({
    environment: childEnvironment,
    spawn: spawnNodeChild(source),
  });
}

function spawnNodeChild(source: string): typeof spawn {
  return ((
    _command: string,
    _arguments: readonly string[],
    options: object,
  ) => spawn(process.execPath, ['-e', source], options)
  ) as unknown as typeof spawn;
}

function createControlledChild(
  stdout: PassThrough,
  stdin: PassThrough = new PassThrough(),
) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
    kill(signal?: NodeJS.Signals): boolean;
    unref(): void;
  };
  child.stdin = stdin;
  child.stdout = stdout;
  child.stderr = new PassThrough();
  child.kill = () => true;
  child.unref = () => {};
  return child;
}

function createDeferredFinishStdin() {
  const stdin = new EventEmitter() as EventEmitter & {
    destroy(): void;
    end(): void;
    write(chunk: Uint8Array): boolean;
  };
  stdin.destroy = () => {};
  stdin.end = () => {};
  stdin.write = () => true;
  return stdin as unknown as PassThrough;
}
