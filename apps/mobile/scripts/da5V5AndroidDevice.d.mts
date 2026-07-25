import type {
  Da5V5ArtifactDependencies,
  Da5V5FileDependencies,
  verifyDa5V5AndroidArtifact,
} from './da5V5AndroidArtifact.mjs';

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

export interface Da5V5AndroidPreflightBinding extends Da5V5AndroidDeviceBinding {
  readonly androidApi: string;
  readonly androidRelease: string;
  readonly fontScale: '2.0';
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
  options?: Readonly<{ signal?: AbortSignal }>,
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
  readonly runner?: Da5V5AndroidAdbRunner;
  readonly serialBinding: Da5V5UsbSerialBinding;
  readonly signal?: AbortSignal;
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
  readonly installationState?: 'known' | 'uncertain';
  readonly reverseState?: 'known' | 'uncertain';
  readonly now?: () => number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<Readonly<{ status: 'match' | 'mismatch' }>>;
