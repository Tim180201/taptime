import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {
  isAbsolute,
  join,
  normalize,
  resolve,
} from 'node:path';

export const DA5_V5_VALIDATION_RUNTIME_VARIANT = 'da5-v5-validation';
export const DA5_V5_VALIDATION_ENTRY_FILE = 'validation-index.ts';
export const DA5_V5_VALIDATION_RUNTIME_MARKER =
  'taptime-da5-v5-validation-only-v1';
export const DA5_V5_VALIDATION_DEVICE_MODULE =
  'taptime-da5-v5-validation-device-binding';
export const DA5_V5_VALIDATION_ANDROID_PACKAGE =
  'com.tim180201.mobile.validation';
export const DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES = Object.freeze([
  '@expo/dom-webview',
  '@expo/log-box',
  'expo-asset',
  'expo-background-task',
  'expo-constants',
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
  'expo-file-system',
  'expo-font',
  'expo-json-utils',
  'expo-keep-awake',
  'expo-manifests',
  'expo-network',
  'expo-secure-store',
  'expo-sqlite',
  'expo-status-bar',
  'expo-task-manager',
  'expo-updates-interface',
  'taptime-monotonic-clock',
  'taptime-nfc-ingress',
  'unimodules-app-loader',
]);
export const DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST = Object.freeze([
  Object.freeze({
    packageName: 'expo',
    packageVersion: '57.0.2',
    repositoryPath: 'node_modules/expo/android',
  }),
  Object.freeze({
    packageName: 'expo-crypto',
    packageVersion: '57.0.0',
    repositoryPath: 'node_modules/expo-crypto/android',
  }),
  Object.freeze({
    packageName: 'expo-modules-core',
    packageVersion: '57.0.2',
    repositoryPath: 'node_modules/expo-modules-core/android',
  }),
  Object.freeze({
    packageName: DA5_V5_VALIDATION_DEVICE_MODULE,
    packageVersion: '',
    repositoryPath:
      'apps/mobile/modules/'
      + `${DA5_V5_VALIDATION_DEVICE_MODULE}/android`,
  }),
]);
export const DA5_V5_VALIDATION_REACT_NATIVE_ALLOWLIST = Object.freeze([
  Object.freeze({
    packageImportPath: 'import expo.modules.ExpoModulesPackage;',
    packageInstance: 'new ExpoModulesPackage()',
    packageName: 'expo',
    repositoryPath: 'node_modules/expo',
    sourcePath: 'node_modules/expo/android',
  }),
  Object.freeze({
    packageImportPath:
      'import community.revteltech.nfc.NfcManagerPackage;',
    packageInstance: 'new NfcManagerPackage()',
    packageName: 'react-native-nfc-manager',
    repositoryPath: 'node_modules/react-native-nfc-manager',
    sourcePath: 'node_modules/react-native-nfc-manager/android',
  }),
]);
export const DA5_V5_VALIDATION_BUNDLE_NATIVE_MODULE_ALLOWLIST =
  Object.freeze([
    Object.freeze({
      moduleName: 'Da5V5ValidationDeviceBinding',
      sourcePath:
        'apps/mobile/modules/'
        + 'taptime-da5-v5-validation-device-binding/index.ts',
    }),
    Object.freeze({
      moduleName: 'ExpoCrypto',
      sourcePath:
        'apps/mobile/src/validation/createDa5V5ValidationRuntime.ts',
    }),
    Object.freeze({
      moduleName: 'ExpoModulesCoreJSLogger',
      sourcePath:
        'node_modules/expo-modules-core/src/sweet/setUpJsLogger.fx.ts',
    }),
    Object.freeze({
      moduleName: 'NfcManager',
      sourcePath:
        'node_modules/react-native-nfc-manager/src/NativeNfcManager.js',
    }),
  ]);
export const DA5_V5_VALIDATION_EXPECTED_BUNDLE_SOURCE_CLOSURE =
  Object.freeze({
    entries: 555,
    sourceBytes: 2_679_201,
    sha256:
      '93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd',
  });
export const DA5_V5_VALIDATION_EXPECTED_BUNDLE_EXECUTABLE =
  Object.freeze({
    bytes: 2_044_686,
    sha256:
      'f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88',
  });

export const DA5_V5_VALIDATION_SOURCE_CLOSURE = Object.freeze([
  'apps/mobile/app.config.js',
  'apps/mobile/app.json',
  'apps/mobile/assets/android-icon-background.png',
  'apps/mobile/assets/android-icon-foreground.png',
  'apps/mobile/assets/android-icon-monochrome.png',
  'apps/mobile/assets/icon.png',
  'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/build.gradle',
  'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/src/main/AndroidManifest.xml',
  'apps/mobile/modules/taptime-da5-v5-validation-device-binding/android/src/main/java/com/taptime/da5validationbinding/Da5V5ValidationDeviceBindingModule.kt',
  'apps/mobile/modules/taptime-da5-v5-validation-device-binding/expo-module.config.json',
  'apps/mobile/modules/taptime-da5-v5-validation-device-binding/index.ts',
  'apps/mobile/package.json',
  'apps/mobile/plugins/withDa5V5ValidationAndroidBoundary.js',
  'apps/mobile/scripts/buildDa5V5ValidationAndroid.mjs',
  'apps/mobile/scripts/da5V5ValidationArtifact.mjs',
  'apps/mobile/scripts/da5V5ValidationBuildProcess.mjs',
  'apps/mobile/scripts/da5V5ValidationNativeSourceBinding.mjs',
  'apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs',
  'apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs',
  'apps/mobile/scripts/da5V5ValidationSourceBinding.mjs',
  'apps/mobile/scripts/publishDa5V5ValidationArtifact.mjs',
  'apps/mobile/scripts/verifyDa5V5ValidationAndroidArtifact.mjs',
  'apps/mobile/src/validation/Da5V5ValidationContract.ts',
  'apps/mobile/src/validation/Da5V5ValidationController.ts',
  'apps/mobile/src/validation/Da5V5ValidationDeviceBinding.ts',
  'apps/mobile/src/validation/Da5V5ValidationMobileApp.tsx',
  'apps/mobile/src/validation/Da5V5ValidationNfcCapture.ts',
  'apps/mobile/src/validation/NativeDa5V5ValidationDeviceBinding.ts',
  'apps/mobile/src/validation/createDa5V5ValidationRuntime.ts',
  'apps/mobile/tsconfig.json',
  'apps/mobile/validation-index.ts',
  'package-lock.json',
  'package.json',
]);

export const DA5_V5_VALIDATION_EXECUTION_SCOPES = Object.freeze([
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

export const DA5_V5_VALIDATION_SOURCE_SCOPES = Object.freeze([
  ':(glob)apps/mobile/.env*',
  'apps/mobile/app.config.js',
  'apps/mobile/app.json',
  'apps/mobile/assets/android-icon-background.png',
  'apps/mobile/assets/android-icon-foreground.png',
  'apps/mobile/assets/android-icon-monochrome.png',
  'apps/mobile/assets/icon.png',
  ':(glob)apps/mobile/babel.config.*',
  'apps/mobile/modules',
  ':(glob)apps/mobile/metro.config.*',
  'apps/mobile/package.json',
  'apps/mobile/plugins/withDa5V5ValidationAndroidBoundary.js',
  ':(glob)apps/mobile/react-native.config.*',
  'apps/mobile/scripts/buildDa5V5ValidationAndroid.mjs',
  'apps/mobile/scripts/da5V5ValidationArtifact.mjs',
  'apps/mobile/scripts/da5V5ValidationBuildProcess.mjs',
  'apps/mobile/scripts/da5V5ValidationNativeSourceBinding.mjs',
  'apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs',
  'apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs',
  'apps/mobile/scripts/da5V5ValidationSourceBinding.mjs',
  'apps/mobile/scripts/publishDa5V5ValidationArtifact.mjs',
  'apps/mobile/scripts/verifyDa5V5ValidationAndroidArtifact.mjs',
  'apps/mobile/src/validation',
  'apps/mobile/tsconfig.json',
  'apps/mobile/validation-index.ts',
  'package-lock.json',
  'package.json',
]);

export const DA5_V5_VALIDATION_BUILD_ENVIRONMENT = Object.freeze({
  APP_VARIANT: DA5_V5_VALIDATION_RUNTIME_VARIANT,
  ENTRY_FILE: DA5_V5_VALIDATION_ENTRY_FILE,
  EXPO_OFFLINE: '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
  EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT:
    DA5_V5_VALIDATION_RUNTIME_VARIANT,
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_offline: 'true',
  npm_config_update_notifier: 'false',
});

export function createCurrentDa5V5ValidationToolIdentity(
  path,
  dependencies = systemToolIdentityDependencies(),
) {
  const canonical = requireCanonicalToolPath(path);
  const stat = requireToolStatMetadata(
    dependencies.lstat(canonical),
    'DA5 V5 Validation tool authority mismatch',
  );
  return verifyDa5V5ValidationToolIdentity(
    Object.freeze({
      bytes: stat.size,
      dev: stat.dev,
      ino: stat.ino,
      mode: stat.mode & 0o7777,
      path: canonical,
      sha256: dependencies.sha256(canonical),
    }),
    dependencies,
  );
}

export function verifyDa5V5ValidationToolIdentity(
  binding,
  dependencies = systemToolIdentityDependencies(),
) {
  if (
    typeof binding !== 'object'
    || binding === null
    || Array.isArray(binding)
    || !Number.isSafeInteger(binding.bytes)
    || binding.bytes <= 0
    || !Number.isSafeInteger(binding.mode)
    || binding.mode < 0
    || binding.mode > 0o7777
    || typeof binding.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(binding.sha256)
  ) {
    throw new Error('DA5 V5 Validation tool binding mismatch');
  }
  const path = requireCanonicalToolPath(binding.path);
  const bindingDev = optionalCanonicalToolIdentityComponent(
    binding.dev,
    'DA5 V5 Validation tool binding mismatch',
  );
  const bindingIno = optionalCanonicalToolIdentityComponent(
    binding.ino,
    'DA5 V5 Validation tool binding mismatch',
  );
  const before = requireToolStatMetadata(
    dependencies.lstat(path),
    'DA5 V5 Validation tool authority mismatch',
  );
  const mode = before.mode & 0o7777;
  if (
    !before.file
    || before.symbolicLink
    || mode !== binding.mode
    || (mode & 0o111) === 0
    || before.size !== binding.bytes
    || (
      bindingDev !== undefined
      && bindingDev !== before.dev
    )
    || (
      bindingIno !== undefined
      && bindingIno !== before.ino
    )
    || normalize(dependencies.realpath(path)) !== path
    || dependencies.sha256(path) !== binding.sha256
  ) {
    throw new Error('DA5 V5 Validation tool authority mismatch');
  }
  const identity = Object.freeze({
    bytes: before.size,
    dev: before.dev,
    ino: before.ino,
    mode,
    path,
    sha256: binding.sha256,
  });
  assertDa5V5ValidationToolIdentityMetadata(identity, dependencies);
  return identity;
}

export function assertDa5V5ValidationToolIdentityMetadata(
  identity,
  dependencies = systemToolIdentityDependencies(),
) {
  if (
    typeof identity !== 'object'
    || identity === null
    || Array.isArray(identity)
    || !Number.isSafeInteger(identity.bytes)
    || identity.bytes <= 0
    || !Number.isSafeInteger(identity.mode)
    || identity.mode < 0
    || identity.mode > 0o7777
    || typeof identity.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(identity.sha256)
  ) {
    throw new Error('DA5 V5 Validation tool identity mismatch');
  }
  const identityDev = requireCanonicalToolIdentityComponent(
    identity.dev,
    'DA5 V5 Validation tool identity mismatch',
  );
  const identityIno = requireCanonicalToolIdentityComponent(
    identity.ino,
    'DA5 V5 Validation tool identity mismatch',
  );
  const path = requireCanonicalToolPath(identity.path);
  const stat = requireToolStatMetadata(
    dependencies.lstat(path),
    'DA5 V5 Validation tool identity mismatch',
  );
  if (
    !stat.file
    || stat.symbolicLink
    || stat.dev !== identityDev
    || stat.ino !== identityIno
    || (stat.mode & 0o7777) !== identity.mode
    || stat.size !== identity.bytes
    || normalize(dependencies.realpath(path)) !== path
    || dependencies.sha256(path) !== identity.sha256
  ) {
    throw new Error('DA5 V5 Validation tool identity mismatch');
  }
  return Object.freeze({ status: 'match' });
}

function optionalCanonicalToolIdentityComponent(value, mismatchMessage) {
  return value === undefined
    ? undefined
    : requireCanonicalToolIdentityComponent(value, mismatchMessage);
}

function requireCanonicalToolIdentityComponent(value, mismatchMessage) {
  if (
    typeof value === 'string'
    && /^(?:0|[1-9][0-9]*)$/u.test(value)
  ) {
    return value;
  }
  throw new Error(mismatchMessage);
}

function requireToolStatIdentityComponent(value, mismatchMessage) {
  if (typeof value === 'bigint') {
    if (value >= 0n) return value.toString(10);
  } else if (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
  ) {
    return String(value);
  } else if (typeof value === 'string') {
    return requireCanonicalToolIdentityComponent(value, mismatchMessage);
  }
  throw new Error(mismatchMessage);
}

function requireToolStatMetadata(stat, mismatchMessage) {
  try {
    if (
      typeof stat !== 'object'
      || stat === null
      || typeof stat.isFile !== 'function'
      || typeof stat.isSymbolicLink !== 'function'
    ) {
      throw new Error(mismatchMessage);
    }
    return Object.freeze({
      dev: requireToolStatIdentityComponent(stat.dev, mismatchMessage),
      file: stat.isFile(),
      ino: requireToolStatIdentityComponent(stat.ino, mismatchMessage),
      mode: requireSafeToolStatNumber(stat.mode, mismatchMessage),
      size: requireSafeToolStatNumber(stat.size, mismatchMessage),
      symbolicLink: stat.isSymbolicLink(),
    });
  } catch {
    throw new Error(mismatchMessage);
  }
}

function requireSafeToolStatNumber(value, mismatchMessage) {
  if (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
  ) {
    return value;
  }
  if (
    typeof value === 'bigint'
    && value >= 0n
    && value <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return Number(value);
  }
  throw new Error(mismatchMessage);
}

function requireCanonicalToolPath(path) {
  if (
    typeof path !== 'string'
    || path.length === 0
    || normalize(resolve(path)) !== path
  ) {
    throw new Error('DA5 V5 Validation tool authority mismatch');
  }
  return path;
}

function systemToolIdentityDependencies() {
  return Object.freeze({
    lstat(path) {
      return lstatSync(path, { bigint: true });
    },
    realpath: realpathSync,
    sha256(path) {
      return createHash('sha256')
        .update(readFileSync(path))
        .digest('hex');
    },
  });
}

const BUILD_ENVIRONMENT_ALLOWLIST = Object.freeze([
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'GRADLE_USER_HOME',
  'HOME',
  'JAVA_HOME',
  'LANG',
  'LC_ALL',
  'PATH',
  'TMPDIR',
  'USER',
]);

export function createDa5V5ValidationBuildEnvironment(environment) {
  const sanitized = {};
  for (const name of BUILD_ENVIRONMENT_ALLOWLIST) {
    const value = environment[name];
    if (typeof value === 'string' && value.length > 0) {
      sanitized[name] = value;
    }
  }
  return Object.freeze({
    ...sanitized,
    ...DA5_V5_VALIDATION_BUILD_ENVIRONMENT,
  });
}

export function createDa5V5ValidationAutolinkingPackageJson(source) {
  let packageJson;
  try {
    packageJson = JSON.parse(source);
  } catch {
    throw new Error('DA5 V5 Validation package.json is invalid');
  }
  if (
    JSON.stringify(packageJson.expo?.autolinking?.exclude)
    !== JSON.stringify([DA5_V5_VALIDATION_DEVICE_MODULE])
  ) {
    throw new Error(
      'DA5 V5 Validation default Product autolinking boundary mismatch',
    );
  }
  packageJson.expo.autolinking.exclude = [
    ...DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES,
  ];
  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

export function assertDa5V5ValidationPrebuildPackageJson(before, after) {
  let packageJson;
  try {
    packageJson = JSON.parse(before);
  } catch {
    throw new Error('DA5 V5 Validation package.json is invalid');
  }
  if (
    typeof packageJson.scripts !== 'object'
    || packageJson.scripts === null
    || Array.isArray(packageJson.scripts)
    || packageJson.scripts.android !== 'expo start --android'
    || packageJson.scripts.ios !== 'expo start --ios'
  ) {
    throw new Error(
      'DA5 V5 Validation prebuild script boundary mismatch',
    );
  }
  packageJson.scripts.android = 'expo run:android';
  packageJson.scripts.ios = 'expo run:ios';
  if (after !== `${JSON.stringify(packageJson, null, 2)}\n`) {
    throw new Error(
      'DA5 V5 Validation prebuild attempted to mutate package.json',
    );
  }
}

export function assertDa5V5ValidationAutolinkingResolution(
  resolution,
  repositoryRoot,
) {
  if (
    typeof resolution !== 'object'
    || resolution === null
    || Array.isArray(resolution)
    || !Array.isArray(resolution.modules)
    || !Array.isArray(resolution.extraDependencies)
    || resolution.extraDependencies.length !== 0
    || !Array.isArray(resolution.coreFeatures)
    || resolution.coreFeatures.length !== 0
    || typeof repositoryRoot !== 'string'
    || !isAbsolute(repositoryRoot)
  ) {
    throw new Error(
      'DA5 V5 Validation native module graph is unavailable',
    );
  }
  const canonicalRepositoryRoot = canonicalAbsolute(repositoryRoot);
  if (
    resolution.modules.length
      !== DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST.length
  ) {
    throw new Error('DA5 V5 Validation native module graph mismatch');
  }
  const modulesByName = new Map();
  for (const module of resolution.modules) {
    if (
      typeof module !== 'object'
      || module === null
      || Array.isArray(module)
      || typeof module.packageName !== 'string'
      || module.packageName.length === 0
      || !Array.isArray(module.projects)
      || module.projects.length === 0
      || module.projects.some((project) => (
        typeof project !== 'object'
        || project === null
        || Array.isArray(project)
        || typeof project.name !== 'string'
        || project.name.length === 0
        || typeof project.sourceDir !== 'string'
        || !isAbsolute(project.sourceDir)
      ))
    ) {
      throw new Error(
        'DA5 V5 Validation native module graph is unavailable',
      );
    }
    if (modulesByName.has(module.packageName)) {
      throw new Error('DA5 V5 Validation native module graph mismatch');
    }
    modulesByName.set(module.packageName, module);
  }
  for (const expected of DA5_V5_VALIDATION_EXPO_NATIVE_ALLOWLIST) {
    const module = modulesByName.get(expected.packageName);
    const expectedSourceDirectory = join(
      canonicalRepositoryRoot,
      expected.repositoryPath,
    );
    if (
      module === undefined
      || module.projects.length !== 1
      || module.projects[0].name !== expected.packageName
      || canonicalAbsolute(module.projects[0].sourceDir)
        !== expectedSourceDirectory
      || (
        expected.packageVersion === null
          ? module.packageVersion !== undefined
          : module.packageVersion !== expected.packageVersion
      )
    ) {
      throw new Error('DA5 V5 Validation native module graph mismatch');
    }
  }
}

export function assertDa5V5ValidationReactNativeAutolinkingResolution(
  resolution,
  repositoryRoot,
  mobileDirectory,
) {
  if (
    typeof resolution !== 'object'
    || resolution === null
    || Array.isArray(resolution)
    || typeof resolution.dependencies !== 'object'
    || resolution.dependencies === null
    || Array.isArray(resolution.dependencies)
  ) {
    throw new Error(
      'DA5 V5 Validation React Native module graph is unavailable',
    );
  }
  const canonicalRepositoryRoot = canonicalAbsolute(repositoryRoot);
  const canonicalMobileDirectory = canonicalAbsolute(mobileDirectory);
  if (
    canonicalAbsolute(resolution.root) !== canonicalMobileDirectory
    || canonicalAbsolute(resolution.reactNativePath)
      !== join(canonicalRepositoryRoot, 'node_modules/react-native')
    || typeof resolution.project !== 'object'
    || resolution.project === null
    || Array.isArray(resolution.project)
    || Object.keys(resolution.project).join('\n') !== 'android'
    || resolution.project.android?.packageName
      !== DA5_V5_VALIDATION_ANDROID_PACKAGE
    || canonicalAbsolute(resolution.project.android?.sourceDir)
      !== join(canonicalMobileDirectory, 'android')
  ) {
    throw new Error(
      'DA5 V5 Validation React Native module graph mismatch',
    );
  }
  const dependencyNames = Object.keys(resolution.dependencies).sort();
  const expectedNames = DA5_V5_VALIDATION_REACT_NATIVE_ALLOWLIST
    .map(({ packageName }) => packageName)
    .sort();
  if (dependencyNames.join('\n') !== expectedNames.join('\n')) {
    throw new Error(
      'DA5 V5 Validation React Native module graph mismatch',
    );
  }
  for (const expected of DA5_V5_VALIDATION_REACT_NATIVE_ALLOWLIST) {
    const dependency = resolution.dependencies[expected.packageName];
    if (
      typeof dependency !== 'object'
      || dependency === null
      || Array.isArray(dependency)
      || canonicalAbsolute(dependency.root)
        !== join(canonicalRepositoryRoot, expected.repositoryPath)
      || typeof dependency.platforms !== 'object'
      || dependency.platforms === null
      || canonicalAbsolute(dependency.platforms.android?.sourceDir)
        !== join(canonicalRepositoryRoot, expected.sourcePath)
      || dependency.platforms.android?.packageImportPath
        !== expected.packageImportPath
      || dependency.platforms.android?.packageInstance
        !== expected.packageInstance
    ) {
      throw new Error(
        'DA5 V5 Validation React Native module graph mismatch',
      );
    }
  }
}

export function assertDa5V5ValidationBundleNativeModuleGraph(
  sourceMap,
  bundle,
) {
  if (!(bundle instanceof Uint8Array)) {
    throw new Error(
      'DA5 V5 Validation bundle executable is unavailable',
    );
  }
  if (
    bundle.byteLength
      !== DA5_V5_VALIDATION_EXPECTED_BUNDLE_EXECUTABLE.bytes
    || createHash('sha256').update(bundle).digest('hex')
      !== DA5_V5_VALIDATION_EXPECTED_BUNDLE_EXECUTABLE.sha256
  ) {
    throw new Error(
      'DA5 V5 Validation bundle executable mismatch',
    );
  }
  const bundleSources = readDa5V5ValidationBundleSources(sourceMap);
  const sourceClosure = createBundleSourceClosure(bundleSources);
  // Native modules can be reached through aliases, bracket notation,
  // TurboModuleRegistry and React Native internals. Bind every Metro source
  // exactly so the security boundary does not depend on recognizing all
  // executable JavaScript reference forms.
  if (
    sourceClosure.entries
      !== DA5_V5_VALIDATION_EXPECTED_BUNDLE_SOURCE_CLOSURE.entries
    || sourceClosure.sourceBytes
      !== DA5_V5_VALIDATION_EXPECTED_BUNDLE_SOURCE_CLOSURE.sourceBytes
    || sourceClosure.sha256
      !== DA5_V5_VALIDATION_EXPECTED_BUNDLE_SOURCE_CLOSURE.sha256
  ) {
    throw new Error(
      'DA5 V5 Validation bundle source closure mismatch',
    );
  }
  const records = new Map();
  for (const { source, sourcePath } of bundleSources) {
    if (
      sourcePath === 'node_modules/expo/src/Expo.fx.tsx'
      || DA5_V5_VALIDATION_EXCLUDED_NATIVE_MODULES.some(
        (packageName) => sourcePath.startsWith(
          `node_modules/${packageName}/`,
        ),
      )
    ) {
      throw new Error(
        'DA5 V5 Validation bundle native module graph mismatch',
      );
    }
    for (const match of source.matchAll(
      /\brequire(?:Optional)?NativeModule(?:\s*<[^>]+>)?\s*\(\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/gu,
    )) {
      addBundleNativeModuleRecord(records, match[1], sourcePath);
    }
    if (!sourcePath.startsWith('node_modules/react-native/')) {
      for (const match of source.matchAll(
        /\bNativeModules\.([A-Za-z][A-Za-z0-9]*)/gu,
      )) {
        addBundleNativeModuleRecord(records, match[1], sourcePath);
      }
    }
  }
  const actual = [...records.values()].sort(compareBundleNativeModules);
  const expected = [...DA5_V5_VALIDATION_BUNDLE_NATIVE_MODULE_ALLOWLIST]
    .sort(compareBundleNativeModules);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      'DA5 V5 Validation bundle native module graph mismatch',
    );
  }
  return Object.freeze(actual.map((record) => Object.freeze(record)));
}

function readDa5V5ValidationBundleSources(sourceMap) {
  if (
    typeof sourceMap !== 'object'
    || sourceMap === null
    || Array.isArray(sourceMap)
    || sourceMap.version !== 3
    || !Array.isArray(sourceMap.sources)
    || !Array.isArray(sourceMap.sourcesContent)
    || sourceMap.sources.length !== sourceMap.sourcesContent.length
  ) {
    throw new Error(
      'DA5 V5 Validation bundle native module graph is unavailable',
    );
  }
  const sourcePaths = new Set();
  return sourceMap.sources.map((value, index) => {
    const sourcePath = normalizeBundleSourcePath(value);
    const source = sourceMap.sourcesContent[index];
    if (typeof source !== 'string' || sourcePaths.has(sourcePath)) {
      throw new Error(
        'DA5 V5 Validation bundle native module graph is unavailable',
      );
    }
    sourcePaths.add(sourcePath);
    return { source, sourcePath };
  });
}

function createBundleSourceClosure(bundleSources) {
  const sources = bundleSources.map(({ source, sourcePath }) => ({
    sourcePath,
    sourceBytes: Buffer.byteLength(source, 'utf8'),
    sourceSha256: createHash('sha256')
      .update(source, 'utf8')
      .digest('hex'),
  })).sort((left, right) => left.sourcePath < right.sourcePath
    ? -1
    : left.sourcePath > right.sourcePath
      ? 1
      : 0);
  const serialized = `${sources.map(
    (source) => JSON.stringify(source),
  ).join('\n')}\n`;
  return {
    entries: sources.length,
    sourceBytes: sources.reduce(
      (total, source) => total + source.sourceBytes,
      0,
    ),
    sha256: createHash('sha256')
      .update(serialized, 'utf8')
      .digest('hex'),
  };
}

function addBundleNativeModuleRecord(records, moduleName, sourcePath) {
  const key = `${moduleName}\0${sourcePath}`;
  records.set(key, { moduleName, sourcePath });
}

function compareBundleNativeModules(left, right) {
  return left.moduleName.localeCompare(right.moduleName)
    || left.sourcePath.localeCompare(right.sourcePath);
}

function normalizeBundleSourcePath(value) {
  if ([
    '__prelude__',
    '\0polyfill:assets-registry',
    '\0polyfill:environment-variables',
    '\0polyfill:external-require',
  ].includes(value)) {
    return value;
  }
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.includes('\\')
    || value.split('/').includes('..')
  ) {
    throw new Error(
      'DA5 V5 Validation bundle native module graph is unavailable',
    );
  }
  return value.slice(1);
}

function canonicalAbsolute(value) {
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw new Error(
      'DA5 V5 Validation native module path is unavailable',
    );
  }
  const canonical = normalize(resolve(value));
  if (canonical !== value) {
    throw new Error(
      'DA5 V5 Validation native module path is not canonical',
    );
  }
  return canonical;
}
