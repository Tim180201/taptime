import type {
  Da5V5AndroidAdbRunner,
} from './da5V5AndroidDevice.mjs';
import type {
  Da5V5ValidationInstallStreamRunner,
} from './da5V5ValidationInstallStream.mjs';
import type {
  Da5V5ValidationToolIdentity,
  Da5V5ValidationToolIdentityDependencies,
} from './da5V5ValidationRuntimeContract.mjs';

export const DA5_V5_VALIDATION_PHASE0_PROFILE:
  'da5-v5-validation-phase0';
export const DA5_V5_VALIDATION_PHASE0_ACTIVITY:
  'com.tim180201.mobile.validation/.MainActivity';
export const DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES: Readonly<{
  installation: 'installation';
  installedProvenance: 'installed_provenance';
  prelaunch: 'prelaunch';
  activityStart: 'activity_start';
  postlaunch: 'postlaunch';
}>;
export const DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES: Readonly<{
  adbChildExitMismatch: 'adb_child_exit_mismatch';
  adbChildTimeoutMismatch: 'adb_child_timeout_mismatch';
  adbChildTransportMismatch: 'adb_child_transport_mismatch';
  adbStdinPipeAbortMismatch: 'adb_stdin_pipe_abort_mismatch';
  operatorAbortMismatch: 'operator_abort_mismatch';
  operationMismatch: 'operation_mismatch';
  packageManagerArtifactRejection:
    'package_manager_artifact_rejection';
  packageManagerCommandContractMismatch:
    'package_manager_command_contract_mismatch';
  packageManagerInstalledStateConflict:
    'package_manager_installed_state_conflict';
  packageManagerPolicyRestriction:
    'package_manager_policy_restriction';
  packageManagerReceiptMismatch: 'package_manager_receipt_mismatch';
  packageManagerStorageRejection:
    'package_manager_storage_rejection';
  verificationMismatch: 'verification_mismatch';
}>;
export const DA5_V5_VALIDATION_PHASE0_ARTIFACT: Readonly<{
  apk: Readonly<{
    bytes: 65634553;
    mode: number;
    path: string;
    sha256: string;
  }>;
  manifest: Readonly<{
    bytes: 6855;
    mode: number;
    path: string;
    sha256: string;
  }>;
  sourceClosureJsonSha256: 'a50ec386e87217eb9a02fede94fd37a97fefb0734fa5a9791b7ff142a9c44c2f';
  sourceClosureRecords: 33;
  sourceCommit: '83635335aa4f547dc8994243c604dacf9797f593';
  sourceTree: '40b7655a94e607b8afe19f90f42a95f42ee6d582';
}>;

export interface Da5V5ValidationSnapshot {
  readonly status: 'match';
  destroy(): void;
  state(): 'destroyed' | 'ready' | 'used';
  use<T>(operation: (snapshot: Buffer) => Promise<T> | T): Promise<T>;
}

export interface Da5V5ValidationPhase0Tools {
  readonly aapt: Readonly<Da5V5ValidationToolIdentity>;
  readonly adb: Readonly<Da5V5ValidationToolIdentity>;
  readonly apksigner: Readonly<Da5V5ValidationToolIdentity>;
  readonly hermesc: Readonly<Da5V5ValidationToolIdentity>;
  readonly unzip: Readonly<Da5V5ValidationToolIdentity>;
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
  readonly androidSdkAuthority?: unknown;
  readonly deviceModel?: unknown;
  readonly profile?: unknown;
  readonly tools?: unknown;
}): Readonly<{
  androidBuild: string;
  androidSdkAuthority: Readonly<{
    androidHome?: string;
    androidSdkRoot?: string;
    path: string;
  }>;
  deviceModel: string;
  profile: typeof DA5_V5_VALIDATION_PHASE0_PROFILE;
  tools: Readonly<Da5V5ValidationPhase0Tools>;
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
  readonly androidSdkAuthority: unknown;
  readonly artifactVerificationDependencies?: unknown;
  readonly inspectionTools: unknown;
  readonly profile: unknown;
  readonly stableFiles?: Da5V5ValidationStableFiles;
  readonly toolIdentityDependencies?:
    Da5V5ValidationToolIdentityDependencies;
  readonly verifyArtifact?: (...arguments_: readonly unknown[]) => unknown;
}): Da5V5ValidationSnapshot;
export function verifyDa5V5ValidationInstalledArtifact(options: {
  readonly deadline?: number;
  readonly now?: () => number;
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
    readonly installStreamRunner:
      Da5V5ValidationInstallStreamRunner;
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
    readonly operatorAbortRequested?: () => boolean;
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
    | 'human_passed' | 'preflighting' | 'ready' | 'waiting';
  submit(command: string): Promise<unknown>;
}

export interface Da5V5ValidationPhase0SessionOptions {
  readonly androidBuild: unknown;
  readonly androidSdkAuthority: unknown;
  readonly deviceModel: unknown;
  readonly now?: () => number;
  readonly profile: unknown;
  readonly tools: unknown;
  readonly toolIdentityDependencies?:
    Da5V5ValidationToolIdentityDependencies;
  readonly receipt?: (
    stage: string,
    status: 'match' | 'mismatch',
    category?:
      | 'adb_child_transport_mismatch'
      | 'adb_child_exit_mismatch'
      | 'adb_child_timeout_mismatch'
      | 'adb_stdin_pipe_abort_mismatch'
      | 'operator_abort_mismatch'
      | 'operation_mismatch'
      | 'package_manager_artifact_rejection'
      | 'package_manager_command_contract_mismatch'
      | 'package_manager_installed_state_conflict'
      | 'package_manager_policy_restriction'
      | 'package_manager_receipt_mismatch'
      | 'package_manager_storage_rejection'
      | 'verification_mismatch',
  ) => void;
  readonly runner?: Da5V5AndroidAdbRunner;
  readonly installStreamRunner?:
    Da5V5ValidationInstallStreamRunner;
  readonly sealArtifact?: (options: {
    readonly androidSdkAuthority: unknown;
    readonly inspectionTools: unknown;
    readonly profile: unknown;
    readonly toolIdentityDependencies?:
      Da5V5ValidationToolIdentityDependencies;
  }) => Da5V5ValidationSnapshot;
  readonly serialBinding?: import(
    './da5V5AndroidDevice.mjs'
  ).Da5V5UsbSerialBinding;
  readonly wait?: (milliseconds: number) => Promise<void>;
}

export function createDa5V5ValidationPhase0Session(
  options: Da5V5ValidationPhase0SessionOptions,
): Da5V5ValidationPhase0Session;
