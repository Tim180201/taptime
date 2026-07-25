import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import {
  createDa5V5AdbChildEnvironment,
} from './da5V5AdbChildEnvironment.mjs';
import {
  DA5_V5_ANDROID_ARTIFACT,
  DA5_V5_ANDROID_PACKAGE,
  requireDa5V5AndroidProfile,
  reverifyDa5V5AndroidArtifactForInstall,
  verifyDa5V5AndroidArtifact,
} from './da5V5AndroidArtifact.mjs';

const requiredMappings = Object.freeze([
  Object.freeze({ device: 'tcp:54321', host: 'tcp:54321' }),
  Object.freeze({ device: 'tcp:3000', host: 'tcp:3000' }),
]);
const cleanupFlights = new WeakMap();
const uncertainInstallRunners = new WeakSet();
const timeouts = Object.freeze({
  inspect: 15_000,
  install: 240_000,
  reverse: 30_000,
  uninstall: 120_000,
});
const uncertainInstallCleanup = Object.freeze({
  maximumMilliseconds: 60_000,
  nullWindowMilliseconds: 15_000,
  pollMilliseconds: 250,
});
const adbServerArguments = Object.freeze(['-H', '127.0.0.1', '-P', '5037']);

export class Da5V5UsbSerialBinding {
  #failed = false;
  #serial = null;

  bind(serial) {
    if (
      this.#failed
      || typeof serial !== 'string'
      || serial.length === 0
      || (this.#serial !== null && this.#serial !== serial)
    ) {
      this.#failed = true;
      return 'mismatch';
    }
    this.#serial = serial;
    return 'match';
  }

  use(serial, operation) {
    if (
      this.#failed
      || this.#serial === null
      || serial !== this.#serial
    ) {
      this.#failed = true;
      throw new Error('DA5 V5 USB device continuity mismatch');
    }
    return operation(this.#serial);
  }

  useRetained(operation) {
    if (this.#failed || this.#serial === null) {
      throw new Error('DA5 V5 USB device is unbound');
    }
    return operation(this.#serial);
  }

  state() {
    return this.#failed ? 'failed' : this.#serial === null ? 'unbound' : 'bound';
  }
}

export class SystemDa5V5AndroidAdbRunner {
  constructor(dependencies = {}) {
    this.dependencies = Object.freeze({
      environment: dependencies.environment ?? process.env,
      spawn: dependencies.spawn ?? spawn,
    });
  }

  run(arguments_, options = {}) {
    return runAdb(arguments_, options, this.dependencies);
  }

  runBinaryDigest(arguments_, options = {}) {
    return runAdbBinaryDigest(arguments_, options, this.dependencies);
  }
}

export class Da5V5AndroidPreinstallPreflight {
  #state = 'created';

  constructor(runner, serialBinding, binding) {
    this.runner = runner;
    this.serialBinding = serialBinding;
    this.binding = binding;
  }

  async run(options = {}) {
    if (this.#state !== 'created') {
      this.#state = 'failed';
      return Object.freeze({ status: 'mismatch' });
    }
    this.#state = 'running';
    try {
      const serial = await bindCurrentDevice(
        this.runner,
        this.serialBinding,
        this.binding,
        options.signal,
      );
      const release = await this.runner.run(
        ['-s', serial, 'shell', 'getprop', 'ro.build.version.release'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      const api = await this.runner.run(
        ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      const fontScale = await this.runner.run(
        ['-s', serial, 'shell', 'settings', 'get', 'system', 'font_scale'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      const talkBack = await this.runner.run(
        ['-s', serial, 'shell', 'dumpsys', 'package',
          'com.google.android.marvin.talkback'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      const listeners = await this.runner.run(
        ['-s', serial, 'shell', 'ss', '-ltnH'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      if (
        oneLine(release) !== this.binding.androidRelease
        || oneLine(api) !== this.binding.androidApi
        || oneLine(fontScale) !== this.binding.fontScale
        || readTalkBackVersion(talkBack) !== this.binding.talkBackVersion
      ) {
        throw new Error('DA5 V5 preinstall metadata mismatch');
      }
      assertNoDa5V5OwnedListeners(listeners);
      await assertDa5V5PackageMappingZero(
        this.runner,
        serial,
        { signal: options.signal },
      );
      this.#state = 'matched';
      return Object.freeze({ status: 'match' });
    } catch {
      this.#state = 'failed';
      return Object.freeze({ status: 'mismatch' });
    }
  }

  state() {
    return this.#state;
  }
}

export async function requireSingleDa5V5UsbDevice(runner, options = {}) {
  const rows = (await runner.run(['devices', '-l'], {
    signal: options.signal,
    timeoutMilliseconds: timeouts.inspect,
  }))
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length >= 2);
  const row = rows[0];
  const serial = row?.[0];
  if (
    rows.length !== 1
    || serial === undefined
    || row?.[1] !== 'device'
    || row.slice(2).every((part) => !part.startsWith('usb:'))
    || serial.includes(':')
    || serial.startsWith('emulator-')
    || serial.includes('_adb-tls-connect._tcp')
  ) {
    throw new Error('DA5 V5 requires exactly one authorized USB device');
  }
  return serial;
}

export function parseDa5V5ReverseMappings(value, expectedSerial) {
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length !== 0);
  return Object.freeze(lines.map((line) => {
    const parts = line.split(/\s+/u);
    const [serial, device, host] = parts;
    if (
      parts.length !== 3
      || serial !== expectedSerial
      || !validTcpEndpoint(device)
      || !validTcpEndpoint(host)
    ) {
      throw new Error('DA5 V5 reverse mapping output is malformed or unexpected');
    }
    return Object.freeze({ device, host });
  }));
}

export async function assertDa5V5PackageMappingZero(runner, serial, options = {}) {
  const packagePaths = await readPackagePaths(runner, serial, options.signal);
  const mappings = await readMappings(runner, serial, options.signal);
  if (packagePaths.length !== 0 || mappings.length !== 0) {
    throw new Error('DA5 V5 package/mapping zero state mismatch');
  }
  return Object.freeze({ status: 'match' });
}

export async function withDa5V5VerifiedInstalledDevice(options, operation) {
  const serial = await bindCurrentDevice(
    options.runner,
    options.serialBinding,
    options.deviceBinding,
    options.signal,
  );
  await requireExactInstalledState(options.runner, serial, true, options.signal);
  return options.serialBinding.use(serial, operation);
}

export async function installDa5V5AndroidFromPackageZero(options) {
  requireDa5V5AndroidProfile(options.profile);
  const verifyArtifact = options.verifyArtifact ?? verifyDa5V5AndroidArtifact;
  const reverifyArtifact = options.reverifyArtifact
    ?? reverifyDa5V5AndroidArtifactForInstall;
  const verification = verifyArtifact({
    profile: options.profile,
    ...(options.artifactDependencies === undefined
      ? {}
      : { dependencies: options.artifactDependencies }),
  });
  const runner = options.runner ?? new SystemDa5V5AndroidAdbRunner();
  const serialBinding = requireSerialBinding(options.serialBinding);
  let mutationStarted = false;
  let installCommandStarted = false;
  let reverseMutationUncertain = false;
  let verifiedSource = null;
  try {
    const serial = await bindCurrentDevice(
      runner,
      serialBinding,
      options.deviceBinding,
      options.signal,
    );
    await assertDa5V5PackageMappingZero(runner, serial, { signal: options.signal });
    mutationStarted = true;
    for (const mapping of requiredMappings) {
      reverseMutationUncertain = true;
      await runner.run(['-s', serial, 'reverse', mapping.device, mapping.host], {
        signal: options.signal,
        timeoutMilliseconds: timeouts.reverse,
      });
    }
    await requireExactInstalledState(runner, serial, false, options.signal);
    reverseMutationUncertain = false;
    verifiedSource = reverifyArtifact(
      verification,
      options.artifactDependencies?.files,
    );
    if (
      verifiedSource?.status !== 'match'
      || typeof verifiedSource.use !== 'function'
      || typeof verifiedSource.destroy !== 'function'
    ) {
      throw new Error('DA5 V5 verified APK snapshot is unavailable');
    }
    installCommandStarted = true;
    uncertainInstallRunners.add(runner);
    const installResult = await verifiedSource.use((snapshot) => runner.run(
      [
        '-s',
        serial,
        'shell',
        '-T',
        'cmd',
        'package',
        'install',
        '-R',
        '--pkg',
        DA5_V5_ANDROID_PACKAGE,
        '-S',
        String(DA5_V5_ANDROID_ARTIFACT.apk.bytes),
        '-',
      ],
      {
        signal: options.signal,
        stdinBytes: snapshot,
        timeoutMilliseconds: timeouts.install,
      },
    ));
    verifiedSource = null;
    if (oneLine(installResult) !== 'Success') {
      throw new Error('DA5 V5 Android package-manager install failed');
    }
    await requireExactInstalledState(runner, serial, true, options.signal);
    await requireExactInstalledArtifactBytes(runner, serial, options.signal);
    uncertainInstallRunners.delete(runner);
    return Object.freeze({
      packageName: DA5_V5_ANDROID_PACKAGE,
      status: 'match',
    });
  } catch {
    verifiedSource?.destroy();
    if (mutationStarted) {
      const rollback = await cleanupDa5V5AndroidState({
        profile: options.profile,
        runner,
        deviceBinding: options.deviceBinding,
        serialBinding,
        installationState: installCommandStarted ? 'uncertain' : 'known',
        reverseState: reverseMutationUncertain ? 'uncertain' : 'known',
        now: options.now,
        wait: options.wait,
      });
      if (rollback.status !== 'match') {
        throw new Error('DA5 V5 Android install rollback failed');
      }
    }
    throw new Error('DA5 V5 Android install failed');
  }
}

export function cleanupDa5V5AndroidState(options) {
  requireDa5V5AndroidProfile(options.profile);
  const runner = options.runner ?? new SystemDa5V5AndroidAdbRunner();
  const requestedUncertainMutation = (
    options.installationState === 'uncertain'
    || options.reverseState === 'uncertain'
    || uncertainInstallRunners.has(runner)
  );
  const active = cleanupFlights.get(runner);
  if (active !== undefined) {
    if (requestedUncertainMutation && !active.uncertainMutation) {
      return active.operation.then(() => Object.freeze({ status: 'mismatch' }));
    }
    return active.operation;
  }
  const serialBinding = requireSerialBinding(options.serialBinding);
  const uncertainMutation = requestedUncertainMutation;
  const operation = performCleanup(
    runner,
    options.deviceBinding,
    serialBinding,
    options.wait ?? wait,
    uncertainMutation,
    options.now ?? (() => performance.now()),
    false,
  ).then((result) => {
    if (uncertainMutation && result.status === 'match') {
      uncertainInstallRunners.delete(runner);
    }
    return result;
  }).finally(() => {
    if (cleanupFlights.get(runner)?.operation === operation) {
      cleanupFlights.delete(runner);
    }
  });
  cleanupFlights.set(runner, Object.freeze({
    operation,
    uncertainMutation,
  }));
  return operation;
}

async function performCleanup(
  runner,
  deviceBinding,
  serialBinding,
  waitForSettle,
  uncertainMutation,
  now,
  bindIfUnbound,
) {
  let failed = false;
  let serial;
  try {
    if (serialBinding.state() === 'unbound' && !bindIfUnbound) {
      return Object.freeze({ status: 'match' });
    }
    const current = await requireSingleDa5V5UsbDevice(runner);
    await verifyDeviceBinding(runner, current, deviceBinding);
    if (serialBinding.bind(current) !== 'match') {
      return Object.freeze({ status: 'mismatch' });
    }
    serial = serialBinding.use(current, (retained) => retained);
  } catch {
    return Object.freeze({ status: 'mismatch' });
  }

  let mappings = [];
  try {
    mappings = await readMappings(runner, serial);
    for (const required of requiredMappings) {
      const matches = mappings.filter((mapping) => mapping.device === required.device);
      if (matches.length > 1 || (matches[0] !== undefined && matches[0].host !== required.host)) {
        failed = true;
        continue;
      }
      if (matches.length === 1) {
        try {
          await runner.run(['-s', serial, 'reverse', '--remove', required.device], {
            timeoutMilliseconds: timeouts.reverse,
          });
        } catch {
          failed = true;
        }
      }
    }
  } catch {
    failed = true;
  }

  try {
    const packagePaths = await readPackagePaths(runner, serial);
    if (packagePaths.length > 1) {
      failed = true;
    } else if (packagePaths.length === 1) {
      try {
        await runner.run(['-s', serial, 'uninstall', DA5_V5_ANDROID_PACKAGE], {
          timeoutMilliseconds: timeouts.uninstall,
        });
      } catch {
        failed = true;
      }
    }
  } catch {
    failed = true;
  }

  if (!await proveFinalZero(
    runner,
    serial,
    waitForSettle,
    uncertainMutation,
    now,
  )) {
    failed = true;
  }
  return Object.freeze({ status: failed ? 'mismatch' : 'match' });
}

async function proveFinalZero(
  runner,
  serial,
  waitForSettle,
  uncertainMutation,
  now,
) {
  if (uncertainMutation) {
    return proveUncertainInstallNullWindow(runner, serial, waitForSettle, now);
  }
  let consecutiveZeroObservations = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const mappings = await readMappings(runner, serial);
      const packagePaths = await readPackagePaths(runner, serial);
      const ownedMappings = mappings.filter((mapping) => (
        requiredMappings.some((required) => required.device === mapping.device)
      ));
      if (ownedMappings.length === 0 && packagePaths.length === 0) {
        consecutiveZeroObservations += 1;
        if (consecutiveZeroObservations >= 2) {
          return true;
        }
      } else {
        consecutiveZeroObservations = 0;
        for (const mapping of ownedMappings) {
          const expected = requiredMappings.find(
            (required) => required.device === mapping.device,
          );
          if (expected === undefined || mapping.host !== expected.host) {
            return false;
          }
          await runner.run(['-s', serial, 'reverse', '--remove', mapping.device], {
            timeoutMilliseconds: timeouts.reverse,
          });
        }
        if (packagePaths.length > 1) {
          return false;
        }
        if (packagePaths.length === 1) {
          await runner.run(['-s', serial, 'uninstall', DA5_V5_ANDROID_PACKAGE], {
            timeoutMilliseconds: timeouts.uninstall,
          });
        }
      }
    } catch {
      return false;
    }
    await waitForSettle(250);
  }
  return false;
}

async function proveUncertainInstallNullWindow(runner, serial, waitForSettle, now) {
  const deadline = now() + uncertainInstallCleanup.maximumMilliseconds;
  let zeroSince = null;
  while (now() < deadline) {
    try {
      const mappings = await readMappings(
        runner,
        serial,
        undefined,
        remainingTimeout(deadline, now, timeouts.inspect),
      );
      const packagePaths = await readPackagePaths(
        runner,
        serial,
        undefined,
        remainingTimeout(deadline, now, timeouts.inspect),
      );
      const observedAt = now();
      if (observedAt > deadline || packagePaths.length > 1) {
        return false;
      }
      const ownedMappings = [];
      for (const required of requiredMappings) {
        const matches = mappings.filter((mapping) => mapping.device === required.device);
        if (
          matches.length > 1
          || (matches[0] !== undefined && matches[0].host !== required.host)
        ) {
          return false;
        }
        if (matches.length === 1) {
          ownedMappings.push(matches[0]);
        }
      }
      if (ownedMappings.length === 0 && packagePaths.length === 0) {
        zeroSince ??= observedAt;
        if (
          observedAt - zeroSince
          >= uncertainInstallCleanup.nullWindowMilliseconds
        ) {
          return true;
        }
      } else {
        zeroSince = null;
        for (const mapping of ownedMappings) {
          await runner.run(['-s', serial, 'reverse', '--remove', mapping.device], {
            timeoutMilliseconds: remainingTimeout(deadline, now, timeouts.reverse),
          });
        }
        if (packagePaths.length === 1) {
          await runner.run(['-s', serial, 'uninstall', DA5_V5_ANDROID_PACKAGE], {
            timeoutMilliseconds: remainingTimeout(deadline, now, timeouts.uninstall),
          });
        }
      }
    } catch {
      return false;
    }
    const remaining = deadline - now();
    if (remaining <= 0) {
      return false;
    }
    await waitForSettle(Math.min(uncertainInstallCleanup.pollMilliseconds, remaining));
  }
  return false;
}

function remainingTimeout(deadline, now, maximum) {
  const remaining = Math.floor(deadline - now());
  if (remaining <= 0) {
    throw new Error('DA5 V5 uncertain install cleanup timed out');
  }
  return Math.max(1, Math.min(maximum, remaining));
}

async function bindCurrentDevice(runner, serialBinding, binding, signal) {
  const serial = await requireSingleDa5V5UsbDevice(runner, { signal });
  await verifyDeviceBinding(runner, serial, binding, signal);
  if (serialBinding.bind(serial) !== 'match') {
    throw new Error('DA5 V5 exact USB device continuity mismatch');
  }
  return serialBinding.use(serial, (retained) => retained);
}

async function requireExactInstalledState(runner, serial, packageExpected = false, signal) {
  const mappings = await readMappings(runner, serial, signal);
  if (
    mappings.length !== requiredMappings.length
    || requiredMappings.some((required) => (
      mappings.filter((mapping) => (
        mapping.device === required.device && mapping.host === required.host
      )).length !== 1
    ))
  ) {
    throw new Error('DA5 V5 exact reverse mapping mismatch');
  }
  const packagePaths = await readPackagePaths(runner, serial, signal);
  if (
    (packageExpected && packagePaths.length !== 1)
    || (!packageExpected && packagePaths.length !== 0)
  ) {
    throw new Error('DA5 V5 exact package state mismatch');
  }
}

async function requireExactInstalledArtifactBytes(runner, serial, signal) {
  if (typeof runner.runBinaryDigest !== 'function') {
    throw new Error('DA5 V5 installed APK byte verification is unavailable');
  }
  const before = await readPackagePaths(runner, serial, signal);
  if (before.length !== 1 || before[0] === undefined) {
    throw new Error('DA5 V5 installed APK path is unavailable');
  }
  const installed = await runner.runBinaryDigest(
    ['-s', serial, 'shell', '-T', 'cat', '--', before[0]],
    {
      maximumBytes: DA5_V5_ANDROID_ARTIFACT.apk.bytes,
      signal,
      timeoutMilliseconds: timeouts.install,
    },
  );
  if (
    installed.bytes !== DA5_V5_ANDROID_ARTIFACT.apk.bytes
    || installed.sha256 !== DA5_V5_ANDROID_ARTIFACT.apk.sha256
  ) {
    throw new Error('DA5 V5 installed APK byte binding mismatch');
  }
  const after = await readPackagePaths(runner, serial, signal);
  if (after.length !== 1 || after[0] !== before[0]) {
    throw new Error('DA5 V5 installed APK path changed during byte verification');
  }
}

async function verifyDeviceBinding(runner, serial, binding, signal) {
  if (
    binding === undefined
    || typeof binding.deviceModel !== 'string'
    || binding.deviceModel.length === 0
    || typeof binding.androidBuild !== 'string'
    || binding.androidBuild.length === 0
  ) {
    throw new Error('DA5 V5 exact device binding is unavailable');
  }
  const model = oneLine(await runner.run([
    '-s', serial, 'shell', 'getprop', 'ro.product.model',
  ], { signal, timeoutMilliseconds: timeouts.inspect }));
  const build = oneLine(await runner.run([
    '-s', serial, 'shell', 'getprop', 'ro.build.fingerprint',
  ], { signal, timeoutMilliseconds: timeouts.inspect }));
  if (model !== binding.deviceModel || build !== binding.androidBuild) {
    throw new Error('DA5 V5 exact device binding mismatch');
  }
}

async function readPackagePaths(
  runner,
  serial,
  signal,
  timeoutMilliseconds = timeouts.inspect,
) {
  return (await runner.run(
    ['-s', serial, 'shell', 'pm', 'path', DA5_V5_ANDROID_PACKAGE],
    { signal, timeoutMilliseconds },
  ))
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      if (!line.startsWith('package:')) {
        throw new Error('DA5 V5 package state is ambiguous');
      }
      const path = line.slice('package:'.length);
      if (!isStrictInstalledBaseApkPath(path)) {
        throw new Error('DA5 V5 package state is ambiguous');
      }
      return path;
    });
}

function isStrictInstalledBaseApkPath(path) {
  if (!path.startsWith('/data/app/') || !path.endsWith('/base.apk')) {
    return false;
  }
  const segments = path.slice('/data/app/'.length).split('/');
  if (segments.length < 2 || segments.at(-1) !== 'base.apk') {
    return false;
  }
  return segments.slice(0, -1).every((segment) => (
    segment !== '.'
    && segment !== '..'
    && /^[A-Za-z0-9._~+=-]+$/u.test(segment)
  ));
}

async function readMappings(
  runner,
  serial,
  signal,
  timeoutMilliseconds = timeouts.inspect,
) {
  return parseDa5V5ReverseMappings(
    await runner.run(['-s', serial, 'reverse', '--list'], {
      signal,
      timeoutMilliseconds,
    }),
    serial,
  );
}

function validTcpEndpoint(value) {
  if (typeof value !== 'string' || !/^tcp:[1-9][0-9]{0,4}$/u.test(value)) {
    return false;
  }
  return Number(value.slice(4)) <= 65_535;
}

function requireSerialBinding(value) {
  if (
    value === undefined
    || typeof value.bind !== 'function'
    || typeof value.state !== 'function'
    || typeof value.use !== 'function'
  ) {
    throw new Error('DA5 V5 opaque USB serial binding is unavailable');
  }
  return value;
}

function oneLine(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /[\r\n]/u.test(trimmed)) {
    throw new Error('DA5 V5 device binding value is unavailable');
  }
  return trimmed;
}

function readTalkBackVersion(value) {
  const matches = [...value.matchAll(/^\s*versionName=(\S+)\s*$/gmu)];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error('DA5 V5 TalkBack binding is unavailable');
  }
  return matches[0][1];
}

function assertNoDa5V5OwnedListeners(value) {
  for (const line of value.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)) {
    const parts = line.split(/\s+/u);
    const local = parts[3];
    const port = local === undefined ? undefined : /:([0-9]{1,5})$/u.exec(local)?.[1];
    if (parts.length < 5 || port === undefined || Number(port) > 65_535) {
      throw new Error('DA5 V5 listener state is ambiguous');
    }
    if (port === '3000' || port === '54321') {
      throw new Error('DA5 V5 owned listener residue detected');
    }
  }
}

function runAdb(arguments_, options, dependencies) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (options.signal?.aborted === true) {
      rejectPromise(new Error('DA5 V5 Android device command aborted'));
      return;
    }
    const environment = createDa5V5AdbChildEnvironment(dependencies.environment);
    const stdinBytes = options.stdinBytes;
    if (stdinBytes !== undefined && !Buffer.isBuffer(stdinBytes)) {
      rejectPromise(new Error('DA5 V5 Android device input is invalid'));
      return;
    }
    const child = dependencies.spawn('adb', [...adbServerArguments, ...arguments_], {
      env: environment,
      stdio: [stdinBytes === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminationError;
    let forceKillTimeout;
    const timeout = setTimeout(() => {
      terminate(new Error('DA5 V5 Android device command timed out'));
    }, options.timeoutMilliseconds ?? timeouts.inspect);

    function abort() {
      terminate(new Error('DA5 V5 Android device command aborted'));
    }

    function terminate(error) {
      if (settled || terminationError !== undefined) {
        return;
      }
      terminationError = error;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, 1_000);
    }

    function removeListeners() {
      options.signal?.removeEventListener('abort', abort);
      child.removeListener('error', onChildError);
      child.stdout.removeListener('data', onStdoutData);
      child.stdout.removeListener('error', onStdoutError);
      child.stderr.removeListener('data', onStderrData);
      child.stderr.removeListener('error', onStderrError);
      if (child.stdin !== null) {
        child.stdin.removeListener('drain', writeStdin);
        child.stdin.removeListener('error', onStdinError);
      }
    }

    function finish(error, value) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      removeListeners();
      if (error === undefined) {
        resolvePromise(value ?? '');
      } else {
        rejectPromise(error);
      }
    }

    function onStdoutData(chunk) {
      if (terminationError !== undefined) {
        return;
      }
      const chunkBytes = Buffer.byteLength(chunk);
      if (stdoutBytes + chunkBytes > 4 * 1024 * 1024) {
        terminate(new Error('DA5 V5 Android device output exceeded its bound'));
        return;
      }
      stdoutBytes += chunkBytes;
      stdout += chunk;
    }

    function onStderrData(chunk) {
      if (terminationError !== undefined) {
        return;
      }
      stderrBytes += chunk.length;
      if (stderrBytes > 4 * 1024 * 1024) {
        terminate(new Error('DA5 V5 Android device output exceeded its bound'));
      }
    }

    function onStdoutError() {
      terminate(new Error('DA5 V5 Android device command failed'));
    }

    function onStderrError() {
      terminate(new Error('DA5 V5 Android device command failed'));
    }

    function onStdinError() {
      terminate(new Error('DA5 V5 Android device input failed'));
    }

    function onChildError() {
      terminate(new Error('DA5 V5 Android device command failed'));
    }

    function writeStdin() {
      if (
        settled
        || terminationError !== undefined
        || stdinBytes === undefined
        || child.stdin === null
      ) {
        return;
      }
      try {
        while (offset < stdinBytes.length) {
          const end = Math.min(offset + 1024 * 1024, stdinBytes.length);
          const writable = child.stdin.write(stdinBytes.subarray(offset, end));
          offset = end;
          if (!writable) {
            return;
          }
        }
        child.stdin.end();
      } catch {
        terminate(new Error('DA5 V5 Android device input failed'));
      }
    }

    let offset = 0;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', onStdoutData);
    child.stdout.once('error', onStdoutError);
    child.stderr.on('data', onStderrData);
    child.stderr.once('error', onStderrError);
    child.once('error', onChildError);
    child.once('close', (code) => {
      finish(
        terminationError ?? (
          code === 0 ? undefined : new Error('DA5 V5 Android device command failed')
        ),
        stdout,
      );
    });
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted === true) {
      abort();
    }
    if (stdinBytes !== undefined) {
      if (child.stdin === null) {
        terminate(new Error('DA5 V5 Android device input failed'));
        return;
      }
      child.stdin.once('error', onStdinError);
      child.stdin.on('drain', writeStdin);
      writeStdin();
    }
  });
}

function runAdbBinaryDigest(arguments_, options, dependencies) {
  return new Promise((resolvePromise, rejectPromise) => {
    if (options.signal?.aborted === true) {
      rejectPromise(new Error('DA5 V5 Android device command aborted'));
      return;
    }
    if (!Number.isSafeInteger(options.maximumBytes) || options.maximumBytes < 0) {
      rejectPromise(new Error('DA5 V5 Android device output bound is invalid'));
      return;
    }
    const environment = createDa5V5AdbChildEnvironment(dependencies.environment);
    const child = dependencies.spawn('adb', [...adbServerArguments, ...arguments_], {
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const digest = createHash('sha256');
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminationError;
    let forceKillTimeout;
    const timeout = setTimeout(() => {
      terminate(new Error('DA5 V5 Android device command timed out'));
    }, options.timeoutMilliseconds ?? timeouts.inspect);
    const abort = () => {
      terminate(new Error('DA5 V5 Android device command aborted'));
    };
    const terminate = (error) => {
      if (settled) return;
      terminationError ??= error;
      if (forceKillTimeout !== undefined) return;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, 1_000);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      options.signal?.removeEventListener('abort', abort);
      if (error === undefined) {
        resolvePromise(Object.freeze({
          bytes: stdoutBytes,
          sha256: digest.digest('hex'),
        }));
      } else {
        rejectPromise(error);
      }
    };
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > options.maximumBytes) {
        terminate(new Error('DA5 V5 Android device output exceeded its bound'));
        return;
      }
      digest.update(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > 4 * 1024 * 1024) {
        terminate(new Error('DA5 V5 Android device output exceeded its bound'));
      }
    });
    child.stdout.once('error', () => {
      terminate(new Error('DA5 V5 Android device command failed'));
    });
    child.stderr.once('error', () => {
      terminate(new Error('DA5 V5 Android device command failed'));
    });
    child.once('error', () => {
      terminate(new Error('DA5 V5 Android device command failed'));
    });
    child.once('close', (code) => {
      finish(
        terminationError ?? (
          code === 0 ? undefined : new Error('DA5 V5 Android device command failed')
        ),
      );
    });
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted === true) {
      abort();
    }
  });
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
