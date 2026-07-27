import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  Da5V5ValidationBuildProcessController,
  Da5V5ValidationBuildSignalLatch,
} from './da5V5ValidationBuildProcess.mjs';
import {
  assertDa5V5ValidationAutolinkingResolution,
  assertDa5V5ValidationReactNativeAutolinkingResolution,
  createDa5V5ValidationAutolinkingPackageJson,
  createDa5V5ValidationBuildEnvironment,
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
  DA5_V5_VALIDATION_SOURCE_SCOPES,
} from './da5V5ValidationRuntimeContract.mjs';
import {
  createDa5V5ValidationSourceClosure,
} from './da5V5ValidationSourceBinding.mjs';
import {
  publishDa5V5ValidationArtifact,
} from './publishDa5V5ValidationArtifact.mjs';
import {
  verifyDa5V5ValidationNativeSourceClosure,
} from './da5V5ValidationNativeSourceBinding.mjs';

const require = createRequire(import.meta.url);
const mobileDirectory = fileURLToPath(new URL('..', import.meta.url));
const androidDirectory = fileURLToPath(new URL('../android', import.meta.url));
const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
const releaseApkPath = fileURLToPath(new URL(
  '../android/app/build/outputs/apk/release/app-release.apk',
  import.meta.url,
));
const outputDirectory = required(
  process.env,
  'DA5_V5_VALIDATION_OUTPUT_DIRECTORY',
);
const environment = createDa5V5ValidationBuildEnvironment(process.env);
const processes = new Da5V5ValidationBuildProcessController();
const signals = new Da5V5ValidationBuildSignalLatch(processes);
let packageJsonBeforeBuild = null;
let publicationReceipt = null;

try {
  await main();
} finally {
  let cleanupFailure = null;
  try {
    await signals.settle();
  } catch (error) {
    cleanupFailure = error;
  }
  try {
    await processes.settle();
  } catch (error) {
    cleanupFailure ??= error;
  }
  try {
    await signals.settle();
  } catch (error) {
    cleanupFailure ??= error;
  }
  try {
    if (publicationReceipt?.isRevocable() === true) {
      publicationReceipt.rollback();
    }
  } catch (error) {
    cleanupFailure ??= error;
  }
  try {
    if (
      packageJsonBeforeBuild !== null
      && readFileSync(packageJsonPath, 'utf8') !== packageJsonBeforeBuild
    ) {
      writeFileSync(packageJsonPath, packageJsonBeforeBuild, 'utf8');
    }
  } catch (error) {
    cleanupFailure ??= error;
  }
  try {
    if (existsSync(androidDirectory)) {
      rmSync(androidDirectory, { force: true, recursive: true });
    }
  } catch (error) {
    cleanupFailure ??= error;
  }
  signals.close();
  const interruptedSignal = processes.getInterruptedSignal();
  if (interruptedSignal !== null) {
    process.exitCode = interruptedSignal === 'SIGINT' ? 130 : 143;
  }
  if (cleanupFailure !== null) {
    throw new Error('DA5 V5 Validation build cleanup failed closed', {
      cause: cleanupFailure,
    });
  }
}

async function main() {
  const androidSdk = environment.ANDROID_HOME
    ?? environment.ANDROID_SDK_ROOT;
  if (androidSdk === undefined || !existsSync(androidSdk)) {
    throw new Error(
      'DA5 V5 Validation local build requires the existing Android SDK',
    );
  }
  await run('java', ['-version'], { capture: true });
  if (existsSync(androidDirectory)) {
    throw new Error(
      'DA5 V5 Validation build refuses a retained Android project',
    );
  }

  const sourceCommit = (
    await run('git', ['rev-parse', 'HEAD'], { capture: true })
  ).stdout.trim();
  const sourceTree = (
    await run('git', ['rev-parse', 'HEAD^{tree}'], { capture: true })
  ).stdout.trim();
  const repositoryRoot = (
    await run('git', ['rev-parse', '--show-toplevel'], { capture: true })
  ).stdout.trim();
  if (
    !/^[0-9a-f]{40}$/u.test(sourceCommit)
    || !/^[0-9a-f]{40}$/u.test(sourceTree)
  ) {
    throw new Error('DA5 V5 Validation source binding is unavailable');
  }

  const sourceStatus = (
    await run('git', [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--ignored=matching',
      '--',
      ...DA5_V5_VALIDATION_SOURCE_SCOPES,
      'apps/mobile/android',
    ], { capture: true, cwd: repositoryRoot })
  ).stdout.trim();
  if (sourceStatus.length > 0) {
    throw new Error(
      'DA5 V5 Validation source closure is dirty, untracked or ignored',
    );
  }
  const treeListing = (
    await run('git', [
      'ls-tree',
      '-r',
      '--full-tree',
      sourceCommit,
      '--',
      ...DA5_V5_VALIDATION_SOURCE_CLOSURE,
    ], { capture: true, cwd: repositoryRoot })
  ).stdout;
  const worktreeObjectIds = (
    await run('git', [
      'hash-object',
      '--',
      ...DA5_V5_VALIDATION_SOURCE_CLOSURE,
    ], { capture: true, cwd: repositoryRoot })
  ).stdout;
  const sourceClosure = createDa5V5ValidationSourceClosure({
    repositoryRoot,
    treeListing,
    worktreeObjectIds,
  });

  packageJsonBeforeBuild = readFileSync(packageJsonPath, 'utf8');
  const validationPackageJson = createDa5V5ValidationAutolinkingPackageJson(
    packageJsonBeforeBuild,
  );
  writeFileSync(packageJsonPath, validationPackageJson, 'utf8');
  await assertValidationExpoModuleGraph(repositoryRoot);
  verifyDa5V5ValidationNativeSourceClosure(repositoryRoot);
  await run(
    process.execPath,
    [
      require.resolve('expo/bin/cli'),
      'prebuild',
      '--platform',
      'android',
      '--no-install',
    ],
  );
  if (readFileSync(packageJsonPath, 'utf8') !== validationPackageJson) {
    throw new Error(
      'DA5 V5 Validation prebuild attempted to mutate package.json',
    );
  }
  await assertValidationModuleGraph(repositoryRoot);
  verifyDa5V5ValidationNativeSourceClosure(repositoryRoot);
  await run(
    './gradlew',
    ['--offline', '--no-daemon', 'clean', 'assembleRelease'],
    { cwd: androidDirectory },
  );
  await processes.checkpoint();
  publicationReceipt = await publishDa5V5ValidationArtifact({
    environment,
    interruption: processes,
    outputDirectory,
    repositoryRoot,
    sourceApkPath: releaseApkPath,
    sourceCommit,
    sourceClosure,
    sourceTree,
  });
  processes.commitPublication(publicationReceipt);
  process.stdout.write(
    `da5_v5_validation_artifact_published`
    + ` publication=${publicationReceipt.publicationName}`
    + ` source_commit=${sourceCommit} source_tree=${sourceTree}\n`,
  );
}

async function assertValidationModuleGraph(repositoryRoot) {
  await assertValidationExpoModuleGraph(repositoryRoot);
  const reactNativeResult = await run(
    process.execPath,
    [
      require.resolve(
        'expo-modules-autolinking/bin/expo-modules-autolinking',
      ),
      'react-native-config',
      '--platform',
      'android',
      '--json',
    ],
    { capture: true },
  );
  let reactNativeResolution;
  try {
    reactNativeResolution = JSON.parse(reactNativeResult.stdout);
  } catch {
    throw new Error(
      'DA5 V5 Validation React Native module graph is unavailable',
    );
  }
  assertDa5V5ValidationReactNativeAutolinkingResolution(
    reactNativeResolution,
    repositoryRoot,
    mobileDirectory,
  );
}

async function assertValidationExpoModuleGraph(repositoryRoot) {
  const expoResult = await run(
    process.execPath,
    [
      require.resolve(
        'expo-modules-autolinking/bin/expo-modules-autolinking',
      ),
      'resolve',
      '--platform',
      'android',
      '--json',
    ],
    { capture: true },
  );
  let resolution;
  try {
    resolution = JSON.parse(expoResult.stdout);
  } catch {
    throw new Error(
      'DA5 V5 Validation native module graph is unavailable',
    );
  }
  assertDa5V5ValidationAutolinkingResolution(
    resolution,
    repositoryRoot,
  );
}

function run(command, args, options = {}) {
  return processes.run(command, args, {
    capture: options.capture,
    cwd: options.cwd ?? mobileDirectory,
    environment,
  });
}

function required(environment_, name) {
  const value = environment_[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`DA5 V5 Validation required binding is missing: ${name}`);
  }
  return value;
}
