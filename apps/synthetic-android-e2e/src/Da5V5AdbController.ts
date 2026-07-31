import { spawnSync } from 'node:child_process';
import {
  Da5V5UsbSerialBinding,
  requireDa5V5ActiveTalkBackProvider,
  SystemDa5V5AndroidAdbRunner,
  type Da5V5TalkBackPackage,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  createDa5V5AdbChildEnvironment,
} from '../../mobile/scripts/da5V5AdbChildEnvironment.mjs';

const PACKAGE_NAME = 'com.tim180201.mobile.synthetic';
const AUTH_MAPPING = Object.freeze({ device: 'tcp:54321', host: 'tcp:54321' });
const API_MAPPING = Object.freeze({ device: 'tcp:3000', host: 'tcp:3000' });
const ADB_TIMEOUT_MILLISECONDS = 5_000;
const ADB_SERVER_ARGUMENTS = Object.freeze(['-H', '127.0.0.1', '-P', '5037']);

export interface Da5V5AdbCommandRunner {
  run(arguments_: readonly string[]): string;
  runMutation(arguments_: readonly string[], signal?: AbortSignal): Promise<string>;
}

export class Da5V5UsbDeviceLock extends Da5V5UsbSerialBinding {}

export class SystemDa5V5AdbCommandRunner implements Da5V5AdbCommandRunner {
  private readonly environment: Readonly<Record<string, string | undefined>>;
  private readonly mutations: SystemDa5V5AndroidAdbRunner;
  private readonly spawnSyncCommand: typeof spawnSync;

  constructor(dependencies: {
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly spawnSync?: typeof spawnSync;
  } = {}) {
    this.environment = dependencies.environment ?? process.env;
    this.spawnSyncCommand = dependencies.spawnSync ?? spawnSync;
    this.mutations = new SystemDa5V5AndroidAdbRunner({
      environment: this.environment,
    });
  }

  run(arguments_: readonly string[]): string {
    const result = this.spawnSyncCommand('adb', [...ADB_SERVER_ARGUMENTS, ...arguments_], {
      encoding: 'utf8',
      env: createDa5V5AdbChildEnvironment(this.environment),
      killSignal: 'SIGKILL',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: ADB_TIMEOUT_MILLISECONDS,
    });
    if (result.status !== 0 || result.error !== undefined) {
      throw new Error('DA5 V5 ADB command failed');
    }
    return result.stdout;
  }

  runMutation(arguments_: readonly string[], signal?: AbortSignal): Promise<string> {
    return this.mutations.run(arguments_, {
      signal,
      timeoutMilliseconds: 30_000,
    });
  }
}

export interface Da5V5DeviceIdentityBinding {
  readonly androidBuild: string;
  readonly deviceModel: string;
}

export type Da5V5OfflinePhase = 'ordinary' | 'protected';

export interface Da5V5ApiOfflineState {
  readonly completedCycles: number;
  readonly state:
    | 'unarmed'
    | 'direct-ordinary'
    | 'offline-ordinary'
    | 'direct-protected'
    | 'offline-protected'
    | 'complete'
    | 'failed'
    | 'closed';
}

export class Da5V5ApiOfflineController {
  private armed = false;
  private completedCycles = 0;
  private mutationFlight: Promise<'match' | 'mismatch'> | null = null;
  private offlineSerial: string | null = null;
  private reverseCleanupState: 'known' | 'uncertain' = 'known';
  private state: Da5V5ApiOfflineState['state'] = 'unarmed';

  constructor(
    private readonly adb: Da5V5AdbCommandRunner,
    private readonly device: Da5V5DeviceIdentityBinding,
    private readonly deviceLock: Da5V5UsbDeviceLock = new Da5V5UsbDeviceLock(),
    private readonly mutationSignal?: AbortSignal,
  ) {}

  arm(): 'match' | 'mismatch' {
    if (this.state !== 'unarmed' || this.armed) {
      return this.fail();
    }
    try {
      const serial = this.requireBoundDevice();
      requireMappings(this.adb, serial, true);
      requireInstalledPackage(this.adb, serial);
      this.armed = true;
      this.state = 'direct-ordinary';
      return 'match';
    } catch {
      return this.fail();
    }
  }

  enterOffline(phase: Da5V5OfflinePhase): Promise<'match' | 'mismatch'> {
    return this.beginMutation(() => this.performEnterOffline(phase));
  }

  restoreDirect(phase: Da5V5OfflinePhase): Promise<'match' | 'mismatch'> {
    return this.beginMutation(() => this.performRestoreDirect(phase));
  }

  private async performEnterOffline(
    phase: Da5V5OfflinePhase,
  ): Promise<'match' | 'mismatch'> {
    const cleanupStateBeforeMutation = this.reverseCleanupState;
    const expectedState = phase === 'ordinary' ? 'direct-ordinary' : 'direct-protected';
    if (this.state !== expectedState) {
      return this.fail();
    }
    try {
      const serial = this.requireBoundDevice();
      requireMappings(this.adb, serial, true);
      this.offlineSerial = serial;
      this.reverseCleanupState = 'uncertain';
      await this.adb.runMutation(
        ['-s', serial, 'reverse', '--remove', API_MAPPING.device],
        this.mutationSignal,
      );
      requireMappings(this.adb, serial, false);
      this.reverseCleanupState = cleanupStateBeforeMutation;
      this.state = phase === 'ordinary' ? 'offline-ordinary' : 'offline-protected';
      return 'match';
    } catch {
      return this.fail();
    }
  }

  private async performRestoreDirect(
    phase: Da5V5OfflinePhase,
  ): Promise<'match' | 'mismatch'> {
    const cleanupStateBeforeMutation = this.reverseCleanupState;
    const expectedState = phase === 'ordinary' ? 'offline-ordinary' : 'offline-protected';
    if (this.state !== expectedState || this.offlineSerial === null) {
      return this.fail();
    }
    try {
      const serial = this.requireBoundDevice();
      if (serial !== this.offlineSerial) {
        return this.fail();
      }
      requireMappings(this.adb, serial, false);
      this.reverseCleanupState = 'uncertain';
      await this.adb.runMutation(
        ['-s', serial, 'reverse', API_MAPPING.device, API_MAPPING.host],
        this.mutationSignal,
      );
      requireMappings(this.adb, serial, true);
      this.reverseCleanupState = cleanupStateBeforeMutation;
      this.completedCycles += 1;
      this.offlineSerial = null;
      this.state = phase === 'ordinary' ? 'direct-protected' : 'complete';
      return 'match';
    } catch {
      return this.fail();
    }
  }

  complete(): 'match' | 'mismatch' {
    if (this.state !== 'complete' || this.completedCycles !== 2) {
      return this.fail();
    }
    return 'match';
  }

  async close(): Promise<'match' | 'mismatch'> {
    await this.mutationFlight;
    if (this.state === 'closed') {
      return 'match';
    }
    if (!this.armed) {
      this.offlineSerial = null;
      this.state = 'closed';
      return 'match';
    }
    if (this.state === 'offline-ordinary' || this.state === 'offline-protected') {
      if (!await this.restoreAfterExit()) {
        return this.fail();
      }
    } else if (this.state === 'failed' && this.offlineSerial !== null) {
      if (!await this.restoreAfterExit()) {
        return 'mismatch';
      }
    } else {
      try {
        const serial = this.requireBoundDevice();
        requireMappings(this.adb, serial, true);
      } catch {
        return this.fail();
      }
    }
    this.offlineSerial = null;
    this.state = 'closed';
    return 'match';
  }

  getState(): Da5V5ApiOfflineState {
    return Object.freeze({
      completedCycles: this.completedCycles,
      state: this.state,
    });
  }

  cleanupProofState(): 'known' | 'uncertain' {
    return this.reverseCleanupState;
  }

  private async restoreAfterExit(): Promise<boolean> {
    const serial = this.offlineSerial;
    if (serial === null) {
      return false;
    }
    const cleanupStateBeforeMutation = this.reverseCleanupState;
    try {
      const mappings = readMappings(this.adb, serial);
      requireExactMapping(mappings, AUTH_MAPPING.device, AUTH_MAPPING.host);
      const api = mappings.filter((mapping) => mapping.device === API_MAPPING.device);
      if (api.length === 0) {
        this.reverseCleanupState = 'uncertain';
        await this.adb.runMutation(
          ['-s', serial, 'reverse', API_MAPPING.device, API_MAPPING.host],
        );
      } else {
        requireExactMapping(api, API_MAPPING.device, API_MAPPING.host);
      }
      requireMappings(this.adb, serial, true);
      this.reverseCleanupState = cleanupStateBeforeMutation;
      this.offlineSerial = null;
      return true;
    } catch {
      this.state = 'failed';
      return false;
    }
  }

  private fail(): 'mismatch' {
    this.state = 'failed';
    return 'mismatch';
  }

  private beginMutation(
    operation: () => Promise<'match' | 'mismatch'>,
  ): Promise<'match' | 'mismatch'> {
    if (this.mutationFlight !== null) {
      this.state = 'failed';
      return Promise.resolve('mismatch');
    }
    const flight = operation().finally(() => {
      if (this.mutationFlight === flight) {
        this.mutationFlight = null;
      }
    });
    this.mutationFlight = flight;
    return flight;
  }

  private requireBoundDevice(): string {
    const serial = requireSingleUsbDevice(this.adb);
    requireDeviceIdentity(this.adb, serial, this.device);
    if (this.deviceLock.bind(serial) !== 'match') {
      throw new Error('DA5 V5 USB device changed during the run');
    }
    return serial;
  }
}

export interface Da5V5AccessibilityBinding extends Da5V5DeviceIdentityBinding {
  readonly fontScale: '2.0';
  readonly talkBackPackage: Da5V5TalkBackPackage;
  readonly talkBackVersion: string;
}

export type Da5V5DeviceCheckpointState =
  | 'created'
  | 'cold-dispatch-prepared'
  | 'ordinary-relaunch-prepared'
  | 'cancellation-armed'
  | 'cancellation-ui-confirmed'
  | 'cancellation-killed'
  | 'cancellation-complete'
  | 'accessibility-confirmed'
  | 'protected-relaunch-prepared'
  | 'protected-relaunch-complete'
  | 'failed';

export class Da5V5DeviceCheckpointController {
  private serial: string | null = null;
  private state: Da5V5DeviceCheckpointState = 'created';

  constructor(
    private readonly adb: Da5V5AdbCommandRunner,
    private readonly accessibility: Da5V5AccessibilityBinding,
    private readonly deviceLock: Da5V5UsbDeviceLock = new Da5V5UsbDeviceLock(),
  ) {}

  prepareColdDispatch(): 'match' | 'mismatch' {
    if (this.state !== 'created') {
      return this.fail();
    }
    if (this.killAndProveAbsent('kill') !== 'match') {
      return this.fail();
    }
    this.state = 'cold-dispatch-prepared';
    return 'match';
  }

  verifyAccessibilityBinding(): 'match' | 'mismatch' {
    if (this.state !== 'cold-dispatch-prepared') {
      return this.fail();
    }
    try {
      const serial = requireSingleUsbDevice(this.adb);
      requireDeviceIdentity(this.adb, serial, this.accessibility);
      if (this.deviceLock.bind(serial) !== 'match') {
        return this.fail();
      }
      const fontScale = oneLine(
        this.adb.run(['-s', serial, 'shell', 'settings', 'get', 'system', 'font_scale']),
      );
      const talkBackPackage = requireDa5V5ActiveTalkBackProvider(
        this.adb.run(['-s', serial, 'shell', 'settings', 'get', 'secure',
          'accessibility_enabled']),
        this.adb.run(['-s', serial, 'shell', 'settings', 'get', 'secure',
          'enabled_accessibility_services']),
        this.accessibility.talkBackPackage,
      );
      const talkBack = readTalkBackVersion(
        this.adb.run(['-s', serial, 'shell', 'dumpsys', 'package',
          talkBackPackage]),
      );
      if (
        fontScale !== this.accessibility.fontScale
        || talkBack !== this.accessibility.talkBackVersion
      ) {
        return this.fail();
      }
      this.state = 'accessibility-confirmed';
      return 'match';
    } catch {
      return this.fail();
    }
  }

  prepareOrdinaryPendingRelaunch(): 'match' | 'mismatch' {
    if (this.state !== 'accessibility-confirmed') {
      return this.fail();
    }
    if (this.killAndProveAbsent('kill') !== 'match') {
      return this.fail();
    }
    this.state = 'ordinary-relaunch-prepared';
    return 'match';
  }

  armCancellation(): 'match' | 'mismatch' {
    if (this.state !== 'ordinary-relaunch-prepared') {
      return this.fail();
    }
    try {
      const serial = requireSingleUsbDevice(this.adb);
      requireDeviceIdentity(this.adb, serial, this.accessibility);
      if (this.deviceLock.bind(serial) !== 'match') {
        return this.fail();
      }
      requireMappings(this.adb, serial, true);
      requireInstalledPackage(this.adb, serial);
      this.serial = serial;
      this.state = 'cancellation-armed';
      return 'match';
    } catch {
      return this.fail();
    }
  }

  confirmCancelledUi(result: 'pass' | 'fail' | 'ambiguous'): 'match' | 'mismatch' {
    if (this.state !== 'cancellation-armed' || result !== 'pass') {
      return this.fail();
    }
    this.state = 'cancellation-ui-confirmed';
    return 'match';
  }

  killBackgroundProcess(): 'match' | 'mismatch' {
    if (this.state !== 'cancellation-ui-confirmed' || this.serial === null) {
      return this.fail();
    }
    try {
      const serial = requireSingleUsbDevice(this.adb);
      if (serial !== this.serial) {
        return this.fail();
      }
      if (this.killAndProveAbsent('kill', serial) !== 'match') {
        return this.fail();
      }
      this.state = 'cancellation-killed';
      return 'match';
    } catch {
      return this.fail();
    }
  }

  confirmColdReady(result: 'pass' | 'fail' | 'ambiguous'): 'match' | 'mismatch' {
    if (this.state !== 'cancellation-killed' || result !== 'pass') {
      return this.fail();
    }
    this.serial = null;
    this.state = 'cancellation-complete';
    return 'match';
  }

  prepareProtectedColdRelaunch(): 'match' | 'mismatch' {
    if (this.state !== 'cancellation-complete') {
      return this.fail();
    }
    if (this.killAndProveAbsent('force-stop') !== 'match') {
      return this.fail();
    }
    this.state = 'protected-relaunch-prepared';
    return 'match';
  }

  confirmProtectedStateRetained(
    result: 'pass' | 'fail' | 'ambiguous',
  ): 'match' | 'mismatch' {
    if (this.state !== 'protected-relaunch-prepared' || result !== 'pass') {
      return this.fail();
    }
    this.serial = null;
    this.state = 'protected-relaunch-complete';
    return 'match';
  }

  getState(): Da5V5DeviceCheckpointState {
    return this.state;
  }

  private fail(): 'mismatch' {
    this.state = 'failed';
    this.serial = null;
    return 'mismatch';
  }

  private killAndProveAbsent(
    operation: 'kill' | 'force-stop',
    expectedSerial?: string,
  ): 'match' | 'mismatch' {
    try {
      const serial = requireSingleUsbDevice(this.adb);
      if (expectedSerial !== undefined && serial !== expectedSerial) {
        return 'mismatch';
      }
      requireDeviceIdentity(this.adb, serial, this.accessibility);
      if (this.deviceLock.bind(serial) !== 'match') {
        return 'mismatch';
      }
      requireMappings(this.adb, serial, true);
      requireInstalledPackage(this.adb, serial);
      this.serial = serial;
      this.adb.run(['-s', serial, 'shell', 'am', operation, PACKAGE_NAME]);
      const processNames = this.adb.run(['-s', serial, 'shell', 'ps', '-A', '-o', 'NAME'])
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length !== 0 && line !== 'NAME');
      return processNames.some((name) => (
        name === PACKAGE_NAME || name.startsWith(`${PACKAGE_NAME}:`)
      ))
        ? 'mismatch'
        : 'match';
    } catch {
      return 'mismatch';
    }
  }
}

interface ReverseMapping {
  readonly device: string;
  readonly host: string;
}

function requireSingleUsbDevice(adb: Da5V5AdbCommandRunner): string {
  const rows = adb.run(['devices', '-l'])
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2);
  const row = rows[0];
  const serial = row?.[0];
  const isUsb = row?.slice(2).some((part) => part.startsWith('usb:')) === true;
  if (
    rows.length !== 1
    || serial === undefined
    || row?.[1] !== 'device'
    || !isUsb
    || serial.includes(':')
    || serial.startsWith('emulator-')
    || serial.includes('_adb-tls-connect._tcp')
  ) {
    throw new Error('DA5 V5 requires exactly one authorized USB device');
  }
  return serial;
}

function requireMappings(
  adb: Da5V5AdbCommandRunner,
  serial: string,
  apiExpected: boolean,
): void {
  const mappings = readMappings(adb, serial);
  const expectedCount = apiExpected ? 2 : 1;
  if (mappings.length !== expectedCount) {
    throw new Error('DA5 V5 reverse mapping set is unexpected');
  }
  requireExactMapping(mappings, AUTH_MAPPING.device, AUTH_MAPPING.host);
  const api = mappings.filter((mapping) => mapping.device === API_MAPPING.device);
  if (apiExpected) {
    requireExactMapping(api, API_MAPPING.device, API_MAPPING.host);
  } else if (api.length !== 0) {
    throw new Error('DA5 V5 API mapping remained during controlled offline');
  }
}

function readMappings(
  adb: Da5V5AdbCommandRunner,
  serial: string,
): readonly ReverseMapping[] {
  const lines = adb.run(['-s', serial, 'reverse', '--list'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length !== 0);
  return lines.map((line) => {
    const parts = line.split(/\s+/);
    const [mappingSerial, device, host] = parts;
    if (
      parts.length !== 3
      || mappingSerial !== serial
      || device === undefined
      || host === undefined
      || !/^tcp:[1-9][0-9]{0,4}$/u.test(device)
      || !/^tcp:[1-9][0-9]{0,4}$/u.test(host)
      || Number(device.slice(4)) > 65_535
      || Number(host.slice(4)) > 65_535
    ) {
      throw new Error('DA5 V5 reverse mapping output is malformed or unexpected');
    }
    return Object.freeze({ device, host });
  });
}

function requireExactMapping(
  mappings: readonly ReverseMapping[],
  device: string,
  host: string,
): void {
  const matching = mappings.filter((mapping) => mapping.device === device);
  if (matching.length !== 1 || matching[0]?.host !== host) {
    throw new Error('DA5 V5 reverse mapping is unavailable or unexpected');
  }
}

function requireInstalledPackage(
  adb: Da5V5AdbCommandRunner,
  serial: string,
): void {
  const result = adb.run(['-s', serial, 'shell', 'pm', 'path', PACKAGE_NAME]).trim();
  if (!/^package:\/\S+\.apk$/.test(result)) {
    throw new Error('DA5 V5 synthetic package is unavailable');
  }
}

function requireDeviceIdentity(
  adb: Da5V5AdbCommandRunner,
  serial: string,
  expected: Da5V5DeviceIdentityBinding,
): void {
  const model = oneLine(
    adb.run(['-s', serial, 'shell', 'getprop', 'ro.product.model']),
  );
  const build = oneLine(
    adb.run(['-s', serial, 'shell', 'getprop', 'ro.build.fingerprint']),
  );
  if (model !== expected.deviceModel || build !== expected.androidBuild) {
    throw new Error('DA5 V5 device binding mismatch');
  }
}

function oneLine(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('DA5 V5 device binding value is unavailable');
  }
  return trimmed;
}

function readTalkBackVersion(value: string): string {
  const matches = [...value.matchAll(/^\s*versionName=(\S+)\s*$/gm)];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error('DA5 V5 TalkBack binding is unavailable');
  }
  return matches[0][1];
}
