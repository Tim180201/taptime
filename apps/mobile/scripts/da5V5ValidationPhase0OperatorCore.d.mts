import type {
  Da5V5AndroidAdbRunner,
} from './da5V5AndroidDevice.mjs';

export const DA5_V5_VALIDATION_PHASE0_PROFILE:
  'da5-v5-validation-phase0';
export const DA5_V5_VALIDATION_PHASE0_ACTIVITY:
  'com.tim180201.mobile.validation/.MainActivity';
export const DA5_V5_VALIDATION_PHASE0_ARTIFACT: Readonly<{
  apk: Readonly<{
    bytes: 65631433;
    mode: number;
    path: string;
    sha256: string;
  }>;
  manifest: Readonly<{
    bytes: 6700;
    mode: number;
    path: string;
    sha256: string;
  }>;
  sourceCommit: string;
  sourceTree: string;
}>;

export interface Da5V5ValidationSnapshot {
  readonly status: 'match';
  destroy(): void;
  state(): 'destroyed' | 'ready' | 'used';
  use<T>(operation: (snapshot: Buffer) => Promise<T> | T): Promise<T>;
}

export interface Da5V5ValidationStableFiles {
  close(fileDescriptor: number): void;
  fstat(fileDescriptor: number): import('node:fs').Stats;
  lstat(path: string): import('node:fs').Stats;
  openReadOnly(path: string): number;
  readFileDescriptor(fileDescriptor: number, expectedBytes: number): Buffer;
  realpath(path: string): string;
}

export function requireDa5V5ValidationPhase0Inputs(value: {
  readonly androidBuild?: unknown;
  readonly deviceModel?: unknown;
  readonly profile?: unknown;
}): Readonly<{
  androidBuild: string;
  deviceModel: string;
  profile: typeof DA5_V5_VALIDATION_PHASE0_PROFILE;
}>;
export function parseDa5V5ValidationInstalledBaseApkPath(
  value: string,
): string;
export function parseDa5V5ValidationInstalledStat(value: string): Readonly<{
  device: string;
  inode: string;
  mode: string;
  size: number;
}>;
export function parseDa5V5ValidationAndroidUserTopology(
  value: string,
): Readonly<{
  currentUser: '0';
  mainUser: '0';
  ownerUser: '0';
}>;
export function sealDa5V5ValidationInstallSnapshot(
  binding: Readonly<{
    bytes: number;
    mode: number;
    path: string;
    sha256: string;
  }>,
  files?: Da5V5ValidationStableFiles,
): Da5V5ValidationSnapshot;
export function verifyAndSealDa5V5ValidationPhase0Artifact(options: {
  readonly artifactVerificationDependencies?: unknown;
  readonly profile: unknown;
  readonly stableFiles?: Da5V5ValidationStableFiles;
  readonly verifyArtifact?: (...arguments_: readonly unknown[]) => unknown;
}): Da5V5ValidationSnapshot;
export function verifyDa5V5ValidationInstalledArtifact(options: {
  readonly runner: Da5V5AndroidAdbRunner;
  readonly serial: string;
  readonly signal?: AbortSignal;
}): Promise<Readonly<{
  canonicalPath: string;
  path: string;
  sha256: string;
  stat: Readonly<{
    device: string;
    inode: string;
    mode: string;
    size: number;
  }>;
  status: 'match';
  versionCode: '1';
}>>;

export class Da5V5ValidationPhase0Device {
  constructor(options: {
    readonly androidBuild: string;
    readonly deviceModel: string;
    readonly now?: () => number;
    readonly runner: Da5V5AndroidAdbRunner;
    readonly serialBinding: import(
      './da5V5AndroidDevice.mjs'
    ).Da5V5UsbSerialBinding;
    readonly snapshot: Da5V5ValidationSnapshot;
    readonly wait?: (milliseconds: number) => Promise<void>;
  });
  preflight(options?: {
    readonly signal?: AbortSignal;
  }): Promise<Readonly<{ status: 'match' }>>;
  installAndLaunch(options?: {
    readonly signal?: AbortSignal;
  }): Promise<Readonly<{ status: 'match' }>>;
  finishMaximumMilliseconds(): number;
  cleanup(options?: {
    readonly deadline?: number;
  }): Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
}

export class Da5V5ValidationPhase0Session {
  readonly done: Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
  constructor(options: Da5V5ValidationPhase0SessionOptions);
  end(): Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
  fail(): Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
  signal(): Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
  start(): Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
  state(): 'cleaning' | 'complete' | 'created' | 'failed' | 'installing'
    | 'preflighting' | 'ready' | 'waiting';
  submit(command: string): Promise<unknown>;
}

export interface Da5V5ValidationPhase0SessionOptions {
  readonly androidBuild: unknown;
  readonly deviceModel: unknown;
  readonly now?: () => number;
  readonly profile: unknown;
  readonly receipt?: (
    stage: string,
    status: 'match' | 'mismatch',
  ) => void;
  readonly runner?: Da5V5AndroidAdbRunner;
  readonly sealArtifact?: (options: {
    readonly profile: unknown;
  }) => Da5V5ValidationSnapshot;
  readonly serialBinding?: import(
    './da5V5AndroidDevice.mjs'
  ).Da5V5UsbSerialBinding;
  readonly wait?: (milliseconds: number) => Promise<void>;
}

export function createDa5V5ValidationPhase0Session(
  options: Da5V5ValidationPhase0SessionOptions,
): Da5V5ValidationPhase0Session;
