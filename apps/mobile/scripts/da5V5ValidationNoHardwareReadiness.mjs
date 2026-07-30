import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  join,
  normalize,
  resolve,
} from 'node:path';

import {
  DA5_V5_VALIDATION_UNZIP_PATH,
  requireDa5V5ValidationAndroidSdkAuthority,
  resolveDa5V5ValidationHermesCompilerPath,
} from './da5V5ValidationArtifact.mjs';
import {
  DA5_V5_VALIDATION_EXECUTION_SCOPES,
  DA5_V5_VALIDATION_SOURCE_SCOPES,
  verifyDa5V5ValidationToolIdentity,
} from './da5V5ValidationRuntimeContract.mjs';

const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const protectedExclusions = Object.freeze([
  ':(top,exclude,glob)research/**',
  ':(top,exclude,literal)app.json',
]);
const readinessScopes = Object.freeze([
  ...new Set([
    ...DA5_V5_VALIDATION_SOURCE_SCOPES,
    ...DA5_V5_VALIDATION_EXECUTION_SCOPES,
  ]),
]);

export function createDa5V5ValidationNoHardwareReadinessOptions(
  environment,
) {
  if (
    typeof environment !== 'object'
    || environment === null
    || Array.isArray(environment)
  ) {
    throw new Error('DA5 V5 Validation environment authority mismatch');
  }
  return Object.freeze({
    androidSdkAuthority: Object.freeze({
      androidHome: optional(environment, 'ANDROID_HOME'),
      androidSdkRoot: optional(environment, 'ANDROID_SDK_ROOT'),
    }),
    artifactSourceCommit: required(
      environment,
      'DA5_V5_VALIDATION_SOURCE_COMMIT',
    ),
    artifactSourceTree: required(
      environment,
      'DA5_V5_VALIDATION_SOURCE_TREE',
    ),
    executionCommit: required(
      environment,
      'DA5_V5_VALIDATION_EXECUTION_COMMIT',
    ),
    executionTree: required(
      environment,
      'DA5_V5_VALIDATION_EXECUTION_TREE',
    ),
    repositoryRoot: required(
      environment,
      'DA5_V5_VALIDATION_REPOSITORY_ROOT',
    ),
    tools: Object.freeze({
      aapt: fileBinding(environment, 'DA5_V5_VALIDATION_AAPT'),
      adb: fileBinding(environment, 'DA5_V5_VALIDATION_ADB'),
      apksigner: fileBinding(
        environment,
        'DA5_V5_VALIDATION_APKSIGNER',
      ),
      git: fileBinding(environment, 'DA5_V5_VALIDATION_GIT'),
      hermesc: fileBinding(environment, 'DA5_V5_VALIDATION_HERMESC'),
      node: fileBinding(environment, 'DA5_V5_VALIDATION_NODE'),
      unzip: fileBinding(environment, 'DA5_V5_VALIDATION_UNZIP'),
    }),
  });
}

export function verifyDa5V5ValidationNoHardwareReadiness(
  options,
  dependencies = systemDependencies(),
) {
  const authority = requireDa5V5ValidationAndroidSdkAuthority(
    options?.androidSdkAuthority,
  );
  requireDirectory(authority.path, dependencies);
  const tools = Object.freeze({
    aapt: verifyDa5V5ValidationToolIdentity(
      options?.tools?.aapt,
      dependencies,
    ),
    adb: verifyDa5V5ValidationToolIdentity(
      options?.tools?.adb,
      dependencies,
    ),
    apksigner: verifyDa5V5ValidationToolIdentity(
      options?.tools?.apksigner,
      dependencies,
    ),
    git: verifyDa5V5ValidationToolIdentity(
      options?.tools?.git,
      dependencies,
    ),
    hermesc: verifyDa5V5ValidationToolIdentity(
      options?.tools?.hermesc,
      dependencies,
    ),
    node: verifyDa5V5ValidationToolIdentity(
      options?.tools?.node,
      dependencies,
    ),
    unzip: verifyDa5V5ValidationToolIdentity(
      options?.tools?.unzip,
      dependencies,
    ),
  });
  if (tools.node.path !== dependencies.currentNodePath) {
    throw new Error('DA5 V5 Validation Node authority mismatch');
  }
  requireExactToolPath(
    tools.adb.path,
    join(authority.path, 'platform-tools', 'adb'),
    'ADB',
  );
  requireExactToolPath(
    tools.aapt.path,
    join(authority.path, 'build-tools', '35.0.0', 'aapt'),
    'aapt',
  );
  requireExactToolPath(
    tools.apksigner.path,
    join(authority.path, 'build-tools', '35.0.0', 'apksigner'),
    'apksigner',
  );
  requireExactToolPath(
    tools.hermesc.path,
    dependencies.resolveHermesCompilerPath(),
    'hermesc',
  );
  requireExactToolPath(
    tools.unzip.path,
    DA5_V5_VALIDATION_UNZIP_PATH,
    'unzip',
  );
  const repositoryRoot = requireDirectory(
    options?.repositoryRoot,
    dependencies,
  );
  requireGitObject(options?.executionCommit);
  requireGitObject(options?.executionTree);
  requireGitObject(options?.artifactSourceCommit);
  requireGitObject(options?.artifactSourceTree);
  const repository = dependencies.readRepositoryBinding(
    tools.git.path,
    repositoryRoot,
    Object.freeze([
      ...readinessScopes,
      ...protectedExclusions,
    ]),
  );
  if (
    repository.root !== repositoryRoot
    || repository.executionCommit !== options.executionCommit
    || repository.executionTree !== options.executionTree
    || repository.clean !== true
  ) {
    throw new Error('DA5 V5 Validation repository binding mismatch');
  }
  return Object.freeze({
    androidSdkPath: authority.path,
    artifactSourceCommit: options.artifactSourceCommit,
    artifactSourceTree: options.artifactSourceTree,
    executionCommit: options.executionCommit,
    executionTree: options.executionTree,
    repositoryRoot,
    status: 'match',
    tools,
  });
}

export function readDa5V5ValidationRepositoryBinding(
  gitPath,
  repositoryRoot,
  sourceScopes,
  dependencies = Object.freeze({ runGit }),
) {
  const revision = dependencies.runGit(
    gitPath,
    [
      '-C',
      repositoryRoot,
      'rev-parse',
      'HEAD',
      'HEAD^{tree}',
      '--show-toplevel',
    ],
  );
  const lines = revision.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length !== 3) {
    throw new Error(
      'DA5 V5 Validation repository inspection mismatch',
    );
  }
  const status = dependencies.runGit(
    gitPath,
    [
      '-C',
      repositoryRoot,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--',
      ...sourceScopes,
    ],
  );
  const ignoredStatus = dependencies.runGit(
    gitPath,
    [
      '-C',
      repositoryRoot,
      'status',
      '--porcelain=v1',
      '-z',
      '--untracked-files=all',
      '--ignored=matching',
      '--',
      ...sourceScopes.filter((scope) => (
        !scope.startsWith(':(top,exclude,')
      )),
    ],
  );
  return Object.freeze({
    clean: status.length === 0 && ignoredStatus.length === 0,
    executionCommit: lines[0],
    executionTree: lines[1],
    root: lines[2],
  });
}

function requireExactToolPath(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`DA5 V5 Validation ${label} authority mismatch`);
  }
}

function requireDirectory(path, dependencies) {
  const canonical = requireCanonicalPath(path);
  const stat = dependencies.lstat(canonical);
  if (
    !stat.isDirectory()
    || stat.isSymbolicLink()
    || normalize(dependencies.realpath(canonical)) !== canonical
  ) {
    throw new Error('DA5 V5 Validation directory authority mismatch');
  }
  return canonical;
}

function requireCanonicalPath(path) {
  if (
    typeof path !== 'string'
    || path.length === 0
    || normalize(resolve(path)) !== path
  ) {
    throw new Error('DA5 V5 Validation canonical authority mismatch');
  }
  return path;
}

function requireGitObject(value) {
  if (typeof value !== 'string' || !GIT_OBJECT_PATTERN.test(value)) {
    throw new Error('DA5 V5 Validation repository binding mismatch');
  }
}

function fileBinding(environment, prefix) {
  return Object.freeze({
    bytes: Number(required(environment, `${prefix}_BYTES`)),
    mode: Number.parseInt(required(environment, `${prefix}_MODE`), 8),
    path: required(environment, `${prefix}_PATH`),
    sha256: required(environment, `${prefix}_SHA256`),
  });
}

function required(environment, name) {
  const value = environment[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`DA5 V5 Validation required binding is missing: ${name}`);
  }
  return value;
}

function optional(environment, name) {
  const value = environment[name];
  return typeof value !== 'string' || value.length === 0
    ? undefined
    : value;
}

function systemDependencies() {
  return Object.freeze({
    currentNodePath: process.execPath,
    lstat(path) {
      return lstatSync(path, { bigint: true });
    },
    readRepositoryBinding(gitPath, repositoryRoot, sourceScopes) {
      return readDa5V5ValidationRepositoryBinding(
        gitPath,
        repositoryRoot,
        sourceScopes,
      );
    },
    realpath: realpathSync,
    resolveHermesCompilerPath:
      resolveDa5V5ValidationHermesCompilerPath,
    sha256(path) {
      return createHash('sha256').update(readFileSync(path)).digest('hex');
    },
  });
}

function runGit(gitPath, arguments_) {
  const result = spawnSync(gitPath, arguments_, {
    encoding: 'utf8',
    env: Object.freeze({
      GIT_OPTIONAL_LOCKS: '0',
      LANG: 'C',
      LC_ALL: 'C',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (
    result.status !== 0
    || result.error !== undefined
    || typeof result.stdout !== 'string'
  ) {
    throw new Error('DA5 V5 Validation repository inspection failed');
  }
  return result.stdout;
}
