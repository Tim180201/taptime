const fs = require('node:fs');
const path = require('node:path');
const { withInfoPlist, withXcodeProject, withAppDelegate } = require('expo/config-plugins');
const plist = require('@expo/plist').default;

const targetName = 'TapTimeLiveActivity';
const fonts = ['400Regular/Manrope_400Regular.ttf', '600SemiBold/Manrope_600SemiBold.ttf', '800ExtraBold/Manrope_800ExtraBold.ttf'];

module.exports = function withTaptimeLiveActivity(config) {
  const bundleIdentifier = `${config.ios.bundleIdentifier}.${targetName}`;
  const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (!scheme) throw new Error('Live Activity needs the installed variant URL scheme.');
  // EAS needs this before prebuild in order to discover the extension's separate signing credentials.
  const eas = config.extra?.eas ?? {};
  const ios = eas.build?.experimental?.ios ?? {};
  config.extra = { ...config.extra, eas: { ...eas, build: { ...eas.build, experimental: {
    ...eas.build?.experimental, ios: { ...ios, appExtensions: [
      ...(ios.appExtensions ?? []).filter(extension => extension.targetName !== targetName),
      { targetName, bundleIdentifier, entitlements: {} },
    ] },
  } } } };
  config = withInfoPlist(config, mod => {
    mod.modResults.NSSupportsLiveActivities = true;
    mod.modResults.TapTimeLockScreenScheme = scheme;
    mod.modResults.CFBundleShortVersionString = '$(MARKETING_VERSION)';
    mod.modResults.CFBundleVersion = '$(CURRENT_PROJECT_VERSION)';
    return mod;
  });
  config = withAppDelegate(config, mod => {
    if (mod.modResults.language !== 'swift') throw new Error('Live Activity requires the Expo Swift AppDelegate.');
    if (!mod.modResults.contents.includes('TapTimeForegroundLaunch.run')) {
      const pattern = /window = UIWindow\(frame: UIScreen.main.bounds\)\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\s*\)/;
      if (!pattern.test(mod.modResults.contents)) throw new Error('Expo AppDelegate changed: review the foreground startup boundary.');
      mod.modResults.contents = mod.modResults.contents.replace(pattern,
        call => `TapTimeForegroundLaunch.run(application: application) { [self] in\n      ${call.replace(/\n/g, '\n  ')}\n    }`);
    }
    return mod;
  });
  return withXcodeProject(config, mod => {
    const project = mod.modResults;
    const root = mod.modRequest.projectRoot;
    const nativeRoot = mod.modRequest.platformProjectRoot;
    const source = path.join(root, 'modules/taptime-lock-screen');
    const destination = path.join(nativeRoot, targetName);
    fs.mkdirSync(destination, { recursive: true });
    const shared = ['LockScreenModel.swift', 'LockScreenAttributes.swift'];
    const widget = ['TapTimeLiveActivity.swift', 'LockScreenActionIntent.swift', 'TapTimeForegroundLaunch.swift'];
    for (const name of shared) fs.copyFileSync(path.join(source, 'ios', name), path.join(destination, name));
    for (const name of widget) fs.copyFileSync(path.join(source, 'widget', name), path.join(destination, name));
    for (const font of fonts) fs.copyFileSync(require.resolve(`@expo-google-fonts/manrope/${font}`), path.join(destination, path.basename(font)));
    const assets = path.join(destination, 'Assets.xcassets');
    const mark = path.join(assets, 'TaptimeMark.imageset');
    fs.mkdirSync(mark, { recursive: true });
    fs.copyFileSync(path.join(root, '../../shared/brand/mark-compact.svg'), path.join(mark, 'mark.svg'));
    fs.writeFileSync(path.join(assets, 'Contents.json'), JSON.stringify({ info: { version: 1, author: 'xcode' } }));
    fs.writeFileSync(path.join(mark, 'Contents.json'), JSON.stringify({ images: [{ idiom: 'universal', filename: 'mark.svg' }],
      info: { version: 1, author: 'xcode' }, properties: { 'preserves-vector-representation': true } }));
    fs.writeFileSync(path.join(destination, 'Info.plist'), plist.build({
      CFBundleDisplayName: config.name, CFBundleName: '$(PRODUCT_NAME)', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundlePackageType: 'XPC!', CFBundleInfoDictionaryVersion: '6.0',
      CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
      UIAppFonts: fonts.map(font => path.basename(font)), NSSupportsLiveActivities: true,
    }));
    if (Object.values(project.pbxNativeTargetSection()).some(target => target.name?.replaceAll('"', '') === targetName)) return mod;
    // node-xcode requires these sections even if the template has no existing target dependency.
    project.hash.project.objects.PBXTargetDependency ??= {};
    project.hash.project.objects.PBXContainerItemProxy ??= {};
    const app = project.getFirstTarget().uuid;
    const appTarget = project.getFirstTarget().firstTarget;
    const target = project.addTarget(targetName, 'app_extension', targetName, bundleIdentifier);
    const objects = project.hash.project.objects;
    const group = project.addPbxGroup([], targetName, targetName);
    objects.PBXGroup[project.getFirstProject().firstProject.mainGroup].children.push({ value: group.uuid, comment: targetName });
    const names = [...shared, ...widget, 'Assets.xcassets', ...fonts.map(font => path.basename(font)), 'Info.plist'];
    const references = Object.fromEntries(names.map(name => [name, project.addFile(name, group.uuid)]));
    // A file reference may be shared; each target owns its own PBXBuildFile.
    const addToPhase = (phase, name, kind) => {
      const uuid = project.generateUuid();
      const comment = `${name} in ${kind}`;
      objects.PBXBuildFile[uuid] = { isa: 'PBXBuildFile', fileRef: references[name].fileRef, fileRef_comment: name };
      objects.PBXBuildFile[`${uuid}_comment`] = comment;
      phase.files.push({ value: uuid, comment });
    };
    const appSources = project.pbxSourcesBuildPhaseObj(app);
    for (const name of ['LockScreenActionIntent.swift', 'TapTimeForegroundLaunch.swift']) addToPhase(appSources, name, 'Sources');
    const sources = project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid).buildPhase;
    for (const name of [...shared, 'LockScreenActionIntent.swift', 'TapTimeLiveActivity.swift']) addToPhase(sources, name, 'Sources');
    const resources = project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid).buildPhase;
    for (const name of ['Assets.xcassets', ...fonts.map(font => path.basename(font))]) addToPhase(resources, name, 'Resources');
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    const embed = appTarget.buildPhases.find(ref => objects.PBXCopyFilesBuildPhase?.[ref.value]?.files.some(file =>
      objects.PBXBuildFile[file.value].fileRef === target.pbxNativeTarget.productReference));
    if (!embed) throw new Error('Live Activity extension is not embedded.');
    appTarget.buildPhases = appTarget.buildPhases.filter(ref => ref !== embed);
    const firstScript = appTarget.buildPhases.findIndex(ref => objects.PBXShellScriptBuildPhase?.[ref.value]);
    appTarget.buildPhases.splice(firstScript < 0 ? appTarget.buildPhases.length : firstScript, 0, embed);
    // Both targets inherit one project-level version. EAS remote version synchronization
    // also discovers the extension via appExtensions and updates both native Info.plists.
    const configurationsFor = item => project.pbxXCConfigurationList()[item.buildConfigurationList].buildConfigurations
      .map(({ value }) => project.pbxXCBuildConfigurationSection()[value]);
    for (const configuration of configurationsFor(project.getFirstProject().firstProject)) {
      configuration.buildSettings.MARKETING_VERSION = `"${config.version}"`;
      configuration.buildSettings.CURRENT_PROJECT_VERSION = `"${config.ios.buildNumber ?? '1'}"`;
    }
    for (const configuration of configurationsFor(appTarget)) {
      delete configuration.buildSettings.MARKETING_VERSION;
      delete configuration.buildSettings.CURRENT_PROJECT_VERSION;
    }
    const configurations = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList].buildConfigurations;
    for (const { value } of configurations) {
      Object.assign(project.pbxXCBuildConfigurationSection()[value].buildSettings, {
        INFOPLIST_FILE: `"${targetName}/Info.plist"`, IPHONEOS_DEPLOYMENT_TARGET: '16.4',
        SWIFT_VERSION: '5.0', SWIFT_ACTIVE_COMPILATION_CONDITIONS: '"$(inherited) TAPTIME_WIDGET"',
        TARGETED_DEVICE_FAMILY: '1', APPLICATION_EXTENSION_API_ONLY: 'YES',
        CODE_SIGN_STYLE: 'Automatic', GENERATE_INFOPLIST_FILE: 'NO',
      });
    }
    return mod;
  });
};
