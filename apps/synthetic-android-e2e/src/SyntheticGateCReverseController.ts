import { spawnSync } from 'node:child_process';
import {
  SYNTHETIC_GATE_C_LISTEN_PORT,
  type SyntheticGateCResponseDropProxyControl,
  type SyntheticGateCResponseDropState,
} from './SyntheticGateCResponseDropProxy.js';

const authDevicePort = 'tcp:54321';
const authHostPort = 'tcp:54321';
const apiDevicePort = 'tcp:3000';
const directApiHostPort = 'tcp:3000';
const proxyApiHostPort = `tcp:${SYNTHETIC_GATE_C_LISTEN_PORT}`;
const adbCommandTimeoutMilliseconds = 5_000;

export type SyntheticGateCReverseState =
  | 'armed'
  | 'closed'
  | 'created'
  | 'failed'
  | 'restoring'
  | 'restored';

export type SyntheticGateCReverseSafeEvent =
  | 'gate_c_transport_armed'
  | 'gate_c_transport_restore_failed'
  | 'gate_c_transport_restored'
  | 'gate_c_transport_restored_after_abort';

export interface SyntheticGateCAdbCommandRunner {
  run(arguments_: readonly string[]): string;
}

export interface SyntheticGateCTransportStatus {
  readonly proxy: SyntheticGateCResponseDropState;
  readonly reverse: SyntheticGateCReverseState;
}

export type SyntheticGateCEmergencyRestoreResult = 'already_direct' | 'restored';

export class SystemSyntheticGateCAdbCommandRunner implements SyntheticGateCAdbCommandRunner {
  run(arguments_: readonly string[]): string {
    const result = spawnSync('adb', [...arguments_], {
      encoding: 'utf8',
      killSignal: 'SIGKILL',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: adbCommandTimeoutMilliseconds,
    });
    if (result.status !== 0 || result.error !== undefined) {
      throw new Error('Synthetic Gate-C ADB command failed');
    }
    return result.stdout;
  }
}

/**
 * Owns only the temporary API reverse swap used by the local DA1 Gate-C proxy.
 * It never changes Auth or unrelated mappings and never accepts a configurable remote endpoint.
 */
export class SyntheticGateCReverseController {
  private readonly onSafeEvent: (event: SyntheticGateCReverseSafeEvent) => void;
  private closePromise: Promise<void> | null = null;
  private restorePromise: Promise<boolean> | null = null;
  private serial: string | null = null;
  private state: SyntheticGateCReverseState = 'created';

  constructor(
    private readonly proxy: SyntheticGateCResponseDropProxyControl,
    private readonly adb: SyntheticGateCAdbCommandRunner,
    onSafeEvent: (event: SyntheticGateCReverseSafeEvent) => void = () => undefined,
  ) {
    this.onSafeEvent = onSafeEvent;
  }

  async arm(): Promise<void> {
    if (this.state !== 'created') {
      throw new Error('Synthetic Gate-C transport cannot be armed twice');
    }
    const serial = requireSingleAuthorizedDevice(this.adb);
    requireDirectGateCMappings(this.adb, serial);
    try {
      await this.proxy.start();
      if (this.proxy.getListenPort() !== SYNTHETIC_GATE_C_LISTEN_PORT) {
        throw new Error('Synthetic Gate-C proxy did not bind the approved port');
      }
      swapApiMapping(this.adb, serial, directApiHostPort, proxyApiHostPort);
      requireProxyGateCMappings(this.adb, serial);
    } catch {
      const restored = restoreDirectMappingBestEffort(this.adb, serial);
      await this.proxy.close();
      this.state = 'failed';
      if (!restored) {
        this.emitSafeEvent('gate_c_transport_restore_failed');
      }
      throw new Error('Synthetic Gate-C transport arm failed');
    }
    this.serial = serial;
    this.state = 'armed';
    this.emitSafeEvent('gate_c_transport_armed');
  }

  getStatus(): SyntheticGateCTransportStatus {
    return Object.freeze({
      proxy: this.proxy.getState(),
      reverse: this.state,
    });
  }

  restore(): Promise<boolean> {
    if (this.restorePromise !== null) {
      return this.restorePromise;
    }
    if (this.state === 'restored' || this.state === 'closed') {
      return Promise.resolve(false);
    }
    if (this.state !== 'armed' || this.serial === null) {
      return Promise.reject(new Error('Synthetic Gate-C transport is not armed'));
    }
    this.state = 'restoring';
    const operation = this.performRestore(this.serial);
    this.restorePromise = operation;
    return operation;
  }

  close(): Promise<void> {
    if (this.closePromise !== null) {
      return this.closePromise;
    }
    const operation = this.performClose();
    this.closePromise = operation;
    return operation;
  }

  private async performRestore(serial: string): Promise<boolean> {
    const successfulDrop = this.proxy.getState() === 'blocked';
    try {
      swapApiMapping(this.adb, serial, proxyApiHostPort, directApiHostPort);
      requireDirectGateCMappings(this.adb, serial);
    } catch {
      this.state = 'failed';
      this.emitSafeEvent('gate_c_transport_restore_failed');
      throw new Error('Synthetic Gate-C transport restore failed');
    }
    await this.proxy.close();
    this.state = 'restored';
    this.emitSafeEvent(
      successfulDrop
        ? 'gate_c_transport_restored'
        : 'gate_c_transport_restored_after_abort',
    );
    return successfulDrop;
  }

  private async performClose(): Promise<void> {
    if (this.state === 'closed') {
      return;
    }
    if (this.state === 'restoring' && this.restorePromise !== null) {
      try {
        await this.restorePromise;
      } catch {
        // The failed state below owns the final bounded restoration attempt.
      }
    }
    if (this.state === 'armed') {
      try {
        await this.restore();
      } catch {
        // The failed state below owns the final bounded restoration attempt.
      }
    }
    if (this.state === 'failed' && this.serial !== null) {
      const restored = restoreDirectMappingBestEffort(this.adb, this.serial);
      await this.proxy.close();
      if (!restored) {
        this.emitSafeEvent('gate_c_transport_restore_failed');
        throw new Error('Synthetic Gate-C transport cleanup failed');
      }
    } else {
      await this.proxy.close();
    }
    this.state = 'closed';
  }

  private emitSafeEvent(event: SyntheticGateCReverseSafeEvent): void {
    try {
      this.onSafeEvent(event);
    } catch {
      // Fixed diagnostics must never affect reverse ownership or cleanup.
    }
  }
}

export function restoreSyntheticGateCTransport(
  adb: SyntheticGateCAdbCommandRunner,
): SyntheticGateCEmergencyRestoreResult {
  const serial = requireSingleAuthorizedDevice(adb);
  const mappings = readMappings(adb, serial);
  requireExactMapping(mappings, authDevicePort, authHostPort);
  const apiMappings = mappings.filter((mapping) => mapping.device === apiDevicePort);
  if (
    apiMappings.length === 1
    && apiMappings[0]?.host === directApiHostPort
  ) {
    return 'already_direct';
  }
  if (apiMappings.length === 0) {
    adb.run(['-s', serial, 'reverse', apiDevicePort, directApiHostPort]);
    requireDirectGateCMappings(adb, serial);
    return 'restored';
  }
  if (
    apiMappings.length !== 1
    || apiMappings[0]?.host !== proxyApiHostPort
  ) {
    throw new Error('Synthetic Gate-C emergency restore found an unexpected mapping');
  }
  swapApiMapping(adb, serial, proxyApiHostPort, directApiHostPort);
  requireDirectGateCMappings(adb, serial);
  return 'restored';
}

function requireSingleAuthorizedDevice(adb: SyntheticGateCAdbCommandRunner): string {
  const devices = adb.run(['devices', '-l'])
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2);
  const device = devices[0];
  const serial = device?.[0];
  const state = device?.[1];
  const hasUsbTransport = device?.slice(2).some((part) => part.startsWith('usb:')) === true;
  const isNetworkOrEmulatorSerial = serial === undefined
    || serial.includes(':')
    || serial.startsWith('emulator-')
    || serial.includes('_adb-tls-connect._tcp');
  if (
    devices.length !== 1
    || serial === undefined
    || state !== 'device'
    || !hasUsbTransport
    || isNetworkOrEmulatorSerial
  ) {
    throw new Error('Synthetic Gate-C transport requires exactly one authorized USB device');
  }
  return serial;
}

function requireDirectGateCMappings(
  adb: SyntheticGateCAdbCommandRunner,
  serial: string,
): void {
  const mappings = readMappings(adb, serial);
  requireExactMapping(mappings, authDevicePort, authHostPort);
  requireExactMapping(mappings, apiDevicePort, directApiHostPort);
}

function requireProxyGateCMappings(
  adb: SyntheticGateCAdbCommandRunner,
  serial: string,
): void {
  const mappings = readMappings(adb, serial);
  requireExactMapping(mappings, authDevicePort, authHostPort);
  requireExactMapping(mappings, apiDevicePort, proxyApiHostPort);
}

function requireExactMapping(
  mappings: readonly ReverseMapping[],
  device: string,
  host: string,
): void {
  const matching = mappings.filter((mapping) => mapping.device === device);
  if (matching.length !== 1 || matching[0]?.host !== host) {
    throw new Error('Synthetic Gate-C reverse mapping is unavailable or unexpected');
  }
}

function swapApiMapping(
  adb: SyntheticGateCAdbCommandRunner,
  serial: string,
  expectedHost: string,
  targetHost: string,
): void {
  const before = readMappings(adb, serial);
  requireExactMapping(before, authDevicePort, authHostPort);
  requireExactMapping(before, apiDevicePort, expectedHost);
  adb.run(['-s', serial, 'reverse', '--remove', apiDevicePort]);
  adb.run(['-s', serial, 'reverse', apiDevicePort, targetHost]);
  const after = readMappings(adb, serial);
  requireExactMapping(after, authDevicePort, authHostPort);
  requireExactMapping(after, apiDevicePort, targetHost);
}

function restoreDirectMappingBestEffort(
  adb: SyntheticGateCAdbCommandRunner,
  serial: string,
): boolean {
  try {
    const mappings = readMappings(adb, serial);
    requireExactMapping(mappings, authDevicePort, authHostPort);
    const apiMappings = mappings.filter((mapping) => mapping.device === apiDevicePort);
    if (
      apiMappings.length === 1
      && apiMappings[0]?.host === directApiHostPort
    ) {
      return true;
    }
    if (
      apiMappings.length === 1
      && apiMappings[0]?.host === proxyApiHostPort
    ) {
      adb.run(['-s', serial, 'reverse', '--remove', apiDevicePort]);
    } else if (apiMappings.length !== 0) {
      return false;
    }
    adb.run(['-s', serial, 'reverse', apiDevicePort, directApiHostPort]);
    requireDirectGateCMappings(adb, serial);
    return true;
  } catch {
    return false;
  }
}

interface ReverseMapping {
  readonly device: string;
  readonly host: string;
}

function readMappings(
  adb: SyntheticGateCAdbCommandRunner,
  serial: string,
): readonly ReverseMapping[] {
  return adb.run(['-s', serial, 'reverse', '--list'])
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts.at(-2)?.startsWith('tcp:'))
    .map((parts) => Object.freeze({
      device: parts.at(-2) as string,
      host: parts.at(-1) as string,
    }));
}
