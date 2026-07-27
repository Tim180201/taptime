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
export const DA5_V5_VALIDATION_SOURCE_CLOSURE: readonly string[];
export const DA5_V5_VALIDATION_SOURCE_SCOPES: readonly string[];
export const DA5_V5_VALIDATION_BUILD_ENVIRONMENT: Readonly<
  Record<string, string>
>;
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
