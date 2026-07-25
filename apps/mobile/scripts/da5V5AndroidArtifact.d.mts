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
  realpath(path: string): string;
  sha256(path: string): string;
}

export interface Da5V5ApkInspection {
  readonly allowBackup: boolean;
  readonly backupRules: boolean;
  readonly dataExtractionRules: boolean;
  readonly hermesBundleCount: number;
  readonly mifareUltralight: boolean;
  readonly networkSecurityConfig: boolean;
  readonly nfcA: boolean;
  readonly nfcTechDiscovered: boolean;
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
  inspectApk(path: string): Da5V5ApkInspection;
  verifyRuntime(path: string): void;
}

export const DA5_V5_ANDROID_PROFILE: 'da5-v5';
export const DA5_V5_ANDROID_PACKAGE: 'com.tim180201.mobile.synthetic';
export const DA5_V5_ANDROID_ARTIFACT: Readonly<{
  apk: Da5V5ImmutableFileBinding;
  manifest: Da5V5ImmutableFileBinding;
  packageName: typeof DA5_V5_ANDROID_PACKAGE;
  signerCertificateSha256: string;
  versionCode: '1';
  versionName: '1.0.0';
}>;

export function requireDa5V5AndroidProfile(value: unknown): typeof DA5_V5_ANDROID_PROFILE;
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
