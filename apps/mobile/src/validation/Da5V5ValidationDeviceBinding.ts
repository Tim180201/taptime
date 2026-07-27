export const DA5_V5_VALIDATION_TALKBACK_PACKAGES = Object.freeze([
  'com.google.android.marvin.talkback',
  'com.samsung.android.accessibility.talkback',
] as const);

export type Da5V5ValidationTalkBackPackage =
  typeof DA5_V5_VALIDATION_TALKBACK_PACKAGES[number];

export interface Da5V5ValidationDeviceBinding {
  readonly deviceModel: string;
  readonly androidRelease: string;
  readonly androidApiLevel: number;
  readonly androidBuild: string;
  readonly fontScale: number;
  readonly talkBackPackageName: Da5V5ValidationTalkBackPackage;
  readonly talkBackPackageVersion: string;
  readonly talkBackEnabled: true;
}

export interface Da5V5ValidationDeviceBindingPort {
  readBinding(): Promise<unknown>;
}

const EXACT_BINDING_KEYS = Object.freeze([
  'androidApiLevel',
  'androidBuild',
  'androidRelease',
  'deviceModel',
  'fontScale',
  'talkBackEnabled',
  'talkBackPackageName',
  'talkBackPackageVersion',
]);
const SAFE_NATIVE_TEXT = /^[\u0020-\u007E]{1,160}$/u;

export function requireDa5V5ValidationDeviceBinding(
  value: unknown,
): Da5V5ValidationDeviceBinding {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.keys(value).sort().join('\n')
      !== [...EXACT_BINDING_KEYS].sort().join('\n')
  ) {
    throw new Error('DA5 V5 Validation device binding shape mismatch');
  }
  const candidate = value as Record<string, unknown>;
  if (
    !safeNativeText(candidate.deviceModel)
    || !safeNativeText(candidate.androidRelease)
    || !Number.isSafeInteger(candidate.androidApiLevel)
    || (candidate.androidApiLevel as number) < 1
    || (candidate.androidApiLevel as number) > 999
    || !safeNativeText(candidate.androidBuild)
    || typeof candidate.fontScale !== 'number'
    || !Number.isFinite(candidate.fontScale)
    || candidate.fontScale !== 2
    || !allowedTalkBackPackage(candidate.talkBackPackageName)
    || !safeNativeText(candidate.talkBackPackageVersion)
    || candidate.talkBackEnabled !== true
  ) {
    throw new Error('DA5 V5 Validation device binding value mismatch');
  }
  return Object.freeze({
    androidApiLevel: candidate.androidApiLevel as number,
    androidBuild: candidate.androidBuild as string,
    androidRelease: candidate.androidRelease as string,
    deviceModel: candidate.deviceModel as string,
    fontScale: candidate.fontScale,
    talkBackEnabled: true,
    talkBackPackageName: candidate.talkBackPackageName,
    talkBackPackageVersion: candidate.talkBackPackageVersion as string,
  });
}

function allowedTalkBackPackage(
  value: unknown,
): value is Da5V5ValidationTalkBackPackage {
  return value === DA5_V5_VALIDATION_TALKBACK_PACKAGES[0]
    || value === DA5_V5_VALIDATION_TALKBACK_PACKAGES[1];
}

function safeNativeText(value: unknown): value is string {
  return typeof value === 'string'
    && value === value.trim()
    && SAFE_NATIVE_TEXT.test(value);
}
