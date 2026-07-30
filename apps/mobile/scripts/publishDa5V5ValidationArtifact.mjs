import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';

import {
  createDa5V5ValidationArtifactManifest,
  inspectDa5V5ValidationApk,
  serializeDa5V5ValidationArtifactManifest,
  verifyDa5V5ValidationApkInspection,
  verifyDa5V5ValidationArtifactBinding,
} from './da5V5ValidationArtifact.mjs';

const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;

/**
 * Publishes an already-built validation APK as a single immutable directory.
 *
 * A create-exclusive lock serializes publishers. The complete staging directory is renamed into
 * place only after APK, manifest and their exact binding verify. A failed final re-verification
 * removes only the directory created by this invocation.
 */
export async function publishDa5V5ValidationArtifact(
  options,
  dependencies = Object.freeze({
    inspectApk: inspectDa5V5ValidationApk,
  }),
) {
  const interruption = requireInterruption(options?.interruption);
  await interruption.checkpoint('before-initial-inspection');
  requireGitObject(options?.sourceCommit, 'source commit');
  requireGitObject(options?.sourceTree, 'source tree');
  const repositoryRoot = canonicalDirectory(
    options?.repositoryRoot,
    'repository root',
  );
  const outputDirectory = canonicalDirectory(
    options?.outputDirectory,
    'output directory',
  );
  if (isWithin(repositoryRoot, outputDirectory)) {
    throw new Error(
      'DA5 V5 Validation output directory must be external to the repository',
    );
  }
  const sourceApkPath = canonicalFile(options?.sourceApkPath, 'source APK');
  const sourceBytes = readFileSync(sourceApkPath);
  const apkSha256 = sha256(sourceBytes);
  verifyDa5V5ValidationApkInspection(
    dependencies.inspectApk(
      sourceApkPath,
      validationAndroidSdkAuthority(options?.environment),
    ),
  );
  await interruption.checkpoint('after-initial-inspection');

  const publicationName = [
    'da5-v5-validation',
    options.sourceCommit.slice(0, 12),
    apkSha256.slice(0, 16),
  ].join('-');
  const finalDirectory = join(outputDirectory, publicationName);
  const lockPath = `${finalDirectory}.publish-lock`;
  let lockDescriptor = null;
  let lockIdentity = null;
  let stagingDirectory = null;
  let stagingIdentity = null;
  let finalIdentity = null;
  let publishedByInvocation = false;

  try {
    lockDescriptor = openSync(lockPath, 'wx', 0o600);
    lockIdentity = identity(fstatSync(lockDescriptor));
    await interruption.checkpoint('after-lock');
    requireAbsent(finalDirectory);
    stagingDirectory = mkdtempSync(join(
      outputDirectory,
      '.da5-v5-validation-stage-',
    ));
    stagingIdentity = directoryIdentity(stagingDirectory);
    await interruption.checkpoint('after-staging');
    const apkName = `app-release-${apkSha256.slice(0, 16)}.apk`;
    const manifestName =
      `manifest-${options.sourceCommit.slice(0, 12)}.json`;
    const stagedApkPath = join(stagingDirectory, apkName);
    const stagedManifestPath = join(stagingDirectory, manifestName);
    copyFileSync(sourceApkPath, stagedApkPath, constants.COPYFILE_EXCL);
    chmodSync(stagedApkPath, 0o444);

    const manifest = createDa5V5ValidationArtifactManifest({
      apkBytes: sourceBytes.length,
      apkSha256,
      sourceCommit: options.sourceCommit,
      sourceClosure: options.sourceClosure,
      sourceTree: options.sourceTree,
    });
    writeFileSync(
      stagedManifestPath,
      serializeDa5V5ValidationArtifactManifest(manifest),
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    chmodSync(stagedManifestPath, 0o444);
    await interruption.checkpoint('after-stage-files');

    await interruption.checkpoint('before-staged-verification');
    verifyPublishedPair({
      apkPath: stagedApkPath,
      environment: options?.environment,
      expectedSourceCommit: options.sourceCommit,
      expectedSourceClosure: options.sourceClosure,
      expectedSourceTree: options.sourceTree,
      manifestPath: stagedManifestPath,
    }, dependencies);
    await interruption.checkpoint('after-staged-verification');

    await interruption.checkpoint('before-rename');
    renameSync(stagingDirectory, finalDirectory);
    finalIdentity = stagingIdentity;
    stagingDirectory = null;
    stagingIdentity = null;
    publishedByInvocation = true;
    await interruption.checkpoint('after-rename');

    const finalApkPath = join(finalDirectory, apkName);
    const finalManifestPath = join(finalDirectory, manifestName);
    await interruption.checkpoint('before-final-verification');
    const binding = verifyPublishedPair({
      apkPath: finalApkPath,
      environment: options?.environment,
      expectedSourceCommit: options.sourceCommit,
      expectedSourceClosure: options.sourceClosure,
      expectedSourceTree: options.sourceTree,
      manifestPath: finalManifestPath,
    }, dependencies);
    await interruption.checkpoint('after-final-verification');
    closeSync(lockDescriptor);
    lockDescriptor = null;
    removeOwnedFile(lockPath, lockIdentity);
    lockIdentity = null;
    await interruption.checkpoint('after-lock-release');
    await interruption.checkpoint('before-receipt');
    const receipt = createRevocablePublicationReceipt({
      apk: binding.apk,
      directory: finalDirectory,
      manifest: binding.manifest,
      publicationName,
      sourceCommit: options.sourceCommit,
      sourceClosure: options.sourceClosure,
      sourceTree: options.sourceTree,
    }, finalDirectory, finalIdentity);
    publishedByInvocation = false;
    return receipt;
  } finally {
    let cleanupFailure = null;
    if (stagingDirectory !== null) {
      try {
        removeOwnedDirectory(stagingDirectory, stagingIdentity);
      } catch (error) {
        cleanupFailure = error;
      }
    }
    if (publishedByInvocation) {
      try {
        removeOwnedDirectory(finalDirectory, finalIdentity);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    if (lockDescriptor !== null) {
      try {
        closeSync(lockDescriptor);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    if (lockIdentity !== null) {
      try {
        removeOwnedFile(lockPath, lockIdentity);
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
    if (cleanupFailure !== null) {
      throw new Error(
        'DA5 V5 Validation publication cleanup failed closed',
        { cause: cleanupFailure },
      );
    }
  }
}

function createRevocablePublicationReceipt(
  metadata,
  publicationDirectory,
  publicationIdentity,
) {
  let state = 'revocable';
  return Object.freeze({
    ...metadata,
    commit() {
      if (state !== 'revocable') {
        throw new Error(
          'DA5 V5 Validation publication receipt is not revocable',
        );
      }
      state = 'committed';
    },
    isRevocable() {
      return state === 'revocable';
    },
    rollback() {
      if (state === 'rolled_back') {
        return;
      }
      if (state !== 'revocable') {
        throw new Error(
          'DA5 V5 Validation committed publication cannot be rolled back',
        );
      }
      removeOwnedDirectory(
        publicationDirectory,
        publicationIdentity,
      );
      state = 'rolled_back';
    },
  });
}

function requireInterruption(interruption) {
  if (
    typeof interruption !== 'object'
    || interruption === null
    || typeof interruption.checkpoint !== 'function'
  ) {
    throw new Error(
      'DA5 V5 Validation publication interruption boundary is unavailable',
    );
  }
  return interruption;
}

function directoryIdentity(path) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      'DA5 V5 Validation publication directory identity mismatch',
    );
  }
  return identity(stat);
}

function identity(stat) {
  if (!Number.isSafeInteger(stat.dev) || !Number.isSafeInteger(stat.ino)) {
    throw new Error(
      'DA5 V5 Validation publication identity is unavailable',
    );
  }
  return Object.freeze({ dev: stat.dev, ino: stat.ino });
}

function removeOwnedDirectory(path, expectedIdentity) {
  const stat = existingStat(path);
  if (stat === null) {
    return;
  }
  if (
    expectedIdentity === null
    || !stat.isDirectory()
    || stat.isSymbolicLink()
    || stat.dev !== expectedIdentity.dev
    || stat.ino !== expectedIdentity.ino
  ) {
    throw new Error(
      'DA5 V5 Validation publication directory ownership changed',
    );
  }
  rmSync(path, { force: true, recursive: true });
}

function removeOwnedFile(path, expectedIdentity) {
  const stat = existingStat(path);
  if (stat === null) {
    return;
  }
  if (
    expectedIdentity === null
    || !stat.isFile()
    || stat.isSymbolicLink()
    || stat.dev !== expectedIdentity.dev
    || stat.ino !== expectedIdentity.ino
  ) {
    throw new Error(
      'DA5 V5 Validation publication lock ownership changed',
    );
  }
  rmSync(path, { force: true });
}

function existingStat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function verifyPublishedPair(options, dependencies) {
  const apk = immutableBinding(options.apkPath);
  const manifest = immutableBinding(options.manifestPath);
  verifyDa5V5ValidationArtifactBinding({
    apk,
    expectedSourceCommit: options.expectedSourceCommit,
    expectedSourceClosure: options.expectedSourceClosure,
    expectedSourceTree: options.expectedSourceTree,
    manifest,
  }, {
    files: {
      lstat: lstatSync,
      readUtf8(path) {
        return readFileSync(path, 'utf8');
      },
      realpath: realpathSync,
      sha256(path) {
        return sha256(readFileSync(path));
      },
    },
    inspectApk(path) {
      return dependencies.inspectApk(
        path,
        validationAndroidSdkAuthority(options.environment),
      );
    },
  });
  return Object.freeze({ apk, manifest });
}

function validationAndroidSdkAuthority(environment) {
  return Object.freeze({
    androidHome: environment?.ANDROID_HOME,
    androidSdkRoot: environment?.ANDROID_SDK_ROOT,
  });
}

function immutableBinding(path) {
  const stat = lstatSync(path);
  return Object.freeze({
    bytes: stat.size,
    mode: stat.mode & 0o7777,
    path,
    sha256: sha256(readFileSync(path)),
  });
}

function canonicalDirectory(path, label) {
  const canonical = canonicalPath(path, label);
  const stat = lstatSync(canonical);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`DA5 V5 Validation ${label} is not a real directory`);
  }
  return canonical;
}

function canonicalFile(path, label) {
  const canonical = canonicalPath(path, label);
  const stat = lstatSync(canonical);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`DA5 V5 Validation ${label} is not a real file`);
  }
  return canonical;
}

function canonicalPath(path, label) {
  if (typeof path !== 'string' || !isAbsolute(path)) {
    throw new Error(`DA5 V5 Validation ${label} path is invalid`);
  }
  const canonical = normalize(resolve(path));
  if (
    canonical !== path
    || normalize(realpathSync(canonical)) !== canonical
  ) {
    throw new Error(`DA5 V5 Validation ${label} path is not canonical`);
  }
  return canonical;
}

function isWithin(parent, candidate) {
  const delta = relative(parent, candidate);
  return delta === ''
    || (
      delta !== '..'
      && !delta.startsWith(`..${sep}`)
      && !isAbsolute(delta)
    );
}

function requireAbsent(path) {
  try {
    lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  throw new Error('DA5 V5 Validation publication collision');
}

function requireGitObject(value, label) {
  if (typeof value !== 'string' || !GIT_OBJECT_PATTERN.test(value)) {
    throw new Error(`DA5 V5 Validation ${label} is invalid`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
