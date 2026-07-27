import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertDa5V5ValidationNativeSourceClosure,
  createDa5V5ValidationNativeSourceClosure,
  DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE,
  DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING,
  DA5_V5_VALIDATION_NATIVE_PACKAGE_BINDINGS,
  verifyDa5V5ValidationNativeSourceClosure,
} from '../../scripts/da5V5ValidationNativeSourceBinding.mjs';
import {
  DA5_V5_VALIDATION_SOURCE_CLOSURE,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';

const repositoryRoot = realpathSync(fileURLToPath(
  new URL('../../../..', import.meta.url),
));
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('DA5 V5 Validation native source binding', () => {
  it('matches the reviewed locked native source closure', () => {
    expect(verifyDa5V5ValidationNativeSourceClosure(repositoryRoot))
      .toEqual({
        ...DA5_V5_VALIDATION_EXPECTED_NATIVE_SOURCE_CLOSURE,
        status: 'match',
      });
  });

  it('keeps the committed local native module in the HEAD source closure', () => {
    expect(DA5_V5_VALIDATION_SOURCE_CLOSURE).toEqual(
      expect.arrayContaining([
        `${DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.modulePath}`
          + '/android/build.gradle',
        `${DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.modulePath}`
          + '/android/src/main/AndroidManifest.xml',
        `${DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.modulePath}`
          + '/android/src/main/java/com/taptime/da5validationbinding/'
          + 'Da5V5ValidationDeviceBindingModule.kt',
        `${DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.modulePath}`
          + '/expo-module.config.json',
        `${DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.modulePath}/index.ts`,
      ]),
    );
  });

  it('rejects a lexical-correct package-root symlink', () => {
    const root = createFixture();
    const packageRoot = join(root, 'node_modules/expo');
    const target = join(root, 'shadow-expo');
    renameSync(packageRoot, target);
    symlinkSync(target, packageRoot, 'dir');
    expect(() => createDa5V5ValidationNativeSourceClosure(root))
      .toThrow(/contains a symlink/u);
  });

  it('rejects a nested source-tree symlink', () => {
    const root = createFixture();
    const target = join(root, 'shadow-native-source');
    mkdirSync(target);
    writeFileSync(join(target, 'Injected.kt'), 'forbidden');
    symlinkSync(
      target,
      join(root, 'node_modules/expo/android/linked-source'),
      'dir',
    );
    expect(() => createDa5V5ValidationNativeSourceClosure(root))
      .toThrow(/contains a symlink/u);
  });

  it.each([
    ['mutation', mutateSource],
    ['addition', addSource],
    ['removal', removeSource],
  ] as const)(
    'rejects same-path source %s against its exact closure',
    (_name, change) => {
      const root = createFixture();
      const expected = createDa5V5ValidationNativeSourceClosure(root);
      change(root);
      const changed = createDa5V5ValidationNativeSourceClosure(root);
      expect(() => assertDa5V5ValidationNativeSourceClosure(
        changed,
        expected,
      )).toThrow(/native source closure mismatch/u);
    },
  );

  it('rejects exact react-native-nfc-manager version drift', () => {
    const root = createFixture();
    const packageJsonPath = join(
      root,
      'node_modules/react-native-nfc-manager/package.json',
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = '3.17.3';
    writeFileSync(packageJsonPath, JSON.stringify(packageJson));
    expect(() => createDa5V5ValidationNativeSourceClosure(root))
      .toThrow(/native package identity mismatch/u);
  });

  it('rejects same-size react-native-nfc-manager plugin tamper', () => {
    const root = createFixture();
    const expected = createDa5V5ValidationNativeSourceClosure(root);
    const path = nfcPluginPath(root);
    const original = readFileSync(path);
    const mutated = Buffer.from(original);
    mutated[0] = mutated[0] === 0x78 ? 0x79 : 0x78;
    writeFileSync(path, mutated);
    expect(() => assertDa5V5ValidationNativeSourceClosure(
      createDa5V5ValidationNativeSourceClosure(root),
      expected,
    )).toThrow(/native source closure mismatch/u);
  });

  it('rejects react-native-nfc-manager plugin removal', () => {
    const root = createFixture();
    rmSync(nfcPluginPath(root));
    expect(() => createDa5V5ValidationNativeSourceClosure(root))
      .toThrow();
  });

  it.each([
    'react-native.config.js',
    'react-native.config.ts',
  ])('rejects optional react-native-nfc-manager config addition: %s', (
    configName,
  ) => {
    const root = createFixture();
    writeFileSync(
      join(root, 'node_modules/react-native-nfc-manager', configName),
      'module.exports = {};\n',
    );
    expect(() => createDa5V5ValidationNativeSourceClosure(root))
      .toThrow(/optional native config presence mismatch/u);
  });

  it('rejects locked package version or integrity drift', () => {
    const root = createFixture();
    const packageLockPath = join(root, 'package-lock.json');
    const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'));
    packageLock.packages['node_modules/react-native-nfc-manager']
      .integrity = 'sha512-different';
    writeFileSync(packageLockPath, JSON.stringify(packageLock));
    expect(() => createDa5V5ValidationNativeSourceClosure(root))
      .toThrow(/native package lock mismatch/u);
  });
});

function createFixture(): string {
  const root = realpathSync(mkdtempSync(
    join(tmpdir(), 'taptime-da5-native-source-test-'),
  ));
  temporaryRoots.push(root);
  const packages: Record<string, {
    integrity: string;
    version: string;
  }> = {};
  for (const binding of DA5_V5_VALIDATION_NATIVE_PACKAGE_BINDINGS) {
    const packageRoot = join(root, binding.packagePath);
    const androidSource = join(root, binding.androidPath);
    mkdirSync(join(androidSource, 'src/main'), { recursive: true });
    writeFileSync(
      join(androidSource, 'src/main/Module.kt'),
      `${binding.packageName}:${binding.version}\n`,
    );
    for (const metadataPath of binding.metadataPaths) {
      const path = join(root, metadataPath);
      mkdirSync(dirname(path), { recursive: true });
      if (!path.endsWith('/package.json')) {
        writeFileSync(path, `${binding.packageName}\n`);
      }
    }
    writeFileSync(
      join(packageRoot, 'package.json'),
      JSON.stringify({
        name: binding.packageName,
        version: binding.version,
      }),
    );
    packages[binding.packagePath] = {
      integrity: binding.integrity,
      version: binding.version,
    };
  }
  mkdirSync(
    join(root, DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.androidPath),
    { recursive: true },
  );
  writeFileSync(
    join(
      root,
      DA5_V5_VALIDATION_LOCAL_NATIVE_BINDING.androidPath,
      'build.gradle',
    ),
    'plugins {}\n',
  );
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({ packages }),
  );
  return root;
}

function sourcePath(root: string): string {
  return join(root, 'node_modules/expo/android/src/main/Module.kt');
}

function nfcPluginPath(root: string): string {
  return join(
    root,
    'node_modules/react-native-nfc-manager/app.plugin.js',
  );
}

function mutateSource(root: string): void {
  const path = sourcePath(root);
  const original = readFileSync(path);
  const mutated = Buffer.from(original);
  mutated[0] = mutated[0] === 0x78 ? 0x79 : 0x78;
  writeFileSync(path, mutated);
}

function addSource(root: string): void {
  writeFileSync(
    join(root, 'node_modules/expo/android/src/main/Added.kt'),
    'added\n',
  );
}

function removeSource(root: string): void {
  rmSync(sourcePath(root));
}
