import { createHash } from 'node:crypto';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
  DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES,
  type Da5V5ValidationApkInspection,
} from '../../scripts/da5V5ValidationArtifact.mjs';
import {
  publishDa5V5ValidationArtifact,
} from '../../scripts/publishDa5V5ValidationArtifact.mjs';
import {
  Da5V5ValidationBuildProcessController,
} from '../../scripts/da5V5ValidationBuildProcess.mjs';
import {
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';

const temporaryRoots: string[] = [];
const sourceCommit = 'a'.repeat(40);
const sourceTree = 'b'.repeat(40);
const sourceClosure = DA5_V5_VALIDATION_SOURCE_CLOSURE.map((path) => ({
  path,
  sha256: 'c'.repeat(64),
}));

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('DA5 V5 Validation atomic artifact publisher', () => {
  it('publishes one immutable bound directory and never overwrites it', async () => {
    const fixture = createFixture();
    const inspectApk = vi.fn(() => validInspection());
    const first = await publishDa5V5ValidationArtifact({
      interruption: uninterrupted(),
      outputDirectory: fixture.outputDirectory,
      repositoryRoot: fixture.repositoryRoot,
      sourceApkPath: fixture.sourceApkPath,
      sourceCommit,
      sourceClosure,
      sourceTree,
    }, { inspectApk });

    expect(first.isRevocable()).toBe(true);
    first.commit();
    expect(first.isRevocable()).toBe(false);
    expect(lstatSync(first.directory).isDirectory()).toBe(true);
    expect(first.apk.mode).toBe(0o444);
    expect(first.manifest.mode).toBe(0o444);
    expect(JSON.parse(readFileSync(first.manifest.path, 'utf8')))
      .toMatchObject({
        apkBytes: Buffer.byteLength('synthetic-apk'),
        apkSha256: createHash('sha256')
          .update('synthetic-apk')
          .digest('hex'),
        signerCertificateSha256:
          DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
        sourceCommit,
        sourceClosure,
        sourceTree,
      });
    const originalApk = readFileSync(first.apk.path);

    await expect(publishDa5V5ValidationArtifact({
      interruption: uninterrupted(),
      outputDirectory: fixture.outputDirectory,
      repositoryRoot: fixture.repositoryRoot,
      sourceApkPath: fixture.sourceApkPath,
      sourceCommit,
      sourceClosure,
      sourceTree,
    }, { inspectApk })).rejects.toThrow(/publication collision/u);
    expect(readFileSync(first.apk.path)).toEqual(originalApk);
    expect(readdirSync(fixture.outputDirectory)).toEqual([
      first.publicationName,
    ]);
  });

  it('removes lock, staging and final output when final reverify fails', async () => {
    const fixture = createFixture();
    let inspection = 0;
    const inspectApk = vi.fn(() => {
      inspection += 1;
      if (inspection === 3) {
        throw new Error('synthetic final reverify failure');
      }
      return validInspection();
    });

    await expect(publishDa5V5ValidationArtifact({
      interruption: uninterrupted(),
      outputDirectory: fixture.outputDirectory,
      repositoryRoot: fixture.repositoryRoot,
      sourceApkPath: fixture.sourceApkPath,
      sourceCommit,
      sourceClosure,
      sourceTree,
    }, { inspectApk })).rejects.toThrow(
      'synthetic final reverify failure',
    );
    expect(readdirSync(fixture.outputDirectory)).toEqual([]);
  });

  it.each([
    ['initial inspection', 1],
    ['staged verification', 2],
    ['final verification', 3],
  ] as const)(
    'removes all invocation-owned output for a signal during %s',
    async (_window, interruptOnInspection) => {
      const fixture = createFixture();
      const interruption = latchedInterruption();
      let inspections = 0;
      const inspectApk = vi.fn(() => {
        inspections += 1;
        if (inspections === interruptOnInspection) {
          interruption.interrupt();
        }
        return validInspection();
      });
      await expect(publishDa5V5ValidationArtifact({
        interruption,
        outputDirectory: fixture.outputDirectory,
        repositoryRoot: fixture.repositoryRoot,
        sourceApkPath: fixture.sourceApkPath,
        sourceCommit,
        sourceClosure,
        sourceTree,
      }, { inspectApk })).rejects.toThrow(
        /synthetic parent signal/u,
      );
      expect(inspectApk).toHaveBeenCalledTimes(interruptOnInspection);
      expect(readdirSync(fixture.outputDirectory)).toEqual([]);
    },
  );

  it('removes only its own renamed publication on a queued post-rename signal', async () => {
    const fixture = createFixture();
    const unrelatedPath = join(
      fixture.outputDirectory,
      'unrelated-user-file',
    );
    writeFileSync(unrelatedPath, 'preserve', {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    const inspectApk = vi.fn(() => validInspection());
    await expect(publishDa5V5ValidationArtifact({
      interruption: interruptAt('after-rename'),
      outputDirectory: fixture.outputDirectory,
      repositoryRoot: fixture.repositoryRoot,
      sourceApkPath: fixture.sourceApkPath,
      sourceCommit,
      sourceClosure,
      sourceTree,
    }, { inspectApk })).rejects.toThrow(/synthetic parent signal/u);
    expect(inspectApk).toHaveBeenCalledTimes(2);
    expect(readdirSync(fixture.outputDirectory)).toEqual([
      'unrelated-user-file',
    ]);
    expect(readFileSync(unrelatedPath, 'utf8')).toBe('preserve');
  });

  it('retains no artifact when an accepted interrupt wins before atomic commit', async () => {
    const fixture = createFixture();
    const controller = new Da5V5ValidationBuildProcessController();
    const receipt = await publishDa5V5ValidationArtifact({
      interruption: controller,
      outputDirectory: fixture.outputDirectory,
      repositoryRoot: fixture.repositoryRoot,
      sourceApkPath: fixture.sourceApkPath,
      sourceCommit,
      sourceClosure,
      sourceTree,
    }, { inspectApk: vi.fn(() => validInspection()) });
    await controller.interrupt('SIGTERM');
    expect(() => controller.commitPublication(receipt))
      .toThrow(/interrupted by SIGTERM/u);
    receipt.rollback();
    const interruptedSignal = controller.getInterruptedSignal();
    expect(interruptedSignal).toBe('SIGTERM');
    expect(interruptedSignal === 'SIGINT' ? 130 : 143).toBe(143);
    expect(readdirSync(fixture.outputDirectory)).toEqual([]);
  });

  it('retains a committed artifact when commit wins before a late signal', async () => {
    const fixture = createFixture();
    const controller = new Da5V5ValidationBuildProcessController();
    const receipt = await publishDa5V5ValidationArtifact({
      interruption: controller,
      outputDirectory: fixture.outputDirectory,
      repositoryRoot: fixture.repositoryRoot,
      sourceApkPath: fixture.sourceApkPath,
      sourceCommit,
      sourceClosure,
      sourceTree,
    }, { inspectApk: vi.fn(() => validInspection()) });
    controller.commitPublication(receipt);
    await controller.interrupt('SIGINT');
    expect(controller.getInterruptedSignal()).toBeNull();
    expect(receipt.isRevocable()).toBe(false);
    expect(readdirSync(fixture.outputDirectory)).toEqual([
      receipt.publicationName,
    ]);
  });
});

function uninterrupted() {
  return {
    checkpoint: vi.fn(async () => undefined),
  };
}

function interruptAt(target: string) {
  return {
    checkpoint: vi.fn(async (label: string) => {
      if (label === target) {
        throw new Error(`synthetic parent signal at ${target}`);
      }
    }),
  };
}

function latchedInterruption() {
  let interrupted = false;
  return {
    interrupt() {
      interrupted = true;
    },
    checkpoint: vi.fn(async () => {
      if (interrupted) {
        throw new Error('synthetic parent signal');
      }
    }),
  };
}

function createFixture() {
  const root = realpathSync(mkdtempSync(
    join(tmpdir(), 'taptime-da5-publisher-test-'),
  ));
  temporaryRoots.push(root);
  const repositoryRoot = join(root, 'repository');
  const outputDirectory = join(root, 'external-output');
  mkdirSync(repositoryRoot);
  mkdirSync(outputDirectory);
  const sourceApkPath = join(repositoryRoot, 'candidate.apk');
  writeFileSync(sourceApkPath, 'synthetic-apk', {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  chmodSync(sourceApkPath, 0o600);
  return { outputDirectory, repositoryRoot, sourceApkPath };
}

function validInspection(): Da5V5ValidationApkInspection {
  return {
    allowBackup: false,
    backupPolicyDenyAll: true,
    cleartextTraffic: false,
    hermesBundleCount: 1,
    networkPolicyDenyAll: true,
    networkSecurityConfig: true,
    nfcFeatureRequired: true,
    packageName: 'com.tim180201.mobile.validation',
    packageVisibilityQueriesExact: true,
    permissions: [
      'android.permission.NFC',
      'com.tim180201.mobile.validation.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
    ],
    privateReceiverPermissionGuard: true,
    productDeepLinks: false,
    productRuntimeMarker: false,
    productTagDispatch: false,
    queryPackages: [...DA5_V5_VALIDATION_TALKBACK_QUERY_PACKAGES],
    requiredNativeModules: true,
    forbiddenNativeModules: false,
    signatureV1: false,
    signatureV2: true,
    signatureV3: false,
    signatureV31: false,
    signatureV4: false,
    signerCertificateSha256: DA5_V5_VALIDATION_LOCAL_SIGNER_SHA256,
    signerCount: 1,
    validationRuntimeMarker: true,
    versionCode: '1',
    versionName: '1.0.0',
  };
}
