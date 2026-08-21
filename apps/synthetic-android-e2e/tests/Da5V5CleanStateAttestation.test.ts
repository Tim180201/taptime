import { describe, expect, it, vi } from 'vitest';
import {
  attestDa5V5CleanState,
  requireDa5V5ProductSnapshotClaim,
  type Da5V5CleanStateAttestationOptions,
  type Da5V5CleanStateDependencies,
} from '../src/Da5V5CleanStateAttestation.js';

const standardProfile = Object.freeze({
  androidApi: '35',
  androidBuild: 'bound-build',
  androidRelease: '15',
  deviceModel: 'bound-model',
  fontScale: '1.0' as const,
});

const observedProductMatch = Object.freeze({
  aggregates: Object.freeze({ equality: 'match' as const, observation: 'observed' as const }),
  invariants: Object.freeze({ equality: 'match' as const, observation: 'observed' as const }),
  queue: Object.freeze({ equality: 'match' as const, observation: 'observed' as const }),
  schema_version: 1 as const,
  tag_roles: Object.freeze({ equality: 'match' as const, observation: 'observed' as const }),
});

function options(productSnapshot: unknown = observedProductMatch): Da5V5CleanStateAttestationOptions {
  return {
    childPid: 4321,
    operatorEntrypointPath: '/bound/dist/da5V5Main.js',
    productSnapshot,
    runtimeGuardBinaryPath: '/private/tmp/bound-runtime-guard',
    standardProfile,
  };
}

function cleanDependencies(): Da5V5CleanStateDependencies {
  return {
    androidAttest: vi.fn(async () => 'match' as const),
    listPrivateTmpNames: vi.fn(async () => ['unrelated-entry']),
    runHost: vi.fn(async (executable) => executable === '/bin/ps'
      ? { exitCode: 0, stderr: '', stdout: '1 0 1 /sbin/launchd\n' }
      : { exitCode: 1, stderr: '', stdout: '' }),
  };
}

function cleanHostResult(executable: string) {
  return executable === '/bin/ps'
    ? { exitCode: 0, stderr: '', stdout: '1 0 1 /sbin/launchd\n' }
    : { exitCode: 1, stderr: '', stdout: '' };
}

describe('DA5 V5 fresh clean-state attestation', () => {
  it('matches only the exact scoped clean host, Android and Product state', async () => {
    const dependencies = cleanDependencies();

    const result = await attestDa5V5CleanState(options(), dependencies);

    expect(result).toEqual({
      android: 'match',
      bound_postgres_processes: 'match',
      checked_ports: [3000, 54321, 55435],
      operator_processes: 'match',
      owned_listeners: 'match',
      product_equality: observedProductMatch,
      schema_version: 1,
      status: 'match',
      task_roots: 'match',
    });
    expect(dependencies.androidAttest).toHaveBeenCalledOnce();
    expect(dependencies.runHost).toHaveBeenCalledTimes(4);
  });

  it('reports mismatches without deleting foreign or owned state', async () => {
    const dependencies: Da5V5CleanStateDependencies = {
      androidAttest: vi.fn(async () => 'mismatch' as const),
      listPrivateTmpNames: vi.fn(async () => ['.t5-bound']),
      runHost: vi.fn(async (executable, arguments_) => {
        if (executable === '/bin/ps') {
          return {
            exitCode: 0,
            stderr: '',
            stdout: [
              '4322 4321 4321 /usr/bin/node worker.js',
              '4323 1 4323 postgres -D /private/tmp/.t5-bound/run-1/data',
            ].join('\n'),
          };
        }
        return arguments_.includes('-iTCP:3000')
          ? { exitCode: 0, stderr: '', stdout: 'node 4324 user 10u TCP *:3000 (LISTEN)\n' }
          : { exitCode: 1, stderr: '', stdout: '' };
      }),
    };

    const result = await attestDa5V5CleanState(options(), dependencies);

    expect(result.status).toBe('mismatch');
    expect(result).toMatchObject({
      android: 'mismatch',
      bound_postgres_processes: 'mismatch',
      operator_processes: 'mismatch',
      owned_listeners: 'mismatch',
      task_roots: 'mismatch',
    });
  });

  it('accepts a process table above 64 KiB and below the dedicated 4 MiB cap', async () => {
    const processTable = Array.from({ length: 4_000 }, (_, index) => {
      const pid = 10_000 + index;
      return `${pid} 1 ${pid} /usr/bin/clean-worker-${index}`;
    }).join('\n');
    expect(Buffer.byteLength(processTable)).toBeGreaterThan(64 * 1024);
    expect(Buffer.byteLength(processTable)).toBeLessThan(4 * 1024 * 1024);
    const dependencies: Da5V5CleanStateDependencies = {
      ...cleanDependencies(),
      runHost: vi.fn(async (executable) => executable === '/bin/ps'
        ? { exitCode: 0, stderr: '', stdout: processTable }
        : cleanHostResult(executable)),
    };

    const result = await attestDa5V5CleanState(options(), dependencies);

    expect(result.status).toBe('match');
    expect(dependencies.runHost).toHaveBeenCalledWith(
      '/bin/ps',
      ['-axo', 'pid=,ppid=,pgid=,command='],
      4 * 1024 * 1024,
    );
    for (const port of [3000, 54321, 55435]) {
      expect(dependencies.runHost).toHaveBeenCalledWith(
        '/usr/sbin/lsof',
        ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'],
        64 * 1024,
      );
    }
  });

  it('fails only the process-owned domains when ps exceeds its 4 MiB cap', async () => {
    const dependencies: Da5V5CleanStateDependencies = {
      ...cleanDependencies(),
      runHost: vi.fn(async (executable) => executable === '/bin/ps'
        ? {
            exitCode: 0,
            outputBytes: 4 * 1024 * 1024 + 1,
            stderr: '',
            stdout: '1 0 1 /sbin/launchd\n',
          }
        : cleanHostResult(executable)),
    };

    const result = await attestDa5V5CleanState(options(), dependencies);

    expect(result).toMatchObject({
      android: 'match',
      bound_postgres_processes: 'mismatch',
      operator_processes: 'mismatch',
      owned_listeners: 'match',
      status: 'mismatch',
      task_roots: 'match',
    });
  });

  it('attributes each checker failure only to its owned attestation domain', async () => {
    const processFailure: Da5V5CleanStateDependencies = {
      ...cleanDependencies(),
      runHost: vi.fn(async (executable) => {
        if (executable === '/bin/ps') throw new Error('injected ps failure');
        return cleanHostResult(executable);
      }),
    };
    const taskRootFailure: Da5V5CleanStateDependencies = {
      ...cleanDependencies(),
      listPrivateTmpNames: vi.fn(async () => {
        throw new Error('injected task-root failure');
      }),
    };
    const androidFailure: Da5V5CleanStateDependencies = {
      ...cleanDependencies(),
      androidAttest: vi.fn(async () => {
        throw new Error('injected Android failure');
      }),
    };
    const listenerFailure: Da5V5CleanStateDependencies = {
      ...cleanDependencies(),
      runHost: vi.fn(async (executable, arguments_) => {
        if (executable === '/usr/sbin/lsof' && arguments_.includes('-iTCP:54321')) {
          throw new Error('injected lsof failure');
        }
        return cleanHostResult(executable);
      }),
    };

    await expect(attestDa5V5CleanState(options(), processFailure)).resolves.toMatchObject({
      android: 'match',
      bound_postgres_processes: 'mismatch',
      operator_processes: 'mismatch',
      owned_listeners: 'match',
      status: 'mismatch',
      task_roots: 'match',
    });
    await expect(attestDa5V5CleanState(options(), taskRootFailure)).resolves.toMatchObject({
      android: 'match',
      bound_postgres_processes: 'match',
      operator_processes: 'match',
      owned_listeners: 'match',
      status: 'mismatch',
      task_roots: 'mismatch',
    });
    await expect(attestDa5V5CleanState(options(), androidFailure)).resolves.toMatchObject({
      android: 'mismatch',
      bound_postgres_processes: 'match',
      operator_processes: 'match',
      owned_listeners: 'match',
      status: 'mismatch',
      task_roots: 'match',
    });
    await expect(attestDa5V5CleanState(options(), listenerFailure)).resolves.toMatchObject({
      android: 'match',
      bound_postgres_processes: 'match',
      operator_processes: 'match',
      owned_listeners: 'mismatch',
      status: 'mismatch',
      task_roots: 'match',
    });
  });

  it('preserves explicit unobserved truth and rejects inferred queue absence', () => {
    const unobserved = {
      ...observedProductMatch,
      queue: {
        equality: 'unproved',
        observation: 'unobserved',
        reason: 'operator_schema_has_no_queue_field',
      },
    };
    expect(requireDa5V5ProductSnapshotClaim(unobserved).queue).toEqual(unobserved.queue);
    expect(() => requireDa5V5ProductSnapshotClaim({
      ...unobserved,
      queue: { equality: 'unproved', observation: 'unobserved' },
    })).toThrow(/queue observation reason mismatch/u);
    expect(() => requireDa5V5ProductSnapshotClaim({
      ...unobserved,
      raw_records: [],
    })).toThrow(/schema mismatch/u);
  });
});
