import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  createDa5V5ValidationNoHardwareReadinessOptions,
  readDa5V5ValidationRepositoryBinding,
  resolveDa5V5ValidationExecutionRepositoryRoot,
  verifyDa5V5ValidationNoHardwareReadiness,
  type Da5V5ValidationExecutionRepositoryRootDependencies,
  type Da5V5ValidationNoHardwareReadinessDependencies,
} from '../../scripts/da5V5ValidationNoHardwareReadiness.mjs';
import {
  DA5_V5_VALIDATION_EXECUTION_SCOPES,
  DA5_V5_VALIDATION_SOURCE_SCOPES,
  assertDa5V5ValidationToolIdentityMetadata,
  createCurrentDa5V5ValidationToolIdentity,
  verifyDa5V5ValidationToolIdentity,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';

const executionCommit = 'a'.repeat(40);
const executionTree = 'b'.repeat(40);
const artifactSourceCommit = 'c'.repeat(40);
const artifactSourceTree = 'd'.repeat(40);
const toolSha256 = 'e'.repeat(64);
const paths = Object.freeze({
  aapt: '/synthetic/android-sdk/build-tools/35.0.0/aapt',
  adb: '/synthetic/android-sdk/platform-tools/adb',
  apksigner:
    '/synthetic/android-sdk/build-tools/35.0.0/apksigner',
  git: '/synthetic/bin/git',
  hermesc:
    '/synthetic/repository/node_modules/hermes-compiler/hermesc/osx-bin/hermesc',
  node: '/synthetic/bin/node',
  repository: '/synthetic/repository',
  sdk: '/synthetic/android-sdk',
  unzip: '/usr/bin/unzip',
});
const executionScopes = Object.freeze([
  'apps/mobile/scripts/da5V5AdbChildEnvironment.mjs',
  'apps/mobile/scripts/da5V5AndroidArtifact.mjs',
  'apps/mobile/scripts/da5V5AndroidDevice.mjs',
  'apps/mobile/scripts/da5V5ValidationArtifact.mjs',
  'apps/mobile/scripts/da5V5ValidationInstallStream.mjs',
  'apps/mobile/scripts/da5V5ValidationNativeSourceBinding.mjs',
  'apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs',
  'apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs',
  'apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs',
  'apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs',
  'apps/mobile/scripts/syntheticE2eRuntimeContract.mjs',
  'apps/mobile/scripts/verifyDa5V5ValidationAndroidArtifact.mjs',
  'apps/mobile/scripts/verifySyntheticE2eAndroidRuntime.mjs',
]);
const readinessScopes = Object.freeze([
  ...new Set([
    ...DA5_V5_VALIDATION_SOURCE_SCOPES,
    ...executionScopes,
  ]),
]);
const toolPaths = new Set<string>([
  paths.aapt,
  paths.adb,
  paths.apksigner,
  paths.git,
  paths.hermesc,
  paths.node,
  paths.unzip,
]);
const readinessModulePath = join(
  paths.repository,
  'apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs',
);

describe('DA5 V5 Validation no-hardware readiness', () => {
  it('keeps execution and older artifact-source bindings separate', () => {
    const dependencies = validDependencies();
    const result = verifyDa5V5ValidationNoHardwareReadiness(
      validOptions(),
      dependencies,
    );

    expect(result).toMatchObject({
      androidSdkPath: paths.sdk,
      artifactSourceCommit,
      artifactSourceTree,
      executionCommit,
      executionTree,
      repositoryRoot: paths.repository,
      status: 'match',
      tools: {
        aapt: { path: paths.aapt },
        adb: { path: paths.adb },
        apksigner: { path: paths.apksigner },
        git: { path: paths.git },
        hermesc: { path: paths.hermesc },
        node: { path: paths.node },
        unzip: { path: paths.unzip },
      },
    });
    expect(artifactSourceCommit).not.toBe(executionCommit);
    expect(dependencies.readRepositoryBinding).toHaveBeenCalledTimes(1);
    const sourceScopes = vi.mocked(
      dependencies.readRepositoryBinding,
    ).mock.calls[0]?.[2];
    expect(sourceScopes).toEqual([
      ...readinessScopes,
      ':(top,exclude,glob)research/**',
      ':(top,exclude,literal)app.json',
    ]);
    expect(DA5_V5_VALIDATION_EXECUTION_SCOPES).toEqual(
      executionScopes,
    );
  });

  it('covers the exact transitive local imports of both executable entries',
    async () => {
      const repositoryRoot = fileURLToPath(
        new URL('../../../../', import.meta.url),
      ).replace(/\/$/u, '');
      const pending = [
        'apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs',
        'apps/mobile/scripts/verifyDa5V5ValidationAndroidArtifact.mjs',
      ];
      const discovered = new Set<string>();
      while (pending.length > 0) {
        const scope = pending.pop();
        if (scope === undefined || discovered.has(scope)) continue;
        discovered.add(scope);
        const absolute = resolve(repositoryRoot, scope);
        const source = await readFile(absolute, 'utf8');
        for (const match of source.matchAll(
          /\bfrom\s+['"](\.\/[^'"]+\.mjs)['"]/gu,
        )) {
          const imported = match[1];
          if (imported === undefined) continue;
          const importedScope = relative(
            repositoryRoot,
            resolve(dirname(absolute), imported),
          );
          pending.push(importedScope);
        }
      }
      expect([...discovered].sort()).toEqual(executionScopes);
    });

  it('parses every binding only from its explicit environment input', () => {
    const environment = validEnvironment();
    environment.UNRELATED_SECRET = 'must-not-be-forwarded';

    const rootDependencies = validExecutionRootDependencies();
    expect(createDa5V5ValidationNoHardwareReadinessOptions(
      environment,
      rootDependencies,
    ))
      .toEqual(validOptions());
    expect(JSON.stringify(
      createDa5V5ValidationNoHardwareReadinessOptions(
        environment,
        rootDependencies,
      ),
    )).not.toContain('must-not-be-forwarded');
  });

  it('binds the supplied repository root to the loaded module root', () => {
    const environment = validEnvironment();
    environment.DA5_V5_VALIDATION_REPOSITORY_ROOT =
      '/synthetic/foreign-repository';
    expect(() => createDa5V5ValidationNoHardwareReadinessOptions(
      environment,
      validExecutionRootDependencies(),
    )).toThrow(/execution repository authority/u);
  });

  it('rejects a direct foreign repository root before any Git inspection', () => {
    const options = validOptions();
    Object.defineProperty(options, 'repositoryRoot', {
      value: '/synthetic/foreign-repository',
    });
    const dependencies = validDependencies();
    expect(() => verifyDa5V5ValidationNoHardwareReadiness(
      options,
      dependencies,
    )).toThrow(/execution repository authority/u);
    expect(dependencies.readRepositoryBinding).not.toHaveBeenCalled();
  });

  it.each(['symlink', 'realpath'] as const)(
    'rejects derived repository-root %s drift before Git inspection',
    (drift) => {
      const dependencies = validDependencies();
      if (drift === 'symlink') {
        vi.mocked(dependencies.lstat).mockImplementation((path) =>
          stat(path, { symbolicLink: path === paths.repository }));
      } else {
        vi.mocked(dependencies.realpath).mockImplementation((path) => (
          path === paths.repository
            ? '/synthetic/foreign-repository'
            : path
        ));
      }
      expect(() => verifyDa5V5ValidationNoHardwareReadiness(
        validOptions(),
        dependencies,
      )).toThrow(/authority/u);
      expect(dependencies.readRepositoryBinding).not.toHaveBeenCalled();
    },
  );

  it('rejects a noncanonical supplied repository root in option parsing', () => {
    const environment = validEnvironment();
    environment.DA5_V5_VALIDATION_REPOSITORY_ROOT =
      '/synthetic/../synthetic/repository';
    expect(() => createDa5V5ValidationNoHardwareReadinessOptions(
      environment,
      validExecutionRootDependencies(),
    )).toThrow(/canonical authority/u);
  });

  it('rejects a symlinked or foreign loaded readiness module root', () => {
    const symlinked = validExecutionRootDependencies();
    vi.mocked(symlinked.lstat).mockImplementation((path) =>
      executionRootStat(path, { symbolicLink: path === readinessModulePath }));
    expect(() => resolveDa5V5ValidationExecutionRepositoryRoot(
      symlinked.moduleUrl,
      symlinked,
    )).toThrow(/execution repository authority/u);

    const foreign = validExecutionRootDependencies();
    vi.mocked(foreign.realpath).mockImplementation((path) => (
      path === readinessModulePath
        ? '/synthetic/foreign-repository/apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs'
        : path
    ));
    expect(() => resolveDa5V5ValidationExecutionRepositoryRoot(
      foreign.moduleUrl,
      foreign,
    )).toThrow(/execution repository authority/u);
  });

  it.each(executionScopes.flatMap((scope) => [
    ['staged', scope, `M  ${scope}\u0000`],
    ['unstaged', scope, ` M ${scope}\u0000`],
    ['untracked', scope, `?? ${scope}\u0000`],
  ]))(
    'classifies %s state in %s as dirty',
    (_kind, _scope, status) => {
    const runGit = vi.fn()
      .mockReturnValueOnce(
        `${executionCommit}\n${executionTree}\n${paths.repository}\n`,
      )
      .mockReturnValueOnce(status)
      .mockReturnValueOnce('');

    expect(readDa5V5ValidationRepositoryBinding(
      paths.git,
      paths.repository,
      [
        ...readinessScopes,
        ':(top,exclude,glob)research/**',
        ':(top,exclude,literal)app.json',
      ],
      { runGit },
    )).toMatchObject({ clean: false });
    expect(runGit).toHaveBeenNthCalledWith(2, paths.git, [
      '-C',
      paths.repository,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--',
      ...readinessScopes,
      ':(top,exclude,glob)research/**',
      ':(top,exclude,literal)app.json',
    ]);
    expect(runGit).toHaveBeenNthCalledWith(3, paths.git, [
      '-C',
      paths.repository,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--ignored=matching',
      '--',
      ...readinessScopes,
    ]);
    },
  );

  it('detects ignored in-scope residue while retaining protected exclusions', () => {
    const repositoryRoot = mkdtempSync(
      join(tmpdir(), 'taptime-da5-v5-readiness-'),
    );
    const git = (
      arguments_: readonly string[],
    ): string => execFileSync('git', arguments_, {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    const scopes = [
      ...readinessScopes,
      ':(top,exclude,glob)research/**',
      ':(top,exclude,literal)app.json',
    ];
    try {
      git(['init', '--quiet']);
      writeFileSync(
        join(repositoryRoot, '.gitignore'),
        [
          '/apps/mobile/.env*',
          '/apps/mobile/modules/**/build/',
          '/research/',
          '/app.json',
          '',
        ].join('\n'),
      );
      git(['add', '.gitignore']);
      git([
        '-c',
        'user.name=TapTim.e Test',
        '-c',
        'user.email=taptime-test@example.invalid',
        'commit',
        '--quiet',
        '-m',
        'synthetic baseline',
      ]);

      mkdirSync(join(repositoryRoot, 'apps/mobile'), {
        recursive: true,
      });
      writeFileSync(
        join(repositoryRoot, 'apps/mobile/.env.local'),
        'SYNTHETIC_IGNORED_VALUE=1\n',
      );
      expect(readDa5V5ValidationRepositoryBinding(
        'git',
        repositoryRoot,
        scopes,
      )).toMatchObject({ clean: false });
      rmSync(join(repositoryRoot, 'apps/mobile/.env.local'));

      const moduleBuild = join(
        repositoryRoot,
        'apps/mobile/modules/synthetic/build',
      );
      mkdirSync(moduleBuild, { recursive: true });
      writeFileSync(join(moduleBuild, 'residue.bin'), 'synthetic\n');
      expect(readDa5V5ValidationRepositoryBinding(
        'git',
        repositoryRoot,
        scopes,
      )).toMatchObject({ clean: false });
      rmSync(join(repositoryRoot, 'apps/mobile/modules'), {
        recursive: true,
      });

      mkdirSync(join(repositoryRoot, 'research'), { recursive: true });
      writeFileSync(
        join(repositoryRoot, 'research/ignored-control.txt'),
        'synthetic protected control\n',
      );
      writeFileSync(
        join(repositoryRoot, 'app.json'),
        '{"synthetic":"protected control"}\n',
      );
      expect(git([
        'status',
        '--porcelain=v1',
        '-z',
        '--untracked-files=all',
        '--ignored=matching',
        '--',
        ...readinessScopes,
      ])).toBe('');
      expect(readDa5V5ValidationRepositoryBinding(
        'git',
        repositoryRoot,
        scopes,
      )).toMatchObject({ clean: true });
    } finally {
      rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'ADB exact path',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.adb.path = '/synthetic/bin/adb';
      },
    },
    {
      name: 'aapt exact path',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.aapt.path =
          '/synthetic/android-sdk/build-tools/34.0.0/aapt';
      },
    },
    {
      name: 'apksigner exact path',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.apksigner.path =
          '/synthetic/android-sdk/build-tools/34.0.0/apksigner';
      },
    },
    {
      name: 'Node process identity',
      apply(
        _options: ReturnType<typeof validOptions>,
        dependencies: Da5V5ValidationNoHardwareReadinessDependencies,
      ) {
        Object.defineProperty(dependencies, 'currentNodePath', {
          value: '/synthetic/bin/other-node',
        });
      },
    },
    {
      name: 'hermesc repository resolution',
      apply(
        _options: ReturnType<typeof validOptions>,
        dependencies: Da5V5ValidationNoHardwareReadinessDependencies,
      ) {
        Object.defineProperty(dependencies, 'resolveHermesCompilerPath', {
          value: () => '/synthetic/repository/foreign/hermesc',
        });
      },
    },
    {
      name: 'unzip exact path',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.unzip.path = '/synthetic/bin/unzip';
      },
    },
    {
      name: 'tool digest',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.git.sha256 = 'f'.repeat(64);
      },
    },
    {
      name: 'tool byte size',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.adb.bytes = 101;
      },
    },
    {
      name: 'tool mode',
      apply(options: ReturnType<typeof validOptions>) {
        options.tools.node.mode = 0o700;
      },
    },
    {
      name: 'execution commit',
      apply(options: ReturnType<typeof validOptions>) {
        options.executionCommit = 'f'.repeat(40);
      },
    },
    {
      name: 'execution tree',
      apply(options: ReturnType<typeof validOptions>) {
        options.executionTree = 'f'.repeat(40);
      },
    },
    {
      name: 'dirty source scope',
      apply(
        _options: ReturnType<typeof validOptions>,
        dependencies: Da5V5ValidationNoHardwareReadinessDependencies,
      ) {
        vi.mocked(dependencies.readRepositoryBinding).mockReturnValue({
          clean: false,
          executionCommit,
          executionTree,
          root: paths.repository,
        });
      },
    },
  ])('fails closed for $name drift', ({ apply }) => {
    const options = validOptions();
    const dependencies = validDependencies();
    apply(options, dependencies);

    expect(() => verifyDa5V5ValidationNoHardwareReadiness(
      options,
      dependencies,
    )).toThrow(/authority|binding/u);
  });

  it.each([
    paths.aapt,
    paths.adb,
    paths.apksigner,
    paths.git,
    paths.hermesc,
    paths.node,
    paths.unzip,
  ])('rejects a symlinked or swapped %s identity', (toolPath) => {
    const symlinkDependencies = validDependencies();
    vi.mocked(symlinkDependencies.lstat).mockImplementation((path) =>
      stat(path, { symbolicLink: path === toolPath }));
    expect(() => verifyDa5V5ValidationNoHardwareReadiness(
      validOptions(),
      symlinkDependencies,
    )).toThrow(/authority/u);

    const swappedDependencies = validDependencies();
    let calls = 0;
    vi.mocked(swappedDependencies.lstat).mockImplementation((path) => {
      if (path === toolPath) {
        calls += 1;
        return stat(path, { ino: calls === 1 ? 11 : 12 });
      }
      return stat(path);
    });
    expect(() => verifyDa5V5ValidationNoHardwareReadiness(
      validOptions(),
      swappedDependencies,
    )).toThrow(/identity/u);
  });

  it('preserves APFS-scale BigInt tool identities exactly', () => {
    const dependencies = validDependencies();
    const dev = 16_777_232n;
    const ino = 1_152_921_500_312_573_001n;
    vi.mocked(dependencies.lstat).mockImplementation((path) =>
      stat(path, {
        dev,
        ino,
        mode: 0o100755n,
        size: 100n,
      }));

    const identity = createCurrentDa5V5ValidationToolIdentity(
      paths.unzip,
      dependencies,
    );

    expect(identity).toMatchObject({
      bytes: 100,
      dev: dev.toString(10),
      ino: ino.toString(10),
      mode: 0o755,
      path: paths.unzip,
    });
    expect(assertDa5V5ValidationToolIdentityMetadata(
      identity,
      dependencies,
    )).toEqual({ status: 'match' });
  });

  it('rejects equal-size in-place digest drift and digest read failure', () => {
    const dependencies = validDependencies();
    const identity = createCurrentDa5V5ValidationToolIdentity(
      paths.unzip,
      dependencies,
    );

    vi.mocked(dependencies.sha256).mockReturnValue('f'.repeat(64));
    expect(() => assertDa5V5ValidationToolIdentityMetadata(
      identity,
      dependencies,
    )).toThrow(/identity/u);

    vi.mocked(dependencies.sha256).mockImplementation(() => {
      throw new Error('digest unavailable');
    });
    expect(() => assertDa5V5ValidationToolIdentityMetadata(
      identity,
      dependencies,
    )).toThrow('digest unavailable');
  });

  it.each([
    undefined,
    '',
    'e'.repeat(63),
    'E'.repeat(64),
    'g'.repeat(64),
  ])('rejects malformed reattestation digest %s', (sha256) => {
    const dependencies = validDependencies();
    const identity = createCurrentDa5V5ValidationToolIdentity(
      paths.unzip,
      dependencies,
    );

    expect(() => assertDa5V5ValidationToolIdentityMetadata({
      ...identity,
      sha256,
    }, dependencies)).toThrow(/identity/u);
  });

  it('rejects adjacent BigInt inodes that collide as Numbers', () => {
    const dependencies = validDependencies();
    const collidingAsNumber = [
      9_007_199_254_740_992n,
      9_007_199_254_740_993n,
    ] as const;
    expect(Number(collidingAsNumber[0])).toBe(
      Number(collidingAsNumber[1]),
    );
    let toolStatCalls = 0;
    vi.mocked(dependencies.lstat).mockImplementation((path) => {
      if (path !== paths.unzip) return stat(path);
      const ino = collidingAsNumber[Math.min(toolStatCalls, 1)];
      toolStatCalls += 1;
      return stat(path, {
        dev: 16_777_232n,
        ino,
        mode: 0o100755n,
        size: 100n,
      });
    });

    expect(() => createCurrentDa5V5ValidationToolIdentity(
      paths.unzip,
      dependencies,
    )).toThrow(/authority/u);
  });

  it('rejects exact BigInt identity drift during stable reattestation', () => {
    const dependencies = validDependencies();
    let toolStatCalls = 0;
    vi.mocked(dependencies.lstat).mockImplementation((path) => {
      if (path !== paths.unzip) return stat(path);
      toolStatCalls += 1;
      return stat(path, {
        dev: 16_777_232n,
        ino: toolStatCalls < 3
          ? 1_152_921_500_312_573_001n
          : 1_152_921_500_312_573_002n,
        mode: 0o100755n,
        size: 100n,
      });
    });

    expect(() => createCurrentDa5V5ValidationToolIdentity(
      paths.unzip,
      dependencies,
    )).toThrow(/identity/u);
  });

  it.each(['dev', 'ino'].flatMap((field) => [
    -1n,
    -1,
    1,
    Number.MAX_SAFE_INTEGER + 1,
    '',
    '-1',
    '+1',
    '01',
    '1.0',
    '9e15',
  ].map((value) => [field, value] as const)))(
    'rejects malformed tool binding %s component %s',
    (field, value) => {
      expect(() => verifyDa5V5ValidationToolIdentity({
        ...binding(paths.unzip),
        dev: '1',
        ino: '11',
        [field]: value,
      }, validDependencies())).toThrow(/binding/u);
    },
  );

  it.each(['dev', 'ino'].flatMap((field) => [
    -1n,
    -1,
    Number.MAX_SAFE_INTEGER + 1,
    '',
    '-1',
    '+1',
    '01',
    '1.0',
    '9e15',
  ].map((value) => [field, value] as const)))(
    'rejects malformed lstat %s component %s',
    (field, value) => {
      const dependencies = validDependencies();
      vi.mocked(dependencies.lstat).mockImplementation((path) =>
        stat(path, { [field]: value }));

      expect(() => verifyDa5V5ValidationToolIdentity(
        binding(paths.unzip),
        dependencies,
      )).toThrow(/authority/u);
    },
  );

  it.each([
    ['mode', -1n],
    ['mode', BigInt(Number.MAX_SAFE_INTEGER) + 1n],
    ['mode', Number.MAX_SAFE_INTEGER + 1],
    ['mode', '33261'],
    ['size', -1n],
    ['size', BigInt(Number.MAX_SAFE_INTEGER) + 1n],
    ['size', Number.MAX_SAFE_INTEGER + 1],
    ['size', '100'],
  ] as const)(
    'rejects non-safe lstat %s value %s',
    (field, value) => {
      const dependencies = validDependencies();
      vi.mocked(dependencies.lstat).mockImplementation((path) =>
        stat(path, { [field]: value }));

      expect(() => verifyDa5V5ValidationToolIdentity(
        binding(paths.unzip),
        dependencies,
      )).toThrow(/authority/u);
    },
  );

  it('rejects an ancestor symlink through canonical-path revalidation', () => {
    const dependencies = validDependencies();
    vi.mocked(dependencies.realpath).mockImplementation((path) =>
      path === paths.aapt ? '/canonical/android-sdk/aapt' : path);

    expect(() => verifyDa5V5ValidationNoHardwareReadiness(
      validOptions(),
      dependencies,
    )).toThrow(/authority/u);
  });
});

function validOptions() {
  return {
    androidSdkAuthority: {
      androidHome: paths.sdk,
      androidSdkRoot: paths.sdk,
    },
    artifactSourceCommit,
    artifactSourceTree,
    executionCommit,
    executionTree,
    repositoryRoot: paths.repository,
    tools: {
      aapt: binding(paths.aapt),
      adb: binding(paths.adb),
      apksigner: binding(paths.apksigner),
      git: binding(paths.git),
      hermesc: binding(paths.hermesc),
      node: binding(paths.node),
      unzip: binding(paths.unzip),
    },
  };
}

function validEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ANDROID_HOME: paths.sdk,
    ANDROID_SDK_ROOT: paths.sdk,
    DA5_V5_VALIDATION_EXECUTION_COMMIT: executionCommit,
    DA5_V5_VALIDATION_EXECUTION_TREE: executionTree,
    DA5_V5_VALIDATION_REPOSITORY_ROOT: paths.repository,
    DA5_V5_VALIDATION_SOURCE_COMMIT: artifactSourceCommit,
    DA5_V5_VALIDATION_SOURCE_TREE: artifactSourceTree,
    NODE_ENV: 'test',
  };
  for (
    const [name, path] of Object.entries({
      AAPT: paths.aapt,
      ADB: paths.adb,
      APKSIGNER: paths.apksigner,
      GIT: paths.git,
      HERMESC: paths.hermesc,
      NODE: paths.node,
      UNZIP: paths.unzip,
    })
  ) {
    environment[`DA5_V5_VALIDATION_${name}_BYTES`] = '100';
    environment[`DA5_V5_VALIDATION_${name}_MODE`] = '755';
    environment[`DA5_V5_VALIDATION_${name}_PATH`] = path;
    environment[`DA5_V5_VALIDATION_${name}_SHA256`] = toolSha256;
  }
  return environment;
}

function validExecutionRootDependencies():
Da5V5ValidationExecutionRepositoryRootDependencies {
  return {
    lstat: vi.fn((path: string) => executionRootStat(path)),
    moduleUrl: pathToFileURL(readinessModulePath).href,
    realpath: vi.fn((path: string) => path),
  };
}

function executionRootStat(
  path: string,
  overrides: Readonly<{ symbolicLink?: boolean }> = {},
) {
  return {
    isDirectory: () => path === paths.repository,
    isFile: () => path === readinessModulePath,
    isSymbolicLink: () => overrides.symbolicLink ?? false,
  };
}

function binding(path: string) {
  return {
    bytes: 100,
    mode: 0o755,
    path,
    sha256: toolSha256,
  };
}

function validDependencies():
Da5V5ValidationNoHardwareReadinessDependencies {
  return {
    currentNodePath: paths.node,
    lstat: vi.fn((path: string) => stat(path)),
    moduleUrl: pathToFileURL(readinessModulePath).href,
    readRepositoryBinding: vi.fn(() => ({
      clean: true,
      executionCommit,
      executionTree,
      root: paths.repository,
    })),
    realpath: vi.fn((path: string) => path),
    resolveHermesCompilerPath: vi.fn(() => paths.hermesc),
    sha256: vi.fn(() => toolSha256),
  };
}

function stat(
  path: string,
  overrides: Readonly<{
    dev?: bigint | number | string;
    ino?: bigint | number | string;
    mode?: bigint | number | string;
    size?: bigint | number | string;
    symbolicLink?: boolean;
  }> = {},
) {
  const directory = path === paths.sdk || path === paths.repository;
  return {
    dev: overrides.dev ?? 1,
    ino: overrides.ino ?? 11,
    mode: overrides.mode ?? (directory ? 0o40755 : 0o100755),
    size: overrides.size ?? (directory ? 200 : 100),
    isDirectory: () => directory,
    isFile: () => toolPaths.has(path) || path === readinessModulePath,
    isSymbolicLink: () => overrides.symbolicLink ?? false,
  } as ReturnType<
    Da5V5ValidationNoHardwareReadinessDependencies['lstat']
  >;
}
