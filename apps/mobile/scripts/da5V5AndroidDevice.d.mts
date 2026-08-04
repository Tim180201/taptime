import type {
  Da5V5ArtifactDependencies,
  Da5V5FileDependencies,
  verifyDa5V5AndroidArtifact,
} from './da5V5AndroidArtifact.mjs';
import type {
  Da5V5ValidationInstallStreamRunner,
} from './da5V5ValidationInstallStream.mjs';

export const DA5_V5_ANDROID_CLEANUP_SUBSTAGES: Readonly<{
  artifactSnapshotDestroy: 'artifact_snapshot_destroy';
  complete: 'complete';
  deviceReattest: 'device_reattest';
  finalZero: 'final_zero';
  installAbandon: 'install_abandon';
  internal: 'cleanup_internal';
  notRequired: 'not_required';
  packageList: 'package_list';
  packageUninstall: 'package_uninstall';
  processList: 'process_list';
  reverseList: 'reverse_list';
  reverseRemoveApi: 'reverse_remove_tcp_3000';
  reverseRemoveAuth: 'reverse_remove_tcp_54321';
  runnerBinding: 'runner_binding';
  uncertaintyEscalation: 'uncertainty_escalation';
}>;

export type Da5V5AndroidCleanupSubstage =
  (typeof DA5_V5_ANDROID_CLEANUP_SUBSTAGES)[
    keyof typeof DA5_V5_ANDROID_CLEANUP_SUBSTAGES
  ];
export interface Da5V5AndroidCleanupEvidence {
  readonly status: 'match' | 'mismatch' | 'not_required';
  readonly substage: Da5V5AndroidCleanupSubstage;
}

export const DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES: Readonly<{
  artifactReverify: 'artifact_reverify';
  childExit: 'child_exit';
  childStartTransport: 'child_start_transport';
  cleanup: 'cleanup';
  installedProvenance: 'installed_provenance';
  packageManagerReceipt: 'package_manager_receipt';
  signalAbort: 'signal_abort';
  stdinPipe: 'stdin_pipe';
  timeout: 'timeout';
}>;

export type Da5V5AndroidInstallFailureCategory =
  (typeof DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES)[
    keyof typeof DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES
  ];

export class Da5V5AndroidInstallError extends Error {
  readonly category: Da5V5AndroidInstallFailureCategory;
  readonly cleanupStatus: Da5V5AndroidCleanupEvidence['status'];
  readonly cleanupSubstage: Da5V5AndroidCleanupSubstage;
  constructor(
    category: Da5V5AndroidInstallFailureCategory,
    cleanup?: Da5V5AndroidCleanupEvidence,
  );
}
export function classifyDa5V5AndroidInstallError(
  error: unknown,
): Da5V5AndroidInstallFailureCategory;
export function classifyDa5V5AndroidInstallCleanup(
  error: unknown,
): Readonly<Da5V5AndroidCleanupEvidence>;

export interface Da5V5AndroidCommandOptions {
  readonly signal?: AbortSignal;
  readonly stdinBytes?: Buffer;
  readonly timeoutMilliseconds?: number;
}

export interface Da5V5AndroidAdbRunner {
  run(
    arguments_: readonly string[],
    options?: Da5V5AndroidCommandOptions,
  ): Promise<string>;
  runBinaryDigest?(
    arguments_: readonly string[],
    options: Readonly<{
      maximumBytes: number;
      signal?: AbortSignal;
      timeoutMilliseconds?: number;
    }>,
  ): Promise<Readonly<{
    bytes: number;
    sha256: string;
  }>>;
}

export interface Da5V5AndroidDeviceBinding {
  readonly androidBuild: string;
  readonly deviceModel: string;
}

export type Da5V5TalkBackPackage =
  | 'com.google.android.marvin.talkback'
  | 'com.samsung.android.accessibility.talkback';

export function requireDa5V5TalkBackPackage(value: string): Da5V5TalkBackPackage;
export function requireDa5V5ActiveTalkBackProvider(
  accessibilityEnabled: string,
  enabledServices: string,
  expectedPackage: string,
): Da5V5TalkBackPackage;

export class Da5V5AndroidCommandAbortError extends Error {}
export function isDa5V5AndroidCommandAbortError(
  error: unknown,
): error is Da5V5AndroidCommandAbortError;
export class Da5V5AndroidCommandTimeoutError extends Error {}
export function isDa5V5AndroidCommandTimeoutError(
  error: unknown,
): error is Da5V5AndroidCommandTimeoutError;
export class Da5V5AndroidCommandExitError extends Error {}
export class Da5V5AndroidCommandTransientError extends Error {}
export function isDa5V5AndroidCommandTransientError(
  error: unknown,
): error is Da5V5AndroidCommandTransientError;

export interface Da5V5AndroidPreflightBinding extends Da5V5AndroidDeviceBinding {
  readonly androidApi: string;
  readonly androidRelease: string;
  readonly fontScale: '2.0';
  readonly talkBackPackage: Da5V5TalkBackPackage;
  readonly talkBackVersion: string;
}

export interface Da5V5ReverseMapping {
  readonly device: string;
  readonly host: string;
}

export class Da5V5UsbSerialBinding {
  bind(serial: string): 'match' | 'mismatch';
  use<T>(serial: string, operation: (retainedSerial: string) => T): T;
  useRetained<T>(operation: (retainedSerial: string) => T): T;
  state(): 'bound' | 'failed' | 'unbound';
}

export class SystemDa5V5AndroidAdbRunner implements Da5V5AndroidAdbRunner {
  constructor(dependencies?: Readonly<{
    adbPath?: string;
    environment?: Readonly<Record<string, string | undefined>>;
    spawn?: typeof import('node:child_process').spawn;
  }>);
  run(
    arguments_: readonly string[],
    options?: Da5V5AndroidCommandOptions,
  ): Promise<string>;
  runBinaryDigest(
    arguments_: readonly string[],
    options: Readonly<{
      maximumBytes: number;
      signal?: AbortSignal;
      timeoutMilliseconds?: number;
    }>,
  ): Promise<Readonly<{
    bytes: number;
    sha256: string;
  }>>;
  createInstallStreamRunner(): Da5V5ValidationInstallStreamRunner;
}

export class Da5V5AndroidInstallTransaction {
  constructor(options: Readonly<{
    deviceBinding: Da5V5AndroidDeviceBinding;
    installStreamRunner: Da5V5ValidationInstallStreamRunner;
    runner: Da5V5AndroidAdbRunner;
    serialBinding: Da5V5UsbSerialBinding;
  }>);
  markZeroPreconditionProven(): void;
  markReverseMutationStarted(device: 'tcp:3000' | 'tcp:54321'): void;
  markReverseMutationProven(device: 'tcp:3000' | 'tcp:54321'): void;
  markSessionCreateStarted(): void;
  markSessionCommitted(): void;
}

export class Da5V5AndroidPreinstallPreflight {
  constructor(
    runner: Da5V5AndroidAdbRunner,
    serialBinding: Da5V5UsbSerialBinding,
    binding: Da5V5AndroidPreflightBinding,
  );
  run(options?: Readonly<{ signal?: AbortSignal }>): Promise<
    Readonly<{ status: 'match' | 'mismatch' }>
  >;
  state(): 'created' | 'failed' | 'matched' | 'running';
}

export function requireSingleDa5V5UsbDevice(
  runner: Da5V5AndroidAdbRunner,
  options?: Readonly<{
    signal?: AbortSignal;
    timeoutMilliseconds?: number;
  }>,
): Promise<string>;
export function parseDa5V5ReverseMappings(
  value: string,
  expectedSerial: string,
): readonly Da5V5ReverseMapping[];
export function assertDa5V5PackageMappingZero(
  runner: Da5V5AndroidAdbRunner,
  serial: string,
  options?: Readonly<{ signal?: AbortSignal }>,
): Promise<Readonly<{ status: 'match' }>>;
export function withDa5V5VerifiedInstalledDevice<T>(
  options: Readonly<{
    deviceBinding: Da5V5AndroidDeviceBinding;
    runner: Da5V5AndroidAdbRunner;
    serialBinding: Da5V5UsbSerialBinding;
    signal?: AbortSignal;
  }>,
  operation: (retainedSerial: string) => T,
): Promise<T>;
export function installDa5V5AndroidFromPackageZero(options: {
  readonly artifactDependencies?: Da5V5ArtifactDependencies;
  readonly deviceBinding: Da5V5AndroidDeviceBinding;
  readonly profile: unknown;
  readonly reverifyArtifact?: (
    verification: unknown,
    dependencies?: Da5V5FileDependencies,
  ) => Readonly<{
    destroy(): void;
    status: 'match';
    use<T>(operation: (snapshot: Buffer) => Promise<T> | T): Promise<T>;
  }>;
  readonly installStreamRunner?: Da5V5ValidationInstallStreamRunner;
  readonly runner?: Da5V5AndroidAdbRunner;
  readonly serialBinding: Da5V5UsbSerialBinding;
  readonly signal?: AbortSignal;
  readonly transaction: Da5V5AndroidInstallTransaction;
  readonly now?: () => number;
  readonly verifyArtifact?: (options: {
    readonly dependencies?: Da5V5ArtifactDependencies;
    readonly profile: unknown;
  }) => ReturnType<typeof verifyDa5V5AndroidArtifact> | unknown;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<Readonly<{
  packageName: 'com.tim180201.mobile.synthetic';
  status: 'match';
}>>;
export function cleanupDa5V5AndroidState(options: {
  readonly deviceBinding: Da5V5AndroidDeviceBinding;
  readonly profile: unknown;
  readonly runner?: Da5V5AndroidAdbRunner;
  readonly serialBinding: Da5V5UsbSerialBinding;
  readonly transaction: Da5V5AndroidInstallTransaction;
  readonly installationState?: 'known' | 'uncertain';
  readonly reverseState?: 'known' | 'uncertain';
  readonly now?: () => number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<Readonly<Da5V5AndroidCleanupEvidence>>;
