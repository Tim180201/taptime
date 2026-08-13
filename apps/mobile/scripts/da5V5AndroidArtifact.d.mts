import type {
  Da5V5ValidationToolIdentity,
  Da5V5ValidationToolIdentityDependencies,
} from './da5V5ValidationRuntimeContract.mjs';

export interface Da5V5ImmutableFileBinding {
  readonly bytes: number;
  readonly mode: number;
  readonly path: string;
  readonly sha256: string;
}

export interface Da5V5FileDependencies {
  close?(fileDescriptor: number): void;
  fstat?(fileDescriptor: number): {
    readonly dev: number;
    readonly ino: number;
    isFile(): boolean;
    isSymbolicLink(): boolean;
    readonly mode: number;
    readonly size: number;
  };
  lstat(path: string): {
    readonly dev: number;
    readonly ino: number;
    isFile(): boolean;
    isSymbolicLink(): boolean;
    readonly mode: number;
    readonly size: number;
  };
  openReadOnly?(path: string): number;
  readFileDescriptor?(fileDescriptor: number, expectedBytes: number): Buffer;
  readUtf8?(path: string): string;
  realpath(path: string): string;
  sha256(path: string): string;
}

export interface Da5V5ApkInspection {
  readonly allowBackup: boolean;
  readonly backupRules: boolean;
  readonly dataExtractionRules: boolean;
  readonly hermesBundleCount: number;
  readonly networkSecurityConfig: boolean;
  readonly nfcTechElementCount: number;
  readonly nfcTechListCount: number;
  readonly nfcTechnologies: readonly string[];
  readonly nfcDispatchManifestExact: boolean;
  readonly packageName: string;
  readonly signatureV1: boolean;
  readonly signatureV2: boolean;
  readonly signatureV3: boolean;
  readonly signatureV31: boolean;
  readonly signatureV4: boolean;
  readonly signerCertificateSha256: string;
  readonly signerCount: number;
  readonly usesCleartextTraffic: boolean;
  readonly versionCode: string;
  readonly versionName: string;
}

export interface Da5V5ArtifactDependencies {
  readonly files: Da5V5FileDependencies;
  inspectApk(
    path: string,
    tools: Da5V5AndroidApkInspectionTools,
  ): Da5V5ApkInspection;
  reportRuntimeVerified?(): void;
  resolveHermesCompilerPath(): string;
  readonly toolAuthority: Da5V5AndroidInspectionToolAuthority;
  readonly toolIdentity?: Da5V5ValidationToolIdentityDependencies;
  verifyRuntime(
    path: string,
    tools: Da5V5AndroidRuntimeInspectionTools,
  ): void;
}

export interface Da5V5AndroidInspectionToolAuthority {
  readonly aapt: Da5V5ImmutableFileBinding;
  readonly androidSdkPath: string;
  readonly apksigner: Da5V5ImmutableFileBinding;
  readonly hermesc: Da5V5ImmutableFileBinding;
  readonly unzip: Da5V5ImmutableFileBinding;
}

export interface Da5V5AndroidApkInspectionTools {
  readonly aapt: Readonly<Da5V5ValidationToolIdentity>;
  readonly apksigner: Readonly<Da5V5ValidationToolIdentity>;
  readonly unzip: Readonly<Da5V5ValidationToolIdentity>;
}

export interface Da5V5AndroidRuntimeInspectionTools {
  readonly hermesc: Readonly<Da5V5ValidationToolIdentity>;
  readonly unzip: Readonly<Da5V5ValidationToolIdentity>;
}

export const DA5_V5_ANDROID_PROFILE: 'da5-v5';
export const DA5_V5_ANDROID_PACKAGE: 'com.tim180201.mobile.synthetic';
export const DA5_V5_ANDROID_ARTIFACT: Readonly<{
  apk: Da5V5ImmutableFileBinding;
  manifest: Da5V5ImmutableFileBinding;
  packageName: typeof DA5_V5_ANDROID_PACKAGE;
  signerCertificateSha256: string;
  sourceCommit: '03e0e48ad53ff91b24ee1182abf782473317988d';
  sourceTree: '4465f8ee5be41f82cdaed5f31f2da92b839c952d';
  versionCode: '1';
  versionName: '1.0.0';
}>;

export function requireDa5V5AndroidProfile(value: unknown): typeof DA5_V5_ANDROID_PROFILE;
export function createDa5V5AndroidInspectionToolAuthority(
  options?: Readonly<{
    environment?: NodeJS.ProcessEnv;
    resolveHermesCompilerPath?(): string;
  }>,
): Readonly<Da5V5AndroidInspectionToolAuthority>;
export function verifyDa5V5AndroidArtifactManifest(
  source: string,
): Readonly<Record<string, string>>;
export function verifyDa5V5ImmutableFile(
  binding: Da5V5ImmutableFileBinding,
  dependencies?: Da5V5FileDependencies,
): Readonly<{
  identity: Readonly<{ dev: number; ino: number }>;
  status: 'match';
}>;
export function verifyDa5V5AndroidArtifact(options: {
  readonly profile: unknown;
  readonly dependencies?: Da5V5ArtifactDependencies;
  readonly toolAuthority?: Da5V5AndroidInspectionToolAuthority;
}): Readonly<{
  packageName: typeof DA5_V5_ANDROID_PACKAGE;
  status: 'match';
  versionCode: '1';
  versionName: '1.0.0';
}>;
export function createDa5V5AndroidArtifactVerificationForTest(options: {
  readonly apk: Da5V5ImmutableFileBinding;
  readonly dependencies: Da5V5FileDependencies;
  readonly manifest: Da5V5ImmutableFileBinding;
}): ReturnType<typeof verifyDa5V5AndroidArtifact>;
export function reverifyDa5V5AndroidArtifactForInstall(
  verification: ReturnType<typeof verifyDa5V5AndroidArtifact>,
  dependencies?: Da5V5FileDependencies,
): Readonly<{
  destroy(): void;
  status: 'match';
  use<T>(operation: (snapshot: Buffer) => Promise<T> | T): Promise<T>;
}>;
export function inspectDa5V5NfcTechFilterXmlTree(
  xmlTree: string,
): Readonly<{
  techElementCount: number;
  techListCount: number;
  technologies: readonly string[];
}>;
export function inspectDa5V5ProductManifestXmlTree(
  xmlTree: string,
  expectedResourceId: string,
): Readonly<{
  nfcDispatchManifestExact: boolean;
}>;
export function resolveDa5V5NfcTechFilterResourceBinding(
  resources: string,
): Readonly<{
  path: string;
  resourceId: string;
}>;
export function resolveDa5V5NfcTechFilterResourcePath(
  resources: string,
): string;
