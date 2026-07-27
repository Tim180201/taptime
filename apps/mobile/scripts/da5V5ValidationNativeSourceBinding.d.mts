export interface Da5V5ValidationNativeSourceRecord {
  readonly bytes: number;
  readonly mode: string;
  readonly path: string;
  readonly sha256: string | null;
  readonly type: 'directory' | 'file';
}

export interface Da5V5ValidationNativeSourceSummary {
  readonly bytes: number;
  readonly directories: number;
  readonly entries: number;
  readonly files: number;
  readonly sha256: string;
}

export const DA5_V5_VALIDATION_NATIVE_SOURCE_CONTRACT:
  'taptime-da5-v5-native-source-closure-v1';
export const DA5_V5_VALIDATION_NATIVE_SOURCE_MAX_ENTRIES: number;
export const DA5_V5_VALIDATION_NATIVE_SOURCE_MAX_BYTES: number;
export const DA5_V5_VALIDATION_NATIVE_PACKAGE_BINDINGS:
  readonly Readonly<{
    absentMetadataPaths: readonly string[];
    androidPath: string;
    integrity: string;
    metadataPaths: readonly string[];
    packageName: string;
    packagePath: string;
    version: string;
  }>[];
export const DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING:
  Readonly<{
    androidPath: string;
    modulePath: string;
  }>;
export const DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE:
  Readonly<Da5V5ValidationNativeSourceSummary>;
export function createDa5V5ValidationNativeSourceClosure(
  repositoryRoot: string,
): Readonly<
  Da5V5ValidationNativeSourceSummary
  & { records: readonly Da5V5ValidationNativeSourceRecord[] }
>;
export function assertDa5V5ValidationNativeSourceClosure(
  closure: Da5V5ValidationNativeSourceSummary,
  expected?: Da5V5ValidationNativeSourceSummary,
): Readonly<Da5V5ValidationNativeSourceSummary & { status: 'match' }>;
export function verifyDa5V5ValidationNativeSourceClosure(
  repositoryRoot: string,
): Readonly<Da5V5ValidationNativeSourceSummary & { status: 'match' }>;
