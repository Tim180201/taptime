export interface Da5V5ValidationFileBinding {
  readonly path: string;
  readonly bytes: number;
  readonly mode: number;
  readonly sha256: string;
}
export interface Da5V5ValidationSourceRecord {
  readonly path: string;
  readonly sha256: string;
}

export interface Da5V5ValidationApkInspection {
  readonly packageName: string;
  readonly versionCode: string;
  readonly versionName: string;
  readonly signatureV1: boolean;
  readonly signatureV2: boolean;
  readonly signatureV3: boolean;
  readonly signatureV31: boolean;
  readonly signatureV4: boolean;
  readonly signerCount: number;
  readonly signerCertificateSha256: string;
  readonly permissions: readonly string[];
  readonly privateReceiverPermissionGuard: boolean;
  readonly nfcFeatureRequired: boolean;
  readonly allowBackup: boolean;
  readonly backupPolicyDenyAll: boolean;
  readonly cleartextTraffic: boolean;
  readonly httpsBrowsableQueryIntentExact: boolean;
  readonly networkSecurityConfig: boolean;
  readonly networkPolicyDenyAll: boolean;
  readonly packageVisibilityQueriesExact: boolean;
  readonly queryPackages: readonly string[];
  readonly productDeepLinks: boolean;
  readonly productTagDispatch: boolean;
  readonly requiredNativeModules: boolean;
  readonly forbiddenNativeModules: boolean;
  readonly hermesBundleCount: number;
  readonly validationRuntimeMarker: boolean;
  readonly productRuntimeMarker: boolean;
}

export interface Da5V5ValidationFileDependencies {
  readonly lstat: (path: string) => {
    readonly dev: number;
    readonly ino: number;
    readonly mode: number;
    readonly size: number;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
  readonly readUtf8: (path: string) => string;
  readonly realpath: (path: string) => string;
  readonly sha256: (path: string) => string;
}

export interface Da5V5ValidationArtifactDependencies {
  readonly files: Da5V5ValidationFileDependencies;
  readonly inspectApk: (
    path: string,
  ) => Da5V5ValidationApkInspection;
}

export interface Da5V5ValidationAndroidSdkAuthority {
  readonly androidHome?: string;
  readonly androidSdkRoot?: string;
}
export interface Da5V5ValidationInspectionTools {
  readonly aapt: Readonly<Da5V5ValidationToolIdentity>;
  readonly apksigner: Readonly<Da5V5ValidationToolIdentity>;
  readonly hermesc: Readonly<Da5V5ValidationToolIdentity>;
  readonly unzip: Readonly<Da5V5ValidationToolIdentity>;
}

export const DA5_V5_VALIDATION_ARTIFACT_CONTRACT:
  'taptime-da5-v5-validation-artifact-v1';
export const DA5_V5_VALIDATION_PACKAGE:
  'com.tim180201.mobile.validation';
export const DA5_V5_VALIDATION_VERSION_CODE: '1';
export const DA5_V5_VALIDATION_VERSION_NAME: '1.0.0';
export const DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256: string;
export const DA5_V5_VALIDATION_UNZIP_PATH: '/usr/bin/unzip';
export const DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES:
  readonly string[];
export const DA5_V5_VALIDATION_TECHNOLOGY:
  'NfcA';

export function createDa5V5ValidationArtifactManifest(options: {
  readonly apkBytes: number;
  readonly apkSha256: string;
  readonly sourceCommit: string;
  readonly sourceClosure: readonly Da5V5ValidationSourceRecord[];
  readonly sourceTree: string;
}): Readonly<Record<
  string,
  string | number | boolean | readonly Da5V5ValidationSourceRecord[]
>>;
export function serializeDa5V5ValidationArtifactManifest(
  manifest: Readonly<Record<
    string,
    string | number | boolean | readonly Da5V5ValidationSourceRecord[]
  >>,
): string;
export function verifyDa5V5ValidationArtifactBinding(
  options: {
    readonly androidSdkAuthority?: Da5V5ValidationAndroidSdkAuthority;
    readonly apk: Da5V5ValidationFileBinding;
    readonly manifest: Da5V5ValidationFileBinding;
    readonly expectedSourceCommit: string;
    readonly expectedSourceClosure: readonly Da5V5ValidationSourceRecord[];
    readonly expectedSourceTree: string;
    readonly inspectionTools?: Da5V5ValidationInspectionTools;
    readonly toolIdentityDependencies?:
      Da5V5ValidationToolIdentityDependencies;
  },
  dependencies?: Da5V5ValidationArtifactDependencies,
): Readonly<{
  packageName: string;
  sourceCommit: string;
  sourceClosure: readonly Da5V5ValidationSourceRecord[];
  sourceTree: string;
  status: 'match';
}>;
export function verifyDa5V5ValidationApkInspection(
  inspection: Da5V5ValidationApkInspection,
): Readonly<{ status: 'match' }>;
export function resolveDa5V5ValidationPackagedXmlPath(
  resources: string,
  resourceName: string,
): string;
export function inspectDa5V5ValidationManifestXmlTree(
  androidManifest: string,
): Readonly<{
  httpsBrowsableQueryIntentExact: boolean;
  packageVisibilityQueriesExact: boolean;
  privateReceiverPermissionGuard: boolean;
  productDeepLinks: boolean;
  productTagDispatch: boolean;
  queryPackages: readonly string[];
}>;
export function inspectDa5V5ValidationApk(
  apkPath: string,
  androidSdkAuthority: Da5V5ValidationAndroidSdkAuthority,
  inspectionTools?: Da5V5ValidationInspectionTools,
  toolIdentityDependencies?: Da5V5ValidationToolIdentityDependencies,
): Da5V5ValidationApkInspection;
export function resolveDa5V5ValidationHermesCompilerPath(): string;
export function requireDa5V5ValidationAndroidSdkAuthority(
  value: unknown,
): Readonly<Da5V5ValidationAndroidSdkAuthority & { path: string }>;
export function inspectDa5V5ValidationHermesBytecode(
  bytecodeDump: string,
): Readonly<{
  productRuntimeMarker: boolean;
  validationRuntimeMarker: boolean;
}>;
export function inspectDa5V5ValidationNativeBytecode(
  bytecode: Buffer,
): Readonly<{
  forbiddenNativeModules: boolean;
  requiredNativeModules: boolean;
}>;
import type {
  Da5V5ValidationToolIdentity,
  Da5V5ValidationToolIdentityDependencies,
} from './da5V5ValidationRuntimeContract.mjs';
