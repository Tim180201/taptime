import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  chmod,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { arch, platform, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildDa5V5TemporaryTestGuard,
  assertDa5V5ProducerPublicationSignalForTest,
  describeDa5V5RuntimeGuardBinaryForTest,
  revalidateDa5V5ProducerInputForTest,
  produceDa5V5RuntimeGuardArtifact,
  runDa5V5ArtifactBuildPhaseForTest,
  verifyDa5V5RuntimeGuardArtifact,
  verifyDa5V5RuntimeGuardRunningProcessForTest,
  type Da5V5RuntimeGuardManifest,
  type Da5V5ProducerPoisonStage,
} from '../src/Da5V5RuntimeGuardArtifact.js';

const sourcePath = fileURLToPath(new URL(
  '../native/da5_v5_runtime_guard.c',
  import.meta.url,
));

describe('DA5 V5 Runtime Guard stable artifact binding', () => {
  it.runIf(process.platform === 'darwin')(
    'binds the actual running guest CDHash and rejects mismatch or exited guests',
    async () => {
      const running = spawn('/bin/sleep', ['10'], {
        env: {},
        shell: false,
        stdio: 'ignore',
      });
      await once(running, 'spawn');
      try {
        await expect(verifyDa5V5RuntimeGuardRunningProcessForTest({
          binaryPath: '/bin/sleep',
          pid: running.pid as number,
        })).resolves.toBeUndefined();
        await expect(verifyDa5V5RuntimeGuardRunningProcessForTest({
          binaryPath: '/bin/sleep',
          expectedCdHash: '0'.repeat(40),
          pid: running.pid as number,
        })).rejects.toThrow(/running process identity mismatch/);
      } finally {
        running.kill('SIGTERM');
        await once(running, 'exit');
      }

      const exited = spawn('/usr/bin/true', [], {
        env: {},
        shell: false,
        stdio: 'ignore',
      });
      await once(exited, 'exit');
      await expect(verifyDa5V5RuntimeGuardRunningProcessForTest({
        binaryPath: '/usr/bin/true',
        pid: exited.pid as number,
      })).rejects.toThrow(/running process identity mismatch/);
    },
  );

  it('classifies build success and fail-closes on error, signal and timeout', () => {
    expect(() => runDa5V5ArtifactBuildPhaseForTest({
      args: [],
      binary: '/usr/bin/true',
      timeoutMs: 100,
    })).not.toThrow();

    const failures = [
      {
        args: [],
        binary: '/usr/bin/false',
        timeoutMs: 100,
      },
      {
        args: ['-e', "process.kill(process.pid, 'SIGTERM')"],
        binary: process.execPath,
        timeoutMs: 100,
      },
      {
        args: ['1'],
        binary: '/bin/sleep',
        timeoutMs: 10,
      },
      {
        args: [],
        binary: '/definitely/absent/da5-v5-tool',
        timeoutMs: 100,
      },
    ] as const;
    for (const failure of failures) {
      expect(() => runDa5V5ArtifactBuildPhaseForTest(failure)).toThrow(
        /build phase failed/,
      );
    }
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    'blocks %s immediately before producer publication',
    (signal) => {
      expect(() => assertDa5V5ProducerPublicationSignalForTest(signal)).toThrow(
        /artifact production interrupted/,
      );
    },
  );

  it('rejects deterministic producer file and path replacements', async () => {
    const root = await realpath(await mkdtemp(
      join(tmpdir(), 'taptime-da5-producer-input-'),
    ));
    try {
      for (const label of ['source-input', 'linker-executable'] as const) {
        const path = join(root, label);
        const displaced = `${path}.displaced`;
        await writeFile(path, `bound-${label}`, { flag: 'wx', mode: 0o600 });
        await expect(revalidateDa5V5ProducerInputForTest({
          kind: 'file',
          mutate: async () => {
            await rename(path, displaced);
            await writeFile(path, `replacement-${label}`, {
              flag: 'wx',
              mode: 0o600,
            });
          },
          path,
        })).rejects.toThrow(/producer input changed/);
      }

      const directory = join(root, 'include-directory');
      const displacedDirectory = `${directory}.displaced`;
      await mkdir(directory, { mode: 0o700 });
      await expect(revalidateDa5V5ProducerInputForTest({
        kind: 'directory',
        mutate: async () => {
          await rename(directory, displacedDirectory);
          await mkdir(directory, { mode: 0o700 });
        },
        path: directory,
      })).rejects.toThrow(/producer path changed/);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('binds private compile input and complete link/load/start provenance before publication',
    async () => {
      const source = await readFile(
        new URL('../src/Da5V5RuntimeGuardArtifact.ts', import.meta.url),
        'utf8',
      );
      const producer = source.slice(
        source.indexOf('export async function produceDa5V5RuntimeGuardArtifact('),
        source.indexOf('export function assertClosedToolchainEnvironment('),
      );
      expect(producer).toContain(
        "const compilerSourcePath = join(workRoot, 'da5_v5_runtime_guard.c')",
      );
      expect(producer).toContain(
        "await writeFile(compilerSourcePath, committedSource",
      );
      expect(producer).toContain(
        "compilerSourcePath,\n    'same-euid-private'",
      );
      expect(producer).toContain('normalizeCompilerInputPaths(');
      const linkInputs = producer.indexOf(
        'const linkInputFiles = Object.freeze([',
      );
      const linkerRun = producer.indexOf(
        'runBuildPhase(linkerPath, linkerArguments, phaseEnvironment)',
      );
      expect(linkInputs).toBeGreaterThan(0);
      expect(linkInputs).toBeLessThan(linkerRun);
      expect(producer).toContain(
        'await Promise.all(linkInputFiles.map(revalidateArtifactFile))',
      );
      expect(producer).toContain('loadDependencyInputs: Object.freeze([');
      expect(producer).toContain('startObjects: Object.freeze([])');
      expect(producer).toContain("startObjectMode: 'platform-linker-default-none'");
      expect(producer).toContain(
        'build: operatingSystemBuild(\n'
        + '          operatingSystemInspector.canonicalPath',
      );
      const binaryPublication = producer.indexOf(
        'await link(candidatePath, binaryPath)',
      );
      const manifestPublication = producer.indexOf(
        'await link(manifestCandidatePath, manifestPath)',
      );
      const publicationRevalidations = [...producer.matchAll(
        /await revalidateProducerInputs\(\{/gu,
      )].map(({ index }) => index);
      expect(publicationRevalidations.some(
        (index) => index < binaryPublication && index > linkerRun,
      )).toBe(true);
      expect(publicationRevalidations.some(
        (index) => index < manifestPublication && index > binaryPublication,
      )).toBe(true);
      expect(producer.match(/assertNoPendingProducerSignal\(pendingSignal\)/gu))
        .not.toBeNull();
    });

  it.runIf(process.platform === 'darwin' && process.arch === 'arm64')(
    'executes the complete root-bound producer through separate compile and link phases',
    async () => {
      const root = await realpath(await mkdtemp(
        join(tmpdir(), 'taptime-da5-full-producer-'),
      ));
      const outputDirectory = join(root, 'artifact');
      const testEvidencePath = join(root, 'focused-evidence.json');
      const testEvidence = Buffer.from('{"passed":true}\n');
      const repositoryRoot = join(root, 'repository');
      const nativeRoot = join(repositoryRoot, 'native');
      const fixtureSourcePath = join(nativeRoot, 'da5_v5_runtime_guard.c');
      await mkdir(nativeRoot, { recursive: true, mode: 0o700 });
      await writeFile(fixtureSourcePath, await readFile(sourcePath), {
        flag: 'wx',
        mode: 0o400,
      });
      await writeFile(testEvidencePath, testEvidence, {
        flag: 'wx',
        mode: 0o400,
      });
      for (const arguments_ of [
        ['init', '--quiet'],
        ['add', '--', 'native/da5_v5_runtime_guard.c'],
        [
          '-c',
          'user.name=TapTim.e Test',
          '-c',
          'user.email=synthetic@example.invalid',
          'commit',
          '--quiet',
          '-m',
          'synthetic runtime guard fixture',
        ],
      ]) {
        const result = spawnSync('/usr/bin/git', [
          '-C',
          repositoryRoot,
          ...arguments_,
        ], { encoding: 'utf8' });
        if (result.status !== 0) {
          throw new Error('DA5 V5 full producer Git fixture failed');
        }
      }
      const implementationCommit = String(spawnSync('/usr/bin/git', [
        '-C',
        repositoryRoot,
        'rev-parse',
        'HEAD',
      ], { encoding: 'utf8' }).stdout).trim();
      const implementationTree = String(spawnSync('/usr/bin/git', [
        '-C',
        repositoryRoot,
        'rev-parse',
        'HEAD^{tree}',
      ], { encoding: 'utf8' }).stdout).trim();
      try {
        const produced = await produceDa5V5RuntimeGuardArtifact({
          environment: {},
          expectedTestEvidenceSha256: sha256(testEvidence),
          implementationCommit,
          implementationTree,
          outputDirectory,
          sourcePath: fixtureSourcePath,
          testEvidencePath,
          testOnlyOutputBoundary: true,
        });
        expect(produced.manifest.build.mode)
          .toBe('separate-cc1-and-direct-linker');
        expect(produced.manifest.toolchain.compiler.trust).toBe('root-system');
        expect(produced.manifest.toolchain.linker.trust).toBe('root-system');
        expect(produced.manifest.toolchain.xcrun.trust).toBe('root-system');
        expect(produced.manifest.toolchain.sdk.trust).toBe('root-system');
        expect(produced.manifest.source.trust).toBe('same-euid-private');
        expect(produced.manifest.toolchain.inputFiles.every((input) => (
          input.canonicalPath === fixtureSourcePath
            ? input.trust === 'same-euid-private'
            : input.trust === 'root-system'
        ))).toBe(true);
        expect(produced.manifest.toolchain.linkInputFiles.map(
          ({ trust }) => trust,
        )).toEqual(['same-euid-private', 'root-system']);
        expect((await stat(produced.binaryPath)).mode & 0o777).toBe(0o555);
        expect((await stat(produced.manifestPath)).mode & 0o777).toBe(0o444);

        const poisonFile = join(root, 'private-poison-file');
        const poisonDirectory = join(root, 'private-poison-directory');
        await writeFile(poisonFile, 'private poison fixture', {
          flag: 'wx',
          mode: 0o400,
        });
        await mkdir(poisonDirectory, { mode: 0o700 });
        const fileStages: readonly Da5V5ProducerPoisonStage[] = [
          'git-inspector',
          'source',
          'xcrun',
          'compiler',
          'linker',
          'link-object-input',
          'link-libsystem-input',
          'signature',
          'load-dependency-inspector',
          'operating-system-inspector',
          'process-inspector',
        ];
        const poisonCases: {
          readonly index: number;
          readonly path: string;
          readonly stage: Da5V5ProducerPoisonStage;
        }[] = fileStages.map((stage) => ({
          index: 0,
          path: poisonFile,
          stage,
        }));
        poisonCases.push(
          {
            index: 0,
            path: poisonDirectory,
            stage: 'sdk-sysroot',
          },
          {
            index: 0,
            path: poisonDirectory,
            stage: 'compiler-resource-directory',
          },
          ...produced.manifest.toolchain.includeDirectories.map(
            (_directory, index) => ({
              index,
              path: poisonDirectory,
              stage: 'include-directory' as const,
            }),
          ),
          ...produced.manifest.toolchain.inputFiles.map((_input, index) => ({
            index,
            path: poisonFile,
            stage: 'compiler-input' as const,
          })),
        );
        for (const poisonCase of poisonCases) {
          const poisonedOutput = join(
            root,
            `poison-${poisonCase.stage}-${poisonCase.index}`,
          );
          await expect(produceDa5V5RuntimeGuardArtifact({
            environment: {},
            expectedTestEvidenceSha256: sha256(testEvidence),
            implementationCommit,
            implementationTree,
            outputDirectory: poisonedOutput,
            sourcePath: fixtureSourcePath,
            testEvidencePath,
            testOnlyOutputBoundary: true,
            testOnlyPoisonIndex: poisonCase.index,
            testOnlyPoisonPath: poisonCase.path,
            testOnlyPoisonStage: poisonCase.stage,
          })).rejects.toThrow(
            /artifact producer (?:input changed|path changed|owner or mode mismatch)/,
          );
          await expect(stat(join(poisonedOutput, 'da5_v5_runtime_guard')))
            .rejects.toThrow();
          await expect(stat(join(poisonedOutput, 'guard-manifest.txt')))
            .rejects.toThrow();
        }
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    },
  );

  it('requires strict root ownership for system producer inputs', async () => {
    const root = await realpath(await mkdtemp(
      join(tmpdir(), 'taptime-da5-system-trust-'),
    ));
    const privateInput = join(root, 'fake-system-input');
    await writeFile(privateInput, 'same-euid', { flag: 'wx', mode: 0o500 });
    try {
      const rootSystemInput = platform() === 'darwin'
        ? '/usr/bin/codesign'
        : await realpath('/usr/bin/cc');
      await expect(revalidateDa5V5ProducerInputForTest({
        kind: 'file',
        mutate: async () => undefined,
        path: privateInput,
        trust: 'root-system',
      })).rejects.toThrow(/owner or mode mismatch/);
      await expect(revalidateDa5V5ProducerInputForTest({
        kind: 'file',
        mutate: async () => undefined,
        path: rootSystemInput,
        trust: 'root-system',
      })).resolves.toBeUndefined();
      expect(await realpath(rootSystemInput)).toBe(rootSystemInput);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('keeps unsupported cleanup-entry errno portable and fail-closed', async () => {
    const source = await readFile(sourcePath, 'utf8');
    const unsupportedEntry = source.slice(
      source.indexOf(
        'if (!S_ISREG(named_state.st_mode) && !S_ISDIR(named_state.st_mode))',
      ),
      source.indexOf(
        'if (S_ISREG(named_state.st_mode) && named_state.st_nlink != 1)',
      ),
    );
    expect(unsupportedEntry).toContain('#if defined(__APPLE__)');
    expect(unsupportedEntry).toContain('errno = EFTYPE;');
    expect(unsupportedEntry).toContain('#elif defined(__linux__)');
    expect(unsupportedEntry).toContain('errno = EINVAL;');
    expect(unsupportedEntry).toContain('return -1;');
  });

  it('requires external exact digests and revalidates both stable descriptors', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'taptime-da5-artifact-')));
    try {
      const temporaryGuard = await buildDa5V5TemporaryTestGuard({
        sourcePath,
        temporaryRoot: root,
      });
      const binaryPath = temporaryGuard.binaryPath;
      const replacedPath = join(root, 'guard-replaced');
      const manifestPath = join(root, 'guard-manifest.json');
      await chmod(binaryPath, 0o555);
      const description = await describeDa5V5RuntimeGuardBinaryForTest(binaryPath);
      if (platform() !== 'darwin') {
        expect(description.format).toBe('ELF');
        const invalidManifestBytes = Buffer.from('{}\n');
        await writeFile(manifestPath, invalidManifestBytes, {
          flag: 'wx',
          mode: 0o444,
        });
        await chmod(manifestPath, 0o444);
        await expect(verifyDa5V5RuntimeGuardArtifact({
          binaryPath,
          expectedBinarySha256: '0'.repeat(64),
          expectedManifestSha256: sha256(invalidManifestBytes),
          implementationCommit: 'a'.repeat(40),
          implementationTree: 'b'.repeat(40),
          manifestPath,
        })).rejects.toThrow(/externally reviewed digest mismatch/);
        await expect(verifyDa5V5RuntimeGuardArtifact({
          binaryPath,
          expectedBinarySha256: description.sha256,
          expectedManifestSha256: '0'.repeat(64),
          implementationCommit: 'a'.repeat(40),
          implementationTree: 'b'.repeat(40),
          manifestPath,
        })).rejects.toThrow(/externally reviewed digest mismatch/);
        await expect(revalidateDa5V5ProducerInputForTest({
          kind: 'file',
          mutate: async () => {
            await rename(binaryPath, replacedPath);
            await writeFile(binaryPath, await readFile(replacedPath), {
              flag: 'wx',
              mode: 0o555,
            });
          },
          path: binaryPath,
          trust: 'same-euid-private',
        })).rejects.toThrow(/producer input changed/u);
        return;
      }
      const runningGuard = spawn(binaryPath, [], {
        cwd: '/',
        detached: true,
        env: {},
        shell: false,
        stdio: [
          'ignore', 'ignore', 'ignore',
          'pipe', 'pipe', 'pipe',
          'ignore', 'ignore', 'ignore',
          'ignore', 'ignore', 'ignore',
        ],
      });
      await once(runningGuard, 'spawn');
      await expect(verifyDa5V5RuntimeGuardRunningProcessForTest({
        binaryPath,
        pid: runningGuard.pid as number,
      })).resolves.toBeUndefined();
      runningGuard.stdio[3]?.destroy();
      await once(runningGuard, 'exit');
      const implementationCommit = 'a'.repeat(40);
      const implementationTree = 'b'.repeat(40);
      const manifest = await createManifest({
        binaryPath,
        description,
        implementationCommit,
        implementationTree,
      });
      const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
      await writeFile(manifestPath, manifestBytes, { flag: 'wx', mode: 0o444 });
      await chmod(manifestPath, 0o444);
      const manifestSha256 = sha256(manifestBytes);

      await expect(verifyDa5V5RuntimeGuardArtifact({
        binaryPath,
        expectedBinarySha256: '0'.repeat(64),
        expectedManifestSha256: manifestSha256,
        implementationCommit,
        implementationTree,
        manifestPath,
      })).rejects.toThrow(/externally reviewed digest mismatch/);
      await expect(verifyDa5V5RuntimeGuardArtifact({
        binaryPath,
        expectedBinarySha256: description.sha256,
        expectedManifestSha256: '0'.repeat(64),
        implementationCommit,
        implementationTree,
        manifestPath,
      })).rejects.toThrow(/externally reviewed digest mismatch/);

      const binding = await verifyDa5V5RuntimeGuardArtifact({
        binaryPath,
        expectedBinarySha256: description.sha256,
        expectedManifestSha256: manifestSha256,
        implementationCommit,
        implementationTree,
        manifestPath,
      });
      try {
        await expect(binding.revalidate()).resolves.toBeUndefined();
        await rename(binaryPath, replacedPath);
        await writeFile(binaryPath, await readFile(replacedPath), {
          flag: 'wx',
          mode: 0o555,
        });
        await expect(binding.revalidate()).rejects.toThrow(
          'stable-FD identity changed',
        );
      } finally {
        await binding.close();
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

async function createManifest(options: {
  readonly binaryPath: string;
  readonly description: Awaited<
    ReturnType<typeof describeDa5V5RuntimeGuardBinaryForTest>
  >;
  readonly implementationCommit: string;
  readonly implementationTree: string;
}): Promise<Da5V5RuntimeGuardManifest> {
  const state = await stat(options.binaryPath, { bigint: true });
  const boundPath = Object.freeze({
    canonicalPath: options.binaryPath,
    dev: state.dev.toString(),
    gid: Number(state.gid),
    identitySha256: 'd'.repeat(64),
    ino: state.ino.toString(),
    mode: (Number(state.mode) & 0o7777).toString(8).padStart(4, '0'),
    size: state.size.toString(),
    trust: 'same-euid-private' as const,
    uid: Number(state.uid),
  });
  const boundFile = Object.freeze({
    ...boundPath,
    platformSignature: options.description.signature,
    sha256: options.description.sha256,
  });
  const processVerifierPath = '/usr/bin/codesign';
  const processVerifierState = await stat(processVerifierPath, { bigint: true });
  const processVerifierDescription =
    await describeDa5V5RuntimeGuardBinaryForTest(processVerifierPath);
  const processVerifierRecord = {
    canonicalPath: processVerifierPath,
    dev: processVerifierState.dev.toString(),
    gid: Number(processVerifierState.gid),
    ino: processVerifierState.ino.toString(),
    mode: (Number(processVerifierState.mode) & 0o7777)
      .toString(8)
      .padStart(4, '0'),
    size: processVerifierState.size.toString(),
    trust: 'root-system' as const,
    uid: Number(processVerifierState.uid),
  };
  const processVerifier = Object.freeze({
    ...processVerifierRecord,
    identitySha256: sha256(Buffer.from(JSON.stringify(processVerifierRecord))),
    platformSignature: processVerifierDescription.signature,
    sha256: processVerifierDescription.sha256,
  });
  const systemTool = async (path: string) => {
    const toolState = await stat(path, { bigint: true });
    const description = await describeDa5V5RuntimeGuardBinaryForTest(path);
    const record = {
      canonicalPath: path,
      dev: toolState.dev.toString(),
      gid: Number(toolState.gid),
      ino: toolState.ino.toString(),
      mode: (Number(toolState.mode) & 0o7777)
        .toString(8)
        .padStart(4, '0'),
      size: toolState.size.toString(),
      trust: 'root-system' as const,
      uid: Number(toolState.uid),
    };
    return Object.freeze({
      ...record,
      identitySha256: sha256(Buffer.from(JSON.stringify(record))),
      platformSignature: description.signature,
      sha256: description.sha256,
    });
  };
  const git = await systemTool('/usr/bin/git');
  const loadDependencyInspector = await systemTool('/usr/bin/otool');
  const operatingSystemInspector = await systemTool('/usr/bin/sw_vers');
  return Object.freeze({
    architecture: arch(),
    binary: Object.freeze({
      format: options.description.format,
      loadDependencies: options.description.loadDependencies,
      loadDependencyInputs: Object.freeze([boundFile]),
      magicHex: options.description.magicHex,
      mode: '0555',
      path: options.binaryPath,
      sha256: options.description.sha256,
      signature: options.description.signature,
      size: options.description.size,
    }),
    build: Object.freeze({
      commandSha256: 'c'.repeat(64),
      compilerArguments: Object.freeze(['synthetic-test-compiler']),
      linkerArguments: Object.freeze(['synthetic-test-linker']),
      mode: 'separate-cc1-and-direct-linker',
      signatureArguments: Object.freeze(['synthetic-test-signature']),
      testResult: 'focused-pass',
      umask: '0077',
    }),
    implementation: Object.freeze({
      commit: options.implementationCommit,
      repositoryRoot: join(options.binaryPath, '..'),
      tree: options.implementationTree,
    }),
    operatingSystem: Object.freeze({
      build: platform() === 'darwin'
        ? String(spawnSync('/usr/bin/sw_vers', ['-buildVersion'], {
          encoding: 'utf8',
        }).stdout).trim()
        : release(),
      platform: platform(),
      release: release(),
    }),
    source: boundFile,
    toolchain: Object.freeze({
      compiler: boundFile,
      compilerResourceDirectory: boundPath,
      compilerVersion: 'synthetic-test-compiler',
      git,
      includeDirectories: Object.freeze([boundPath]),
      inputFiles: Object.freeze([boundFile]),
      linkInputFiles: Object.freeze([boundFile]),
      linker: boundFile,
      linkerVersion: 'synthetic-test-linker',
      loadDependencyInspector,
      operatingSystemInspector,
      processVerifier,
      sdk: boundPath,
      sdkBuildVersion: 'synthetic-test-sdk',
      sdkVersion: 'synthetic-test-sdk',
      startObjects: Object.freeze([]),
      startObjectMode: 'platform-linker-default-none',
      sysroot: boundPath,
      target: 'arm64-apple-macosx26.0.0',
      xcrun: boundFile,
    }),
  });
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
