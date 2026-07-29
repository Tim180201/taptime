import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fileConstants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { performance } from 'node:perf_hooks';
import { normalize, resolve } from 'node:path';

import {
  Da5V5UsbSerialBinding,
  SystemDa5V5AndroidAdbRunner,
  requireSingleDa5V5UsbDevice,
} from './da5V5AndroidDevice.mjs';
import {
  DA5_V5_VALIDATION_PACKAGE,
  verifyDa5V5ValidationArtifactBinding,
} from './da5V5ValidationArtifact.mjs';

export const DA5_V5_VALIDATION_PHASE0_PROFILE =
  'da5-v5-validation-phase0';
export const DA5_V5_VALIDATION_PHASE0_ACTIVITY =
  `${DA5_V5_VALIDATION_PACKAGE}/.MainActivity`;
export const DA5_V5_VALIDATION_PHASE0_ARTIFACT = Object.freeze({
  apk: Object.freeze({
    bytes: 65_631_433,
    mode: 0o444,
    path:
      '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd/app-release-d2084486b07f27bd.apk',
    sha256:
      'd2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5',
  }),
  manifest: Object.freeze({
    bytes: 6_700,
    mode: 0o444,
    path:
      '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd/manifest-03694f2d877b.json',
    sha256:
      'aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347',
  }),
  sourceCommit: '03694f2d877bc323791e93473ad01ceb82af70df',
  sourceTree: '6c6039683e067ef29f1f917a60c2628d26e38784',
});
const exactSourceClosure = Object.freeze([
  Object.freeze({
    path: 'apps/mobile/app.config.js',
    sha256: '1ca63463e07b0c7c7111a653f1549bdad1011219300db771e740537d9908811b',
  }),
  Object.freeze({
    path: 'apps/mobile/app.json',
    sha256: '692f6c6c3fb7214bc797af152cbc5572e393d5cdab6a0fd1062e47a0f0fa7250',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/android-icon-background.png',
    sha256: 'fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/android-icon-foreground.png',
    sha256: '9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/android-icon-monochrome.png',
    sha256: '6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83',
  }),
  Object.freeze({
    path: 'apps/mobile/assets/icon.png',
    sha256: '119462bb78eb240a65c869fc067ee599639b3cb5a41953f25c07b17d2a8c7e0f',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/build.gradle',
    sha256: 'd7b10372584f1ba7b9b999c0a515bfeae64e0ed0f615e98a910478d40e478517',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/src/main/AndroidManifest.xml',
    sha256: 'e20c6e02b4518b90a049a5ce81d99274978b87e2b02433dcb626daf545c9669e',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/src/main/java/com/taptime/da5validationbinding/Da5V5ValidationDeviceBindingModule.kt',
    sha256: 'ced432bef3c8970f745db5d495a024a4f6e9af9d2a7ca8dc0f7046ed4ccd73d5',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/expo-module.config.json',
    sha256: '7c762172127c09833c755aaa8e87ba70b492fb0bbf21cb073f873fb12208dd62',
  }),
  Object.freeze({
    path: 'apps/mobile/modules/taptime-da5-v5-validation-device-binding/index.ts',
    sha256: '88bcdc21a78a619d939b3923f5b37247e7a601830ca255f70465b6569ecb11a8',
  }),
  Object.freeze({
    path: 'apps/mobile/package.json',
    sha256: '1afe19fc3898543dd91afa23e9f9658959c1c569ee569d2b9e0e83005cbd0165',
  }),
  Object.freeze({
    path: 'apps/mobile/plugins/withDa5V5ValidationAndroidBoundary.js',
    sha256: '40089612eb27084888b7a226099625991df4a109784123e301265778adc9264a',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/buildDa5V5ValidationAndroid.mjs',
    sha256: 'd8034c199a002e0418bccb41266dc5640c5bb8beedc6d8363c3ec3c3c35242f9',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationArtifact.mjs',
    sha256: 'd109748f8d4a23b9ce6c761e91783fe6d4696d6717c3485ac5f8476e71b83371',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationBuildProcess.mjs',
    sha256: 'a33d935d287fc498b3b38b6be193a350a5069f1ff4312e554a0018953bdd48f4',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationNativeSourceBinding.mjs',
    sha256: 'afbf1c3fc8983f5c83f00ed4c66b8ea311a677e3060e43419860fe2d933a85ab',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs',
    sha256: '8de7838940526188335f1b4d1cebfc350fb5924b9c64bc1779e0a598a94fe8e3',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/da5V5ValidationSourceBinding.mjs',
    sha256: '066d359f5038ddd45c4d6113792002b49f2e0783b830cb6cb8b78b3faa80c310',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/publishDa5V5ValidationArtifact.mjs',
    sha256: '934cabc6245a72a90a7e8024017615a0296cd079fbf1358c24e3d83f77c7389f',
  }),
  Object.freeze({
    path: 'apps/mobile/scripts/verifyDa5V5ValidationAndroidArtifact.mjs',
    sha256: 'f9b56d44e4d87ab6d356b1d56429372cdc3cca349d82fc64e4cbcf385487b235',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationContract.ts',
    sha256: '3278b10ae55937c8de3dcc6cdcb40aa011ccc5aa5ed307dcc01a589e5b3bb9fa',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationController.ts',
    sha256: '1030ca86dbe39c0b144d1fa49567b95fddf657db8fb41c2e15326a8af855a112',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationDeviceBinding.ts',
    sha256: '966de7e51e8df66021f5a1ec5e653dd1c40ee6d9c776c3c79e226065572eb3ee',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationMobileApp.tsx',
    sha256: 'fded3a4b71a619f5748324d16f31a19789d0c8d093ddccf29c0c969a77c0c2fd',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/Da5V5ValidationNfcCapture.ts',
    sha256: 'a02389b0c498833b392c77523ea9e0df360538380c5d1c76b56ebac69c646c6c',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/NativeDa5V5ValidationDeviceBinding.ts',
    sha256: '924dae53aea020d333b5db65753361401737c79d0086bd20badb2da25f345bc9',
  }),
  Object.freeze({
    path: 'apps/mobile/src/validation/createDa5V5ValidationRuntime.ts',
    sha256: '9ddd9730992e565f53f4e50296d1331c348fb1a9f731d93e5cfa291d0edd6759',
  }),
  Object.freeze({
    path: 'apps/mobile/tsconfig.json',
    sha256: '712583ff9cdb4b4e4f9b000a4a56d68db8dc1921cbfbc36d490a3a9f2be3dd72',
  }),
  Object.freeze({
    path: 'apps/mobile/validation-index.ts',
    sha256: 'd42c0ff8424077c43df5396969cc08d547e857b1e2ebff0081b17543374e49e8',
  }),
  Object.freeze({
    path: 'package-lock.json',
    sha256: '62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470',
  }),
  Object.freeze({
    path: 'package.json',
    sha256: '34b577bee93440e296b2d61d8b47265224324a3e75e9f3053aaa7d337ebcd57a',
  }),
]);

const timeouts = Object.freeze({
  inspect: 15_000,
  install: 240_000,
  launch: 30_000,
  uninstall: 120_000,
});
const cleanupPolicy = Object.freeze({
  knownMaximumMilliseconds: 30_000,
  nullWindowMilliseconds: 15_000,
  pollMilliseconds: 250,
  uncertainMaximumMilliseconds:
    timeouts.install + 15_000 + timeouts.inspect,
});
const androidOwnerUser = '0';
const validationVersionCode = '1';
const safeSegmentPattern = /^[A-Za-z0-9._~+=-]{1,192}$/u;
const packageDirectoryPrefix = `${DA5_V5_VALIDATION_PACKAGE}-`;

export function requireDa5V5ValidationPhase0Inputs(value) {
  if (
    value?.profile !== DA5_V5_VALIDATION_PHASE0_PROFILE
    || !isBoundInput(value.deviceModel)
    || !isBoundInput(value.androidBuild)
  ) {
    throw new Error('DA5 V5 Validation Phase-0 authority input mismatch');
  }
  return Object.freeze({
    androidBuild: value.androidBuild,
    deviceModel: value.deviceModel,
    profile: DA5_V5_VALIDATION_PHASE0_PROFILE,
  });
}

export function parseDa5V5ValidationInstalledBaseApkPath(value) {
  const line = exactSingleLine(value);
  if (!line.startsWith('package:')) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  const path = line.slice('package:'.length);
  if (!path.startsWith('/data/app/') || !path.endsWith('/base.apk')) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  const segments = path.slice('/data/app/'.length).split('/');
  if (segments.length !== 2 && segments.length !== 3) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  if (segments.at(-1) !== 'base.apk') {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  const packageDirectory = segments.at(-2);
  const parent = segments.length === 3 ? segments[0] : undefined;
  if (
    packageDirectory === undefined
    || !packageDirectory.startsWith(packageDirectoryPrefix)
    || !isSafePathSegment(
      packageDirectory.slice(packageDirectoryPrefix.length),
    )
    || (
      parent !== undefined
      && (
        !parent.startsWith('~~')
        || !isSafePathSegment(parent)
        || parent.length === 2
      )
    )
  ) {
    throw new Error('DA5 V5 Validation installed package path mismatch');
  }
  return path;
}

export function parseDa5V5ValidationInstalledStat(value) {
  const match = /^([0-9]+):([0-9]+):([0-9]+):([0-9a-fA-F]+)$/u
    .exec(exactSingleLine(value));
  if (match === null) {
    throw new Error('DA5 V5 Validation installed package stat mismatch');
  }
  const [, device, inode, sizeText, modeText] = match;
  const size = Number(sizeText);
  const mode = BigInt(`0x${modeText}`);
  if (
    device === undefined
    || inode === undefined
    || !Number.isSafeInteger(size)
    || size < 0
    || (mode & 0o170000n) !== 0o100000n
    || (mode & 0o022n) !== 0n
  ) {
    throw new Error('DA5 V5 Validation installed package stat mismatch');
  }
  return Object.freeze({
    device,
    inode,
    mode: mode.toString(16),
    size,
  });
}

export function parseDa5V5ValidationAndroidUserTopology(value) {
  const lines = exactLines(value);
  if (lines.shift() !== 'Users:' || lines.length !== 1) {
    throw new Error('DA5 V5 Validation Android user topology mismatch');
  }
  const match =
    /^UserInfo\{([0-9]+):[^{}\0\r\n]*:[0-9a-fA-F]+\} running$/u
      .exec(lines[0]?.trim() ?? '');
  if (match?.[1] !== androidOwnerUser) {
    throw new Error('DA5 V5 Validation Android user topology mismatch');
  }
  return Object.freeze({
    currentUser: androidOwnerUser,
    mainUser: androidOwnerUser,
    ownerUser: androidOwnerUser,
  });
}

export function sealDa5V5ValidationInstallSnapshot(
  binding,
  files = systemStableFileDependencies(),
) {
  requireHostBinding(binding);
  const fileDescriptor = files.openReadOnly(binding.path);
  let snapshot;
  try {
    const before = requireStableHostFile(
      binding,
      fileDescriptor,
      files,
    );
    snapshot = files.readFileDescriptor(fileDescriptor, binding.bytes);
    if (
      !Buffer.isBuffer(snapshot)
      || snapshot.length !== binding.bytes
      || createHash('sha256').update(snapshot).digest('hex') !== binding.sha256
    ) {
      throw new Error('DA5 V5 Validation stable snapshot digest mismatch');
    }
    const after = requireStableHostFile(
      binding,
      fileDescriptor,
      files,
    );
    if (before.dev !== after.dev || before.ino !== after.ino) {
      throw new Error('DA5 V5 Validation stable snapshot identity mismatch');
    }
  } catch (error) {
    snapshot?.fill(0);
    try {
      files.close(fileDescriptor);
    } catch {
      throw new Error('DA5 V5 Validation stable snapshot close mismatch');
    }
    throw error;
  }
  try {
    files.close(fileDescriptor);
  } catch {
    snapshot.fill(0);
    throw new Error('DA5 V5 Validation stable snapshot close mismatch');
  }
  let destroyed = false;
  let used = false;
  return Object.freeze({
    destroy() {
      if (!destroyed) {
        destroyed = true;
        snapshot.fill(0);
      }
    },
    state() {
      return destroyed ? 'destroyed' : used ? 'used' : 'ready';
    },
    status: 'match',
    async use(operation) {
      if (destroyed || used || typeof operation !== 'function') {
        throw new Error('DA5 V5 Validation install snapshot unavailable');
      }
      used = true;
      try {
        return await operation(snapshot);
      } finally {
        destroyed = true;
        snapshot.fill(0);
      }
    },
  });
}

export function verifyAndSealDa5V5ValidationPhase0Artifact(options = {}) {
  if (options.profile !== DA5_V5_VALIDATION_PHASE0_PROFILE) {
    throw new Error('DA5 V5 Validation Phase-0 profile mismatch');
  }
  const verifyArtifact =
    options.verifyArtifact ?? verifyDa5V5ValidationArtifactBinding;
  const verificationOptions = {
    apk: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk,
    expectedSourceClosure: exactSourceClosure,
    expectedSourceCommit:
      DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit,
    expectedSourceTree: DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree,
    manifest: DA5_V5_VALIDATION_PHASE0_ARTIFACT.manifest,
  };
  const verified = options.artifactVerificationDependencies === undefined
    ? verifyArtifact(verificationOptions)
    : verifyArtifact(
      verificationOptions,
      options.artifactVerificationDependencies,
    );
  if (
    verified?.status !== 'match'
    || verified.packageName !== DA5_V5_VALIDATION_PACKAGE
    || verified.sourceCommit
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit
    || verified.sourceTree
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree
  ) {
    throw new Error('DA5 V5 Validation artifact verification mismatch');
  }
  return sealDa5V5ValidationInstallSnapshot(
    DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk,
    options.stableFiles,
  );
}

export async function verifyDa5V5ValidationInstalledArtifact(options) {
  if (typeof options.runner?.runBinaryDigest !== 'function') {
    throw new Error('DA5 V5 Validation installed digest unavailable');
  }
  await requireOwnerUserTopology(
    options.runner,
    options.serial,
    options.signal,
  );
  await requireOwnerPackagePresent(
    options.runner,
    options.serial,
    options.signal,
  );
  await requireOwnerInstalledVersion(
    options.runner,
    options.serial,
    options.signal,
  );
  const beforePath = await readInstalledPackagePath(
    options.runner,
    options.serial,
    options.signal,
  );
  const beforeCanonical = await readInstalledCanonical(
    options.runner,
    options.serial,
    beforePath,
    options.signal,
  );
  const beforeStat = await readInstalledStat(
    options.runner,
    options.serial,
    beforePath,
    options.signal,
  );
  if (
    beforeCanonical !== beforePath
    || beforeStat.size !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes
  ) {
    throw new Error('DA5 V5 Validation installed artifact mismatch');
  }
  const digest = await options.runner.runBinaryDigest(
    ['-s', options.serial, 'shell', '-T', 'cat', '--', beforePath],
    {
      maximumBytes: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes,
      signal: options.signal,
      timeoutMilliseconds: timeouts.install,
    },
  );
  if (
    digest.bytes !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes
    || digest.sha256 !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256
  ) {
    throw new Error('DA5 V5 Validation installed artifact digest mismatch');
  }
  await requireOwnerUserTopology(
    options.runner,
    options.serial,
    options.signal,
  );
  await requireOwnerPackagePresent(
    options.runner,
    options.serial,
    options.signal,
  );
  await requireOwnerInstalledVersion(
    options.runner,
    options.serial,
    options.signal,
  );
  const afterPath = await readInstalledPackagePath(
    options.runner,
    options.serial,
    options.signal,
  );
  const afterCanonical = await readInstalledCanonical(
    options.runner,
    options.serial,
    afterPath,
    options.signal,
  );
  const afterStat = await readInstalledStat(
    options.runner,
    options.serial,
    afterPath,
    options.signal,
  );
  if (
    afterPath !== beforePath
    || afterCanonical !== beforeCanonical
    || JSON.stringify(afterStat) !== JSON.stringify(beforeStat)
  ) {
    throw new Error('DA5 V5 Validation installed artifact changed');
  }
  return Object.freeze({
    canonicalPath: afterCanonical,
    path: afterPath,
    sha256: digest.sha256,
    stat: afterStat,
    status: 'match',
    versionCode: validationVersionCode,
  });
}

export class Da5V5ValidationPhase0Device {
  #cleanupFlight;
  #cleanupDeadline;
  #installUncertain = false;
  #mutationMayHaveStarted = false;
  #ownedProvenance;
  #preflightMatched = false;
  #preflightStarted = false;

  constructor(options) {
    this.runner = options.runner;
    this.serialBinding = options.serialBinding;
    this.deviceBinding = Object.freeze({
      androidBuild: options.androidBuild,
      deviceModel: options.deviceModel,
    });
    this.snapshot = options.snapshot;
    this.now = options.now ?? (() => performance.now());
    this.wait = options.wait ?? wait;
  }

  async preflight(options = {}) {
    this.#preflightStarted = true;
    const serial = await this.#requireCurrentDevice(options.signal);
    await requirePackageProcessReverseZero(
      this.runner,
      serial,
      options.signal,
    );
    this.#preflightMatched = true;
    return Object.freeze({ status: 'match' });
  }

  async installAndLaunch(options = {}) {
    if (!this.#preflightMatched || this.#mutationMayHaveStarted) {
      throw new Error('DA5 V5 Validation install order mismatch');
    }
    const serial = await this.#requireCurrentDevice(options.signal);
    await requirePackageProcessReverseZero(
      this.runner,
      serial,
      options.signal,
    );
    const installSerial = await this.#requireCurrentDevice(options.signal);
    if (
      installSerial !== serial
      || await readOwnerPackageRegistration(
        this.runner,
        installSerial,
        { signal: options.signal },
      ) !== 'absent'
    ) {
      throw new Error('DA5 V5 Validation package preinstall changed');
    }
    this.#installUncertain = true;
    this.#mutationMayHaveStarted = true;
    const installResult = await this.snapshot.use((snapshot) =>
      this.runner.run(
        [
          '-s',
          installSerial,
          'shell',
          '-T',
          'cmd',
          'package',
          'install',
          '-R',
          '--user',
          androidOwnerUser,
          '--pkg',
          DA5_V5_VALIDATION_PACKAGE,
          '-S',
          String(DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes),
          '-',
        ],
        {
          signal: options.signal,
          stdinBytes: snapshot,
          timeoutMilliseconds: timeouts.install,
        },
      ));
    if (exactSingleLine(installResult) !== 'Success') {
      throw new Error('DA5 V5 Validation package install mismatch');
    }
    const proofSerial = await this.#requireCurrentDevice(options.signal);
    if (proofSerial !== installSerial) {
      throw new Error('DA5 V5 Validation install device mismatch');
    }
    const provenance = await verifyDa5V5ValidationInstalledArtifact({
      runner: this.runner,
      serial: proofSerial,
      signal: options.signal,
    });
    this.#ownedProvenance = provenance;
    this.#installUncertain = false;
    await requireReverseZero(this.runner, proofSerial, options.signal);
    const processesBefore = await readMatchingProcesses(
      this.runner,
      proofSerial,
      options.signal,
    );
    if (processesBefore.length !== 0) {
      throw new Error('DA5 V5 Validation process prelaunch mismatch');
    }
    const launchSerial = await this.#requireCurrentDevice(options.signal);
    await requireOwnedProvenance(
      this.runner,
      launchSerial,
      this.#ownedProvenance,
      { signal: options.signal },
    );
    const launch = await this.runner.run(
      [
        '-s',
        launchSerial,
        'shell',
        'am',
        'start',
        '-W',
        '--user',
        androidOwnerUser,
        '-n',
        DA5_V5_VALIDATION_PHASE0_ACTIVITY,
      ],
      {
        signal: options.signal,
        timeoutMilliseconds: timeouts.launch,
      },
    );
    requireExactLaunchReceipt(launch);
    const processesAfter = await readMatchingProcesses(
      this.runner,
      launchSerial,
      options.signal,
    );
    if (
      processesAfter.length !== 1
      || processesAfter[0] !== DA5_V5_VALIDATION_PACKAGE
    ) {
      throw new Error('DA5 V5 Validation launched process mismatch');
    }
    await requireReverseZero(
      this.runner,
      launchSerial,
      options.signal,
    );
    const postLaunchSerial =
      await this.#requireCurrentDevice(options.signal);
    await requireOwnedProvenance(
      this.runner,
      postLaunchSerial,
      this.#ownedProvenance,
      { signal: options.signal },
    );
    return Object.freeze({ status: 'match' });
  }

  finishMaximumMilliseconds() {
    return this.#installUncertain
      ? cleanupPolicy.uncertainMaximumMilliseconds
      : cleanupPolicy.knownMaximumMilliseconds;
  }

  cleanup(options = {}) {
    if (this.#cleanupFlight !== undefined) {
      return this.#cleanupFlight;
    }
    this.#cleanupDeadline = options.deadline
      ?? this.now() + this.finishMaximumMilliseconds();
    this.#cleanupFlight = this.#performCleanup(this.#cleanupDeadline);
    return this.#cleanupFlight;
  }

  async #performCleanup(deadline) {
    this.snapshot.destroy();
    if (!isDeadline(deadline) || this.now() >= deadline) {
      return Object.freeze({ status: 'mismatch' });
    }
    if (!this.#preflightStarted && !this.#mutationMayHaveStarted) {
      return Object.freeze({ status: 'match' });
    }
    const uncertain = this.#installUncertain;
    let consecutiveZero = 0;
    let zeroSince = null;
    while (hasDeadlineBudget(deadline, this.now)) {
      try {
        const serial = await this.#requireCurrentDevice(
          undefined,
          deadline,
        );
        const observation = await readCleanupObservation(
          this.runner,
          serial,
          { deadline, now: this.now },
        );
        requireDeadlineBudget(deadline, this.now);
        if (
          observation.packageMaybePresent
          || observation.processMaybePresent
        ) {
          if (
            !this.#mutationMayHaveStarted
            || this.#ownedProvenance === undefined
            || !observation.exact
            || !observation.packagePresent
          ) {
            return Object.freeze({ status: 'mismatch' });
          }
          consecutiveZero = 0;
          zeroSince = null;
          const stopSerial = await this.#requireCurrentDevice(
            undefined,
            deadline,
          );
          await requireOwnedProvenance(
            this.runner,
            stopSerial,
            this.#ownedProvenance,
            { deadline, now: this.now },
          );
          requireDeadlineBudget(deadline, this.now);
          await this.runner.run(
            ['-s', stopSerial, 'shell', 'am', 'force-stop',
              '--user', androidOwnerUser,
              DA5_V5_VALIDATION_PACKAGE],
            {
              timeoutMilliseconds: remainingTimeout(
                deadline,
                this.now,
                timeouts.launch,
              ),
            },
          );
          const uninstallSerial = await this.#requireCurrentDevice(
            undefined,
            deadline,
          );
          await requireOwnedProvenance(
            this.runner,
            uninstallSerial,
            this.#ownedProvenance,
            { deadline, now: this.now },
          );
          requireDeadlineBudget(deadline, this.now);
          const uninstall = await this.runner.run(
            ['-s', uninstallSerial, 'shell', 'cmd', 'package', 'uninstall',
              '--user', androidOwnerUser, '--versionCode',
              validationVersionCode,
              DA5_V5_VALIDATION_PACKAGE],
            {
              timeoutMilliseconds: remainingTimeout(
                deadline,
                this.now,
                timeouts.uninstall,
              ),
            },
          );
          requireDeadlineBudget(deadline, this.now);
          if (exactSingleLine(uninstall) !== 'Success') {
            throw new Error('DA5 V5 Validation package uninstall mismatch');
          }
          this.#ownedProvenance = undefined;
        } else if (!observation.exact || !observation.reverseZero) {
          consecutiveZero = 0;
          zeroSince = null;
        } else {
          const observedAt = this.now();
          consecutiveZero += 1;
          zeroSince ??= observedAt;
          if (
            consecutiveZero >= 2
            && (
              !uncertain
              || observedAt - zeroSince
                >= cleanupPolicy.nullWindowMilliseconds
            )
          ) {
            const finalSerial = await this.#requireCurrentDevice(
              undefined,
              deadline,
            );
            const finalObservation = await readCleanupObservation(
              this.runner,
              finalSerial,
              { deadline, now: this.now },
            );
            requireDeadlineBudget(deadline, this.now);
            if (
              !finalObservation.exact
              || finalObservation.packageMaybePresent
              || finalObservation.processMaybePresent
              || !finalObservation.reverseZero
            ) {
              return Object.freeze({ status: 'mismatch' });
            }
            return Object.freeze({ status: 'match' });
          }
        }
      } catch {
        consecutiveZero = 0;
        zeroSince = null;
      }
      if (!hasDeadlineBudget(deadline, this.now)) break;
      try {
        await this.wait(remainingWait(
          deadline,
          this.now,
          cleanupPolicy.pollMilliseconds,
        ));
        requireDeadlineBudget(deadline, this.now);
      } catch {
        return Object.freeze({ status: 'mismatch' });
      }
    }
    return Object.freeze({ status: 'mismatch' });
  }

  async #requireCurrentDevice(signal, deadline) {
    const commandOptions = deadline === undefined
      ? { signal, timeoutMilliseconds: timeouts.inspect }
      : {
          signal,
          timeoutMilliseconds: remainingTimeout(
            deadline,
            this.now,
            timeouts.inspect,
          ),
        };
    const serial = await requireSingleDa5V5UsbDevice(
      this.runner,
      commandOptions,
    );
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    const model = exactSingleLine(await this.runner.run(
      ['-s', serial, 'shell', 'getprop', 'ro.product.model'],
      deadline === undefined
        ? commandOptions
        : {
            signal,
            timeoutMilliseconds: remainingTimeout(
              deadline,
              this.now,
              timeouts.inspect,
            ),
          },
    ));
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    const build = exactSingleLine(await this.runner.run(
      ['-s', serial, 'shell', 'getprop', 'ro.build.fingerprint'],
      deadline === undefined
        ? commandOptions
        : {
            signal,
            timeoutMilliseconds: remainingTimeout(
              deadline,
              this.now,
              timeouts.inspect,
            ),
          },
    ));
    if (
      model !== this.deviceBinding.deviceModel
      || build !== this.deviceBinding.androidBuild
      || this.serialBinding.bind(serial) !== 'match'
    ) {
      throw new Error('DA5 V5 Validation device binding mismatch');
    }
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    await requireOwnerUserTopology(
      this.runner,
      serial,
      signal,
      deadline === undefined
        ? undefined
        : { deadline, now: this.now },
    );
    if (deadline !== undefined) requireDeadlineBudget(deadline, this.now);
    return this.serialBinding.use(serial, (retained) => retained);
  }
}

export class Da5V5ValidationPhase0Session {
  #abortController;
  #activeOperation;
  #device;
  #failureRequested = false;
  #finishDeadline;
  #finishFlight;
  #state = 'created';

  constructor(options) {
    this.options = options;
    this.now = options.now ?? (() => performance.now());
    this.receipt = options.receipt ?? (() => {});
    this.done = new Promise((resolvePromise) => {
      this.resolveDone = resolvePromise;
    });
  }

  state() {
    return this.#state;
  }

  async start() {
    if (this.#state !== 'created') {
      return this.fail();
    }
    this.#state = 'preflighting';
    try {
      const inputs = requireDa5V5ValidationPhase0Inputs(this.options);
      const snapshot = (this.options.sealArtifact
        ?? verifyAndSealDa5V5ValidationPhase0Artifact)({
        profile: inputs.profile,
      });
      this.#device = new Da5V5ValidationPhase0Device({
        androidBuild: inputs.androidBuild,
        deviceModel: inputs.deviceModel,
        now: this.options.now,
        runner: this.options.runner
          ?? new SystemDa5V5AndroidAdbRunner(),
        serialBinding: this.options.serialBinding
          ?? new Da5V5UsbSerialBinding(),
        snapshot,
        wait: this.options.wait,
      });
      if (!this.#emitReceipt('artifact', 'match')) {
        return this.#finish(false);
      }
      this.#abortController = new AbortController();
      const preflight = this.#device.preflight({
        signal: this.#abortController.signal,
      });
      this.#activeOperation = preflight;
      try {
        await preflight;
      } finally {
        if (this.#activeOperation === preflight) {
          this.#activeOperation = undefined;
          this.#abortController = undefined;
        }
      }
      if (this.#failureRequested) {
        return this.#finish(false);
      }
      this.#state = 'ready';
      if (!this.#emitReceipt('preflight', 'match')) {
        return this.fail();
      }
      return Object.freeze({ status: 'match' });
    } catch {
      this.#emitReceipt(
        this.#device === undefined ? 'artifact' : 'preflight',
        'mismatch',
      );
      return this.fail();
    }
  }

  submit(command) {
    if (this.#finishFlight !== undefined) {
      if (this.#state === 'complete' || this.#state === 'failed') {
        return Promise.resolve(Object.freeze({ status: 'mismatch' }));
      }
      this.#failureRequested = true;
      return this.#finishFlight;
    }
    if (this.#activeOperation !== undefined) {
      return this.fail();
    }
    if (command === 'install-launch' && this.#state === 'ready') {
      this.#state = 'installing';
      this.#abortController = new AbortController();
      const operation = this.#device.installAndLaunch({
        signal: this.#abortController.signal,
      });
      this.#activeOperation = operation;
      operation.then(
        () => {
          if (this.#activeOperation === operation) {
            this.#activeOperation = undefined;
            this.#abortController = undefined;
          }
          if (!this.#failureRequested) {
            this.#state = 'waiting';
            if (
              !this.#emitReceipt('install_launch', 'match')
              || !this.#emitReceipt('waiting', 'match')
            ) {
              void this.fail();
            }
          }
        },
        () => {
          if (this.#activeOperation === operation) {
            this.#activeOperation = undefined;
            this.#abortController = undefined;
          }
          this.#emitReceipt('install_launch', 'mismatch');
          void this.fail();
        },
      );
      return operation.catch(() => undefined);
    }
    if (command === 'human-pass' && this.#state === 'waiting') {
      this.#state = 'human_passed';
      if (!this.#emitReceipt('human_pass', 'match')) {
        return this.fail();
      }
      return Promise.resolve(Object.freeze({ status: 'match' }));
    }
    if (command === 'cleanup' && this.#state === 'human_passed') {
      return this.#finish(true);
    }
    if (
      command === 'abort'
      && this.#state !== 'complete'
      && this.#state !== 'failed'
    ) {
      return this.fail();
    }
    return this.fail();
  }

  end() {
    if (this.#state === 'complete' || this.#state === 'failed') {
      return this.done;
    }
    return this.fail();
  }

  signal() {
    return this.fail();
  }

  fail() {
    this.#failureRequested = true;
    return this.#finish(false);
  }

  #emitReceipt(stage, status) {
    try {
      this.receipt(stage, status);
      return true;
    } catch {
      this.#failureRequested = true;
      return false;
    }
  }

  #finish(successRequested) {
    if (this.#finishFlight !== undefined) {
      if (!successRequested) this.#failureRequested = true;
      return this.#finishFlight;
    }
    const active = this.#activeOperation;
    this.#finishDeadline = this.now() + (
      this.#device?.finishMaximumMilliseconds()
      ?? cleanupPolicy.knownMaximumMilliseconds
    );
    this.#abortController?.abort();
    this.#state = 'cleaning';
    this.#finishFlight = (async () => {
      if (active !== undefined) {
        try {
          const settled = await settleBeforeDeadline(
            active,
            this.#finishDeadline,
            this.now,
          );
          if (!settled) this.#failureRequested = true;
        } catch {
          this.#failureRequested = true;
        }
      }
      if (!hasDeadlineBudget(this.#finishDeadline, this.now)) {
        this.#failureRequested = true;
      }
      let cleanup;
      try {
        cleanup = this.#device === undefined
          ? (
              hasDeadlineBudget(this.#finishDeadline, this.now)
                ? Object.freeze({ status: 'match' })
                : Object.freeze({ status: 'mismatch' })
            )
          : await this.#device.cleanup({
              deadline: this.#finishDeadline,
            });
      } catch {
        cleanup = Object.freeze({ status: 'mismatch' });
      }
      if (
        cleanup.status === 'match'
        && !hasDeadlineBudget(this.#finishDeadline, this.now)
      ) {
        cleanup = Object.freeze({ status: 'mismatch' });
      }
      this.#emitReceipt('cleanup', cleanup.status);
      let success = (
        successRequested
        && !this.#failureRequested
        && cleanup.status === 'match'
        && hasDeadlineBudget(this.#finishDeadline, this.now)
      );
      if (success && !this.#emitReceipt('complete', 'match')) {
        success = false;
      }
      this.#state = success ? 'complete' : 'failed';
      if (!success) {
        this.#emitReceipt('failed', 'mismatch');
      }
      const result = Object.freeze({
        status: success ? 'match' : 'mismatch',
      });
      this.resolveDone(result);
      return result;
    })();
    return this.#finishFlight;
  }
}

export function createDa5V5ValidationPhase0Session(options) {
  return new Da5V5ValidationPhase0Session(options);
}

async function requirePackageProcessReverseZero(runner, serial, signal) {
  if (
    await readOwnerPackageRegistration(runner, serial, { signal })
    !== 'absent'
  ) {
    throw new Error('DA5 V5 Validation package preinstall mismatch');
  }
  if ((await readMatchingProcesses(runner, serial, signal)).length !== 0) {
    throw new Error('DA5 V5 Validation process preinstall mismatch');
  }
  await requireReverseZero(runner, serial, signal);
}

async function readMatchingProcesses(runner, serial, signal, budget) {
  const value = await runner.run(
    [
      '-s', serial, 'shell', 'ps', '-A', '-w', '-o', 'NAME:4',
    ],
    commandOptions(budget, timeouts.inspect, signal),
  );
  const lines = exactLines(value);
  if (lines.shift() !== 'NAME') {
    throw new Error('DA5 V5 Validation process header mismatch');
  }
  for (const line of lines) {
    if (line.length === 0 || /\s|\0/u.test(line)) {
      throw new Error('DA5 V5 Validation process state mismatch');
    }
  }
  return lines.filter((line) => (
    line === DA5_V5_VALIDATION_PACKAGE
    || line.startsWith(`${DA5_V5_VALIDATION_PACKAGE}:`)
  ));
}

async function requireReverseZero(runner, serial, signal) {
  const value = await runner.run(
    ['-s', serial, 'reverse', '--list'],
    { signal, timeoutMilliseconds: timeouts.inspect },
  );
  if (!isExactEmptyOutput(value)) {
    throw new Error('DA5 V5 Validation global reverse state mismatch');
  }
}

async function readCleanupObservation(runner, serial, budget) {
  let exact = true;
  let packagePresent = false;
  let packageMaybePresent = false;
  let processMaybePresent = false;
  try {
    const packageRegistration = await readOwnerPackageRegistration(
      runner,
      serial,
      budget,
    );
    if (packageRegistration === 'present') {
      packagePresent = true;
      packageMaybePresent = true;
    }
  } catch {
    exact = false;
    packageMaybePresent = true;
  }
  try {
    processMaybePresent =
      (await readMatchingProcesses(
        runner,
        serial,
        undefined,
        budget,
      )).length !== 0;
  } catch {
    exact = false;
    processMaybePresent = true;
  }
  let reverseZero = false;
  try {
    const reverseOutput = await runner.run(
      ['-s', serial, 'reverse', '--list'],
      commandOptions(budget, timeouts.inspect),
    );
    reverseZero = isExactEmptyOutput(reverseOutput);
  } catch {
    exact = false;
  }
  return Object.freeze({
    exact,
    packageMaybePresent,
    packagePresent,
    processMaybePresent,
    reverseZero,
  });
}

async function readInstalledPackagePath(
  runner,
  serial,
  signal,
  budget,
) {
  return parseDa5V5ValidationInstalledBaseApkPath(
    await runner.run(
      [
        '-s', serial, 'shell', 'cmd', 'package', 'path',
        '--user', androidOwnerUser, DA5_V5_VALIDATION_PACKAGE,
      ],
      commandOptions(budget, timeouts.inspect, signal),
    ),
  );
}

async function readInstalledCanonical(
  runner,
  serial,
  path,
  signal,
  budget,
) {
  return exactSingleLine(await runner.run(
    ['-s', serial, 'shell', 'readlink', '-f', '--', path],
    commandOptions(budget, timeouts.inspect, signal),
  ));
}

async function readInstalledStat(
  runner,
  serial,
  path,
  signal,
  budget,
) {
  return parseDa5V5ValidationInstalledStat(await runner.run(
    ['-s', serial, 'shell', 'stat', '-c', '%d:%i:%s:%f', '--', path],
    commandOptions(budget, timeouts.inspect, signal),
  ));
}

async function readOwnerPackageRegistration(
  runner,
  serial,
  budget = {},
) {
  const value = await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'package', 'list', 'packages',
      '-a', '-u', '--user', androidOwnerUser,
      DA5_V5_VALIDATION_PACKAGE,
    ],
    commandOptions(budget, timeouts.inspect, budget.signal),
  );
  if (isExactEmptyOutput(value)) return 'absent';
  if (
    exactSingleLine(value)
    === `package:${DA5_V5_VALIDATION_PACKAGE}`
  ) {
    return 'present';
  }
  throw new Error('DA5 V5 Validation package registration mismatch');
}

async function requireOwnerPackagePresent(runner, serial, signal, budget) {
  if (
    await readOwnerPackageRegistration(
      runner,
      serial,
      budget === undefined ? { signal } : { ...budget, signal },
    ) !== 'present'
  ) {
    throw new Error('DA5 V5 Validation installed package mismatch');
  }
}

async function requireOwnerInstalledVersion(
  runner,
  serial,
  signal,
  budget,
) {
  const value = exactSingleLine(await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'package', 'list', 'packages',
      '--show-versioncode', '--user', androidOwnerUser,
      DA5_V5_VALIDATION_PACKAGE,
    ],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  if (
    value
    !== `package:${DA5_V5_VALIDATION_PACKAGE} versionCode:${validationVersionCode}`
  ) {
    throw new Error('DA5 V5 Validation installed version mismatch');
  }
}

async function requireOwnerUserTopology(
  runner,
  serial,
  signal,
  budget,
) {
  parseDa5V5ValidationAndroidUserTopology(await runner.run(
    ['-s', serial, 'shell', 'cmd', 'user', 'list', '--all'],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  requireDeadlineBudgetIfPresent(budget);
  const mainUser = exactSingleLine(await runner.run(
    ['-s', serial, 'shell', 'cmd', 'user', 'get-main-user'],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  requireDeadlineBudgetIfPresent(budget);
  const headlessMode = exactSingleLine(await runner.run(
    [
      '-s', serial, 'shell', 'cmd', 'user',
      'is-headless-system-user-mode',
    ],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  requireDeadlineBudgetIfPresent(budget);
  const currentUser = exactSingleLine(await runner.run(
    ['-s', serial, 'shell', 'am', 'get-current-user'],
    commandOptions(budget, timeouts.inspect, signal),
  ));
  if (
    mainUser !== androidOwnerUser
    || headlessMode !== 'false'
    || currentUser !== androidOwnerUser
  ) {
    throw new Error('DA5 V5 Validation Android user topology mismatch');
  }
}

async function requireOwnedProvenance(
  runner,
  serial,
  provenance,
  options = {},
) {
  if (
    provenance?.status !== 'match'
    || provenance.versionCode !== validationVersionCode
    || provenance.sha256
      !== DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256
  ) {
    throw new Error('DA5 V5 Validation package provenance mismatch');
  }
  const budget = options.deadline === undefined
    ? undefined
    : { deadline: options.deadline, now: options.now };
  await requireOwnerUserTopology(
    runner,
    serial,
    options.signal,
    budget,
  );
  await requireOwnerPackagePresent(
    runner,
    serial,
    options.signal,
    budget,
  );
  await requireOwnerInstalledVersion(
    runner,
    serial,
    options.signal,
    budget,
  );
  const path = await readInstalledPackagePath(
    runner,
    serial,
    options.signal,
    budget,
  );
  const canonicalPath = await readInstalledCanonical(
    runner,
    serial,
    path,
    options.signal,
    budget,
  );
  const stat = await readInstalledStat(
    runner,
    serial,
    path,
    options.signal,
    budget,
  );
  if (
    path !== provenance.path
    || canonicalPath !== provenance.canonicalPath
    || JSON.stringify(stat) !== JSON.stringify(provenance.stat)
  ) {
    throw new Error('DA5 V5 Validation package provenance changed');
  }
  return Object.freeze({ status: 'match' });
}

function requireExactLaunchReceipt(value) {
  const lines = exactLines(value);
  const statuses = lines.filter((line) => line.startsWith('Status:'));
  const activities = lines.filter((line) => line.startsWith('Activity:'));
  if (
    statuses.length !== 1
    || statuses[0] !== 'Status: ok'
    || activities.length !== 1
    || activities[0] !== `Activity: ${DA5_V5_VALIDATION_PHASE0_ACTIVITY}`
  ) {
    throw new Error('DA5 V5 Validation explicit launch mismatch');
  }
}

function requireStableHostFile(binding, fileDescriptor, files) {
  const opened = files.fstat(fileDescriptor);
  const atPath = files.lstat(binding.path);
  if (
    !opened.isFile()
    || opened.isSymbolicLink()
    || !atPath.isFile()
    || atPath.isSymbolicLink()
    || opened.size !== binding.bytes
    || atPath.size !== binding.bytes
    || (opened.mode & 0o7777) !== binding.mode
    || (atPath.mode & 0o7777) !== binding.mode
    || !Number.isSafeInteger(opened.dev)
    || !Number.isSafeInteger(opened.ino)
    || opened.dev !== atPath.dev
    || opened.ino !== atPath.ino
    || normalize(files.realpath(binding.path)) !== binding.path
  ) {
    throw new Error('DA5 V5 Validation stable snapshot metadata mismatch');
  }
  return Object.freeze({ dev: opened.dev, ino: opened.ino });
}

function requireHostBinding(binding) {
  if (
    typeof binding?.path !== 'string'
    || normalize(resolve(binding.path)) !== binding.path
    || !Number.isSafeInteger(binding.bytes)
    || binding.bytes <= 0
    || !Number.isSafeInteger(binding.mode)
    || !/^[0-9a-f]{64}$/u.test(binding.sha256)
  ) {
    throw new Error('DA5 V5 Validation stable snapshot binding mismatch');
  }
}

function systemStableFileDependencies() {
  return Object.freeze({
    close: closeSync,
    fstat: fstatSync,
    lstat: lstatSync,
    openReadOnly(path) {
      return openSync(
        path,
        fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
      );
    },
    readFileDescriptor(fileDescriptor, expectedBytes) {
      const snapshot = Buffer.allocUnsafe(expectedBytes);
      const excess = Buffer.allocUnsafe(1);
      try {
        let offset = 0;
        while (offset < expectedBytes) {
          const bytesRead = readSync(
            fileDescriptor,
            snapshot,
            offset,
            expectedBytes - offset,
            offset,
          );
          if (bytesRead === 0) {
            throw new Error('DA5 V5 Validation stable snapshot short read');
          }
          offset += bytesRead;
        }
        if (readSync(fileDescriptor, excess, 0, 1, offset) !== 0) {
          throw new Error('DA5 V5 Validation stable snapshot long read');
        }
        return snapshot;
      } catch (error) {
        snapshot.fill(0);
        throw error;
      } finally {
        excess.fill(0);
      }
    },
    realpath: realpathSync,
  });
}

function isBoundInput(value) {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isSafePathSegment(value) {
  return value !== '.' && value !== '..' && safeSegmentPattern.test(value);
}

function exactSingleLine(value) {
  if (typeof value !== 'string') {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  const match = /^([^\0\r\n]+)(?:\r?\n)?$/u.exec(value);
  if (match?.[1] === undefined) {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  return match[1];
}

function exactLines(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  const normalized = value.endsWith('\r\n')
    ? value.slice(0, -2)
    : value.endsWith('\n')
      ? value.slice(0, -1)
      : value;
  if (normalized.length === 0) return [];
  const lines = normalized.split(/\r?\n/u);
  if (lines.some((line) => line.length === 0)) {
    throw new Error('DA5 V5 Validation command output mismatch');
  }
  return lines;
}

function isExactEmptyOutput(value) {
  return value === '' || value === '\n' || value === '\r\n';
}

function commandOptions(budget, maximumMilliseconds, signal) {
  if (budget?.deadline !== undefined) {
    return {
      signal,
      timeoutMilliseconds: remainingTimeout(
        budget.deadline,
        budget.now,
        maximumMilliseconds,
      ),
    };
  }
  return {
    signal: signal ?? budget?.signal,
    timeoutMilliseconds: maximumMilliseconds,
  };
}

function hasDeadlineBudget(deadline, now) {
  return isDeadline(deadline) && now() < deadline;
}

function isDeadline(value) {
  return Number.isFinite(value) && value >= 0;
}

function remainingTimeout(deadline, now, maximumMilliseconds) {
  const remaining = Math.floor(deadline - now());
  if (remaining < 2_001) {
    throw new Error('DA5 V5 Validation cleanup deadline exhausted');
  }
  return Math.min(maximumMilliseconds, remaining);
}

function remainingWait(deadline, now, maximumMilliseconds) {
  const remaining = Math.floor(deadline - now());
  if (remaining <= 0) {
    throw new Error('DA5 V5 Validation cleanup deadline exhausted');
  }
  return Math.min(maximumMilliseconds, remaining);
}

function requireDeadlineBudget(deadline, now) {
  if (!hasDeadlineBudget(deadline, now)) {
    throw new Error('DA5 V5 Validation cleanup deadline exhausted');
  }
}

function requireDeadlineBudgetIfPresent(budget) {
  if (budget?.deadline !== undefined) {
    requireDeadlineBudget(budget.deadline, budget.now);
  }
}

async function settleBeforeDeadline(operation, deadline, now) {
  const remaining = deadline - now();
  if (remaining <= 0) return false;
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolvePromise(false);
      }
    }, remaining);
    operation.then(
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolvePromise(now() < deadline);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          rejectPromise(error);
        }
      },
    );
  });
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
