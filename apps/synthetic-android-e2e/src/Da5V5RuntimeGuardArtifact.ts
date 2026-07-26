import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  constants,
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rmdir,
  stat,
  unlink,
  writeFile,
  type FileHandle,
} from 'node:fs/promises';
import { arch, platform, release } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const rejectedEnvironmentPatterns = Object.freeze([
  /^(?:CC|CFLAGS|CPPFLAGS|LDFLAGS|CPATH|C_INCLUDE_PATH|CPLUS_INCLUDE_PATH)$/u,
  /^(?:OBJC_INCLUDE_PATH|LIBRARY_PATH|SDKROOT|DEVELOPER_DIR)$/u,
  /^(?:DYLD_|LD_|PG|PQ|LC_)/u,
  /^(?:LANG|LANGUAGE)$/u,
]);

interface BoundArtifactPath {
  readonly canonicalPath: string;
  readonly dev: string;
  readonly gid: number;
  readonly identitySha256: string;
  readonly ino: string;
  readonly mode: string;
  readonly size: string;
  readonly trust: ArtifactTrust;
  readonly uid: number;
}

interface BoundArtifactFile extends BoundArtifactPath {
  readonly platformSignature: string;
  readonly sha256: string;
}

type ArtifactTrust = 'root-system' | 'same-euid-private';

export type Da5V5ProducerPoisonStage =
  | 'compiler'
  | 'compiler-input'
  | 'compiler-resource-directory'
  | 'git-inspector'
  | 'include-directory'
  | 'link-libsystem-input'
  | 'link-object-input'
  | 'linker'
  | 'load-dependency-inspector'
  | 'operating-system-inspector'
  | 'process-inspector'
  | 'sdk-sysroot'
  | 'signature'
  | 'source'
  | 'xcrun';

export interface Da5V5RuntimeGuardManifest {
  readonly architecture: string;
  readonly binary: Readonly<{
    readonly format: 'ELF' | 'Mach-O';
    readonly loadDependencies: readonly string[];
    readonly loadDependencyInputs: readonly BoundArtifactFile[];
    readonly magicHex: string;
    readonly mode: '0555';
    readonly path: string;
    readonly sha256: string;
    readonly signature: string;
    readonly size: number;
  }>;
  readonly build: Readonly<{
    readonly commandSha256: string;
    readonly compilerArguments: readonly string[];
    readonly linkerArguments: readonly string[];
    readonly mode: 'separate-cc1-and-direct-linker';
    readonly signatureArguments: readonly string[];
    readonly testResult: string;
    readonly umask: '0077';
  }>;
  readonly implementation: Readonly<{
    readonly commit: string;
    readonly repositoryRoot: string;
    readonly tree: string;
  }>;
  readonly operatingSystem: Readonly<{
    readonly build: string;
    readonly platform: string;
    readonly release: string;
  }>;
  readonly source: BoundArtifactFile;
  readonly toolchain: Readonly<{
    readonly compiler: BoundArtifactFile;
    readonly compilerResourceDirectory: BoundArtifactPath;
    readonly compilerVersion: string;
    readonly git: BoundArtifactFile;
    readonly includeDirectories: readonly BoundArtifactPath[];
    readonly inputFiles: readonly BoundArtifactFile[];
    readonly linkInputFiles: readonly BoundArtifactFile[];
    readonly linker: BoundArtifactFile;
    readonly linkerVersion: string;
    readonly loadDependencyInspector: BoundArtifactFile;
    readonly operatingSystemInspector: BoundArtifactFile;
    readonly processVerifier: BoundArtifactFile;
    readonly sdk: BoundArtifactPath;
    readonly sdkBuildVersion: string;
    readonly sdkVersion: string;
    readonly startObjects: readonly BoundArtifactFile[];
    readonly startObjectMode: 'platform-linker-default-none';
    readonly sysroot: BoundArtifactPath;
    readonly target: 'arm64-apple-macosx26.0.0';
    readonly xcrun: BoundArtifactFile;
  }>;
}

export interface Da5V5RuntimeGuardArtifactBinding {
  readonly manifest: Da5V5RuntimeGuardManifest;
  readonly manifestSha256: string;
  close(): Promise<void>;
  revalidate(): Promise<void>;
}

interface RuntimeGuardArtifactState {
  readonly binaryHandle: FileHandle;
  binaryHandleClosed: boolean;
  closed: boolean;
  readonly manifestHandle: FileHandle;
  manifestHandleClosed: boolean;
}

const runtimeGuardArtifactStates =
  new WeakMap<object, RuntimeGuardArtifactState>();

export function assertDa5V5RuntimeGuardArtifactBinding(
  binding: Da5V5RuntimeGuardArtifactBinding,
): void {
  const state = runtimeGuardArtifactStates.get(binding);
  if (
    state === undefined
    || state.closed
    || state.binaryHandleClosed
    || state.manifestHandleClosed
  ) {
    throw new Error('DA5 V5 Runtime Guard artifact binding is invalid');
  }
}

export function da5V5RuntimeGuardArtifactBinaryFd(
  binding: Da5V5RuntimeGuardArtifactBinding,
): number {
  assertDa5V5RuntimeGuardArtifactBinding(binding);
  return (runtimeGuardArtifactStates.get(binding) as RuntimeGuardArtifactState)
    .binaryHandle.fd;
}

export async function verifyDa5V5RuntimeGuardRunningProcess(
  binding: Da5V5RuntimeGuardArtifactBinding,
  pid: number,
): Promise<void> {
  assertDa5V5RuntimeGuardArtifactBinding(binding);
  const state = runtimeGuardArtifactStates.get(binding);
  if (state === undefined || state.closed) {
    throw new Error('DA5 V5 Runtime Guard artifact binding is invalid');
  }
  const cdHash = requireCdHash(binding.manifest.binary.signature);
  const verifier = binding.manifest.toolchain.processVerifier;
  await revalidateArtifactFile(verifier);
  const result = spawnSync(verifier.canonicalPath, [
    '--verify',
    `-R=cdhash H"${cdHash}"`,
    String(requireProcessId(pid)),
  ], {
    cwd: '/',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 65_536,
    shell: false,
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  await revalidateArtifactFile(verifier);
  await binding.revalidate();
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
  ) {
    throw new Error('DA5 V5 Runtime Guard running process identity mismatch');
  }
}

export async function verifyDa5V5RuntimeGuardRunningProcessForTest(options: {
  readonly binaryPath: string;
  readonly expectedCdHash?: string;
  readonly pid: number;
}): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || process.env.VITEST !== 'true') {
    throw new Error('DA5 V5 Runtime Guard process verifier is test-only');
  }
  const binaryPath = await requireAbsoluteCanonicalPath(options.binaryPath);
  const binary = await bindArtifactFile(
    binaryPath,
    binaryPath.startsWith('/private/var/folders/')
      ? 'same-euid-private'
      : 'root-system',
  );
  const verifier = await bindArtifactFile('/usr/bin/codesign', 'root-system');
  const cdHash = options.expectedCdHash
    ?? requireCdHash(binary.platformSignature);
  const result = spawnSync(verifier.canonicalPath, [
    '--verify',
    `-R=cdhash H"${cdHash}"`,
    String(requireProcessId(options.pid)),
  ], {
    cwd: '/',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 65_536,
    shell: false,
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  await Promise.all([
    revalidateArtifactFile(binary),
    revalidateArtifactFile(verifier),
  ]);
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
  ) {
    throw new Error('DA5 V5 Runtime Guard running process identity mismatch');
  }
}

export async function verifyDa5V5RuntimeGuardArtifact(options: {
  readonly binaryPath: string;
  readonly expectedBinarySha256: string;
  readonly expectedManifestSha256: string;
  readonly implementationCommit: string;
  readonly implementationTree: string;
  readonly manifestPath: string;
}): Promise<Da5V5RuntimeGuardArtifactBinding> {
  requireSha256(options.expectedBinarySha256);
  requireSha256(options.expectedManifestSha256);
  const binaryPath = await requireAbsoluteCanonicalPath(options.binaryPath);
  const manifestPath = await requireAbsoluteCanonicalPath(options.manifestPath);
  const binary = await openNoFollow(binaryPath);
  let manifestHandle: FileHandle | null = null;
  try {
    manifestHandle = await openNoFollow(manifestPath);
    const binaryBefore = await binary.stat();
    const manifestBefore = await manifestHandle.stat();
    if (
      !binaryBefore.isFile()
      || !manifestBefore.isFile()
      || (binaryBefore.mode & 0o777) !== 0o555
      || (manifestBefore.mode & 0o777) !== 0o444
      || binaryBefore.uid !== effectiveUid()
      || manifestBefore.uid !== effectiveUid()
    ) {
      throw new Error('DA5 V5 Runtime Guard artifact mode or owner mismatch');
    }
    const [binaryBytes, manifestBuffer] = await Promise.all([
      readExactHandle(binary, binaryBefore.size),
      readExactHandle(manifestHandle, manifestBefore.size),
    ]);
    const binaryAfter = await binary.stat();
    const manifestAfter = await manifestHandle.stat();
    assertStableIdentity(binaryBefore, binaryAfter);
    assertStableIdentity(manifestBefore, manifestAfter);
    const binarySha256 = sha256(binaryBytes);
    const manifestSha256 = sha256(manifestBuffer);
    if (
      binarySha256 !== options.expectedBinarySha256
      || manifestSha256 !== options.expectedManifestSha256
    ) {
      throw new Error('DA5 V5 Runtime Guard externally reviewed digest mismatch');
    }
    const manifest = parseManifest(manifestBuffer.toString('utf8'));
    if (
      manifest.toolchain.processVerifier.canonicalPath !== '/usr/bin/codesign'
    ) {
      throw new Error('DA5 V5 Runtime Guard process verifier mismatch');
    }
    await revalidateArtifactFile(manifest.toolchain.processVerifier);
    const actualFormat = executableFormat(binaryBytes);
    await Promise.all([
      revalidateArtifactFile(manifest.toolchain.loadDependencyInspector),
      revalidateArtifactFile(manifest.toolchain.operatingSystemInspector),
      revalidateArtifactFile(manifest.toolchain.processVerifier),
    ]);
    const actualDependencies = loadDependencies(
      binaryPath,
      manifest.toolchain.loadDependencyInspector.canonicalPath,
    );
    const actualSignature = executableSignature(
      binaryPath,
      manifest.toolchain.processVerifier.canonicalPath,
    );
    if (
      manifest.binary.path !== binaryPath
      || manifest.binary.size !== binaryBytes.byteLength
      || manifest.binary.sha256 !== binarySha256
      || manifest.binary.mode !== '0555'
      || manifest.binary.magicHex !== binaryBytes.subarray(0, 8).toString('hex')
      || manifest.binary.format !== actualFormat
      || manifest.binary.signature !== actualSignature
      || manifest.binary.loadDependencies.join('\n')
        !== actualDependencies.join('\n')
      || manifest.implementation.commit !== options.implementationCommit
      || manifest.implementation.tree !== options.implementationTree
      || manifest.architecture !== arch()
      || manifest.operatingSystem.build !== operatingSystemBuild(
        manifest.toolchain.operatingSystemInspector.canonicalPath,
      )
      || manifest.operatingSystem.platform !== platform()
      || manifest.operatingSystem.release !== release()
    ) {
      throw new Error('DA5 V5 Runtime Guard artifact manifest mismatch');
    }
    const boundManifestHandle = manifestHandle;
    const binding: Da5V5RuntimeGuardArtifactBinding = Object.freeze({
      manifest,
      manifestSha256,
      async close(): Promise<void> {
        const state = runtimeGuardArtifactStates.get(binding);
        if (state === undefined || state.closed) {
          return;
        }
        let firstFailure: unknown;
        if (!state.binaryHandleClosed) {
          try {
            await state.binaryHandle.close();
            state.binaryHandleClosed = true;
          } catch (error: unknown) {
            firstFailure ??= error;
          }
        }
        if (!state.manifestHandleClosed) {
          try {
            await state.manifestHandle.close();
            state.manifestHandleClosed = true;
          } catch (error: unknown) {
            firstFailure ??= error;
          }
        }
        state.closed = state.binaryHandleClosed && state.manifestHandleClosed;
        if (firstFailure !== undefined) {
          throw new Error(
            'DA5 V5 Runtime Guard artifact handles did not all close',
            { cause: firstFailure },
          );
        }
      },
      async revalidate(): Promise<void> {
        const state = runtimeGuardArtifactStates.get(binding);
        if (
          state === undefined
          || state.closed
          || state.binaryHandleClosed
          || state.manifestHandleClosed
        ) {
          throw new Error('DA5 V5 Runtime Guard artifact binding is closed');
        }
        const [binaryPathState, manifestPathState, binaryState, manifestState] =
          await Promise.all([
            lstat(binaryPath),
            lstat(manifestPath),
            binary.stat(),
            boundManifestHandle.stat(),
          ]);
        assertStableIdentity(binaryBefore, binaryPathState);
        assertStableIdentity(binaryBefore, binaryState);
        assertStableIdentity(manifestBefore, manifestPathState);
        assertStableIdentity(manifestBefore, manifestState);
        const [latestBinary, latestManifest] = await Promise.all([
          readExactHandle(binary, binaryState.size),
          readExactHandle(boundManifestHandle, manifestState.size),
        ]);
        if (
          sha256(latestBinary) !== options.expectedBinarySha256
          || sha256(latestManifest) !== options.expectedManifestSha256
          || await realpath(binaryPath) !== binaryPath
          || await realpath(manifestPath) !== manifestPath
          || executableFormat(latestBinary) !== manifest.binary.format
          || executableSignature(
            binaryPath,
            manifest.toolchain.processVerifier.canonicalPath,
          ) !== manifest.binary.signature
          || loadDependencies(
            binaryPath,
            manifest.toolchain.loadDependencyInspector.canonicalPath,
          ).join('\n')
            !== manifest.binary.loadDependencies.join('\n')
        ) {
          throw new Error('DA5 V5 Runtime Guard artifact binding changed');
        }
      },
    });
    runtimeGuardArtifactStates.set(binding, {
      binaryHandle: binary,
      binaryHandleClosed: false,
      closed: false,
      manifestHandle: boundManifestHandle,
      manifestHandleClosed: false,
    });
    return binding;
  } catch (error) {
    await binary.close().catch(() => undefined);
    await manifestHandle?.close().catch(() => undefined);
    throw error;
  }
}

export async function buildDa5V5TemporaryTestGuard(options: {
  readonly sourcePath: string;
  readonly temporaryRoot: string;
}): Promise<Readonly<{
  readonly binaryPath: string;
  cleanup(): Promise<void>;
}>> {
  const sourcePath = await requireAbsoluteCanonicalPath(options.sourcePath);
  const temporaryRoot = await realpath(resolve(options.temporaryRoot));
  const buildRoot = join(
    temporaryRoot,
    `guard-test-${process.pid}-${Date.now()}`,
  );
  await mkdir(buildRoot, { mode: 0o700 });
  const binaryPath = join(buildRoot, 'da5_v5_runtime_guard');
  const result = spawnSync('/usr/bin/cc', [
    '-DDA5_V5_TEST_BUILD=1',
    '-std=c17',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-Wconversion',
    '-Wshadow',
    '-Wstrict-prototypes',
    '-fstack-protector-strong',
    '-o',
    binaryPath,
    sourcePath,
    '-lpthread',
  ], {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 16_384,
    shell: false,
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 20_000,
    killSignal: 'SIGKILL',
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    const diagnostic = summarizeTemporaryGuardCompilerFailure(
      result.stderr,
      sourcePath,
      buildRoot,
    );
    await unlink(binaryPath).catch(() => undefined);
    await rmdir(buildRoot).catch(() => undefined);
    throw new Error(
      'DA5 V5 temporary Runtime Guard compilation failed '
      + `(status=${String(result.status)}, signal=${result.signal ?? 'none'}; `
      + `${diagnostic})`,
    );
  }
  await (await open(
    binaryPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  )).close();
  let cleaned = false;
  return Object.freeze({
    binaryPath,
    async cleanup(): Promise<void> {
      if (cleaned) {
        return;
      }
      cleaned = true;
      await unlink(binaryPath);
      await rmdir(buildRoot);
    },
  });
}

function summarizeTemporaryGuardCompilerFailure(
  stderr: string,
  sourcePath: string,
  buildRoot: string,
): string {
  const diagnosticLines = stderr
    .split(/\r?\n/u)
    .filter((line) => /(?:error:|fatal error:|undefined reference)/iu.test(line))
    .slice(0, 6)
    .map((line) => line
      .replaceAll(sourcePath, '[guard-source]')
      .replaceAll(buildRoot, '[guard-build]')
      .replace(/(?:\/[^/\s:'"]+)+/gu, '[path]')
      .slice(0, 240));
  const diagnostic = diagnosticLines.join(' | ').slice(0, 1_200);
  return diagnostic.length === 0
    ? 'compiler diagnostic unavailable'
    : diagnostic;
}

/**
 * Test-only descriptor for constructing an externally bound synthetic
 * manifest around a freshly compiled guard. Production callers must use the
 * producer and verifier APIs instead.
 */
export async function describeDa5V5RuntimeGuardBinaryForTest(
  path: string,
): Promise<Readonly<{
  readonly format: 'ELF' | 'Mach-O';
  readonly loadDependencies: readonly string[];
  readonly magicHex: string;
  readonly sha256: string;
  readonly signature: string;
  readonly size: number;
}>> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('DA5 V5 Runtime Guard binary descriptor is test-only');
  }
  const canonicalPath = await requireAbsoluteCanonicalPath(path);
  const handle = await openNoFollow(canonicalPath);
  try {
    const before = await handle.stat();
    if (!before.isFile()) {
      throw new Error('DA5 V5 Runtime Guard test binary is invalid');
    }
    const bytes = await readExactHandle(handle, before.size);
    const after = await handle.stat();
    assertStableIdentity(before, after);
    return Object.freeze({
      format: executableFormat(bytes),
      loadDependencies: Object.freeze(loadDependencies(canonicalPath)),
      magicHex: bytes.subarray(0, 8).toString('hex'),
      sha256: sha256(bytes),
      signature: executableSignature(canonicalPath),
      size: bytes.byteLength,
    });
  } finally {
    await handle.close();
  }
}

export async function produceDa5V5RuntimeGuardArtifact(options: {
  readonly environment: NodeJS.ProcessEnv;
  readonly expectedTestEvidenceSha256: string;
  readonly implementationCommit: string;
  readonly implementationTree: string;
  readonly outputDirectory: string;
  readonly sourcePath: string;
  readonly testOnlyOutputBoundary?: boolean;
  readonly testOnlyPoisonIndex?: number;
  readonly testOnlyPoisonPath?: string;
  readonly testOnlyPoisonStage?: Da5V5ProducerPoisonStage;
  readonly testEvidencePath: string;
}): Promise<Readonly<{
  readonly binaryPath: string;
  readonly manifestPath: string;
  readonly manifest: Da5V5RuntimeGuardManifest;
  readonly manifestSha256: string;
}>> {
  assertClosedToolchainEnvironment(options.environment);
  if (platform() !== 'darwin' || arch() !== 'arm64') {
    throw new Error('DA5 V5 Runtime Guard artifact target is unsupported');
  }
  const testOnlyPoisonAuthorized = process.env.NODE_ENV === 'test'
    && process.env.VITEST === 'true';
  if (
    (
      options.testOnlyPoisonStage !== undefined
      || options.testOnlyPoisonPath !== undefined
      || options.testOnlyPoisonIndex !== undefined
    )
    && (
      !testOnlyPoisonAuthorized
      || options.testOnlyPoisonStage === undefined
      || options.testOnlyPoisonPath === undefined
    )
  ) {
    throw new Error('DA5 V5 producer poison authority is unavailable');
  }
  const git = await bindArtifactFile('/usr/bin/git', 'root-system');
  await injectDa5V5ProducerBindingPoison(options, 'git-inspector', git);
  const loadDependencyInspector = await bindArtifactFile(
    '/usr/bin/otool',
    'root-system',
  );
  const operatingSystemInspector = await bindArtifactFile(
    '/usr/bin/sw_vers',
    'root-system',
  );
  const sourcePath = await requireAbsoluteCanonicalPath(options.sourcePath);
  const repositoryRoot = await requireAbsoluteCanonicalPath(
    await boundedArtifactOutput(git, [
      '-C',
      dirname(sourcePath),
      'rev-parse',
      '--show-toplevel',
    ]),
  );
  const sourceRelative = relative(repositoryRoot, sourcePath);
  if (
    sourceRelative.startsWith('..')
    || await boundedArtifactOutput(git, [
      '-C',
      repositoryRoot,
      'ls-files',
      '--error-unmatch',
      '--full-name',
      sourceRelative,
    ]) !== sourceRelative
  ) {
    throw new Error('DA5 V5 Runtime Guard source is not tracked');
  }
  const implementationCommit = await boundedArtifactOutput(git, [
    '-C',
    repositoryRoot,
    'rev-parse',
    'HEAD',
  ]);
  const implementationTree = await boundedArtifactOutput(git, [
    '-C',
    repositoryRoot,
    'rev-parse',
    'HEAD^{tree}',
  ]);
  if (
    implementationCommit !== options.implementationCommit
    || implementationTree !== options.implementationTree
    || !/^[a-f0-9]{40}$/u.test(implementationCommit)
    || !/^[a-f0-9]{40}$/u.test(implementationTree)
  ) {
    throw new Error('DA5 V5 Runtime Guard Git binding mismatch');
  }
  requireSha256(options.expectedTestEvidenceSha256);
  const testEvidencePath = await requireAbsoluteCanonicalPath(
    options.testEvidencePath,
  );
  const testEvidence = await bindArtifactFile(
    testEvidencePath,
    'same-euid-private',
  );
  if (
    testEvidence.sha256 !== options.expectedTestEvidenceSha256
    || !JSON.parse(await readFile(testEvidencePath, 'utf8')).passed
  ) {
    throw new Error('DA5 V5 Runtime Guard focused test evidence mismatch');
  }
  const source = await bindArtifactFile(sourcePath, 'same-euid-private');
  await injectDa5V5ProducerBindingPoison(options, 'source', source);
  const committedSource = await boundedArtifactBuffer(git, [
    '-C',
    repositoryRoot,
    'show',
    `HEAD:${sourceRelative}`,
  ]);
  if (sha256(committedSource) !== source.sha256) {
    throw new Error('DA5 V5 Runtime Guard source differs from Git');
  }

  const outputDirectory = resolve(options.outputDirectory);
  const exactOutputDirectory = join(
    '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/'
      + 'da5-v5-runtime-guard',
    implementationCommit,
  );
  const testOnlyOutputBoundary =
    options.testOnlyOutputBoundary === true
    && process.env.NODE_ENV === 'test'
    && process.env.VITEST === 'true';
  if (options.testOnlyPoisonStage !== undefined && !testOnlyOutputBoundary) {
    throw new Error('DA5 V5 producer poison authority is unavailable');
  }
  if (
    outputDirectory !== exactOutputDirectory
    && !testOnlyOutputBoundary
  ) {
    throw new Error('DA5 V5 Runtime Guard artifact output boundary mismatch');
  }
  const parent = dirname(outputDirectory);
  const parentState = await lstat(parent);
  if (
    !parentState.isDirectory()
    || parentState.uid !== effectiveUid()
    || (parentState.mode & 0o022) !== 0
  ) {
    throw new Error('DA5 V5 Runtime Guard artifact parent is unavailable');
  }
  await mkdir(outputDirectory, { mode: 0o700 });
  const outputState = await lstat(outputDirectory);
  if (
    !outputState.isDirectory()
    || outputState.uid !== effectiveUid()
    || (outputState.mode & 0o777) !== 0o700
  ) {
    throw new Error('DA5 V5 Runtime Guard artifact directory mismatch');
  }
  const workRoot = join(outputDirectory, '.guard-build');
  await mkdir(workRoot, { mode: 0o700 });
  const objectPath = join(workRoot, 'guard.o');
  const dependencyPath = join(workRoot, 'guard.d');
  const compilerSourcePath = join(workRoot, 'da5_v5_runtime_guard.c');
  const discoveryObjectPath = join(workRoot, 'guard-discovery.o');
  const discoveryDependencyPath = join(workRoot, 'guard-discovery.d');
  const candidatePath = join(workRoot, 'guard');
  const manifestCandidatePath = join(workRoot, 'guard-manifest.txt');
  const binaryPath = join(outputDirectory, 'da5_v5_runtime_guard');
  const manifestPath = join(outputDirectory, 'guard-manifest.txt');
  const xcrunPath = '/usr/bin/xcrun';
  const xcrun = await bindArtifactFile(xcrunPath, 'root-system');
  await injectDa5V5ProducerBindingPoison(options, 'xcrun', xcrun);
  await revalidateArtifactFile(xcrun);
  const clangPath = await requireAbsoluteCanonicalPath(
    boundedOutput(xcrunPath, ['--find', 'clang']),
  );
  await revalidateArtifactFile(xcrun);
  const compiler = await bindArtifactFile(clangPath, 'root-system');
  await revalidateArtifactFile(xcrun);
  const linkerPath = await requireAbsoluteCanonicalPath(
    boundedOutput(xcrunPath, ['--find', 'ld']),
  );
  await revalidateArtifactFile(xcrun);
  const linker = await bindArtifactFile(linkerPath, 'root-system');
  await injectDa5V5ProducerBindingPoison(options, 'linker', linker);
  const processVerifier = await bindArtifactFile(
    '/usr/bin/codesign',
    'root-system',
  );
  await writeFile(compilerSourcePath, committedSource, {
    flag: 'wx',
    mode: 0o400,
  });
  const compilerSource = await bindArtifactFile(
    compilerSourcePath,
    'same-euid-private',
  );
  if (compilerSource.sha256 !== source.sha256) {
    throw new Error('DA5 V5 Runtime Guard private compiler source mismatch');
  }
  await revalidateArtifactFile(xcrun);
  const sdkPath = await realpath(
    boundedOutput(xcrunPath, ['--sdk', 'macosx', '--show-sdk-path']),
  );
  await revalidateArtifactFile(xcrun);
  const sdk = await bindArtifactPath(sdkPath, 'root-system');
  await injectDa5V5ProducerBindingPoison(options, 'sdk-sysroot', sdk);
  await injectDa5V5ProducerBindingPoison(options, 'compiler', compiler);
  await revalidateArtifactFile(compiler);
  const resourceDirectory = await requireAbsoluteCanonicalPath(
    boundedOutput(clangPath, ['-print-resource-dir']),
  );
  await revalidateArtifactFile(compiler);
  const compilerResourceDirectory = await bindArtifactPath(
    resourceDirectory,
    'root-system',
  );
  await injectDa5V5ProducerBindingPoison(
    options,
    'compiler-resource-directory',
    compilerResourceDirectory,
  );
  const includePaths = [
    join(resourceDirectory, 'include'),
    join(sdkPath, 'usr/include'),
    join(sdkPath, 'System/Library/Frameworks'),
  ];
  const includeDirectories: BoundArtifactPath[] = [];
  for (const includePath of includePaths) {
    if (!(await stat(includePath)).isDirectory()) {
      throw new Error('DA5 V5 Runtime Guard include boundary mismatch');
    }
    includeDirectories.push(await bindArtifactPath(
      includePath,
      'root-system',
    ));
  }
  const libSystemPath = await realpath(join(
    sdkPath,
    'usr/lib/libSystem.tbd',
  ));
  const compilerArguments = Object.freeze([
    '-cc1',
    '-triple',
    'arm64-apple-macosx26.0.0',
    '-emit-obj',
    '-std=c17',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-Wconversion',
    '-Wshadow',
    '-Wstrict-prototypes',
    '-stack-protector',
    '2',
    '-fdefine-target-os-macros',
    '-fgnuc-version=4.2.1',
    '-target-sdk-version=26.5',
    '-isysroot',
    sdkPath,
    '-internal-isystem',
    includePaths[0] as string,
    '-internal-externc-isystem',
    includePaths[1] as string,
    '-internal-iframework',
    includePaths[2] as string,
    '-dependency-file',
    dependencyPath,
    '-MT',
    objectPath,
    '-o',
    objectPath,
    compilerSourcePath,
  ]);
  const linkerArguments = Object.freeze([
    '-arch',
    'arm64',
    '-syslibroot',
    sdkPath,
    '-platform_version',
    'macos',
    '26.0',
    '26.5',
    libSystemPath,
    '-o',
    candidatePath,
    objectPath,
  ]);
  const phaseEnvironment = Object.freeze({
    HOME: '/var/empty',
    PATH: '/usr/bin:/bin',
    TMPDIR: workRoot,
    TZ: 'UTC',
  });
  const previousUmask = process.umask(0o077);
  let binaryPublished = false;
  let manifestPublished = false;
  let pendingSignal: NodeJS.Signals | null = null;
  const latchSignal = (signal: NodeJS.Signals): void => {
    pendingSignal ??= signal;
  };
  const handleSigint = (): void => latchSignal('SIGINT');
  const handleSigterm = (): void => latchSignal('SIGTERM');
  const handleSighup = (): void => latchSignal('SIGHUP');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
  process.once('SIGHUP', handleSighup);
  try {
    for (const [index, includeDirectory] of includeDirectories.entries()) {
      await injectDa5V5ProducerBindingPoison(
        options,
        'include-directory',
        includeDirectory,
        index,
      );
    }
    await revalidateProducerInputs({
      compiler,
      compilerResourceDirectory,
      git,
      includeDirectories,
      linker,
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk,
      compilerSource,
      source,
      xcrun,
    });
    assertNoPendingProducerSignal(pendingSignal);
    const discoveryArguments = compilerArguments.map((argument) => (
      argument === objectPath
        ? discoveryObjectPath
        : argument === dependencyPath
          ? discoveryDependencyPath
          : argument
    ));
    runBuildPhase(clangPath, discoveryArguments, phaseEnvironment);
    const discoveredInputPaths = normalizeCompilerInputPaths(
      await parseDependencyManifest(discoveryDependencyPath),
      compilerSourcePath,
      sourcePath,
    );
    const inputFiles = Object.freeze(
      await Promise.all(discoveredInputPaths.map((inputPath) => (
        bindArtifactFile(
          inputPath,
          inputPath === sourcePath
            ? 'same-euid-private'
            : 'root-system',
        )
      ))),
    );
    for (const [index, inputFile] of inputFiles.entries()) {
      await injectDa5V5ProducerBindingPoison(
        options,
        'compiler-input',
        inputFile,
        index,
      );
    }
    await Promise.all([
      unlink(discoveryObjectPath),
      unlink(discoveryDependencyPath),
    ]);
    await revalidateProducerInputs({
      compiler,
      compilerResourceDirectory,
      git,
      includeDirectories,
      linker,
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk,
      compilerSource,
      source,
      xcrun,
    });
    await Promise.all(inputFiles.map(revalidateArtifactFile));
    assertNoPendingProducerSignal(pendingSignal);
    runBuildPhase(clangPath, compilerArguments, phaseEnvironment);
    await revalidateArtifactFile(compilerSource);
    assertNoPendingProducerSignal(pendingSignal);
    const finalInputPaths = normalizeCompilerInputPaths(
      await parseDependencyManifest(dependencyPath),
      compilerSourcePath,
      sourcePath,
    );
    if (finalInputPaths.join('\n') !== discoveredInputPaths.join('\n')) {
      throw new Error('DA5 V5 Runtime Guard compiler input set changed');
    }
    await Promise.all(inputFiles.map(revalidateArtifactFile));
    const linkInputFiles = Object.freeze([
      await bindArtifactFile(objectPath, 'same-euid-private'),
      await bindArtifactFile(libSystemPath, 'root-system'),
    ]);
    await injectDa5V5ProducerBindingPoison(
      options,
      'link-object-input',
      linkInputFiles[0] as BoundArtifactFile,
    );
    await injectDa5V5ProducerBindingPoison(
      options,
      'link-libsystem-input',
      linkInputFiles[1] as BoundArtifactFile,
    );
    await Promise.all(linkInputFiles.map(revalidateArtifactFile));
    assertNoPendingProducerSignal(pendingSignal);
    runBuildPhase(linkerPath, linkerArguments, phaseEnvironment);
    await Promise.all(linkInputFiles.map(revalidateArtifactFile));
    await revalidateProducerInputs({
      compiler,
      compilerResourceDirectory,
      git,
      includeDirectories,
      linker,
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk,
      compilerSource,
      source,
      xcrun,
    });
    assertNoPendingProducerSignal(pendingSignal);
    const signatureArguments = Object.freeze([
      '--force',
      '--sign',
      '-',
      '--timestamp=none',
      candidatePath,
    ]);
    await injectDa5V5ProducerBindingPoison(
      options,
      'signature',
      processVerifier,
    );
    runBuildPhase(
      processVerifier.canonicalPath,
      signatureArguments,
      phaseEnvironment,
    );
    await revalidateArtifactFile(processVerifier);
    assertNoPendingProducerSignal(pendingSignal);
    await chmod(candidatePath, 0o555);
    const binaryBytes = await readFile(candidatePath);
    await injectDa5V5ProducerBindingPoison(
      options,
      'load-dependency-inspector',
      loadDependencyInspector,
    );
    await injectDa5V5ProducerBindingPoison(
      options,
      'operating-system-inspector',
      operatingSystemInspector,
    );
    await injectDa5V5ProducerBindingPoison(
      options,
      'process-inspector',
      processVerifier,
    );
    await Promise.all([
      revalidateArtifactFile(loadDependencyInspector),
      revalidateArtifactFile(operatingSystemInspector),
      revalidateArtifactFile(processVerifier),
    ]);
    const compilerVersion = await boundedArtifactOutput(
      compiler,
      ['--version'],
    );
    const linkerVersion = await boundedArtifactCombinedOutput(
      linker,
      ['-v'],
    );
    const sdkBuildVersion = await boundedArtifactOutput(xcrun, [
      '--sdk',
      'macosx',
      '--show-sdk-build-version',
    ]);
    const sdkVersion = await boundedArtifactOutput(xcrun, [
      '--sdk',
      'macosx',
      '--show-sdk-version',
    ]);
    const manifest: Da5V5RuntimeGuardManifest = Object.freeze({
      architecture: arch(),
      binary: Object.freeze({
        format: executableFormat(binaryBytes),
        loadDependencies: Object.freeze(loadDependencies(
          candidatePath,
          loadDependencyInspector.canonicalPath,
        )),
        loadDependencyInputs: Object.freeze([
          linkInputFiles[1] as BoundArtifactFile,
        ]),
        magicHex: binaryBytes.subarray(0, 8).toString('hex'),
        mode: '0555',
        path: binaryPath,
        sha256: sha256(binaryBytes),
        signature: executableSignature(
          candidatePath,
          processVerifier.canonicalPath,
        ),
        size: binaryBytes.byteLength,
      }),
      build: Object.freeze({
        commandSha256: sha256(Buffer.from(
          `${clangPath}\0${compilerArguments.join('\0')}\0`
          + `${linkerPath}\0${linkerArguments.join('\0')}\0`
          + `${processVerifier.canonicalPath}\0`
          + signatureArguments.join('\0'),
        )),
        compilerArguments,
        linkerArguments,
        mode: 'separate-cc1-and-direct-linker',
        signatureArguments,
        testResult: `passed:${testEvidence.sha256}`,
        umask: '0077',
      }),
      implementation: Object.freeze({
        commit: implementationCommit,
        repositoryRoot,
        tree: implementationTree,
      }),
      operatingSystem: Object.freeze({
        build: operatingSystemBuild(
          operatingSystemInspector.canonicalPath,
        ),
        platform: platform(),
        release: release(),
      }),
      source,
      toolchain: Object.freeze({
        compiler,
        compilerResourceDirectory,
        compilerVersion,
        git,
        includeDirectories: Object.freeze(includeDirectories),
        inputFiles,
        linkInputFiles,
        linker,
        linkerVersion,
        loadDependencyInspector,
        operatingSystemInspector,
        processVerifier,
        sdk,
        sdkBuildVersion,
        sdkVersion,
        startObjects: Object.freeze([]),
        startObjectMode: 'platform-linker-default-none',
        sysroot: sdk,
        target: 'arm64-apple-macosx26.0.0',
        xcrun,
      }),
    });
    await revalidateProducerInputs({
      compiler,
      compilerResourceDirectory,
      git,
      includeDirectories,
      linker,
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk,
      compilerSource,
      source,
      xcrun,
    });
    await revalidateArtifactFile(testEvidence);
    await Promise.all(linkInputFiles.map(revalidateArtifactFile));
    assertNoPendingProducerSignal(pendingSignal);
    const manifestBytes = Buffer.from(formatManifest(manifest));
    await writeFile(manifestCandidatePath, manifestBytes, {
      flag: 'wx',
      mode: 0o444,
    });
    await chmod(manifestCandidatePath, 0o444);
    await revalidateProducerInputs({
      compiler,
      compilerResourceDirectory,
      git,
      includeDirectories,
      linker,
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk,
      compilerSource,
      source,
      xcrun,
    });
    await revalidateArtifactFile(testEvidence);
    await Promise.all(linkInputFiles.map(revalidateArtifactFile));
    assertNoPendingProducerSignal(pendingSignal);
    await link(candidatePath, binaryPath);
    binaryPublished = true;
    assertNoPendingProducerSignal(pendingSignal);
    await revalidateProducerInputs({
      compiler,
      compilerResourceDirectory,
      git,
      includeDirectories,
      linker,
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk,
      compilerSource,
      source,
      xcrun,
    });
    await revalidateArtifactFile(testEvidence);
    await Promise.all(linkInputFiles.map(revalidateArtifactFile));
    assertNoPendingProducerSignal(pendingSignal);
    await link(manifestCandidatePath, manifestPath);
    manifestPublished = true;
    assertNoPendingProducerSignal(pendingSignal);
    await Promise.all([
      unlink(candidatePath),
      unlink(manifestCandidatePath),
      unlink(objectPath),
      unlink(dependencyPath),
      unlink(compilerSourcePath),
    ]);
    await rmdir(workRoot);
    return Object.freeze({
      binaryPath,
      manifest,
      manifestPath,
      manifestSha256: sha256(manifestBytes),
    });
  } catch (error) {
    if (manifestPublished) {
      await unlink(manifestPath).catch(() => undefined);
    }
    if (binaryPublished) {
      await unlink(binaryPath).catch(() => undefined);
    }
    await Promise.all([
      unlink(candidatePath).catch(() => undefined),
      unlink(manifestCandidatePath).catch(() => undefined),
      unlink(objectPath).catch(() => undefined),
      unlink(dependencyPath).catch(() => undefined),
      unlink(compilerSourcePath).catch(() => undefined),
      unlink(discoveryObjectPath).catch(() => undefined),
      unlink(discoveryDependencyPath).catch(() => undefined),
    ]);
    await rmdir(workRoot).catch(() => undefined);
    throw error;
  } finally {
    process.off('SIGINT', handleSigint);
    process.off('SIGTERM', handleSigterm);
    process.off('SIGHUP', handleSighup);
    process.umask(previousUmask);
  }
}

export function assertClosedToolchainEnvironment(
  environment: NodeJS.ProcessEnv,
): void {
  if (Object.keys(environment).some((name) => (
    rejectedEnvironmentPatterns.some((pattern) => pattern.test(name))
  ))) {
    throw new Error('DA5 V5 inherited toolchain/runtime environment is rejected');
  }
}

export function runDa5V5ArtifactBuildPhaseForTest(options: {
  readonly args: readonly string[];
  readonly binary: string;
  readonly timeoutMs: number;
}): void {
  if (
    process.env.NODE_ENV !== 'test'
    || process.env.VITEST !== 'true'
    || !Number.isSafeInteger(options.timeoutMs)
    || options.timeoutMs < 1
    || options.timeoutMs > 1_000
  ) {
    throw new Error('DA5 V5 Runtime Guard build-phase test authority is invalid');
  }
  runBuildPhase(
    options.binary,
    options.args,
    Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    options.timeoutMs,
  );
}

export async function revalidateDa5V5ProducerInputForTest(options: {
  readonly kind: 'directory' | 'file';
  readonly mutate: () => Promise<void>;
  readonly path: string;
  readonly trust?: ArtifactTrust;
}): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || process.env.VITEST !== 'true') {
    throw new Error('DA5 V5 producer-input test authority is invalid');
  }
  const trust = options.trust ?? 'same-euid-private';
  if (options.kind === 'file') {
    const binding = await bindArtifactFile(options.path, trust);
    await options.mutate();
    await revalidateArtifactFile(binding);
    return;
  }
  const binding = await bindArtifactPath(options.path, trust);
  await options.mutate();
  await revalidateArtifactPath(binding);
}

export function assertDa5V5ProducerPublicationSignalForTest(
  signal: NodeJS.Signals | null,
): void {
  if (process.env.NODE_ENV !== 'test' || process.env.VITEST !== 'true') {
    throw new Error('DA5 V5 producer-signal test authority is invalid');
  }
  assertNoPendingProducerSignal(signal);
}

function runBuildPhase(
  binary: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>>,
  timeoutMs = 20_000,
): void {
  const result = spawnSync(binary, args, {
    cwd: '/',
    env: environment,
    shell: false,
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    throw new Error('DA5 V5 Runtime Guard build phase failed');
  }
}

function boundedOutput(binary: string, args: readonly string[]): string {
  const result = boundedSpawn(binary, args, 'utf8');
  return (result as string).trim();
}

function boundedCombinedOutput(binary: string, args: readonly string[]): string {
  const result = spawnSync(binary, args, {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 1_048_576,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
  ) {
    throw new Error('DA5 V5 bounded toolchain identity call failed');
  }
  return `${result.stdout}${result.stderr}`.trim();
}

function boundedBuffer(binary: string, args: readonly string[]): Buffer {
  return boundedSpawn(binary, args, 'buffer') as Buffer;
}

function boundedSpawn(
  binary: string,
  args: readonly string[],
  encoding: 'buffer' | 'utf8',
): Buffer | string {
  const result = spawnSync(binary, args, {
    cwd: '/',
    encoding: encoding === 'utf8' ? 'utf8' : undefined,
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 1_048_576,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  const stderr = Buffer.isBuffer(result.stderr)
    ? result.stderr.toString('utf8')
    : result.stderr;
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
    || stderr.trim().length > 0
  ) {
    throw new Error('DA5 V5 bounded toolchain identity call failed');
  }
  return result.stdout;
}

async function bindArtifactFile(
  path: string,
  trust: ArtifactTrust,
): Promise<BoundArtifactFile> {
  const canonicalPath = await requireAbsoluteCanonicalPath(path);
  const handle = await openNoFollow(canonicalPath);
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile()
      || before.size <= 0n
      || before.size > 1_073_741_824n
    ) {
      throw new Error('DA5 V5 artifact provenance file mismatch');
    }
    assertSafeProducerIdentity(before, false, trust);
    const header = Buffer.alloc(8);
    const headerRead = await handle.read(header, 0, header.byteLength, 0);
    if (headerRead.bytesRead < 4) {
      throw new Error('DA5 V5 artifact provenance file mismatch');
    }
    const digest = await hashExactHandle(handle, before.size);
    const after = await handle.stat({ bigint: true });
    assertStableBigIntIdentity(before, after);
    return Object.freeze({
      ...(await boundArtifactState(canonicalPath, before, trust)),
      platformSignature: await platformFileSignature(
        canonicalPath,
        header.subarray(0, headerRead.bytesRead),
        trust,
      ),
      sha256: digest,
    });
  } finally {
    await handle.close();
  }
}

async function bindArtifactPath(
  path: string,
  trust: ArtifactTrust,
): Promise<BoundArtifactPath> {
  const canonicalPath = await requireAbsoluteCanonicalPath(path);
  const state = await lstat(canonicalPath, { bigint: true });
  if (!state.isDirectory()) {
    throw new Error('DA5 V5 artifact provenance directory mismatch');
  }
  assertSafeProducerIdentity(state, true, trust);
  return boundArtifactState(canonicalPath, state, trust);
}

async function boundArtifactState(
  canonicalPath: string,
  state: Awaited<ReturnType<FileHandle['stat']>>,
  trust: ArtifactTrust,
): Promise<BoundArtifactPath> {
  const stateRecord = {
    canonicalPath,
    dev: state.dev.toString(),
    gid: Number(state.gid),
    ino: state.ino.toString(),
    mode: (Number(state.mode) & 0o7777).toString(8).padStart(4, '0'),
    size: state.size.toString(),
    trust,
    uid: Number(state.uid),
  };
  return Object.freeze({
    ...stateRecord,
    identitySha256: sha256(Buffer.from(JSON.stringify(stateRecord))),
  });
}

async function revalidateProducerInputs(inputs: {
  readonly compiler: BoundArtifactFile;
  readonly compilerSource: BoundArtifactFile;
  readonly compilerResourceDirectory: BoundArtifactPath;
  readonly git: BoundArtifactFile;
  readonly includeDirectories: readonly BoundArtifactPath[];
  readonly linker: BoundArtifactFile;
  readonly loadDependencyInspector: BoundArtifactFile;
  readonly operatingSystemInspector: BoundArtifactFile;
  readonly processVerifier: BoundArtifactFile;
  readonly sdk: BoundArtifactPath;
  readonly source: BoundArtifactFile;
  readonly xcrun: BoundArtifactFile;
}): Promise<void> {
  await Promise.all([
    revalidateArtifactFile(inputs.compiler),
    revalidateArtifactFile(inputs.compilerSource),
    revalidateArtifactPath(inputs.compilerResourceDirectory),
    revalidateArtifactFile(inputs.git),
    ...inputs.includeDirectories.map(revalidateArtifactPath),
    revalidateArtifactFile(inputs.linker),
    revalidateArtifactFile(inputs.loadDependencyInspector),
    revalidateArtifactFile(inputs.operatingSystemInspector),
    revalidateArtifactFile(inputs.processVerifier),
    revalidateArtifactPath(inputs.sdk),
    revalidateArtifactFile(inputs.source),
    revalidateArtifactFile(inputs.xcrun),
  ]);
}

async function boundedArtifactOutput(
  binary: BoundArtifactFile,
  args: readonly string[],
): Promise<string> {
  await revalidateArtifactFile(binary);
  const result = boundedOutput(binary.canonicalPath, args);
  await revalidateArtifactFile(binary);
  return result;
}

async function boundedArtifactCombinedOutput(
  binary: BoundArtifactFile,
  args: readonly string[],
): Promise<string> {
  await revalidateArtifactFile(binary);
  const result = boundedCombinedOutput(binary.canonicalPath, args);
  await revalidateArtifactFile(binary);
  return result;
}

async function boundedArtifactBuffer(
  binary: BoundArtifactFile,
  args: readonly string[],
): Promise<Buffer> {
  await revalidateArtifactFile(binary);
  const result = boundedBuffer(binary.canonicalPath, args);
  await revalidateArtifactFile(binary);
  return result;
}

function normalizeCompilerInputPaths(
  inputs: readonly string[],
  compilerSourcePath: string,
  reviewedSourcePath: string,
): readonly string[] {
  const normalized = inputs.map((input) => (
    input === compilerSourcePath ? reviewedSourcePath : input
  ));
  if (
    !inputs.includes(compilerSourcePath)
    || normalized.includes(compilerSourcePath)
  ) {
    throw new Error('DA5 V5 Runtime Guard private compiler source is unbound');
  }
  return Object.freeze([...new Set(normalized)].sort());
}

async function parseDependencyManifest(path: string): Promise<readonly string[]> {
  const contents = await readFile(path, 'utf8');
  const separator = contents.indexOf(':');
  if (separator < 1) {
    throw new Error('DA5 V5 Runtime Guard compiler dependency manifest failed');
  }
  const dependencies = contents
    .slice(separator + 1)
    .replaceAll('\\\n', ' ')
    .trim()
    .split(/\s+/u)
    .map((entry) => entry.replaceAll('\\ ', ' '))
    .filter(Boolean);
  const canonical = await Promise.all(
    dependencies.map(requireAbsoluteCanonicalPath),
  );
  const uniqueSorted = [...new Set(canonical)].sort();
  if (uniqueSorted.length === 0 || !uniqueSorted.includes(
    await requireAbsoluteCanonicalPath(
      dependencies.find((dependency) => dependency.endsWith(
        'da5_v5_runtime_guard.c',
      )) ?? '',
    ),
  )) {
    throw new Error('DA5 V5 Runtime Guard compiler dependency manifest failed');
  }
  return Object.freeze(uniqueSorted);
}

async function revalidateArtifactFile(expected: BoundArtifactFile): Promise<void> {
  const actual = await bindArtifactFile(expected.canonicalPath, expected.trust);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('DA5 V5 artifact producer input changed');
  }
}

async function revalidateArtifactPath(expected: BoundArtifactPath): Promise<void> {
  const actual = await bindArtifactPath(expected.canonicalPath, expected.trust);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('DA5 V5 artifact producer path changed');
  }
}

async function injectDa5V5ProducerBindingPoison(
  options: {
    readonly testOnlyPoisonIndex?: number;
    readonly testOnlyPoisonPath?: string;
    readonly testOnlyPoisonStage?: Da5V5ProducerPoisonStage;
  },
  stage: Da5V5ProducerPoisonStage,
  binding: BoundArtifactFile | BoundArtifactPath,
  index = 0,
): Promise<void> {
  if (
    options.testOnlyPoisonStage !== stage
    || (options.testOnlyPoisonIndex ?? 0) !== index
  ) {
    return;
  }
  if (options.testOnlyPoisonPath === undefined) {
    throw new Error('DA5 V5 producer poison path is unavailable');
  }
  const resolvedPoisonPath = await requireAbsoluteCanonicalPath(
    options.testOnlyPoisonPath,
  );
  if ('platformSignature' in binding) {
    const actual = await bindArtifactFile(resolvedPoisonPath, binding.trust);
    if (JSON.stringify(actual) !== JSON.stringify(binding)) {
      throw new Error('DA5 V5 artifact producer input changed');
    }
  } else {
    const actual = await bindArtifactPath(resolvedPoisonPath, binding.trust);
    if (JSON.stringify(actual) !== JSON.stringify(binding)) {
      throw new Error('DA5 V5 artifact producer path changed');
    }
  }
  throw new Error('DA5 V5 producer poison was not detected');
}

function assertNoPendingProducerSignal(signal: NodeJS.Signals | null): void {
  if (signal !== null) {
    throw new Error('DA5 V5 Runtime Guard artifact production interrupted');
  }
}

async function platformFileSignature(
  path: string,
  bytes: Buffer,
  trust: ArtifactTrust,
): Promise<string> {
  try {
    executableFormat(bytes);
  } catch {
    return 'not-executable';
  }
  try {
    return executableSignature(path);
  } catch (error) {
    if (trust === 'same-euid-private') {
      return 'unsigned-private-build-input';
    }
    throw error;
  }
}

function formatManifest(manifest: Da5V5RuntimeGuardManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseManifest(value: string): Da5V5RuntimeGuardManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('DA5 V5 Runtime Guard manifest is malformed');
  }
  if (!isRecord(parsed)) {
    throw new Error('DA5 V5 Runtime Guard manifest is incomplete');
  }
  const manifest = parsed as unknown as Da5V5RuntimeGuardManifest;
  if (
    !isRecord(manifest.binary)
    || !isRecord(manifest.build)
    || !isRecord(manifest.implementation)
    || !isRecord(manifest.operatingSystem)
    || !isRecord(manifest.source)
    || !isRecord(manifest.toolchain)
    || !Array.isArray(manifest.binary.loadDependencies)
    || !Array.isArray(manifest.binary.loadDependencyInputs)
    || !Array.isArray(manifest.build.compilerArguments)
    || !Array.isArray(manifest.build.linkerArguments)
    || !Array.isArray(manifest.build.signatureArguments)
    || !Array.isArray(manifest.toolchain.includeDirectories)
    || !Array.isArray(manifest.toolchain.inputFiles)
    || !Array.isArray(manifest.toolchain.linkInputFiles)
    || !Array.isArray(manifest.toolchain.startObjects)
    || !isRecord(manifest.toolchain.git)
    || !isRecord(manifest.toolchain.loadDependencyInspector)
    || !isRecord(manifest.toolchain.operatingSystemInspector)
    || !isRecord(manifest.toolchain.processVerifier)
    || !/^[a-f0-9]{64}$/u.test(String(manifest.binary.sha256))
    || !/^[a-f0-9]{64}$/u.test(String(manifest.source.sha256))
    || !/^[a-f0-9]{40}$/u.test(String(manifest.implementation.commit))
    || !/^[a-f0-9]{40}$/u.test(String(manifest.implementation.tree))
    || manifest.build.mode !== 'separate-cc1-and-direct-linker'
    || manifest.build.umask !== '0077'
    || manifest.toolchain.target !== 'arm64-apple-macosx26.0.0'
  ) {
    throw new Error('DA5 V5 Runtime Guard manifest is incomplete');
  }
  return deepFreeze(manifest);
}

function loadDependencies(
  path: string,
  inspector = platform() === 'darwin' ? '/usr/bin/otool' : '/usr/bin/ldd',
): readonly string[] {
  if (platform() === 'darwin') {
    return Object.freeze(
      boundedOutput(inspector, ['-L', path])
        .split('\n')
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }
  return Object.freeze(
    boundedOutput(inspector, [path])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

function operatingSystemBuild(
  inspector = '/usr/bin/sw_vers',
): string {
  return platform() === 'darwin'
    ? boundedOutput(inspector, ['-buildVersion'])
    : release();
}

function executableSignature(
  path: string,
  verifier = '/usr/bin/codesign',
): string {
  if (platform() !== 'darwin') {
    return 'not-applicable';
  }
  const result = spawnSync(verifier, [
    '--display',
    '--verbose=4',
    path,
  ], {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 65_536,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  if (
    result.error !== undefined
    || result.signal !== null
    || result.status !== 0
  ) {
    throw new Error('DA5 V5 Runtime Guard signature mismatch');
  }
  const verification = spawnSync(verifier, [
    '--verify',
    '--strict',
    '--verbose=4',
    path,
  ], {
    cwd: '/',
    encoding: 'utf8',
    env: Object.freeze({ HOME: '/var/empty', PATH: '/usr/bin:/bin', TZ: 'UTC' }),
    maxBuffer: 65_536,
    shell: false,
    timeout: 5_000,
    killSignal: 'SIGKILL',
  });
  if (
    verification.error !== undefined
    || verification.signal !== null
    || verification.status !== 0
  ) {
    throw new Error('DA5 V5 Runtime Guard signature mismatch');
  }
  return [result.stdout, result.stderr]
    .join('')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('Executable='))
    .sort()
    .join('\n');
}

function executableFormat(bytes: Buffer): 'ELF' | 'Mach-O' {
  if (
    bytes.byteLength >= 4
    && bytes[0] === 0x7f
    && bytes[1] === 0x45
    && bytes[2] === 0x4c
    && bytes[3] === 0x46
  ) {
    return 'ELF';
  }
  const magic = bytes.subarray(0, 4).toString('hex');
  if (['cffaedfe', 'feedfacf', 'cafebabe', 'bebafeca'].includes(magic)) {
    return 'Mach-O';
  }
  throw new Error('DA5 V5 Runtime Guard executable format mismatch');
}

async function readExactHandle(
  handle: FileHandle,
  size: number,
): Promise<Buffer> {
  if (!Number.isSafeInteger(size) || size <= 0 || size > 16_777_216) {
    throw new Error('DA5 V5 Runtime Guard artifact size is invalid');
  }
  const bytes = Buffer.allocUnsafe(size);
  let position = 0;
  while (position < size) {
    const read = await handle.read(bytes, position, size - position, position);
    if (read.bytesRead <= 0) {
      throw new Error('DA5 V5 Runtime Guard artifact read is incomplete');
    }
    position += read.bytesRead;
  }
  return bytes;
}

async function hashExactHandle(
  handle: FileHandle,
  size: bigint,
): Promise<string> {
  if (size <= 0n || size > 1_073_741_824n) {
    throw new Error('DA5 V5 Runtime Guard provenance size is invalid');
  }
  const digest = createHash('sha256');
  const chunk = Buffer.allocUnsafe(1_048_576);
  let offset = 0n;
  while (offset < size) {
    const remaining = size - offset;
    const requested = Number(
      remaining < BigInt(chunk.byteLength)
        ? remaining
        : BigInt(chunk.byteLength),
    );
    const result = await handle.read(
      chunk,
      0,
      requested,
      Number(offset),
    );
    if (result.bytesRead !== requested) {
      throw new Error('DA5 V5 Runtime Guard provenance read is incomplete');
    }
    digest.update(chunk.subarray(0, requested));
    offset += BigInt(requested);
  }
  return digest.digest('hex');
}

function openNoFollow(path: string): Promise<FileHandle> {
  return open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
}

async function requireAbsoluteCanonicalPath(path: string): Promise<string> {
  if (!path.startsWith('/')) {
    throw new Error('DA5 V5 Runtime Guard path must be absolute');
  }
  const canonical = await realpath(path);
  if (canonical !== path) {
    throw new Error('DA5 V5 Runtime Guard path must be canonical');
  }
  return canonical;
}

function assertStableIdentity(
  before: Awaited<ReturnType<FileHandle['stat']>>,
  after: Awaited<ReturnType<FileHandle['stat']>>,
): void {
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.uid !== after.uid
    || before.gid !== after.gid
    || before.mode !== after.mode
    || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs
  ) {
    throw new Error('DA5 V5 Runtime Guard stable-FD identity changed');
  }
}

function assertStableBigIntIdentity(
  before: Awaited<ReturnType<FileHandle['stat']>>,
  after: Awaited<ReturnType<FileHandle['stat']>>,
): void {
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.uid !== after.uid
    || before.gid !== after.gid
    || before.mode !== after.mode
    || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs
  ) {
    throw new Error('DA5 V5 Runtime Guard provenance identity changed');
  }
}

function requireSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error('DA5 V5 Runtime Guard expected digest is invalid');
  }
}

function requireCdHash(value: string): string {
  const match = /^CDHash=([a-f0-9]{40,64})$/mu.exec(value);
  if (match?.[1] === undefined) {
    throw new Error('DA5 V5 Runtime Guard CDHash is unavailable');
  }
  return match[1];
}

function requireProcessId(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('DA5 V5 Runtime Guard process identity is invalid');
  }
  return value;
}

function assertSafeProducerIdentity(
  state: Awaited<ReturnType<FileHandle['stat']>>,
  directory: boolean,
  trust: ArtifactTrust,
): void {
  const mode = Number(state.mode) & 0o7777;
  if (
    (
      trust === 'root-system'
        ? Number(state.uid) !== 0
        : Number(state.uid) !== effectiveUid()
    )
    || (mode & 0o022) !== 0
    || (directory && (mode & 0o100) === 0)
  ) {
    throw new Error('DA5 V5 artifact producer owner or mode mismatch');
  }
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function effectiveUid(): number {
  if (process.geteuid === undefined) {
    throw new Error('DA5 V5 Runtime Guard requires a POSIX effective UID');
  }
  return process.geteuid();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}
