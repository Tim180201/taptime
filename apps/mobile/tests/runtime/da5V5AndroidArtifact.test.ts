import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_ANDROID_ARTIFACT,
  DA5_V5_ANDROID_PACKAGE,
  requireDa5V5AndroidProfile,
  reverifyDa5V5AndroidArtifactForInstall,
  verifyDa5V5AndroidArtifact,
  verifyDa5V5ImmutableFile,
  type Da5V5ApkInspection,
  type Da5V5ArtifactDependencies,
  type Da5V5FileDependencies,
} from '../../scripts/da5V5AndroidArtifact.mjs';

describe('DA5 V5 immutable external Android artifact', () => {
  it('requires the exact profile before any file, SDK or runtime inspection', () => {
    const dependencies = validDependencies();
    for (const profile of [undefined, 'default', 'da4-v5', 'DA5-V5']) {
      expect(() => verifyDa5V5AndroidArtifact({ profile, dependencies })).toThrow(
        /exact explicit profile/,
      );
    }
    expect(dependencies.files.lstat).not.toHaveBeenCalled();
    expect(dependencies.inspectApk).not.toHaveBeenCalled();
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
    expect(requireDa5V5AndroidProfile('da5-v5')).toBe('da5-v5');
  });

  it('matches both immutable files and independently inspected APK boundaries', () => {
    const dependencies = validDependencies();
    expect(verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies,
    })).toEqual({
      packageName: DA5_V5_ANDROID_PACKAGE,
      status: 'match',
      versionCode: '1',
      versionName: '1.0.0',
    });
    expect(dependencies.files.lstat).toHaveBeenCalledTimes(4);
    expect(dependencies.inspectApk).toHaveBeenCalledWith(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
    );
    expect(dependencies.verifyRuntime).toHaveBeenCalledWith(
      DA5_V5_ANDROID_ARTIFACT.apk.path,
    );
  });

  it.each([
    'packageName',
    'versionCode',
    'versionName',
    'signatureV1',
    'signatureV2',
    'signatureV3',
    'signatureV31',
    'signatureV4',
    'signerCount',
    'signerCertificateSha256',
    'allowBackup',
    'usesCleartextTraffic',
    'networkSecurityConfig',
    'backupRules',
    'dataExtractionRules',
    'nfcTechDiscovered',
    'nfcA',
    'mifareUltralight',
    'hermesBundleCount',
  ] as const)('rejects independent APK inspection drift in %s', (field) => {
    const dependencies = validDependencies();
    const inspection = validInspection();
    const drift: Record<typeof field, unknown> = {
      [field]: typeof inspection[field] === 'boolean'
        ? !inspection[field]
        : typeof inspection[field] === 'number'
          ? inspection[field] + 1
          : `different-${inspection[field]}`,
    } as Record<typeof field, unknown>;
    vi.mocked(dependencies.inspectApk).mockReturnValue({
      ...inspection,
      ...drift,
    } as Da5V5ApkInspection);

    expect(() => verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies,
    })).toThrow('DA5 V5 APK inspection mismatch');
    expect(dependencies.verifyRuntime).not.toHaveBeenCalled();
  });

  it('rejects path, type, symlink, mode, size, realpath and digest drift', () => {
    const binding = {
      bytes: 10,
      mode: 0o444,
      path: '/synthetic/exact.apk',
      sha256: 'a'.repeat(64),
    };
    const base = validFileDependencies(binding);
    expect(verifyDa5V5ImmutableFile(binding, base)).toEqual({
      identity: { dev: 1, ino: 1 },
      status: 'match',
    });

    expect(() => verifyDa5V5ImmutableFile(
      { ...binding, path: '/synthetic/../synthetic/exact.apk' },
      base,
    )).toThrow(/canonical/);

    for (const dependency of [
      validFileDependencies(binding, { isFile: false }),
      validFileDependencies(binding, { isSymbolicLink: true }),
      validFileDependencies(binding, { mode: 0o644 }),
      validFileDependencies(binding, { mode: 0o1444 }),
      validFileDependencies(binding, { size: 11 }),
    ]) {
      expect(() => verifyDa5V5ImmutableFile(binding, dependency)).toThrow(/metadata/);
    }
    expect(() => verifyDa5V5ImmutableFile(binding, validFileDependencies(binding, {
      realpath: '/different/exact.apk',
    }))).toThrow(/realpath/);
    expect(() => verifyDa5V5ImmutableFile(binding, validFileDependencies(binding, {
      sha256: 'b'.repeat(64),
    }))).toThrow(/digest/);
  });

  it('detects an inspector-time file swap and rechecks the same inode before install', () => {
    const swapped = validDependencies();
    vi.mocked(swapped.files.lstat)
      .mockImplementationOnce(() => fileStat(1))
      .mockImplementationOnce(() => fileStat(2))
      .mockImplementationOnce(() => fileStat(99))
      .mockImplementationOnce(() => fileStat(2));
    expect(() => verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies: swapped,
    })).toThrow(/identity mismatch/);

    const stable = validDependencies();
    const verification = verifyDa5V5AndroidArtifact({
      profile: 'da5-v5',
      dependencies: stable,
    });
    vi.mocked(stable.files.lstat)
      .mockImplementationOnce(() => fileStat(99))
      .mockImplementationOnce(() => fileStat(2));
    expect(() => reverifyDa5V5AndroidArtifactForInstall(
      verification,
      stable.files,
    )).toThrow(/identity mismatch/);
  });
});

function validDependencies(): Da5V5ArtifactDependencies {
  const files = {
    lstat: vi.fn((path: string) => {
      const binding = path === DA5_V5_ANDROID_ARTIFACT.apk.path
        ? DA5_V5_ANDROID_ARTIFACT.apk
        : DA5_V5_ANDROID_ARTIFACT.manifest;
      return {
        dev: 1,
        ino: path === DA5_V5_ANDROID_ARTIFACT.apk.path ? 1 : 2,
        isFile: () => true,
        isSymbolicLink: () => false,
        mode: binding.mode,
        size: binding.bytes,
      };
    }),
    realpath: vi.fn((path: string) => path),
    sha256: vi.fn((path: string) => (
      path === DA5_V5_ANDROID_ARTIFACT.apk.path
        ? DA5_V5_ANDROID_ARTIFACT.apk.sha256
        : DA5_V5_ANDROID_ARTIFACT.manifest.sha256
    )),
  };
  return {
    files,
    inspectApk: vi.fn(() => validInspection()),
    verifyRuntime: vi.fn(),
  };
}

function validInspection(): Da5V5ApkInspection {
  return {
    allowBackup: false,
    backupRules: true,
    dataExtractionRules: true,
    hermesBundleCount: 1,
    mifareUltralight: true,
    networkSecurityConfig: true,
    nfcA: true,
    nfcTechDiscovered: true,
    packageName: DA5_V5_ANDROID_PACKAGE,
    signatureV1: false,
    signatureV2: true,
    signatureV3: false,
    signatureV31: false,
    signatureV4: false,
    signerCertificateSha256: DA5_V5_ANDROID_ARTIFACT.signerCertificateSha256,
    signerCount: 1,
    usesCleartextTraffic: false,
    versionCode: '1',
    versionName: '1.0.0',
  };
}

function validFileDependencies(
  binding: {
    bytes: number;
    mode: number;
    path: string;
    sha256: string;
  },
  drift: Partial<{
    dev: number;
    ino: number;
    isFile: boolean;
    isSymbolicLink: boolean;
    mode: number;
    realpath: string;
    sha256: string;
    size: number;
  }> = {},
): Da5V5FileDependencies {
  return {
    lstat: vi.fn(() => ({
      dev: drift.dev ?? 1,
      ino: drift.ino ?? 1,
      isFile: () => drift.isFile ?? true,
      isSymbolicLink: () => drift.isSymbolicLink ?? false,
      mode: drift.mode ?? binding.mode,
      size: drift.size ?? binding.bytes,
    })),
    realpath: vi.fn(() => drift.realpath ?? binding.path),
    sha256: vi.fn(() => drift.sha256 ?? binding.sha256),
  };
}

function fileStat(ino: number) {
  return {
    dev: 1,
    ino,
    isFile: () => true,
    isSymbolicLink: () => false,
    mode: 0o444,
    size: ino === 2
      ? DA5_V5_ANDROID_ARTIFACT.manifest.bytes
      : DA5_V5_ANDROID_ARTIFACT.apk.bytes,
  };
}
