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
