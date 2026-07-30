export interface Da5V5ValidationReadinessFileBinding {
  readonly bytes: unknown;
  readonly mode: unknown;
  readonly path: unknown;
  readonly sha256: unknown;
}

export interface Da5V5ValidationNoHardwareReadinessOptions {
  readonly androidSdkAuthority: unknown;
  readonly artifactSourceCommit: unknown;
  readonly artifactSourceTree: unknown;
  readonly executionCommit: unknown;
  readonly executionTree: unknown;
  readonly repositoryRoot: unknown;
  readonly tools: Readonly<{
    readonly aapt: Da5V5ValidationReadinessFileBinding;
    readonly adb: Da5V5ValidationReadinessFileBinding;
    readonly apksigner: Da5V5ValidationReadinessFileBinding;
    readonly git: Da5V5ValidationReadinessFileBinding;
    readonly hermesc: Da5V5ValidationReadinessFileBinding;
    readonly node: Da5V5ValidationReadinessFileBinding;
    readonly unzip: Da5V5ValidationReadinessFileBinding;
  }>;
}

export interface Da5V5ValidationNoHardwareReadinessDependencies {
  readonly currentNodePath: string;
  lstat(path: string): {
    readonly dev: number;
    readonly ino: number;
    readonly mode: number;
    readonly size: number;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
  readRepositoryBinding(
    gitPath: string,
    repositoryRoot: string,
    sourceScopes: readonly string[],
  ): Readonly<{
    clean: boolean;
    executionCommit: string;
    executionTree: string;
    root: string;
  }>;
  realpath(path: string): string;
  resolveHermesCompilerPath(): string;
  sha256(path: string): string;
}

export interface Da5V5ValidationReadinessToolIdentity {
  readonly bytes: number;
  readonly dev: number;
  readonly ino: number;
  readonly mode: number;
  readonly path: string;
  readonly sha256: string;
}

export function createDa5V5ValidationNoHardwareReadinessOptions(
  environment: NodeJS.ProcessEnv,
): Da5V5ValidationNoHardwareReadinessOptions;

export function readDa5V5ValidationRepositoryBinding(
  gitPath: string,
  repositoryRoot: string,
  sourceScopes: readonly string[],
  dependencies?: Readonly<{
    runGit(path: string, arguments_: readonly string[]): string;
  }>,
): Readonly<{
  clean: boolean;
  executionCommit: string;
  executionTree: string;
  root: string;
}>;

export function verifyDa5V5ValidationNoHardwareReadiness(
  options: Da5V5ValidationNoHardwareReadinessOptions,
  dependencies?: Da5V5ValidationNoHardwareReadinessDependencies,
): Readonly<{
  androidSdkPath: string;
  artifactSourceCommit: string;
  artifactSourceTree: string;
  executionCommit: string;
  executionTree: string;
  repositoryRoot: string;
  status: 'match';
  tools: Readonly<{
    aapt: Da5V5ValidationReadinessToolIdentity;
    adb: Da5V5ValidationReadinessToolIdentity;
    apksigner: Da5V5ValidationReadinessToolIdentity;
    git: Da5V5ValidationReadinessToolIdentity;
    hermesc: Da5V5ValidationReadinessToolIdentity;
    node: Da5V5ValidationReadinessToolIdentity;
    unzip: Da5V5ValidationReadinessToolIdentity;
  }>;
}>;
