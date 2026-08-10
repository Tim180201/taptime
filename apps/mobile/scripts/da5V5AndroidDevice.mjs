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
import {
  DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES,
  DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES,
  SystemDa5V5ValidationInstallStreamRunner,
} from './da5V5ValidationInstallStream.mjs';

const requiredMappings = Object.freeze([
  Object.freeze({ device: 'tcp:54321', host: 'tcp:54321' }),
  Object.freeze({ device: 'tcp:3000', host: 'tcp:3000' }),
]);
const usbReverseTransport = 'UsbFfs';
const activeInstallTransactions = new WeakMap();
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
const allowedTalkBackPackages = Object.freeze([
  'com.google.android.marvin.talkback',
  'com.samsung.android.accessibility.talkback',
]);
const androidOwnerUser = '0';
const installSplitName = 'base.apk';
const maximumPackageInstallerSessionId = 2_147_483_647;
const cleanupRetryAttempts = 2;
const cleanupPackageResource = 'package';
const transientAdbErrorCodes = new Set([
  'EAGAIN',
  'EBUSY',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
]);
const cleanupResourceStates = Object.freeze({
  baselineUnproven: 'baseline_unproven',
  cleanupFailed: 'cleanup_failed',
  cleanupNotStarted: 'cleanup_not_started',
  cleanupRemovalStarted: 'cleanup_removal_started',
  cleanupRemoved: 'cleanup_removed',
  mutationNotStarted: 'mutation_not_started',
  mutationOwned: 'mutation_owned',
  mutationUncertain: 'mutation_uncertain',
  zeroProven: 'zero_proven',
});

export const DA5_V5_ANDROID_CLEANUP_SUBSTAGES = Object.freeze({
  artifactSnapshotDestroy: 'artifact_snapshot_destroy',
  complete: 'complete',
  deviceReattest: 'device_reattest',
  finalZero: 'final_zero',
  installAbandon: 'install_abandon',
  internal: 'cleanup_internal',
  notRequired: 'not_required',
  packageList: 'package_list',
  packageUninstall: 'package_uninstall',
  processList: 'process_list',
  reverseList: 'reverse_list',
  reverseRemoveApi: 'reverse_remove_tcp_3000',
  reverseRemoveAuth: 'reverse_remove_tcp_54321',
  runnerBinding: 'runner_binding',
  uncertaintyEscalation: 'uncertainty_escalation',
});

const cleanupNotRequired = Object.freeze({
  status: 'not_required',
  substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.notRequired,
});

function createCleanupResourceRecord() {
  return Object.freeze({
    baseline: cleanupResourceStates.baselineUnproven,
    cleanup: cleanupResourceStates.cleanupNotStarted,
    mutation: cleanupResourceStates.mutationNotStarted,
  });
}

function cleanupCoverageIsUncertain(coverage) {
  return (
    coverage.installationUncertain === true
    || coverage.reverseUncertain === true
  );
}

function cleanupCoverageIncludes(completed, requested) {
  return (
    completed !== undefined
    && (!requested.installationUncertain || completed.installationUncertain)
    && (!requested.reverseUncertain || completed.reverseUncertain)
  );
}

export const DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES = Object.freeze({
  artifactReverify: 'artifact_reverify',
  childExit: 'child_exit',
  childStartTransport: 'child_start_transport',
  cleanup: 'cleanup',
  installedProvenance: 'installed_provenance',
  packageManagerReceipt: 'package_manager_receipt',
  signalAbort: 'signal_abort',
  stdinPipe: 'stdin_pipe',
  timeout: 'timeout',
});

export class Da5V5AndroidInstallError extends Error {
  constructor(category, cleanup = cleanupNotRequired) {
    super('DA5 V5 Android install failed');
    this.name = 'Da5V5AndroidInstallError';
    this.category = requireInstallFailureCategory(category);
    const normalizedCleanup = requireInstallCleanupEvidence(cleanup);
    this.cleanupStatus = normalizedCleanup.status;
    this.cleanupSubstage = normalizedCleanup.substage;
  }
}

export function classifyDa5V5AndroidInstallError(error) {
  return classifyTypedInstallFailure(
    error,
    DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
  );
}

export function classifyDa5V5AndroidInstallCleanup(error) {
  if (error instanceof Da5V5AndroidInstallError) {
    return Object.freeze({
      status: error.cleanupStatus,
      substage: error.cleanupSubstage,
    });
  }
  return cleanupNotRequired;
}

export function requireDa5V5TalkBackPackage(value) {
  if (!allowedTalkBackPackages.includes(value)) {
    throw new Error('DA5 V5 TalkBack package binding is unavailable');
  }
  return value;
}

export function requireDa5V5ActiveTalkBackProvider(
  accessibilityEnabled,
  enabledServices,
  expectedPackage,
) {
  const talkBackPackage = requireDa5V5TalkBackPackage(expectedPackage);
  if (oneLine(accessibilityEnabled) !== '1') {
    throw new Error('DA5 V5 accessibility provider is inactive');
  }
  const activePackages = new Set(
    enabledServices.trim().split(':').map((component) => {
      const match = /^([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\/[A-Za-z0-9_.$]+$/u.exec(component);
      if (match?.[1] === undefined) {
        throw new Error('DA5 V5 accessibility provider binding is unavailable');
      }
      return match[1];
    }),
  );
  if (
    activePackages.size !== 1
    || !activePackages.has(talkBackPackage)
  ) {
    throw new Error('DA5 V5 accessibility provider binding mismatch');
  }
  return talkBackPackage;
}

export function requireDa5V5AccessibilityDisabled(
  accessibilityEnabled,
  enabledServices,
) {
  const normalizedServices = enabledServices.trim();
  if (
    oneLine(accessibilityEnabled) !== '0'
    || (normalizedServices !== '' && normalizedServices !== 'null')
  ) {
    throw new Error('DA5 V5 standard accessibility binding mismatch');
  }
}

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

export class Da5V5AndroidCommandAbortError extends Error {
  constructor() {
    super('DA5 V5 Android device command aborted');
    this.name = 'Da5V5AndroidCommandAbortError';
  }
}

export function isDa5V5AndroidCommandAbortError(error) {
  return error instanceof Da5V5AndroidCommandAbortError;
}

export class Da5V5AndroidCommandTimeoutError extends Error {
  constructor() {
    super('DA5 V5 Android device command timed out');
    this.name = 'Da5V5AndroidCommandTimeoutError';
  }
}

export function isDa5V5AndroidCommandTimeoutError(error) {
  return error instanceof Da5V5AndroidCommandTimeoutError;
}

export class Da5V5AndroidCommandExitError extends Error {
  constructor() {
    super('DA5 V5 Android device command exited unsuccessfully');
    this.name = 'Da5V5AndroidCommandExitError';
  }
}

export class Da5V5AndroidCommandTransientError extends Error {
  constructor() {
    super('DA5 V5 Android device command failed transiently');
    this.name = 'Da5V5AndroidCommandTransientError';
  }
}

export function isDa5V5AndroidCommandTransientError(error) {
  return error instanceof Da5V5AndroidCommandTransientError;
}

function classifyAdbTransportError(error) {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && transientAdbErrorCodes.has(error.code)
  )
    ? new Da5V5AndroidCommandTransientError()
    : new Error('DA5 V5 Android device command failed');
}

export class SystemDa5V5AndroidAdbRunner {
  constructor(dependencies = {}) {
    this.dependencies = Object.freeze({
      adbPath: dependencies.adbPath ?? 'adb',
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

  createInstallStreamRunner() {
    return new SystemDa5V5ValidationInstallStreamRunner(this.dependencies);
  }
}

export class Da5V5AndroidInstallTransaction {
  #abandonFlight;
  #cleanupCoverage;
  #cleanupDeadline = null;
  #cleanupFlight;
  #installStarted = false;
  #packageRemovalFlight;
  #resources = new Map([
    [cleanupPackageResource, createCleanupResourceRecord()],
    ...requiredMappings.map(({ device }) => [device, createCleanupResourceRecord()]),
  ]);
  #serial = null;
  #sessionId;
  #sessionState = 'none';

  constructor(options) {
    if (
      options === undefined
      || typeof options.runner?.run !== 'function'
      || typeof options.installStreamRunner?.write !== 'function'
    ) {
      throw new Error('DA5 V5 Android install runner binding is unavailable');
    }
    const serialBinding = requireSerialBinding(options.serialBinding);
    requireDeviceBinding(options.deviceBinding);
    this.runner = options.runner;
    this.installStreamRunner = options.installStreamRunner;
    this.serialBinding = serialBinding;
    this.deviceBinding = Object.freeze({
      androidBuild: options.deviceBinding.androidBuild,
      deviceModel: options.deviceBinding.deviceModel,
    });
    this.cleanupOwnership = Object.freeze({
      deviceBinding: this.deviceBinding,
      packageName: DA5_V5_ANDROID_PACKAGE,
      reverseMappings: requiredMappings,
    });
    Object.freeze(this);
  }

  matchesInstallBindings(options) {
    return (
      options.runner === this.runner
      && options.installStreamRunner === this.installStreamRunner
      && options.serialBinding === this.serialBinding
      && deviceBindingMatches(options.deviceBinding, this.deviceBinding)
    );
  }

  matchesCleanupBindings(options) {
    return (
      options.runner === this.runner
      && options.serialBinding === this.serialBinding
      && deviceBindingMatches(options.deviceBinding, this.deviceBinding)
    );
  }

  beginInstall() {
    const active = activeInstallTransactions.get(this.runner);
    if (
      this.#installStarted
      || this.#cleanupFlight !== undefined
      || (active !== undefined && active !== this)
    ) {
      return false;
    }
    activeInstallTransactions.set(this.runner, this);
    this.#installStarted = true;
    return true;
  }

  bindSerial(serial) {
    if (
      typeof serial !== 'string'
      || serial.length === 0
      || (this.#serial !== null && this.#serial !== serial)
    ) {
      return false;
    }
    this.#serial = serial;
    return true;
  }

  serialMatches(serial) {
    return this.#serial !== null && this.#serial === serial;
  }

  markZeroPreconditionProven() {
    if (this.hasMutationStarted()) {
      throw new Error('DA5 V5 Android cleanup zero precondition is unavailable');
    }
    for (const resource of this.#resources.keys()) {
      const record = this.#resource(resource);
      if (record.baseline !== cleanupResourceStates.baselineUnproven) {
        throw new Error('DA5 V5 Android cleanup zero precondition was already used');
      }
      this.#setResource(resource, {
        ...record,
        baseline: cleanupResourceStates.zeroProven,
      });
    }
  }

  markReverseMutationStarted(device) {
    this.#markMutationStarted(device);
  }

  markReverseMutationProven(device) {
    this.#markMutationProven(device);
  }

  markReverseStateProven() {
    for (const { device } of requiredMappings) {
      this.#markMutationProven(device);
    }
  }

  markSessionCreateStarted() {
    this.#markMutationStarted(cleanupPackageResource);
    this.#sessionState = 'uncertain';
    this.#sessionId = undefined;
  }

  markSessionAbsent() {
    this.#sessionState = 'absent';
    this.#sessionId = undefined;
  }

  markSessionPending(serial, sessionId) {
    if (!this.serialMatches(serial)) {
      throw new Error('DA5 V5 Android install session device mismatch');
    }
    this.#sessionState = 'pending';
    this.#sessionId = sessionId;
  }

  markSessionCommitted() {
    this.#markMutationProven(cleanupPackageResource);
    this.#sessionState = 'committed';
    this.#sessionId = undefined;
  }

  markInstalledProven() {
    this.#markMutationProven(cleanupPackageResource);
  }

  hasMutationStarted() {
    return [...this.#resources.values()].some((record) => (
      record.mutation !== cleanupResourceStates.mutationNotStarted
    ));
  }

  uncertainMutation() {
    return [...this.#resources.values()].some((record) => (
      record.mutation === cleanupResourceStates.mutationUncertain
    ));
  }

  canMutatePackage() {
    return this.#canMutateResource(cleanupPackageResource);
  }

  canMutateReverseMapping(device) {
    return this.#canMutateResource(device, true);
  }

  markReverseMappingRemoved(device) {
    this.#markResourceRemoved(device);
  }

  beginReverseMappingRemoval(device) {
    this.#markRemovalStarted(device);
  }

  markReverseMappingCleanupFailed(device) {
    this.#markResourceCleanupFailed(device);
  }

  markPackageRemoved() {
    this.#markResourceRemoved(cleanupPackageResource);
  }

  sessionSettled() {
    return [
      'none',
      'absent',
      'abandoned',
      'committed',
    ].includes(this.#sessionState);
  }

  settleInstallSession(serial, operation) {
    if (this.#abandonFlight !== undefined) {
      return this.#abandonFlight;
    }
    if (this.sessionSettled()) {
      return Promise.resolve(Object.freeze({ status: 'match' }));
    }
    if (
      this.#sessionState !== 'pending'
      || typeof this.#sessionId !== 'string'
      || !this.serialMatches(serial)
    ) {
      return Promise.resolve(Object.freeze({ status: 'mismatch' }));
    }
    const sessionId = this.#sessionId;
    this.#sessionState = 'abandon_attempted';
    this.#abandonFlight = (async () => {
      try {
        const result = await operation(sessionId);
        if (result?.status !== 'match') {
          return Object.freeze({ status: 'mismatch' });
        }
        this.#sessionId = undefined;
        this.#sessionState = 'abandoned';
        return Object.freeze({ status: 'match' });
      } catch {
        return Object.freeze({ status: 'mismatch' });
      }
    })();
    return this.#abandonFlight;
  }

  removePackage(serial, operation) {
    if (this.#packageRemovalFlight !== undefined) {
      return this.#packageRemovalFlight;
    }
    if (!this.serialMatches(serial) || !this.canMutatePackage()) {
      return Promise.resolve(Object.freeze({ status: 'mismatch' }));
    }
    this.#markRemovalStarted(cleanupPackageResource);
    this.#packageRemovalFlight = Promise.resolve()
      .then(operation)
      .then((result) => {
        if (result?.status !== 'match') {
          this.#markResourceCleanupFailed(cleanupPackageResource);
          return Object.freeze({ status: 'mismatch' });
        }
        this.#markResourceRemoved(cleanupPackageResource);
        return Object.freeze({ status: 'match' });
      })
      .catch(() => {
        this.#markResourceCleanupFailed(cleanupPackageResource);
        return Object.freeze({ status: 'mismatch' });
      });
    return this.#packageRemovalFlight;
  }

  cleanup(options, now, operation) {
    const requestedCoverage = this.#requestedCleanupCoverage(options);
    if (this.#cleanupFlight !== undefined) {
      if (!cleanupCoverageIncludes(this.#cleanupCoverage, requestedCoverage)) {
        return Promise.resolve(cleanupMismatch(
          DA5_V5_ANDROID_CLEANUP_SUBSTAGES.uncertaintyEscalation,
        ));
      }
      return this.#cleanupFlight;
    }
    this.#cleanupCoverage = requestedCoverage;
    this.#cleanupDeadline = cleanupCoverageIsUncertain(requestedCoverage)
      ? now() + uncertainInstallCleanup.maximumMilliseconds
      : null;
    this.#cleanupFlight = Promise.resolve().then(() => operation(Object.freeze({
      deadline: this.#cleanupDeadline,
      installationUncertain: requestedCoverage.installationUncertain,
      reverseUncertain: requestedCoverage.reverseUncertain,
    }))).catch(() => (
      cleanupMismatch(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.internal)
    ));
    return this.#cleanupFlight;
  }

  markCleanupComplete() {
    const active = activeInstallTransactions.get(this.runner);
    if (this.#installStarted && active !== this) {
      throw new Error('DA5 V5 Android install transaction ownership mismatch');
    }
    for (const [resource, record] of this.#resources) {
      if (record.mutation !== cleanupResourceStates.mutationNotStarted) {
        this.#setResource(resource, {
          ...record,
          cleanup: cleanupResourceStates.cleanupRemoved,
        });
      }
    }
    if (
      this.#installStarted
      && !activeInstallTransactions.delete(this.runner)
    ) {
      throw new Error('DA5 V5 Android install transaction release mismatch');
    }
  }

  #requestedCleanupCoverage(options) {
    return Object.freeze({
      installationUncertain: (
        options.installationState === 'uncertain'
        || this.#resource(cleanupPackageResource).mutation
          === cleanupResourceStates.mutationUncertain
      ),
      reverseUncertain: (
        options.reverseState === 'uncertain'
        || requiredMappings.some(({ device }) => (
          this.#resource(device).mutation === cleanupResourceStates.mutationUncertain
        ))
      ),
    });
  }

  #canMutateResource(resource, allowPreviouslyRemoved = false) {
    const record = this.#resource(resource);
    return (
      record.baseline === cleanupResourceStates.zeroProven
      && [
        cleanupResourceStates.mutationOwned,
        cleanupResourceStates.mutationUncertain,
      ].includes(record.mutation)
      && [
        cleanupResourceStates.cleanupNotStarted,
        cleanupResourceStates.cleanupRemovalStarted,
        ...(allowPreviouslyRemoved ? [cleanupResourceStates.cleanupRemoved] : []),
      ].includes(record.cleanup)
    );
  }

  #markMutationStarted(resource) {
    const record = this.#resource(resource);
    if (
      record.baseline !== cleanupResourceStates.zeroProven
      || record.mutation !== cleanupResourceStates.mutationNotStarted
      || record.cleanup !== cleanupResourceStates.cleanupNotStarted
    ) {
      throw new Error('DA5 V5 Android cleanup resource ownership is unavailable');
    }
    this.#setResource(resource, {
      ...record,
      mutation: cleanupResourceStates.mutationUncertain,
    });
  }

  #markMutationProven(resource) {
    const record = this.#resource(resource);
    if (
      record.baseline !== cleanupResourceStates.zeroProven
      || ![
        cleanupResourceStates.mutationOwned,
        cleanupResourceStates.mutationUncertain,
      ].includes(record.mutation)
    ) {
      throw new Error('DA5 V5 Android cleanup resource ownership is unavailable');
    }
    this.#setResource(resource, {
      ...record,
      mutation: cleanupResourceStates.mutationOwned,
    });
  }

  #markRemovalStarted(resource) {
    const record = this.#resource(resource);
    if (
      !this.#canMutateResource(resource, resource !== cleanupPackageResource)
      || ![
        cleanupResourceStates.cleanupNotStarted,
        cleanupResourceStates.cleanupRemoved,
      ].includes(record.cleanup)
    ) {
      throw new Error('DA5 V5 Android cleanup resource ownership is unavailable');
    }
    this.#setResource(resource, {
      ...record,
      cleanup: cleanupResourceStates.cleanupRemovalStarted,
    });
  }

  #markResourceCleanupFailed(resource) {
    const record = this.#resource(resource);
    this.#setResource(resource, {
      ...record,
      cleanup: cleanupResourceStates.cleanupFailed,
    });
  }

  #markResourceRemoved(resource) {
    const record = this.#resource(resource);
    if (record.mutation === cleanupResourceStates.mutationNotStarted) {
      throw new Error('DA5 V5 Android cleanup resource ownership is unavailable');
    }
    this.#setResource(resource, {
      ...record,
      cleanup: cleanupResourceStates.cleanupRemoved,
    });
  }

  #resource(resource) {
    const record = this.#resources.get(resource);
    if (record === undefined) {
      throw new Error('DA5 V5 Android cleanup resource is unavailable');
    }
    return record;
  }

  #setResource(resource, record) {
    this.#resources.set(resource, Object.freeze(record));
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
      const accessibilityEnabled = await this.runner.run(
        ['-s', serial, 'shell', 'settings', 'get', 'secure', 'accessibility_enabled'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      const enabledAccessibilityServices = await this.runner.run(
        ['-s', serial, 'shell', 'settings', 'get', 'secure',
          'enabled_accessibility_services'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      requireDa5V5AccessibilityDisabled(
        accessibilityEnabled,
        enabledAccessibilityServices,
      );
      const listeners = await this.runner.run(
        ['-s', serial, 'shell', 'ss', '-ltnH'],
        { signal: options.signal, timeoutMilliseconds: timeouts.inspect },
      );
      if (
        oneLine(release) !== this.binding.androidRelease
        || oneLine(api) !== this.binding.androidApi
        || oneLine(fontScale) !== this.binding.fontScale
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
    timeoutMilliseconds: options.timeoutMilliseconds ?? timeouts.inspect,
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

export function parseDa5V5ReverseMappings(value, _expectedSerial) {
  const lines = value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length !== 0);
  const devices = new Set();
  return Object.freeze(lines.map((line) => {
    const parts = line.split(/\s+/u);
    const [transport, device, host] = parts;
    if (
      parts.length !== 3
      || transport !== usbReverseTransport
      || !validTcpEndpoint(device)
      || !validTcpEndpoint(host)
      || devices.has(device)
    ) {
      throw new Error('DA5 V5 reverse mapping output is malformed or unexpected');
    }
    devices.add(device);
    return Object.freeze({ device, host });
  }));
}

export async function assertDa5V5PackageMappingZero(runner, serial, options = {}) {
  const packagePaths = await readPackagePaths(runner, serial, options.signal);
  const processes = await readMatchingProcesses(runner, serial, options.signal);
  const mappings = await readMappings(runner, serial, options.signal);
  if (
    packagePaths.length !== 0
    || processes.length !== 0
    || mappings.length !== 0
  ) {
    throw new Error('DA5 V5 package/process/mapping zero state mismatch');
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
  let verification;
  try {
    verification = verifyArtifact({
      profile: options.profile,
      ...(options.artifactDependencies === undefined
        ? {}
        : { dependencies: options.artifactDependencies }),
    });
  } catch {
    throw new Da5V5AndroidInstallError(
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.artifactReverify,
    );
  }
  const runner = options.runner ?? new SystemDa5V5AndroidAdbRunner();
  const installStreamRunner = options.installStreamRunner ?? (
    runner instanceof SystemDa5V5AndroidAdbRunner
      ? runner.createInstallStreamRunner()
      : null
  );
  if (typeof installStreamRunner?.write !== 'function') {
    throw new Da5V5AndroidInstallError(
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
    );
  }
  const serialBinding = requireSerialBinding(options.serialBinding);
  const transaction = requireInstallTransaction(options.transaction);
  if (
    !transaction.matchesInstallBindings({
      deviceBinding: options.deviceBinding,
      installStreamRunner,
      runner,
      serialBinding,
    })
    || !transaction.beginInstall()
  ) {
    throw new Da5V5AndroidInstallError(
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
    );
  }
  const now = options.now ?? (() => performance.now());
  let failureCategory =
    DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport;
  let verifiedSource = null;
  try {
    const serial = await bindCurrentDevice(
      runner,
      serialBinding,
      options.deviceBinding,
      options.signal,
      transaction,
    );
    await assertDa5V5PackageMappingZero(runner, serial, { signal: options.signal });
    transaction.markZeroPreconditionProven();
    for (const mapping of requiredMappings) {
      transaction.markReverseMutationStarted(mapping.device);
      await runner.run(['-s', serial, 'reverse', mapping.device, mapping.host], {
        signal: options.signal,
        timeoutMilliseconds: timeouts.reverse,
      });
      transaction.markReverseMutationProven(mapping.device);
    }
    await requireExactInstalledState(runner, serial, false, options.signal);
    transaction.markReverseStateProven();
    failureCategory =
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.artifactReverify;
    try {
      verifiedSource = reverifyArtifact(
        verification,
        options.artifactDependencies?.files,
      );
    } catch {
      throw new Error('DA5 V5 verified APK snapshot is unavailable');
    }
    if (
      verifiedSource?.status !== 'match'
      || typeof verifiedSource.use !== 'function'
      || typeof verifiedSource.destroy !== 'function'
    ) {
      throw new Error('DA5 V5 verified APK snapshot is unavailable');
    }
    failureCategory =
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport;
    transaction.markSessionCreateStarted();
    const installDeadline = now() + timeouts.install;
    const createReceipt = await runInstallControlCommand(
      runner,
      [
        '-s', serial, 'shell', '-T', '-x', 'cmd', 'package',
        'install-create', '-R', '--user', androidOwnerUser,
        '--pkg', DA5_V5_ANDROID_PACKAGE,
        '-S', String(DA5_V5_ANDROID_ARTIFACT.apk.bytes),
      ],
      options.signal,
      installDeadline,
      now,
    );
    const createResult = parsePackageManagerCreateReceipt(createReceipt);
    if (createResult.status !== 'match') {
      failureCategory =
        DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt;
      if (createResult.sessionAbsent) {
        transaction.markSessionAbsent();
      }
      throw new Error('DA5 V5 Android install-create receipt mismatch');
    }
    transaction.markSessionPending(serial, createResult.sessionId);

    const writeSerial = await bindCurrentDevice(
      runner,
      serialBinding,
      options.deviceBinding,
      options.signal,
      transaction,
    );
    if (writeSerial !== serial) {
      throw new Error('DA5 V5 Android install-write device mismatch');
    }
    let writeOutcome;
    try {
      writeOutcome = await verifiedSource.use((snapshot) => installStreamRunner.write(
        [
          '-s', writeSerial, 'shell', '-T', '-x', 'cmd', 'package',
          'install-write', '-S', String(DA5_V5_ANDROID_ARTIFACT.apk.bytes),
          createResult.sessionId, installSplitName, '-',
        ],
        {
          signal: options.signal,
          stdinBytes: snapshot,
          timeoutMilliseconds: remainingInstallTimeout(installDeadline, now),
        },
      ));
    } finally {
      verifiedSource = null;
    }
    if (writeOutcome?.status !== 'match') {
      failureCategory = installStreamFailureCategory(writeOutcome);
      throw new Error('DA5 V5 Android install-write stream mismatch');
    }
    failureCategory = classifyPackageManagerWriteReceipt(
      writeOutcome.stdout,
      writeOutcome.stdinTerminal,
    );
    if (failureCategory !== null) {
      throw new Error('DA5 V5 Android install-write receipt mismatch');
    }

    failureCategory =
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport;
    const commitSerial = await bindCurrentDevice(
      runner,
      serialBinding,
      options.deviceBinding,
      options.signal,
      transaction,
    );
    if (commitSerial !== serial) {
      throw new Error('DA5 V5 Android install-commit device mismatch');
    }
    const commitReceipt = await runInstallControlCommand(
      runner,
      [
        '-s', commitSerial, 'shell', '-T', '-x', 'cmd', 'package',
        'install-commit', createResult.sessionId,
      ],
      options.signal,
      installDeadline,
      now,
    );
    if (!isExactPackageManagerSuccess(commitReceipt)) {
      failureCategory =
        DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt;
      throw new Error('DA5 V5 Android install-commit receipt mismatch');
    }
    transaction.markSessionCommitted();

    failureCategory =
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.installedProvenance;
    const proofSerial = await bindCurrentDevice(
      runner,
      serialBinding,
      options.deviceBinding,
      options.signal,
      transaction,
    );
    if (proofSerial !== serial) {
      throw new Error('DA5 V5 Android installed device mismatch');
    }
    await requireExactInstalledState(runner, proofSerial, true, options.signal);
    await requireExactInstalledArtifactBytes(runner, proofSerial, options.signal);
    transaction.markInstalledProven();
    return Object.freeze({
      packageName: DA5_V5_ANDROID_PACKAGE,
      status: 'match',
    });
  } catch (error) {
    failureCategory = classifyTypedInstallFailure(error, failureCategory);
    let cleanupEvidence = cleanupNotRequired;
    try {
      verifiedSource?.destroy();
    } catch {
      cleanupEvidence = cleanupMismatch(
        DA5_V5_ANDROID_CLEANUP_SUBSTAGES.artifactSnapshotDestroy,
      );
    }
    if (transaction.hasMutationStarted()) {
      const rollback = await cleanupDa5V5AndroidState({
        transaction,
        profile: options.profile,
        runner,
        deviceBinding: options.deviceBinding,
        serialBinding,
        now: options.now,
        wait: options.wait,
      });
      if (rollback.status === 'mismatch' || cleanupEvidence.status !== 'mismatch') {
        cleanupEvidence = rollback;
      }
    }
    throw new Da5V5AndroidInstallError(failureCategory, cleanupEvidence);
  }
}

export function cleanupDa5V5AndroidState(options) {
  requireDa5V5AndroidProfile(options.profile);
  const runner = options.runner ?? new SystemDa5V5AndroidAdbRunner();
  const serialBinding = requireSerialBinding(options.serialBinding);
  const now = options.now ?? (() => performance.now());
  let transaction;
  try {
    transaction = requireInstallTransaction(options.transaction);
  } catch {
    return Promise.resolve(cleanupMismatch(
      DA5_V5_ANDROID_CLEANUP_SUBSTAGES.runnerBinding,
    ));
  }
  if (!transaction.matchesCleanupBindings({
    deviceBinding: options.deviceBinding,
    runner,
    serialBinding,
  })) {
    return Promise.resolve(cleanupMismatch(
      DA5_V5_ANDROID_CLEANUP_SUBSTAGES.runnerBinding,
    ));
  }
  return transaction.cleanup(options, now, async (coverage) => {
    const context = Object.freeze({
      deadline: coverage.deadline,
      now,
      wait: options.wait ?? wait,
    });
    return performCleanup(
      transaction,
      runner,
      options.deviceBinding,
      serialBinding,
      context,
      coverage,
    );
  });
}

async function performCleanup(
  transaction,
  runner,
  deviceBinding,
  serialBinding,
  context,
  coverage,
) {
  let firstFailure;
  const recordFailure = (substage) => {
    firstFailure ??= substage;
  };
  const removalState = {
    blockedMappings: new Set(),
    removeAttempts: new Map(),
  };
  const ownership = transaction.cleanupOwnership;
  let serial;
  if (
    serialBinding.state() === 'unbound'
    && !transaction.hasMutationStarted()
    && !cleanupCoverageIsUncertain(coverage)
  ) {
    transaction.markCleanupComplete();
    return cleanupMatch();
  }
  try {
    serial = await reattestCleanupDevice(
      transaction,
      runner,
      serialBinding,
      deviceBinding,
      context,
    );
  } catch {
    return cleanupMismatch(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.deviceReattest);
  }

  const sessionCleanup = await transaction.settleInstallSession(
    serial,
    async (sessionId) => {
      const current = await reattestCleanupDevice(
        transaction,
        runner,
        serialBinding,
        deviceBinding,
        context,
      );
      if (current !== serial) {
        return Object.freeze({ status: 'mismatch' });
      }
      const receipt = await runner.run(
        [
          '-s', serial, 'shell', '-T', '-x', 'cmd', 'package',
          'install-abandon', sessionId,
        ],
        { timeoutMilliseconds: cleanupCommandTimeout(context, timeouts.uninstall) },
      );
      return Object.freeze({
        status: isExactPackageManagerSuccess(receipt) ? 'match' : 'mismatch',
      });
    },
  );
  if (sessionCleanup.status !== 'match') {
    recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.installAbandon);
  }

  let mappings;
  try {
    mappings = await retryCleanupOperation(
      () => readMappings(
        runner,
        serial,
        undefined,
        cleanupCommandTimeout(context, timeouts.inspect),
      ),
      context,
    );
  } catch {
    mappings = null;
    for (const required of ownership.reverseMappings) {
      removalState.blockedMappings.add(required.device);
    }
    recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseList);
  }
  if (mappings !== null) {
    for (const required of ownership.reverseMappings) {
      const matches = mappings.filter((mapping) => mapping.device === required.device);
      const substage = cleanupMappingSubstage(required.device);
      if (
        matches.length > 1
        || (matches[0] !== undefined && matches[0].host !== required.host)
      ) {
        removalState.blockedMappings.add(required.device);
        recordFailure(substage);
        continue;
      }
      if (matches.length === 0) {
        if (
          !coverage.reverseUncertain
          && transaction.canMutateReverseMapping(required.device)
        ) {
          transaction.markReverseMappingRemoved(required.device);
        }
        continue;
      }
      if (!transaction.canMutateReverseMapping(required.device)) {
        removalState.blockedMappings.add(required.device);
        recordFailure(substage);
        continue;
      }
      if (
        !await removeExactOwnedMapping({
          context,
          deviceBinding,
          mapping: required,
          removalState,
          runner,
          serial,
          serialBinding,
          transaction,
        })
      ) {
        removalState.blockedMappings.add(required.device);
        recordFailure(substage);
      }
    }
  }

  let packagePaths = [];
  try {
    packagePaths = await readPackagePaths(
      runner,
      serial,
      undefined,
      () => cleanupCommandTimeout(context, timeouts.inspect),
    );
    if (packagePaths.length > 1) {
      recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageList);
    } else if (packagePaths.length === 1) {
      if (!transaction.canMutatePackage()) {
        recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageUninstall);
      } else {
        const packageCleanup = await transaction.removePackage(serial, async () => {
          const current = await reattestCleanupDevice(
            transaction,
            runner,
            serialBinding,
            deviceBinding,
            context,
          );
          if (current !== serial) {
            return Object.freeze({ status: 'mismatch' });
          }
          const receipt = await runner.run(
            ['-s', serial, 'uninstall', ownership.packageName],
            { timeoutMilliseconds: cleanupCommandTimeout(context, timeouts.uninstall) },
          );
          return Object.freeze({
            status: isExactPackageManagerSuccess(receipt) ? 'match' : 'mismatch',
          });
        });
        if (packageCleanup.status !== 'match') {
          recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageUninstall);
        }
      }
    } else if (!coverage.installationUncertain && transaction.canMutatePackage()) {
      transaction.markPackageRemoved();
    }
  } catch {
    recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageList);
  }

  try {
    const processes = await readMatchingProcesses(
      runner,
      serial,
      undefined,
      cleanupCommandTimeout(context, timeouts.inspect),
    );
    if (processes.length !== 0 && packagePaths.length === 0) {
      recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.processList);
    }
  } catch {
    recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.processList);
  }

  if (!await proveFinalZero(
    transaction,
    runner,
    serial,
    serialBinding,
    deviceBinding,
    context,
    removalState,
  )) {
    recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.finalZero);
  }
  if (!transaction.sessionSettled()) {
    recordFailure(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.installAbandon);
  }
  if (firstFailure !== undefined) {
    return cleanupMismatch(firstFailure);
  }
  transaction.markCleanupComplete();
  return cleanupMatch();
}

async function proveFinalZero(
  transaction,
  runner,
  serial,
  serialBinding,
  deviceBinding,
  context,
  removalState,
) {
  if (context.deadline !== null) {
    return proveUncertainInstallNullWindow(
      transaction,
      runner,
      serial,
      serialBinding,
      deviceBinding,
      context,
      removalState,
    );
  }
  let consecutiveZeroObservations = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const current = await reattestCleanupDevice(
        transaction,
        runner,
        serialBinding,
        deviceBinding,
        context,
      );
      if (current !== serial) return false;
      const mappings = await retryCleanupOperation(
        () => readMappings(
          runner,
          serial,
          undefined,
          cleanupCommandTimeout(context, timeouts.inspect),
        ),
        context,
      );
      const packagePaths = await readPackagePaths(
        runner,
        serial,
        undefined,
        () => cleanupCommandTimeout(context, timeouts.inspect),
      );
      const processes = await readMatchingProcesses(
        runner,
        serial,
        undefined,
        cleanupCommandTimeout(context, timeouts.inspect),
      );
      const mutableMappings = exactMutableCleanupMappings(
        transaction,
        mappings,
        removalState,
      );
      if (mutableMappings === null) return false;
      if (
        mutableMappings.length === 0
        && packagePaths.length === 0
        && processes.length === 0
      ) {
        consecutiveZeroObservations += 1;
        if (consecutiveZeroObservations >= 2) return true;
      } else {
        consecutiveZeroObservations = 0;
        for (const mapping of mutableMappings) {
          if (!await removeExactOwnedMapping({
            context,
            deviceBinding,
            mapping,
            removalState,
            runner,
            serial,
            serialBinding,
            transaction,
          })) return false;
        }
        if (packagePaths.length !== 0 || processes.length !== 0) return false;
      }
    } catch {
      return false;
    }
    await waitForCleanup(context, uncertainInstallCleanup.pollMilliseconds);
  }
  return false;
}

async function proveUncertainInstallNullWindow(
  transaction,
  runner,
  serial,
  serialBinding,
  deviceBinding,
  context,
  removalState,
) {
  let zeroSince = null;
  while (context.now() < context.deadline) {
    try {
      const current = await reattestCleanupDevice(
        transaction,
        runner,
        serialBinding,
        deviceBinding,
        context,
      );
      if (current !== serial) return false;
      const mappings = await retryCleanupOperation(
        () => readMappings(
          runner,
          serial,
          undefined,
          cleanupCommandTimeout(context, timeouts.inspect),
        ),
        context,
      );
      const packagePaths = await readPackagePaths(
        runner,
        serial,
        undefined,
        () => cleanupCommandTimeout(context, timeouts.inspect),
      );
      const processes = await readMatchingProcesses(
        runner,
        serial,
        undefined,
        cleanupCommandTimeout(context, timeouts.inspect),
      );
      const observedAt = context.now();
      if (observedAt > context.deadline || packagePaths.length > 1) {
        return false;
      }
      const mutableMappings = exactMutableCleanupMappings(
        transaction,
        mappings,
        removalState,
      );
      if (mutableMappings === null) return false;
      if (
        mutableMappings.length === 0
        && packagePaths.length === 0
        && processes.length === 0
      ) {
        zeroSince ??= observedAt;
        if (
          observedAt - zeroSince
          >= uncertainInstallCleanup.nullWindowMilliseconds
        ) {
          return true;
        }
      } else {
        zeroSince = null;
        for (const mapping of mutableMappings) {
          if (!await removeExactOwnedMapping({
              context,
              deviceBinding,
              mapping,
              removalState,
              runner,
              serial,
              serialBinding,
              transaction,
            })) return false;
        }
        if (packagePaths.length !== 0 || processes.length !== 0) return false;
      }
    } catch {
      return false;
    }
    await waitForCleanup(context, uncertainInstallCleanup.pollMilliseconds);
  }
  return false;
}

async function reattestCleanupDevice(
  transaction,
  runner,
  serialBinding,
  deviceBinding,
  context,
) {
  return retryCleanupOperation(async () => {
    const current = await requireSingleDa5V5UsbDevice(runner, {
      timeoutMilliseconds: cleanupCommandTimeout(context, timeouts.inspect),
    });
    await verifyDeviceBinding(
      runner,
      current,
      deviceBinding,
      undefined,
      () => cleanupCommandTimeout(context, timeouts.inspect),
    );
    if (
      serialBinding.bind(current) !== 'match'
      || !transaction.bindSerial(current)
    ) {
      throw new Error('DA5 V5 Android cleanup device binding mismatch');
    }
    return serialBinding.use(current, (retained) => retained);
  }, context);
}

async function retryCleanupOperation(operation, context) {
  let failure;
  for (let attempt = 0; attempt < cleanupRetryAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      failure = error;
      if (
        attempt + 1 >= cleanupRetryAttempts
        || !isCleanupRetryableCommandError(error)
      ) {
        break;
      }
      await waitForCleanup(context, uncertainInstallCleanup.pollMilliseconds);
    }
  }
  throw failure ?? new Error('DA5 V5 Android cleanup observation failed');
}

function exactMutableCleanupMappings(transaction, mappings, removalState) {
  const mutable = [];
  for (const required of transaction.cleanupOwnership.reverseMappings) {
    const matches = mappings.filter((mapping) => mapping.device === required.device);
    if (
      matches.length > 1
      || (matches[0] !== undefined && matches[0].host !== required.host)
    ) {
      return null;
    }
    if (matches.length === 1) {
      if (
        removalState.blockedMappings.has(required.device)
        || !transaction.canMutateReverseMapping(required.device)
      ) {
        return null;
      }
      mutable.push(required);
    }
  }
  return mutable;
}

async function removeExactOwnedMapping(options) {
  if (!options.transaction.canMutateReverseMapping(options.mapping.device)) {
    return false;
  }
  options.transaction.beginReverseMappingRemoval(options.mapping.device);
  const attempts = options.removalState.removeAttempts.get(options.mapping.device) ?? 0;
  let nextAttempt = attempts;
  while (nextAttempt < cleanupRetryAttempts) {
    nextAttempt += 1;
    options.removalState.removeAttempts.set(options.mapping.device, nextAttempt);
    let current;
    try {
      current = await reattestCleanupDevice(
        options.transaction,
        options.runner,
        options.serialBinding,
        options.deviceBinding,
        options.context,
      );
    } catch {
      options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
      return false;
    }
    if (current !== options.serial) {
      options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
      return false;
    }
    try {
      await options.runner.run(
        ['-s', options.serial, 'reverse', '--remove', options.mapping.device],
        {
          timeoutMilliseconds: cleanupCommandTimeout(
            options.context,
            timeouts.reverse,
          ),
        },
      );
      options.transaction.markReverseMappingRemoved(options.mapping.device);
      return true;
    } catch (error) {
      if (
        nextAttempt >= cleanupRetryAttempts
        || !isCleanupRetryableCommandError(error)
      ) {
        options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
        return false;
      }
      try {
        await waitForCleanup(
          options.context,
          uncertainInstallCleanup.pollMilliseconds,
        );
      } catch {
        options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
        return false;
      }
      let mappings;
      try {
        mappings = await retryCleanupOperation(
          () => readMappings(
            options.runner,
            options.serial,
            undefined,
            cleanupCommandTimeout(options.context, timeouts.inspect),
          ),
          options.context,
        );
      } catch {
        options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
        return false;
      }
      const matches = mappings.filter((mapping) => (
        mapping.device === options.mapping.device
      ));
      if (matches.length === 0) {
        options.transaction.markReverseMappingRemoved(options.mapping.device);
        return true;
      }
      if (matches.length !== 1 || matches[0].host !== options.mapping.host) {
        options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
        return false;
      }
    }
  }
  options.transaction.markReverseMappingCleanupFailed(options.mapping.device);
  return false;
}

function cleanupCommandTimeout(context, maximum) {
  if (context.deadline === null) return maximum;
  return remainingTimeout(context.deadline, context.now, maximum);
}

function isCleanupRetryableCommandError(error) {
  return (
    isDa5V5AndroidCommandTimeoutError(error)
    || isDa5V5AndroidCommandTransientError(error)
  );
}

async function waitForCleanup(context, milliseconds) {
  if (context.deadline === null) {
    await context.wait(milliseconds);
    return;
  }
  const remaining = Math.floor(context.deadline - context.now());
  if (remaining <= 0) {
    throw new Error('DA5 V5 uncertain install cleanup timed out');
  }
  await context.wait(Math.min(milliseconds, remaining));
}

function remainingTimeout(deadline, now, maximum) {
  const remaining = Math.floor(deadline - now());
  if (remaining <= 0) {
    throw new Error('DA5 V5 uncertain install cleanup timed out');
  }
  return Math.max(1, Math.min(maximum, remaining));
}

async function bindCurrentDevice(
  runner,
  serialBinding,
  binding,
  signal,
  transaction,
) {
  const serial = await requireSingleDa5V5UsbDevice(runner, { signal });
  await verifyDeviceBinding(runner, serial, binding, signal);
  if (
    serialBinding.bind(serial) !== 'match'
    || (transaction !== undefined && !transaction.bindSerial(serial))
  ) {
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
  const processes = packageExpected
    ? []
    : await readMatchingProcesses(runner, serial, signal);
  if (
    (packageExpected && packagePaths.length !== 1)
    || (!packageExpected && packagePaths.length !== 0)
    || (!packageExpected && processes.length !== 0)
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

async function verifyDeviceBinding(
  runner,
  serial,
  binding,
  signal,
  timeoutMilliseconds = timeouts.inspect,
) {
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
  ], { signal, timeoutMilliseconds: resolveCommandTimeout(timeoutMilliseconds) }));
  const build = oneLine(await runner.run([
    '-s', serial, 'shell', 'getprop', 'ro.build.fingerprint',
  ], { signal, timeoutMilliseconds: resolveCommandTimeout(timeoutMilliseconds) }));
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
  const registration = await readOwnerPackageRegistration(
    runner,
    serial,
    signal,
    timeoutMilliseconds,
  );
  if (registration === 'absent') {
    return [];
  }
  const line = exactSingleLine(await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'package', 'path',
      '--user', androidOwnerUser, DA5_V5_ANDROID_PACKAGE,
    ],
    { signal, timeoutMilliseconds: resolveCommandTimeout(timeoutMilliseconds) },
  ));
  if (!line.startsWith('package:')) {
    throw new Error('DA5 V5 package state is ambiguous');
  }
  const path = line.slice('package:'.length);
  if (!isStrictInstalledBaseApkPath(path)) {
    throw new Error('DA5 V5 package state is ambiguous');
  }
  return [path];
}

async function readOwnerPackageRegistration(
  runner,
  serial,
  signal,
  timeoutMilliseconds = timeouts.inspect,
) {
  const value = await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'package', 'list', 'packages',
      '-a', '-u', '--user', androidOwnerUser, DA5_V5_ANDROID_PACKAGE,
    ],
    { signal, timeoutMilliseconds: resolveCommandTimeout(timeoutMilliseconds) },
  );
  if (isExactEmptyOutput(value)) {
    return 'absent';
  }
  if (exactSingleLine(value) === `package:${DA5_V5_ANDROID_PACKAGE}`) {
    return 'present';
  }
  throw new Error('DA5 V5 package registration is ambiguous');
}

function resolveCommandTimeout(value) {
  return typeof value === 'function' ? value() : value;
}

async function readMatchingProcesses(
  runner,
  serial,
  signal,
  timeoutMilliseconds = timeouts.inspect,
) {
  const lines = exactLines(await runner.run(
    ['-s', serial, 'shell', 'ps', '-A', '-w', '-o', 'NAME:4'],
    { signal, timeoutMilliseconds },
  ));
  if (lines.shift() !== 'NAME') {
    throw new Error('DA5 V5 process header mismatch');
  }
  for (const line of lines) {
    if (line.length === 0 || /\s|\0/u.test(line)) {
      throw new Error('DA5 V5 process state mismatch');
    }
  }
  return lines.filter((line) => (
    line === DA5_V5_ANDROID_PACKAGE
    || line.startsWith(`${DA5_V5_ANDROID_PACKAGE}:`)
  ));
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

function requireDeviceBinding(value) {
  if (
    value === undefined
    || typeof value.deviceModel !== 'string'
    || value.deviceModel.length === 0
    || typeof value.androidBuild !== 'string'
    || value.androidBuild.length === 0
  ) {
    throw new Error('DA5 V5 exact device binding is unavailable');
  }
  return value;
}

function deviceBindingMatches(left, right) {
  return (
    left !== undefined
    && left.deviceModel === right.deviceModel
    && left.androidBuild === right.androidBuild
  );
}

function requireInstallTransaction(value) {
  if (!(value instanceof Da5V5AndroidInstallTransaction)) {
    throw new Error('DA5 V5 Android install transaction is unavailable');
  }
  return value;
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

function cleanupMappingSubstage(device) {
  if (device === 'tcp:54321') {
    return DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseRemoveAuth;
  }
  if (device === 'tcp:3000') {
    return DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseRemoveApi;
  }
  throw new Error('DA5 V5 Android cleanup mapping is unavailable');
}

function cleanupMatch() {
  return Object.freeze({
    status: 'match',
    substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
  });
}

function cleanupMismatch(substage) {
  if (!Object.values(DA5_V5_ANDROID_CLEANUP_SUBSTAGES).includes(substage)) {
    return Object.freeze({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.internal,
    });
  }
  return Object.freeze({ status: 'mismatch', substage });
}

function requireInstallCleanupEvidence(value) {
  if (
    value?.status === 'not_required'
    && value.substage === DA5_V5_ANDROID_CLEANUP_SUBSTAGES.notRequired
  ) {
    return cleanupNotRequired;
  }
  if (
    value?.status === 'match'
    && value.substage === DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete
  ) {
    return cleanupMatch();
  }
  if (
    value?.status === 'mismatch'
    && Object.values(DA5_V5_ANDROID_CLEANUP_SUBSTAGES).includes(value.substage)
    && value.substage !== DA5_V5_ANDROID_CLEANUP_SUBSTAGES.notRequired
    && value.substage !== DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete
  ) {
    return cleanupMismatch(value.substage);
  }
  return cleanupMismatch(DA5_V5_ANDROID_CLEANUP_SUBSTAGES.internal);
}

function oneLine(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /[\r\n]/u.test(trimmed)) {
    throw new Error('DA5 V5 device binding value is unavailable');
  }
  return trimmed;
}

function exactSingleLine(value) {
  if (typeof value !== 'string') {
    throw new Error('DA5 V5 command output mismatch');
  }
  const match = /^([^\0\r\n]+)(?:\r?\n)?$/u.exec(value);
  if (match?.[1] === undefined) {
    throw new Error('DA5 V5 command output mismatch');
  }
  return match[1];
}

function exactLines(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw new Error('DA5 V5 command output mismatch');
  }
  const normalized = value.endsWith('\r\n')
    ? value.slice(0, -2)
    : value.endsWith('\n')
      ? value.slice(0, -1)
      : value;
  if (normalized.length === 0) return [];
  const lines = normalized.split(/\r?\n/u);
  if (lines.some((line) => line.length === 0)) {
    throw new Error('DA5 V5 command output mismatch');
  }
  return lines;
}

function isExactEmptyOutput(value) {
  return value === '' || value === '\n' || value === '\r\n';
}

function requireInstallFailureCategory(value) {
  if (!Object.values(DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES).includes(value)) {
    throw new Error('DA5 V5 Android install failure category is unavailable');
  }
  return value;
}

function classifyTypedInstallFailure(error, fallbackCategory) {
  if (error instanceof Da5V5AndroidInstallError) {
    return error.category;
  }
  if (isDa5V5AndroidCommandAbortError(error)) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.signalAbort;
  }
  if (isDa5V5AndroidCommandTimeoutError(error)) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.timeout;
  }
  if (error instanceof Da5V5AndroidCommandExitError) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childExit;
  }
  return fallbackCategory;
}

async function runInstallControlCommand(
  runner,
  arguments_,
  signal,
  deadline,
  now,
) {
  try {
    return await runner.run(arguments_, {
      signal,
      timeoutMilliseconds: remainingInstallTimeout(deadline, now),
    });
  } catch (error) {
    throw new Da5V5AndroidInstallError(classifyTypedInstallFailure(
      error,
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
    ));
  }
}

function remainingInstallTimeout(deadline, now) {
  const remaining = Math.floor(deadline - now());
  if (remaining <= 0) {
    throw new Da5V5AndroidInstallError(
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.timeout,
    );
  }
  return Math.min(timeouts.install, remaining);
}

function parsePackageManagerCreateReceipt(value) {
  let line;
  try {
    line = exactSingleLine(value);
  } catch {
    return Object.freeze({ sessionAbsent: false, status: 'mismatch' });
  }
  const match = /^Success: created install session \[([1-9][0-9]{0,9})\]$/u
    .exec(line);
  if (match?.[1] !== undefined) {
    const sessionId = Number(match[1]);
    if (
      Number.isSafeInteger(sessionId)
      && sessionId <= maximumPackageInstallerSessionId
    ) {
      return Object.freeze({ sessionId: match[1], status: 'match' });
    }
  }
  return Object.freeze({
    sessionAbsent: isExactPackageManagerNonSuccessLine(line),
    status: 'mismatch',
  });
}

function isExactPackageManagerNonSuccessLine(value) {
  return (
    value.length <= 2_048
    && (
      /^Failure \[[^\0\r\n]+\]$/u.test(value)
      || /^Error: [^\0\r\n]+$/u.test(value)
    )
  );
}

function isExactPackageManagerSuccess(value) {
  try {
    return exactSingleLine(value) === 'Success';
  } catch {
    return false;
  }
}

function classifyPackageManagerWriteReceipt(value, stdinTerminal) {
  if (stdinTerminal === 'partial_then_pipe_closed') {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.stdinPipe;
  }
  if (
    stdinTerminal !== 'finished'
    && stdinTerminal !== 'all_bytes_submitted_then_pipe_closed'
  ) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.stdinPipe;
  }
  try {
    return exactSingleLine(value) === (
      `Success: streamed ${DA5_V5_ANDROID_ARTIFACT.apk.bytes} bytes`
    )
      ? null
      : DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt;
  } catch {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt;
  }
}

function installStreamFailureCategory(outcome) {
  if (
    outcome?.terminalCause
    === DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES.signalAbort
  ) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.signalAbort;
  }
  const category = outcome?.category;
  if (
    category
    === DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.stdinPipeAbortMismatch
  ) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.stdinPipe;
  }
  if (
    category
    === DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childTimeoutMismatch
  ) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.timeout;
  }
  if (
    category
    === DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childExitMismatch
  ) {
    return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childExit;
  }
  return DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport;
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
      rejectPromise(new Da5V5AndroidCommandAbortError());
      return;
    }
    const environment = createDa5V5AdbChildEnvironment(dependencies.environment);
    const stdinBytes = options.stdinBytes;
    const requireEmptyOutput = options.requireEmptyOutput;
    if (stdinBytes !== undefined && !Buffer.isBuffer(stdinBytes)) {
      rejectPromise(new Error('DA5 V5 Android device input is invalid'));
      return;
    }
    if (requireEmptyOutput !== undefined && requireEmptyOutput !== true) {
      rejectPromise(new Error('DA5 V5 Android device output policy is invalid'));
      return;
    }
    const child = dependencies.spawn(
      dependencies.adbPath,
      [...adbServerArguments, ...arguments_],
      {
        env: environment,
        stdio: [
          stdinBytes === undefined ? 'ignore' : 'pipe',
          'pipe',
          'pipe',
        ],
      },
    );
    let stdout = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminationError;
    let forceKillTimeout;
    let forceSettleTimeout;
    let forceKillSent = false;
    const timeoutMilliseconds =
      requireCommandTimeout(options.timeoutMilliseconds);
    const terminationBudget = Math.min(2_000, timeoutMilliseconds);
    const terminationGrace = Math.min(
      1_000,
      Math.max(1, Math.floor(terminationBudget / 2)),
    );
    const timeout = setTimeout(() => {
      terminate(new Da5V5AndroidCommandTimeoutError());
    }, Math.max(0, timeoutMilliseconds - terminationBudget));
    const hardTimeout = setTimeout(() => {
      terminationError ??=
        new Da5V5AndroidCommandTimeoutError();
      forceKill();
      finish(terminationError, undefined, true);
    }, timeoutMilliseconds);

    function abort() {
      terminate(new Da5V5AndroidCommandAbortError());
    }

    function terminate(error) {
      if (settled || terminationError !== undefined) {
        return;
      }
      terminationError = error;
      try {
        child.kill('SIGTERM');
      } catch {
        // The forced terminal settlement below remains authoritative.
      }
      forceKillTimeout = setTimeout(() => {
        forceKill();
      }, terminationGrace);
      forceSettleTimeout = setTimeout(() => {
        forceKill();
        finish(terminationError, undefined, true);
      }, terminationBudget);
    }

    function forceKill() {
      if (!forceKillSent) {
        forceKillSent = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // The Promise still settles after the bounded post-kill grace.
        }
      }
    }

    function removeListeners() {
      options.signal?.removeEventListener('abort', abort);
      child.removeListener('error', onChildError);
      child.removeListener('close', onClose);
      child.stdout.removeListener('data', onStdoutData);
      child.stdout.removeListener('error', onStdoutError);
      child.stderr.removeListener('data', onStderrData);
      child.stderr.removeListener('error', onStderrError);
      if (child.stdin !== null) {
        child.stdin.removeListener('drain', writeStdin);
        child.stdin.removeListener('error', onStdinError);
      }
    }

    function finish(error, value, abandoned = false) {
      if (settled) {
        return;
      }
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
          // Resource abandonment cannot prevent terminal Promise settlement.
        }
      }
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
      if (requireEmptyOutput !== true) {
        stdout += chunk;
      }
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

    function onStdoutError(error) {
      terminate(classifyAdbTransportError(error));
    }

    function onStderrError(error) {
      terminate(classifyAdbTransportError(error));
    }

    function onStdinError() {
      terminate(new Error('DA5 V5 Android device input failed'));
    }

    function onChildError(error) {
      terminate(classifyAdbTransportError(error));
    }

    function onClose(code, signal) {
      const cleanExit = code === 0 && (signal === null || signal === undefined);
      const outputMismatch = requireEmptyOutput === true
        && (stdoutBytes !== 0 || stderrBytes !== 0);
      finish(
        terminationError ?? (
          !cleanExit
            ? new Da5V5AndroidCommandExitError()
            : outputMismatch
              ? new Error('DA5 V5 Android device output mismatch')
              : undefined
        ),
        requireEmptyOutput === true ? '' : stdout,
      );
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
    child.once('close', onClose);
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
      rejectPromise(new Da5V5AndroidCommandAbortError());
      return;
    }
    if (!Number.isSafeInteger(options.maximumBytes) || options.maximumBytes < 0) {
      rejectPromise(new Error('DA5 V5 Android device output bound is invalid'));
      return;
    }
    const environment = createDa5V5AdbChildEnvironment(dependencies.environment);
    const child = dependencies.spawn(
      dependencies.adbPath,
      [...adbServerArguments, ...arguments_],
      {
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const digest = createHash('sha256');
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminationError;
    let forceKillTimeout;
    let forceSettleTimeout;
    let forceKillSent = false;
    const timeoutMilliseconds =
      requireCommandTimeout(options.timeoutMilliseconds);
    const terminationBudget = Math.min(2_000, timeoutMilliseconds);
    const terminationGrace = Math.min(
      1_000,
      Math.max(1, Math.floor(terminationBudget / 2)),
    );
    const timeout = setTimeout(() => {
      terminate(new Da5V5AndroidCommandTimeoutError());
    }, Math.max(0, timeoutMilliseconds - terminationBudget));
    const hardTimeout = setTimeout(() => {
      terminationError ??=
        new Da5V5AndroidCommandTimeoutError();
      forceKill();
      finish(terminationError, true);
    }, timeoutMilliseconds);
    const abort = () => {
      terminate(new Da5V5AndroidCommandAbortError());
    };
    const terminate = (error) => {
      if (settled) return;
      terminationError ??= error;
      if (forceKillTimeout !== undefined) return;
      try {
        child.kill('SIGTERM');
      } catch {
        // The forced terminal settlement below remains authoritative.
      }
      forceKillTimeout = setTimeout(() => {
        forceKill();
      }, terminationGrace);
      forceSettleTimeout = setTimeout(() => {
        forceKill();
        finish(terminationError, true);
      }, terminationBudget);
    };
    const forceKill = () => {
      if (!forceKillSent) {
        forceKillSent = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // The Promise still settles after the bounded post-kill grace.
        }
      }
    };
    const removeListeners = () => {
      options.signal?.removeEventListener('abort', abort);
      child.removeListener('error', onChildError);
      child.removeListener('close', onClose);
      child.stdout.removeListener('data', onStdoutData);
      child.stdout.removeListener('error', onStdoutError);
      child.stderr.removeListener('data', onStderrData);
      child.stderr.removeListener('error', onStderrError);
    };
    const finish = (error, abandoned = false) => {
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
          child.stdout.destroy();
          child.stderr.destroy();
          child.unref?.();
        } catch {
          // Resource abandonment cannot prevent terminal Promise settlement.
        }
      }
      if (error === undefined) {
        resolvePromise(Object.freeze({
          bytes: stdoutBytes,
          sha256: digest.digest('hex'),
        }));
      } else {
        rejectPromise(error);
      }
    };
    const onStdoutData = (chunk) => {
      if (terminationError !== undefined) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > options.maximumBytes) {
        terminate(new Error('DA5 V5 Android device output exceeded its bound'));
        return;
      }
      digest.update(chunk);
    };
    const onStderrData = (chunk) => {
      if (terminationError !== undefined) return;
      stderrBytes += chunk.length;
      if (stderrBytes > 4 * 1024 * 1024) {
        terminate(new Error('DA5 V5 Android device output exceeded its bound'));
      }
    };
    const onStdoutError = () => {
      terminate(new Error('DA5 V5 Android device command failed'));
    };
    const onStderrError = () => {
      terminate(new Error('DA5 V5 Android device command failed'));
    };
    const onChildError = () => {
      terminate(new Error('DA5 V5 Android device command failed'));
    };
    const onClose = (code, signal) => {
      finish(
        terminationError ?? (
          code === 0 && (signal === null || signal === undefined)
            ? undefined
            : new Da5V5AndroidCommandExitError()
        ),
      );
    };
    child.stdout.on('data', onStdoutData);
    child.stderr.on('data', onStderrData);
    child.stdout.once('error', onStdoutError);
    child.stderr.once('error', onStderrError);
    child.once('error', onChildError);
    child.once('close', onClose);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted === true) {
      abort();
    }
  });
}

function requireCommandTimeout(value) {
  const timeoutMilliseconds = value ?? timeouts.inspect;
  if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
    throw new Error('DA5 V5 Android device timeout is invalid');
  }
  return timeoutMilliseconds;
}

function absorbLateChildErrors(child) {
  const ignore = () => {};
  child.on('error', ignore);
  child.stdin?.on('error', ignore);
  child.stdout.on('error', ignore);
  child.stderr.on('error', ignore);
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
