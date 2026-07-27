import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import {
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';

export const DA5_V5_VALIDATION_NATIVE_SOURCE_CONTRACT =
  'taptime-da5-v5-native-source-closure-v1';
export const DA5_V5_VALIDATION_NATIVE_SOURCE_MAX_ENTRIES = 1_024;
export const DA5_V5_VALIDATION_NATIVE_SOURCE_MAX_BYTES =
  16 * 1_024 * 1_024;

export const DA5_V5_VALIDATION_NATIVE_PACKAGE_BINDINGS = Object.freeze([
  Object.freeze({
    absentMetadataPaths: Object.freeze([
      'node_modules/expo/react-native.config.ts',
    ]),
    androidPath: 'node_modules/expo/android',
    integrity:
      'sha512-QmyNQJNFJb/I6bQYpxl39jqyhCSlFXtiwBCyCFl3a7a18NZ8pHsVHTvLdRIXFI/bNXdCm/g7JMXoJB4eFKLBmg==',
    metadataPaths: Object.freeze([
      'node_modules/expo/expo-module.config.json',
      'node_modules/expo/package.json',
      'node_modules/expo/react-native.config.js',
    ]),
    packageName: 'expo',
    packagePath: 'node_modules/expo',
    version: '57.0.2',
  }),
  Object.freeze({
    absentMetadataPaths: Object.freeze([
      'node_modules/expo-crypto/react-native.config.js',
      'node_modules/expo-crypto/react-native.config.ts',
    ]),
    androidPath: 'node_modules/expo-crypto/android',
    integrity:
      'sha512-vd0kdUO14h9CgPcgzcR8nmy/wgz3zSOhQmucnbDdyn/z9eAeR2IB5BKaDvPbg/lrIT+KweGAV5IlrK5PZFqUSQ==',
    metadataPaths: Object.freeze([
      'node_modules/expo-crypto/expo-module.config.json',
      'node_modules/expo-crypto/package.json',
    ]),
    packageName: 'expo-crypto',
    packagePath: 'node_modules/expo-crypto',
    version: '57.0.0',
  }),
  Object.freeze({
    absentMetadataPaths: Object.freeze([
      'node_modules/expo-modules-core/react-native.config.ts',
    ]),
    androidPath: 'node_modules/expo-modules-core/android',
    integrity:
      'sha512-gs1Ng2Ci1C/CwN1xRZp2RR74C9iWByf9AHaovYEtOlkly9AolitQGAt9+iLT0CoCb6xw128NcDQ00OJl/Bmv9Q==',
    metadataPaths: Object.freeze([
      'node_modules/expo-modules-core/expo-module.config.json',
      'node_modules/expo-modules-core/package.json',
      'node_modules/expo-modules-core/react-native.config.js',
    ]),
    packageName: 'expo-modules-core',
    packagePath: 'node_modules/expo-modules-core',
    version: '57.0.2',
  }),
  Object.freeze({
    absentMetadataPaths: Object.freeze([
      'node_modules/react-native-nfc-manager/react-native.config.js',
      'node_modules/react-native-nfc-manager/react-native.config.ts',
    ]),
    androidPath: 'node_modules/react-native-nfc-manager/android',
    integrity:
      'sha512-0NryP/Iw2hzw4MVH5KCngoRerNUrnRok6VfLrlFcFZRKyTQ7KTgpsdDxCB6cR33qYNyEDrWGBayfAI+ym5gt8Q==',
    metadataPaths: Object.freeze([
      'node_modules/react-native-nfc-manager/app.plugin.js',
      'node_modules/react-native-nfc-manager/package.json',
    ]),
    packageName: 'react-native-nfc-manager',
    packagePath: 'node_modules/react-native-nfc-manager',
    version: '3.17.2',
  }),
]);

export const DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING = Object.freeze({
  androidPath:
    'apps/mobile/modules/'
    + 'taptime-da5-v5-validation-device-binding/android',
  modulePath:
    'apps/mobile/modules/'
    + 'taptime-da5-v5-validation-device-binding',
});

export const DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE =
  Object.freeze({
    bytes: 1_176_224,
    directories: 123,
    entries: 587,
    files: 464,
    sha256:
      '9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259',
  });

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export function createDa5V5ValidationNativeSourceClosure(
  repositoryRoot,
) {
  const canonicalRepositoryRoot = requireRealDirectory(
    repositoryRoot,
    repositoryRoot,
    'repository root',
  );
  const packageLockPath = join(
    canonicalRepositoryRoot,
    'package-lock.json',
  );
  const packageLock = readExactJsonFile(
    packageLockPath,
    canonicalRepositoryRoot,
    'package lock',
  );
  assertLockedPackageBindings(packageLock);

  const records = [];
  for (const binding of DA5_V5_VALIDATION_NATIVE_PACKAGE_BINDINGS) {
    const packageRoot = join(
      canonicalRepositoryRoot,
      binding.packagePath,
    );
    requireRealDirectory(
      packageRoot,
      canonicalRepositoryRoot,
      `${binding.packageName} package root`,
    );
    const packageJson = readExactJsonFile(
      join(packageRoot, 'package.json'),
      canonicalRepositoryRoot,
      `${binding.packageName} package metadata`,
    );
    if (
      packageJson.name !== binding.packageName
      || packageJson.version !== binding.version
    ) {
      throw new Error(
        'DA5 V5 Validation native package identity mismatch',
      );
    }
    collectTree(
      join(canonicalRepositoryRoot, binding.androidPath),
      canonicalRepositoryRoot,
      records,
    );
    for (const metadataPath of binding.metadataPaths) {
      collectFile(
        join(canonicalRepositoryRoot, metadataPath),
        canonicalRepositoryRoot,
        records,
      );
    }
    for (const absentMetadataPath of binding.absentMetadataPaths) {
      requireAbsentFile(
        join(canonicalRepositoryRoot, absentMetadataPath),
        canonicalRepositoryRoot,
      );
    }
  }

  requireRealDirectory(
    join(
      canonicalRepositoryRoot,
      DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.modulePath,
    ),
    canonicalRepositoryRoot,
    'local validation module root',
  );
  requireRealDirectory(
    join(
      canonicalRepositoryRoot,
      DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.androidPath,
    ),
    canonicalRepositoryRoot,
    'local validation Android source',
  );

  records.sort((left, right) => compareText(left.path, right.path));
  const uniquePaths = new Set(records.map(({ path }) => path));
  if (uniquePaths.size !== records.length) {
    throw new Error(
      'DA5 V5 Validation native source closure contains duplicates',
    );
  }
  const files = records.filter(({ type }) => type === 'file');
  const bytes = files.reduce((total, record) => total + record.bytes, 0);
  if (
    records.length > DA5_V5_VALIDATION_NATIVE_SOURCE_MAX_ENTRIES
    || bytes > DA5_V5_VALIDATION_NATIVE_SOURCE_MAX_BYTES
  ) {
    throw new Error(
      'DA5 V5 Validation native source closure exceeds its bound',
    );
  }
  const serialized = records.map((record) => (
    `${JSON.stringify(record)}\n`
  )).join('');
  return Object.freeze({
    bytes,
    directories: records.length - files.length,
    entries: records.length,
    files: files.length,
    records: Object.freeze(records),
    sha256: sha256(Buffer.from(serialized, 'utf8')),
  });
}

export function assertDa5V5ValidationNativeSourceClosure(
  closure,
  expected = DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE,
) {
  if (
    !validSummary(closure)
    || !validSummary(expected)
    || closure.bytes !== expected.bytes
    || closure.directories !== expected.directories
    || closure.entries !== expected.entries
    || closure.files !== expected.files
    || closure.sha256 !== expected.sha256
  ) {
    throw new Error(
      'DA5 V5 Validation native source closure mismatch',
    );
  }
  return Object.freeze({
    bytes: closure.bytes,
    directories: closure.directories,
    entries: closure.entries,
    files: closure.files,
    sha256: closure.sha256,
    status: 'match',
  });
}

export function verifyDa5V5ValidationNativeSourceClosure(repositoryRoot) {
  return assertDa5V5ValidationNativeSourceClosure(
    createDa5V5ValidationNativeSourceClosure(repositoryRoot),
  );
}

function assertLockedPackageBindings(packageLock) {
  if (
    typeof packageLock !== 'object'
    || packageLock === null
    || Array.isArray(packageLock)
    || typeof packageLock.packages !== 'object'
    || packageLock.packages === null
    || Array.isArray(packageLock.packages)
  ) {
    throw new Error(
      'DA5 V5 Validation native package lock is invalid',
    );
  }
  for (const binding of DA5_V5_VALIDATION_NATIVE_PACKAGE_BINDINGS) {
    const locked = packageLock.packages[binding.packagePath];
    if (
      typeof locked !== 'object'
      || locked === null
      || Array.isArray(locked)
      || locked.version !== binding.version
      || locked.integrity !== binding.integrity
    ) {
      throw new Error(
        'DA5 V5 Validation native package lock mismatch',
      );
    }
  }
}

function collectTree(path, repositoryRoot, records) {
  const directory = requireRealDirectory(
    path,
    repositoryRoot,
    'native source directory',
  );
  records.push(directoryRecord(directory, repositoryRoot));
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    const stat = requireRealPath(
      entryPath,
      repositoryRoot,
      'native source entry',
    );
    if (stat.isDirectory()) {
      collectTree(entryPath, repositoryRoot, records);
    } else if (stat.isFile()) {
      records.push(fileRecord(entryPath, repositoryRoot, stat));
    } else {
      throw new Error(
        'DA5 V5 Validation native source entry type is forbidden',
      );
    }
  }
}

function collectFile(path, repositoryRoot, records) {
  const stat = requireRealPath(
    path,
    repositoryRoot,
    'native package metadata',
  );
  if (!stat.isFile()) {
    throw new Error(
      'DA5 V5 Validation native package metadata is not a file',
    );
  }
  records.push(fileRecord(path, repositoryRoot, stat));
}

function requireAbsentFile(path, repositoryRoot) {
  const canonicalRepositoryRoot = lexicalAbsolute(repositoryRoot);
  const canonical = lexicalAbsolute(path);
  const delta = relative(canonicalRepositoryRoot, canonical);
  if (
    delta === '..'
    || delta.startsWith(`..${sep}`)
    || isAbsolute(delta)
  ) {
    throw new Error(
      'DA5 V5 Validation optional native config escapes the repository',
    );
  }
  try {
    lstatSync(canonical);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  throw new Error(
    'DA5 V5 Validation optional native config presence mismatch',
  );
}

function directoryRecord(path, repositoryRoot) {
  const stat = lstatSync(path);
  return Object.freeze({
    bytes: 0,
    mode: modeText(stat.mode),
    path: repositoryPath(path, repositoryRoot),
    sha256: null,
    type: 'directory',
  });
}

function fileRecord(path, repositoryRoot, stat) {
  const bytes = readFileSync(path);
  if (stat.size !== bytes.length) {
    throw new Error(
      'DA5 V5 Validation native source file changed during inspection',
    );
  }
  const after = lstatSync(path);
  if (
    !after.isFile()
    || after.isSymbolicLink()
    || after.dev !== stat.dev
    || after.ino !== stat.ino
    || after.mode !== stat.mode
    || after.size !== stat.size
    || after.mtimeMs !== stat.mtimeMs
  ) {
    throw new Error(
      'DA5 V5 Validation native source file changed during inspection',
    );
  }
  return Object.freeze({
    bytes: bytes.length,
    mode: modeText(stat.mode),
    path: repositoryPath(path, repositoryRoot),
    sha256: sha256(bytes),
    type: 'file',
  });
}

function readExactJsonFile(path, repositoryRoot, label) {
  const stat = requireRealPath(path, repositoryRoot, label);
  if (!stat.isFile()) {
    throw new Error(`DA5 V5 Validation ${label} is not a file`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`DA5 V5 Validation ${label} is invalid`);
  }
}

function requireRealDirectory(path, repositoryRoot, label) {
  const stat = requireRealPath(path, repositoryRoot, label);
  if (!stat.isDirectory()) {
    throw new Error(`DA5 V5 Validation ${label} is not a directory`);
  }
  return normalize(resolve(path));
}

function requireRealPath(path, repositoryRoot, label) {
  const canonicalRepositoryRoot = lexicalAbsolute(repositoryRoot);
  const canonical = lexicalAbsolute(path);
  const delta = relative(canonicalRepositoryRoot, canonical);
  if (
    delta === '..'
    || delta.startsWith(`..${sep}`)
    || isAbsolute(delta)
  ) {
    throw new Error(`DA5 V5 Validation ${label} escapes the repository`);
  }
  const segments = delta.length === 0 ? [] : delta.split(sep);
  let current = canonicalRepositoryRoot;
  for (const segment of segments) {
    current = join(current, segment);
    const component = lstatSync(current);
    if (
      component.isSymbolicLink()
      || normalize(realpathSync(current)) !== current
    ) {
      throw new Error(
        `DA5 V5 Validation ${label} contains a symlink`,
      );
    }
  }
  const stat = lstatSync(canonical);
  if (
    stat.isSymbolicLink()
    || normalize(realpathSync(canonical)) !== canonical
  ) {
    throw new Error(`DA5 V5 Validation ${label} is not canonical`);
  }
  return stat;
}

function lexicalAbsolute(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) {
    throw new Error(
      'DA5 V5 Validation native source path is unavailable',
    );
  }
  const canonical = normalize(resolve(path));
  if (canonical !== path) {
    throw new Error(
      'DA5 V5 Validation native source path is not canonical',
    );
  }
  return canonical;
}

function repositoryPath(path, repositoryRoot) {
  const value = relative(repositoryRoot, path).split(sep).join('/');
  if (value.length === 0 || value.startsWith('../')) {
    throw new Error(
      'DA5 V5 Validation native source record path is invalid',
    );
  }
  return value;
}

function validSummary(value) {
  return (
    typeof value === 'object'
    && value !== null
    && Number.isSafeInteger(value.bytes)
    && value.bytes >= 0
    && Number.isSafeInteger(value.directories)
    && value.directories >= 0
    && Number.isSafeInteger(value.entries)
    && value.entries > 0
    && Number.isSafeInteger(value.files)
    && value.files > 0
    && value.entries === value.directories + value.files
    && typeof value.sha256 === 'string'
    && SHA256_PATTERN.test(value.sha256)
  );
}

function modeText(mode) {
  return (mode & 0o7777).toString(8).padStart(4, '0');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
