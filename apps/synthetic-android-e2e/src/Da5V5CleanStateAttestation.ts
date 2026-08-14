import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import {
  Da5V5AndroidPreinstallPreflight,
  Da5V5UsbSerialBinding,
  SystemDa5V5AndroidAdbRunner,
  type Da5V5AndroidPreflightBinding,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';

const ownedPorts = Object.freeze([3_000, 54_321, 55_435] as const);
const commandTimeoutMilliseconds = 15_000;
const maximumOutputBytes = 64 * 1024;

export type Da5V5AttestationMatch = 'match' | 'mismatch';
export type Da5V5ProductObservation = 'observed' | 'unobserved';
export type Da5V5ProductEquality = 'match' | 'mismatch' | 'unproved';

export interface Da5V5ProductEqualityClaim {
  readonly equality: Da5V5ProductEquality;
  readonly observation: Da5V5ProductObservation;
}

export interface Da5V5ProductSnapshotClaim {
  readonly aggregates: Da5V5ProductEqualityClaim;
  readonly invariants: Da5V5ProductEqualityClaim;
  readonly queue: Da5V5ProductEqualityClaim & Readonly<{ readonly reason?: string }>;
  readonly schema_version: 1;
  readonly tag_roles: Da5V5ProductEqualityClaim;
}

export interface Da5V5CleanStateAttestation {
  readonly android: Da5V5AttestationMatch;
  readonly bound_postgres_processes: Da5V5AttestationMatch;
  readonly checked_ports: readonly [3000, 54321, 55435];
  readonly operator_processes: Da5V5AttestationMatch;
  readonly owned_listeners: Da5V5AttestationMatch;
  readonly product_equality: Da5V5ProductSnapshotClaim;
  readonly schema_version: 1;
  readonly status: Da5V5AttestationMatch;
  readonly task_roots: Da5V5AttestationMatch;
}

export interface Da5V5CleanStateAttestationOptions {
  readonly childPid: number | null;
  readonly operatorEntrypointPath: string;
  readonly productSnapshot: unknown;
  readonly runtimeGuardBinaryPath: string;
  readonly standardProfile: Da5V5AndroidPreflightBinding & Readonly<{
    readonly fontScale: '1.0';
  }>;
}

interface HostCommandResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

export interface Da5V5CleanStateDependencies {
  readonly androidAttest: (
    binding: Da5V5CleanStateAttestationOptions['standardProfile'],
  ) => Promise<Da5V5AttestationMatch>;
  readonly listPrivateTmpNames: () => Promise<readonly string[]>;
  readonly runHost: (
    executable: string,
    arguments_: readonly string[],
  ) => Promise<HostCommandResult>;
}

export async function attestDa5V5CleanState(
  options: Da5V5CleanStateAttestationOptions,
  dependencies: Da5V5CleanStateDependencies = systemCleanStateDependencies(),
): Promise<Da5V5CleanStateAttestation> {
  requireAttestationOptions(options);
  const productEquality = requireDa5V5ProductSnapshotClaim(options.productSnapshot);
  const [processResult, taskRootNames, android, ...portResults] = await Promise.all([
    dependencies.runHost('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,command=']),
    dependencies.listPrivateTmpNames(),
    dependencies.androidAttest(options.standardProfile),
    ...ownedPorts.map((port) => dependencies.runHost(
      '/usr/sbin/lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'],
    )),
  ]);

  const processes = parseProcessTable(processResult);
  const operatorProcesses = processes.every((process) => (
    (options.childPid === null || (
      process.pid !== options.childPid
      && process.parentPid !== options.childPid
      && process.processGroupId !== options.childPid
    ))
    && !commandReferencesExactPath(process.command, options.operatorEntrypointPath)
    && !commandReferencesExactPath(process.command, options.runtimeGuardBinaryPath)
  )) ? 'match' : 'mismatch';
  const boundPostgresProcesses = processes.every((process) => (
    !/\/private\/tmp\/\.t5-[^/\s]+\/run-[^/\s]+\/data(?:\s|\/|$)/u
      .test(process.command)
  )) ? 'match' : 'mismatch';
  const taskRoots = taskRootNames.every((name) => !name.startsWith('.t5-'))
    ? 'match'
    : 'mismatch';
  const ownedListeners = portResults.every(portIsUnbound) ? 'match' : 'mismatch';
  const status = [
    android,
    operatorProcesses,
    boundPostgresProcesses,
    taskRoots,
    ownedListeners,
  ].every((value) => value === 'match') ? 'match' : 'mismatch';

  return Object.freeze({
    android,
    bound_postgres_processes: boundPostgresProcesses,
    checked_ports: ownedPorts,
    operator_processes: operatorProcesses,
    owned_listeners: ownedListeners,
    product_equality: productEquality,
    schema_version: 1,
    status,
    task_roots: taskRoots,
  });
}

export function requireDa5V5ProductSnapshotClaim(
  value: unknown,
): Da5V5ProductSnapshotClaim {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['aggregates', 'invariants', 'queue', 'schema_version', 'tag_roles'])
    || value.schema_version !== 1
  ) {
    throw new Error('DA5 V5 Product snapshot schema mismatch');
  }
  const aggregates = requireProductEqualityClaim(value.aggregates, 'record');
  const invariants = requireProductEqualityClaim(value.invariants, 'record');
  const tagRoles = requireProductEqualityClaim(value.tag_roles, 'record');
  const queue = requireProductEqualityClaim(value.queue, 'queue');
  const queueReason = isRecord(value.queue) && typeof value.queue.reason === 'string'
    ? value.queue.reason
    : undefined;
  if (
    (queue.observation === 'unobserved'
      && queueReason !== 'operator_schema_has_no_queue_field')
    || (queue.observation === 'observed' && queueReason !== undefined)
    || !isRecord(value.queue)
    || (queue.observation === 'unobserved'
      ? !hasExactKeys(value.queue, ['equality', 'observation', 'reason'])
      : !hasExactKeys(value.queue, ['equality', 'observation'])
        && !hasExactKeys(
          value.queue,
          ['baseline', 'equality', 'observation', 'terminal'],
        ))
  ) {
    throw new Error('DA5 V5 Product queue observation reason mismatch');
  }
  return Object.freeze({
    aggregates,
    invariants,
    queue: Object.freeze({ ...queue, ...(queueReason === undefined ? {} : { reason: queueReason }) }),
    schema_version: 1,
    tag_roles: tagRoles,
  });
}

function requireProductEqualityClaim(
  value: unknown,
  shape: 'queue' | 'record',
): Da5V5ProductEqualityClaim {
  if (!isRecord(value)) {
    throw new Error('DA5 V5 Product equality claim mismatch');
  }
  const observation = value.observation;
  const equality = value.equality;
  if (
    (observation !== 'observed' && observation !== 'unobserved')
    || (equality !== 'match' && equality !== 'mismatch' && equality !== 'unproved')
    || (observation === 'observed' && equality === 'unproved')
    || (observation === 'unobserved' && equality !== 'unproved')
  ) {
    throw new Error('DA5 V5 Product equality claim mismatch');
  }
  if (observation === 'observed') {
    const summarized = hasExactKeys(value, ['equality', 'observation']);
    const evidenced = hasExactKeys(
      value,
      ['baseline', 'equality', 'observation', 'terminal'],
    );
    if (!summarized && !evidenced) {
      throw new Error('DA5 V5 Product equality claim mismatch');
    }
    if (evidenced) {
      const baseline = requireDisclosureSafeProductValue(value.baseline, shape);
      const terminal = requireDisclosureSafeProductValue(value.terminal, shape);
      const actualEquality = canonicalJson(baseline) === canonicalJson(terminal)
        ? 'match'
        : 'mismatch';
      if (actualEquality !== equality) {
        throw new Error('DA5 V5 Product equality evidence mismatch');
      }
    }
  } else if (shape === 'record' && !hasExactKeys(value, ['equality', 'observation'])) {
    throw new Error('DA5 V5 Product equality claim mismatch');
  }
  return Object.freeze({ equality, observation });
}

function requireDisclosureSafeProductValue(
  value: unknown,
  shape: 'queue' | 'record',
): unknown {
  if (shape === 'queue') {
    if (!Number.isSafeInteger(value) || Number(value) < 0) {
      throw new Error('DA5 V5 Product queue evidence mismatch');
    }
    return value;
  }
  if (!isRecord(value)) {
    throw new Error('DA5 V5 Product record evidence mismatch');
  }
  const entries = Object.entries(value);
  if (
    entries.length === 0
    || entries.length > 64
    || entries.some(([name, item]) => (
      !/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(name)
      || !(
        (Number.isSafeInteger(item) && Number(item) >= 0)
        || item === 'match'
        || item === 'mismatch'
        || item === 'pending'
      )
    ))
  ) {
    throw new Error('DA5 V5 Product record evidence mismatch');
  }
  return value;
}

function requireAttestationOptions(options: Da5V5CleanStateAttestationOptions): void {
  if (
    (options.childPid !== null && (
      !Number.isSafeInteger(options.childPid)
      || options.childPid < 1
    ))
    || !isAbsolutePath(options.operatorEntrypointPath)
    || !isAbsolutePath(options.runtimeGuardBinaryPath)
    || options.standardProfile.fontScale !== '1.0'
  ) {
    throw new Error('DA5 V5 clean-state binding mismatch');
  }
}

function parseProcessTable(result: HostCommandResult): readonly Readonly<{
  readonly command: string;
  readonly parentPid: number;
  readonly pid: number;
  readonly processGroupId: number;
}>[] {
  if (result.exitCode !== 0 || result.stderr !== '') {
    throw new Error('DA5 V5 process attestation failed');
  }
  return Object.freeze(result.stdout.split('\n').filter(Boolean).map((line) => {
    const match = /^\s*([1-9][0-9]*)\s+([0-9]+)\s+([1-9][0-9]*)\s+(.+)$/u.exec(line);
    const pid = Number(match?.[1]);
    const parentPid = Number(match?.[2]);
    const processGroupId = Number(match?.[3]);
    const command = match?.[4];
    if (
      !Number.isSafeInteger(pid)
      || !Number.isSafeInteger(parentPid)
      || !Number.isSafeInteger(processGroupId)
      || command === undefined
      || command.includes('\0')
    ) {
      throw new Error('DA5 V5 process attestation output mismatch');
    }
    return Object.freeze({ command, parentPid, pid, processGroupId });
  }));
}

function commandReferencesExactPath(command: string, path: string): boolean {
  return command.split(/\s+/u).some((token) => (
    token === path || token === JSON.stringify(path)
  ));
}

function portIsUnbound(result: HostCommandResult): boolean {
  if (result.stderr !== '') {
    throw new Error('DA5 V5 listener attestation failed');
  }
  if (result.exitCode === 1 && result.stdout === '') return true;
  if (result.exitCode === 0 && result.stdout !== '') return false;
  throw new Error('DA5 V5 listener attestation output mismatch');
}

function systemCleanStateDependencies(): Da5V5CleanStateDependencies {
  return Object.freeze({
    androidAttest: async (
      binding: Da5V5CleanStateAttestationOptions['standardProfile'],
    ) => {
      const runner = new SystemDa5V5AndroidAdbRunner();
      const serialBinding = new Da5V5UsbSerialBinding();
      const preflight = new Da5V5AndroidPreinstallPreflight(
        runner,
        serialBinding,
        binding,
      );
      const result = await preflight.run();
      return result.status === 'match' ? 'match' : 'mismatch';
    },
    listPrivateTmpNames: async () => readdir('/private/tmp'),
    runHost: runBoundedHostCommand,
  });
}

function runBoundedHostCommand(
  executable: string,
  arguments_: readonly string[],
): Promise<HostCommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, [...arguments_], {
      env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('DA5 V5 host attestation timed out')),
      commandTimeoutMilliseconds);
    const finish = (error?: Error, exitCode?: number): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error !== undefined || exitCode === undefined) {
        try { child.kill('SIGKILL'); } catch { /* terminal settlement is authoritative */ }
        rejectPromise(error ?? new Error('DA5 V5 host attestation failed'));
      } else {
        resolvePromise(Object.freeze({ exitCode, stderr, stdout }));
      }
    };
    const append = (target: 'stderr' | 'stdout', chunk: Buffer): void => {
      const value = chunk.toString('utf8');
      chunk.fill(0);
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + Buffer.byteLength(value)
        > maximumOutputBytes) {
        finish(new Error('DA5 V5 host attestation output exceeded its bound'));
        return;
      }
      if (target === 'stdout') stdout += value;
      else stderr += value;
    };
    child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk));
    child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk));
    child.once('error', () => finish(new Error('DA5 V5 host attestation failed')));
    child.once('close', (code, signal) => {
      finish(
        signal === null && code !== null
          ? undefined
          : new Error('DA5 V5 host attestation failed'),
        code ?? undefined,
      );
    });
  });
}

function isAbsolutePath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.includes('\0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('DA5 V5 Product evidence mismatch');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expectedKeys.length
    && keys.every((key, index) => key === expectedKeys[index]);
}
