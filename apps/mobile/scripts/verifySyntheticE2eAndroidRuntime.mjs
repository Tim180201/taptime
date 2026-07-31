import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
  normalize,
  resolve,
} from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS } from './syntheticE2eRuntimeContract.mjs';

const mobileDirectory = fileURLToPath(new URL('..', import.meta.url));
const defaultApkPath = join(
  mobileDirectory,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
const bundleEntry = 'assets/index.android.bundle';

export function assertSyntheticE2eRuntimeCompleteness(bytecodeDump) {
  const missing = REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS
    .filter(({ value }) => !bytecodeDump.includes(value))
    .map(({ name }) => name);
  if (missing.length > 0) {
    throw new Error(
      `Synthetic E2E Hermes bytecode is missing required runtime values: ${missing.join(', ')}`,
    );
  }
}

export function verifySyntheticE2eAndroidRuntime(
  apkPath = defaultApkPath,
  options = {},
) {
  const dependencies = options.dependencies ?? systemDependencies();
  const unzipPath = requireExactToolPath(
    options.unzipPath ?? '/usr/bin/unzip',
  );
  const hermesCompilerPath = requireExactToolPath(
    options.hermesCompilerPath ?? resolveSyntheticE2eHermesCompilerPath(),
  );
  const resolvedApkPath = resolve(apkPath);
  if (!dependencies.exists(resolvedApkPath)) {
    throw new Error('Synthetic E2E release APK is missing');
  }

  const entries = dependencies.run(
    unzipPath,
    ['-Z1', resolvedApkPath],
    { capture: true },
  )
    .stdout
    .split(/\r?\n/u)
    .filter((entry) => entry === bundleEntry);
  if (entries.length !== 1) {
    throw new Error(
      'Synthetic E2E release APK must contain exactly one Hermes Android bundle',
    );
  }

  const temporaryDirectory = dependencies.mkdtemp(
    join(dependencies.tmpdir(), 'taptime-hermes-runtime-'),
  );
  const bundlePath = join(temporaryDirectory, 'index.android.bundle');
  try {
    const extractedBundle = dependencies.run(
      unzipPath,
      ['-p', resolvedApkPath, bundleEntry],
      { capture: true, encoding: null },
    ).stdout;
    dependencies.writeFile(bundlePath, extractedBundle);

    const bytecodeDump = dependencies.run(
      hermesCompilerPath,
      ['-b', '-dump-bytecode', '-pretty', bundlePath],
      { capture: true, maxBuffer: 256 * 1024 * 1024 },
    ).stdout;
    assertSyntheticE2eRuntimeCompleteness(bytecodeDump);
  } finally {
    dependencies.remove(temporaryDirectory);
  }

  if (options.emitSuccess !== false) {
    dependencies.writeOutput(
      'synthetic_e2e_android_runtime_complete_verified\n',
    );
  }
}

export function resolveSyntheticE2eHermesCompilerPath() {
  const require = createRequire(import.meta.url);
  const packageDirectory = dirname(require.resolve('hermes-compiler/package.json'));
  const executableDirectory = process.platform === 'darwin'
    ? 'osx-bin'
    : process.platform === 'linux'
      ? 'linux64-bin'
      : process.platform === 'win32'
        ? 'win64-bin'
        : null;
  if (executableDirectory === null) {
    throw new Error('Synthetic E2E runtime verification does not support this host platform');
  }
  const executable = join(
    packageDirectory,
    'hermesc',
    executableDirectory,
    process.platform === 'win32' ? 'hermesc.exe' : 'hermesc',
  );
  if (!existsSync(executable)) {
    throw new Error('Synthetic E2E runtime verification could not locate Hermes');
  }
  return executable;
}

function requireExactToolPath(path) {
  if (
    typeof path !== 'string'
    || path.length === 0
    || normalize(resolve(path)) !== path
  ) {
    throw new Error(
      'Synthetic E2E runtime verification tool path is not canonical',
    );
  }
  return path;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: mobileDirectory,
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`Synthetic E2E runtime verification command failed: ${command}`);
  }
  return result;
}

function systemDependencies() {
  return Object.freeze({
    exists: existsSync,
    mkdtemp: mkdtempSync,
    remove(path) {
      rmSync(path, { recursive: true, force: true });
    },
    run,
    tmpdir,
    writeFile: writeFileSync,
    writeOutput(value) {
      process.stdout.write(value);
    },
  });
}

const invokedPath = process.argv[1] === undefined
  ? null
  : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  verifySyntheticE2eAndroidRuntime(process.argv[2]);
}
