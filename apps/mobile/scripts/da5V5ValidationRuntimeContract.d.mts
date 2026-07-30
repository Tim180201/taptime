export const DA5_V5_VALIDATION_RUNTIME_VARIANT: 'da5-v5-validation';
export const DA5_V5_VALIDATION_ENTRY_FILE: 'validation-index.ts';
export const DA5_V5_VALIDATION_RUNTIME_MARKER:
  'taptime-da5-v5-validation-only-v1';
export const DA5_V5_VALIDATION_DEVICE_MODULE:
  'taptime-da5-v5-validation-device-binding';
export const DA5_V5_VALIDATION_ANDROID_PACKAGE:
  'com.tim180201.mobile.validation';
export const DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES:
  readonly string[];
export const DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST:
  readonly Readonly<Record<string, string | null>>[];
export const DA5_V5_VALIDATION_REACT_NATIVE_ALLOWLIST:
  readonly Readonly<Record<string, string>>[];
export const DA5_V5_VALIDATION_BUNDLE_NATIVE_MODULE_ALLOWLIST:
  readonly Readonly<{
    moduleName: string;
    sourcePath: string;
  }>[];
export const DA5_V5_VALIDATION_EXPECTED_BUNDLE_SOURCE_CLOSURE:
  Readonly<{
    entries: number;
    sourceBytes: number;
    sha256: string;
  }>;
export const DA5_V5_VALIDATION_EXPECTED_BUNDLE_EXECUTABLE:
  Readonly<{
    bytes: number;
    sha256: string;
  }>;
export const DA5_V5_VALIDATION_SOURCE_CLOSURE: readonly string[];
export const DA5_V5_VALIDATION_EXECUTION_SCOPES: readonly string[];
export const DA5_V5_VALIDATION_SOURCE_SCOPES: readonly string[];
export const DA5_V5_VALIDATION_BUILD_ENVIRONMENT: Readonly<
  Record<string, string>
>;
export interface Da5V5ValidationToolIdentity {
  readonly bytes: number;
  readonly dev: string;
  readonly ino: string;
  readonly mode: number;
  readonly path: string;
  readonly sha256: string;
}
export type Da5V5ValidationToolIdentityComponent =
  bigint | number | string;
export type Da5V5ValidationToolStatNumber = bigint | number;
export interface Da5V5ValidationToolIdentityDependencies {
  lstat(path: string): {
    readonly dev: Da5V5ValidationToolIdentityComponent;
    readonly ino: Da5V5ValidationToolIdentityComponent;
    readonly mode: Da5V5ValidationToolStatNumber;
    readonly size: Da5V5ValidationToolStatNumber;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
  realpath(path: string): string;
  sha256(path: string): string;
}
export function createCurrentDa5V5ValidationToolIdentity(
  path: string,
  dependencies?: Da5V5ValidationToolIdentityDependencies,
): Readonly<Da5V5ValidationToolIdentity>;
export function verifyDa5V5ValidationToolIdentity(
  binding: unknown,
  dependencies?: Da5V5ValidationToolIdentityDependencies,
): Readonly<Da5V5ValidationToolIdentity>;
export function assertDa5V5ValidationToolIdentityMetadata(
  identity: unknown,
  dependencies?: Da5V5ValidationToolIdentityDependencies,
): Readonly<{ status: 'match' }>;
export function createDa5V5ValidationBuildEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>>;
export function createDa5V5ValidationAutolinkingPackageJson(
  source: string,
): string;
export function assertDa5V5ValidationPrebuildPackageJson(
  before: string,
  after: string,
): void;
export function assertDa5V5ValidationAutolinkingResolution(
  resolution: unknown,
  repositoryRoot: string,
): void;
export function assertDa5V5ValidationReactNativeAutolinkingResolution(
  resolution: unknown,
  repositoryRoot: string,
  mobileDirectory: string,
): void;
export function assertDa5V5ValidationBundleNativeModuleGraph(
  sourceMap: unknown,
  bundle: Uint8Array,
): readonly Readonly<{
  moduleName: string;
  sourcePath: string;
}>[];
