import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const operatorBundle = fileURLToPath(
  new URL('../dist/da5V5Main.js', import.meta.url),
);
const indexBundle = fileURLToPath(
  new URL('../dist/index.js', import.meta.url),
);
const ptyCredential = '0123456789abcdef'.repeat(4);

describe('DA5 V5 Product operator bundle start smoke', () => {
  it('bounds the GHSA-rgw5-rvv9-x895 intermediate-expansion path in a child', () => {
    const regression = spawnSync(
      process.execPath,
      [
        '--max-old-space-size=64',
        '--input-type=module',
        '--eval',
        `
          import { createRequire } from 'node:module';
          import { expand } from 'brace-expansion';

          const require = createRequire(import.meta.url);
          const { version } = require('brace-expansion/package.json');
          const part = '{' + '0'.repeat(50) + '1..100000}';
          const input = '{' + Array(400).fill(part).join(',') + '}';
          const expanded = expand(input);
          const totalLength = expanded.reduce((sum, value) => sum + value.length, 0);
          if (expanded.length === 0 || totalLength > 4_000_000) process.exit(2);
          process.stdout.write(JSON.stringify({ totalLength, version }));
        `,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
        maxBuffer: 64 * 1024,
        timeout: 5_000,
      },
    );

    expect(regression.error, regression.stderr).toBeUndefined();
    expect(regression.signal, regression.stderr).toBeNull();
    expect(regression.status, regression.stderr).toBe(0);
    expect(JSON.parse(regression.stdout)).toMatchObject({
      version: '5.0.9',
    });
  }, 10_000);

  it('builds and reaches the hardware-free DA5 startup guard without APK or ADB use', () => {
    const build = spawnSync(
      'npm',
      ['run', 'build', '--workspace=@taptime/synthetic-android-e2e'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: process.env,
      },
    );
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    const bundle = readFileSync(operatorBundle, 'utf8');
    expect(bundle).toContain('da5_v5_android_install=mismatch category=');
    for (const category of [
      'artifact_reverify',
      'child_start_transport',
      'stdin_pipe',
      'timeout',
      'child_exit',
      'package_manager_receipt',
      'installed_provenance',
      'cleanup',
      'signal_abort',
    ]) {
      expect(bundle).toContain(category);
    }
    expect(bundle).toContain('cleanup_status=');
    expect(bundle).toContain('cleanup_substage=');
    expect(bundle).toContain('install_abandon');
    expect(bundle).toContain('runner_binding');
    expect(bundle).toContain('uncertainty_escalation');
    expect(bundle).toContain('settleDa5V5BackgroundOperation');
    expect(bundle).toContain('install-create');
    expect(bundle).toContain('install-write');
    expect(bundle).toContain('install-commit');
    expect(bundle).toContain('install-abandon');
    expect(bundle).toContain('UsbFfs');
    expect(bundle).toContain('credential-field-ready <administrator|enrollment|employee> EMPTY_ACTIVE');
    expect(bundle).toContain('credential-field-confirm <administrator|enrollment|employee>');
    expect(bundle).toContain('synthetic_credential_injection=pending_human_confirmation');
    expect(bundle).toContain('da5_v5_accessibility_surface_plan=');
    expect(bundle).toContain('protected-review-error');
    expect(bundle).toContain('auth-login');
    expect(bundle).toContain('administrator-setup');
    expect(bundle).toContain('accessibility-prepare | accessibility-check');
    expect(bundle).toContain('da5_v5_accessibility_prepare=match restore_required=armed');
    expect(bundle).toContain('prepareAccessibilityProfileChange');
    expect(bundle).toContain('profile-change-prepared');
    expect(bundle).toContain('accessibility-surface-confirm <surface> <PASS|FAIL|AMBIGUOUS>');
    expect(bundle).toContain('accessibility-credential-check <administrator|employee>');
    expect(bundle).toContain('da5_v5_accessibility_restore_only=mismatch');
    expect(bundle).toContain('da5_v5_accessibility_restore_required=match');
    expect(bundle).toContain('DA5 V5 accessibility restore proof is unavailable');
    expect(bundle).toContain('standard-profile-check');
    expect(bundle).toContain('requireEmptyOutput: true');
    expect(bundle).toContain('IFS= read -r v || exit 40;');
    expect(bundle).toContain('*[!0-9a-f]*');
    expect(bundle).not.toContain('credential-paste-confirm');
    expect(bundle).not.toContain('pbcopy');
    expect(bundle).not.toContain('pbpaste');

    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith('TAPTIME_')),
    );
    const start = spawnSync(
      process.execPath,
      [operatorBundle],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: environment,
      },
    );

    expect(start.status).toBe(1);
    expect(start.stdout).toBe('');
    expect(start.stderr).toContain(
      'DA5 V5 requires the exact explicit synthetic profile',
    );
    expect(start.stderr).not.toContain('Synthetic E2E release APK');
    expect(start.stderr).not.toContain(
      'synthetic_e2e_android_runtime_complete_verified',
    );

    const startNear = spawnSync(
      process.execPath,
      [operatorBundle],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {
          ...environment,
          PATH: '',
          TAPTIME_DA5_V5_ANDROID_API: '35',
          TAPTIME_DA5_V5_ANDROID_BUILD: 'synthetic-build',
          TAPTIME_DA5_V5_ANDROID_RELEASE: '15',
          TAPTIME_DA5_V5_DEVICE_MODEL: 'Synthetic Galaxy',
          TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT: 'a'.repeat(40),
          TAPTIME_DA5_V5_IMPLEMENTATION_TREE: 'b'.repeat(40),
          TAPTIME_DA5_V5_PG_CONFIG: `${repositoryRoot}/.missing-da5-v5-pg-config`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY:
            `${repositoryRoot}/.missing-da5-v5-runtime-guard`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256: 'c'.repeat(64),
          TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST:
            `${repositoryRoot}/.missing-da5-v5-runtime-guard-manifest`,
          TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256: 'd'.repeat(64),
          TAPTIME_DA5_V5_TAG_A_FINGERPRINT: 'B55E8B6AEB30',
          TAPTIME_DA5_V5_TAG_B_FINGERPRINT: '32A54C8F2F29',
          TAPTIME_DA5_V5_TAG_TECHNOLOGY: 'NfcA',
          TAPTIME_DA5_V5_TAG_X_FINGERPRINT: 'F61C9F702CFE',
          TAPTIME_DA5_V5_TALKBACK_PACKAGE:
            'com.google.android.marvin.talkback',
          TAPTIME_DA5_V5_TALKBACK_VERSION: '15.1.0',
          TAPTIME_SYNTHETIC_E2E_PASSWORD: 'e'.repeat(64),
          TAPTIME_SYNTHETIC_E2E_PROFILE: 'da5-v5',
        },
      },
    );

    expect(startNear.status).toBe(1);
    expect(startNear.stdout).toBe('');
    expect(startNear.stderr).toBe('da5_v5_start_failed\n');
    expect(startNear.stderr).not.toContain('Synthetic E2E release APK');

    const ptyProbe = runPtyProbe(
      ptyProbeSource(),
      ptyCredential,
      'credential',
    );

    expect(ptyProbe).toEqual({
      captureInvalid: false,
      captureMatched: true,
      captureRejected: false,
      childExit: 0,
      cleanupGroupAbsent: true,
      descendantObserved: true,
      finalRemainderScanned: true,
      readyCount: 1,
      secretOccurrences: 0,
      status: 'match',
    });

    for (const mode of [
      'duplicate',
      'unterminated-foreign',
      'valid-eof',
      'close',
      'error',
    ] as const) {
      const rejectedProbe = runPtyProbe(
        ptyProbeSource(),
        ptyCredential,
        mode,
      );
      expect(rejectedProbe, mode).toEqual({
        captureInvalid: false,
        captureMatched: false,
        captureRejected: true,
        childExit: 5,
        cleanupGroupAbsent: true,
        descendantObserved: true,
        finalRemainderScanned: true,
        readyCount: 1,
        secretOccurrences: 0,
        status: 'rejected',
      });
    }

    const invalidProbe = runPtyProbe(
      ptyProbeSource(),
      'A'.repeat(64),
      'invalid',
    );
    expect(invalidProbe).toEqual({
      captureInvalid: true,
      captureMatched: false,
      captureRejected: false,
      childExit: 4,
      cleanupGroupAbsent: true,
      descendantObserved: true,
      finalRemainderScanned: true,
      readyCount: 1,
      secretOccurrences: 0,
      status: 'rejected',
    });

    const boundedWrapperCleanupProbe = runPtyProbe(
      `
        import { spawn } from 'node:child_process';
        const descendant = spawn(
          process.execPath,
          ['--eval', "process.on('SIGHUP', () => undefined); setInterval(() => undefined, 1_000);"],
          { stdio: 'ignore' },
        );
        descendant.unref();
        setInterval(() => undefined, 1_000);
      `,
      ptyCredential,
      'wrapper-timeout',
    );
    expect(boundedWrapperCleanupProbe).toMatchObject({
      cleanupGroupAbsent: true,
      finalRemainderScanned: true,
      status: 'wrapper-process-group-cleaned',
    });

    const unterminatedScannerProbe = runPtyProbe(
      `process.stdout.write(${JSON.stringify(ptyCredential)});`,
      ptyCredential,
      'unterminated-leak',
    );
    expect(unterminatedScannerProbe).toMatchObject({
      childExit: 0,
      cleanupGroupAbsent: true,
      finalRemainderScanned: true,
      secretOccurrences: 1,
      status: 'detected',
    });
  }, 30_000);
});

interface PtyProbeResult {
  readonly captureInvalid: boolean;
  readonly captureMatched: boolean;
  readonly captureRejected: boolean;
  readonly childExit: number | null;
  readonly cleanupGroupAbsent: boolean;
  readonly descendantObserved: boolean;
  readonly finalRemainderScanned: boolean;
  readonly readyCount: number;
  readonly secretOccurrences: number;
  readonly status:
    | 'detected'
    | 'match'
    | 'mismatch'
    | 'rejected'
    | 'wrapper-process-group-cleaned';
}

function runPtyProbe(
  childSource: string,
  secret: string,
  mode: 'close' | 'credential' | 'duplicate' | 'error' | 'invalid'
    | 'unterminated-foreign' | 'unterminated-leak' | 'valid-eof'
    | 'wrapper-timeout',
): PtyProbeResult {
  const secretBytes = Buffer.from(secret, 'ascii');
  try {
    const probe = spawnSync(
      'python3',
      [
        '-c',
        PTY_PROBE,
        process.execPath,
        Buffer.from(childSource, 'utf8').toString('base64'),
        secretBytes.toString('base64'),
        mode,
      ],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: { PATH: process.env.PATH },
        killSignal: 'SIGTERM',
        maxBuffer: 64 * 1024,
        timeout: 10_000,
      },
    );
    if (probe.error !== undefined || probe.signal !== null || probe.status !== 0) {
      throw new Error('DA5 V5 PTY wrapper failed');
    }
    try {
      return JSON.parse(probe.stdout) as PtyProbeResult;
    } catch {
      throw new Error('DA5 V5 PTY wrapper result mismatch');
    }
  } finally {
    secretBytes.fill(0);
  }
}

function ptyProbeSource(): string {
  return `
    import { spawn } from 'node:child_process';
    import { createInterface } from 'node:readline';
    import {
      Da5V5InputOwnership,
      readDa5V5HiddenCredential,
    } from ${JSON.stringify(pathToFileURL(indexBundle).href)};

    const descendant = spawn(
      process.execPath,
      ['--eval', "process.on('SIGHUP', () => undefined); setInterval(() => undefined, 1_000);"],
      { stdio: 'ignore' },
    );
    descendant.unref();

    const ownership = new Da5V5InputOwnership();
    const commandInput = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 0,
    });
    ownership.attachCommand(commandInput);
    process.stdout.write('BOOT\\n');
    commandInput.on('line', async (line) => {
      if (line !== 'credential-check') process.exit(3);
      try {
        const credential = await readDa5V5HiddenCredential(
          ownership,
          process.stdin,
          () => {
            process.stdout.write('synthetic_password_input_ready\\n');
            if (process.env.DA5_V5_PTY_PROBE_MODE === 'error') {
              process.stdin.emit('error', new Error('private PTY probe detail'));
            }
          },
        );
        const length = credential.length;
        credential.fill(0);
        process.stdout.write('CAPTURED=' + length + '\\n');
        process.exit(length === 64 ? 0 : 4);
      } catch {
        process.stdout.write('CAPTURE_FAILED\\n');
        process.exit(5);
      }
    });
    commandInput.once('close', () => {
      if (ownership.command() === commandInput) process.exit(6);
    });
  `;
}

const PTY_PROBE = String.raw`
import base64
import errno
import json
import os
import pty
import select
import signal
import sys
import time

node = sys.argv[1]
source = base64.b64decode(sys.argv[2]).decode('utf-8')
secret = bytearray(base64.b64decode(sys.argv[3]))
mode = sys.argv[4]
deadline = time.monotonic() + (0.25 if mode == 'wrapper-timeout' else 5.0)
child_pid = None
master_fd = None
child_status = None
child_reaped = False
line_tail = bytearray()
marker_window = bytearray()
secret_occurrences = 0
ready_count = 0
command_sent = False
secret_sent = False
capture_matched = False
capture_rejected = False
capture_invalid = False
final_remainder_scanned = False
descendant_observed = False
cleanup_group_absent = False
failure = None

class ProbeSignal(Exception):
    pass

class ProbeTimeout(Exception):
    pass

def stop_on_signal(_number, _frame):
    raise ProbeSignal()

for signal_name in ('SIGHUP', 'SIGINT', 'SIGTERM'):
    signal.signal(getattr(signal, signal_name), stop_on_signal)

def zero(buffer):
    for index in range(len(buffer)):
        buffer[index] = 0

def count_secret(buffer):
    count = 0
    start = 0
    while True:
        found = buffer.find(secret, start)
        if found < 0:
            return count
        count += 1
        start = found + max(1, len(secret))

def scan_chunk(chunk):
    global secret_occurrences
    line_tail.extend(chunk)
    if len(line_tail) > 65536:
        raise RuntimeError('bounded_output_exceeded')
    while True:
        newline = line_tail.find(b'\n')
        if newline < 0:
            return
        line = bytearray(line_tail[:newline + 1])
        del line_tail[:newline + 1]
        secret_occurrences += count_secret(line)
        zero(line)

def scan_final_remainder():
    global final_remainder_scanned, secret_occurrences
    secret_occurrences += count_secret(line_tail)
    final_remainder_scanned = True
    zero(line_tail)
    line_tail.clear()

def write_all(buffer):
    view = memoryview(buffer)
    offset = 0
    try:
        while offset < len(buffer):
            written = os.write(master_fd, view[offset:])
            if written <= 0:
                raise RuntimeError('pty_write_failed')
            offset += written
    finally:
        view.release()
        zero(buffer)

def write_once(buffer):
    view = memoryview(buffer)
    try:
        if len(buffer) == 0:
            return
        written = os.write(master_fd, view)
        if written != len(buffer):
            raise RuntimeError('pty_partial_sensitive_write')
    finally:
        view.release()
        zero(buffer)

def group_exists():
    if child_pid is None:
        return False
    try:
        os.killpg(child_pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True

def reap_nonblocking():
    global child_reaped, child_status
    if child_pid is None or child_reaped:
        return
    try:
        waited, status = os.waitpid(child_pid, os.WNOHANG)
    except ChildProcessError:
        child_reaped = True
        return
    if waited == child_pid:
        child_reaped = True
        child_status = status

def terminate_group():
    global cleanup_group_absent
    if child_pid is None:
        cleanup_group_absent = True
        return
    if group_exists():
        try:
            os.killpg(child_pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    grace = time.monotonic() + 0.5
    while time.monotonic() < grace:
        reap_nonblocking()
        if not group_exists():
            cleanup_group_absent = True
            return
        time.sleep(0.01)
    if group_exists():
        try:
            os.killpg(child_pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    kill_grace = time.monotonic() + 1.0
    while time.monotonic() < kill_grace:
        reap_nonblocking()
        if not group_exists():
            cleanup_group_absent = True
            return
        time.sleep(0.01)
    cleanup_group_absent = not group_exists()

try:
    child_pid, master_fd = pty.fork()
    if child_pid == 0:
        os.environ['DA5_V5_PTY_PROBE_MODE'] = mode
        os.execv(node, [node, '--input-type=module', '--eval', source])

    while True:
        if time.monotonic() >= deadline:
            raise ProbeTimeout()
        readable, _, _ = select.select([master_fd], [], [], max(0.0, deadline - time.monotonic()))
        if not readable:
            raise ProbeTimeout()
        try:
            raw_chunk = os.read(master_fd, 4096)
        except OSError as error:
            if error.errno == errno.EIO:
                break
            raise
        if not raw_chunk:
            break
        chunk = bytearray(raw_chunk)
        try:
            scan_chunk(chunk)
            marker_window.extend(chunk)
            if len(marker_window) > 16384:
                del marker_window[:-8192]
            if mode in (
                'credential',
                'duplicate',
                'unterminated-foreign',
                'valid-eof',
                'close',
                'error',
                'invalid',
            ):
                if not command_sent and b'BOOT\r\n' in marker_window:
                    command_sent = True
                    write_all(bytearray(b'credential-check\n'))
                marker = b'synthetic_password_input_ready\r\n'
                observed_ready_count = marker_window.count(marker)
                if observed_ready_count > ready_count:
                    ready_count = observed_ready_count
                if ready_count == 1 and not secret_sent:
                    secret_sent = True
                    if mode == 'close':
                        secret_write = bytearray([4])
                    elif mode == 'error':
                        secret_write = bytearray()
                    else:
                        secret_write = bytearray(secret)
                        secret_write.append(10)
                        if mode == 'duplicate':
                            secret_write.extend(b'foreign\n')
                        elif mode == 'unterminated-foreign':
                            secret_write.extend(b'foreign')
                        elif mode == 'valid-eof':
                            secret_write.append(4)
                    write_once(secret_write)
                capture_matched = b'CAPTURED=64\r\n' in marker_window
                capture_rejected = b'CAPTURE_FAILED\r\n' in marker_window
                capture_invalid = b'CAPTURED=0\r\n' in marker_window
        finally:
            zero(chunk)

    scan_final_remainder()
    _, child_status = os.waitpid(child_pid, 0)
    child_reaped = True
    descendant_observed = group_exists()
except ProbeSignal:
    failure = 'signal'
except ProbeTimeout:
    failure = 'timeout'
except Exception:
    failure = 'wrapper_failure'
finally:
    if not final_remainder_scanned:
        scan_final_remainder()
    if master_fd is not None:
        try:
            os.close(master_fd)
        except OSError:
            pass
    terminate_group()
    reap_nonblocking()
    if child_pid is not None and not child_reaped:
        try:
            _, child_status = os.waitpid(child_pid, 0)
            child_reaped = True
        except ChildProcessError:
            child_reaped = True

child_exit = None
if child_status is not None:
    child_exit = os.waitstatus_to_exitcode(child_status)

if mode == 'credential':
    matched = (
        failure is None
        and child_exit == 0
        and command_sent
        and secret_sent
        and capture_matched
        and ready_count == 1
        and secret_occurrences == 0
        and final_remainder_scanned
        and descendant_observed
        and cleanup_group_absent
    )
    status = 'match' if matched else 'mismatch'
elif mode in ('duplicate', 'unterminated-foreign', 'valid-eof', 'close', 'error'):
    rejected = (
        failure is None
        and child_exit == 5
        and command_sent
        and secret_sent
        and capture_rejected
        and ready_count == 1
        and secret_occurrences == 0
        and final_remainder_scanned
        and descendant_observed
        and cleanup_group_absent
    )
    status = 'rejected' if rejected else 'mismatch'
elif mode == 'invalid':
    rejected = (
        failure is None
        and child_exit == 4
        and command_sent
        and secret_sent
        and capture_invalid
        and ready_count == 1
        and secret_occurrences == 0
        and final_remainder_scanned
        and descendant_observed
        and cleanup_group_absent
    )
    status = 'rejected' if rejected else 'mismatch'
elif mode == 'wrapper-timeout':
    cleaned = (
        failure == 'timeout'
        and final_remainder_scanned
        and cleanup_group_absent
    )
    status = 'wrapper-process-group-cleaned' if cleaned else 'mismatch'
else:
    detected = (
        failure is None
        and child_exit == 0
        and secret_occurrences == 1
        and final_remainder_scanned
        and cleanup_group_absent
    )
    status = 'detected' if detected else 'mismatch'

zero(marker_window)
marker_window.clear()
zero(secret)
print(json.dumps({
    'captureInvalid': capture_invalid,
    'captureMatched': capture_matched,
    'captureRejected': capture_rejected,
    'childExit': child_exit,
    'cleanupGroupAbsent': cleanup_group_absent,
    'descendantObserved': descendant_observed,
    'finalRemainderScanned': final_remainder_scanned,
    'readyCount': ready_count,
    'secretOccurrences': secret_occurrences,
    'status': status,
}, separators=(',', ':')))
`;
