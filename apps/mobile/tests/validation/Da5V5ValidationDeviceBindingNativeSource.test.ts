import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleDirectory = fileURLToPath(new URL(
  '../../modules/taptime-da5-v5-validation-device-binding/',
  import.meta.url,
));

describe('DA5 V5 Android device binding native source', () => {
  it('selects one allowed provider without rejecting unrelated services', async () => {
    const kotlin = await readFile(
      `${moduleDirectory}/android/src/main/java/com/taptime/`
      + 'da5validationbinding/Da5V5ValidationDeviceBindingModule.kt',
      'utf8',
    );
    expect(kotlin).toContain('Build.MODEL');
    expect(kotlin).toContain('Build.VERSION.RELEASE');
    expect(kotlin).toContain('Build.VERSION.SDK_INT');
    expect(kotlin).toContain('Build.FINGERPRINT');
    expect(kotlin).not.toContain('Build.DISPLAY');
    expect(kotlin).not.toContain('longVersionCode');
    expect(kotlin).toContain(
      '"talkBackPackageVersion" to versionName',
    );
    expect(kotlin).toContain(
      '"talkBackPackageName" to talkBackPackageName',
    );
    expect(kotlin).toContain('configuration.fontScale');
    expect(kotlin).toContain('com.google.android.marvin.talkback');
    expect(kotlin).toContain(
      'com.samsung.android.accessibility.talkback',
    );
    expect(kotlin).toContain('getEnabledAccessibilityServiceList');
    expect(kotlin).toContain('Settings.Secure.ACCESSIBILITY_ENABLED');
    expect(kotlin).toMatch(
      /val activeTalkBackServices = enabledServices\s+\.filter \{ service ->\s+service\.packageName in ALLOWED_TALKBACK_PACKAGES\s+\}/u,
    );
    expect(kotlin).toContain('val talkBackPackageName = activeTalkBackServices');
    expect(kotlin).toContain('.singleOrNull()');
    expect(kotlin).toContain('activeTalkBackServices.all { service ->');
    expect(kotlin).not.toContain('enabledServices.all { service ->');
    expect(kotlin).toContain('service.enabled');
    expect(kotlin).toContain('packageInfo.applicationInfo?.enabled == true');
    expect(kotlin).toContain('"talkBackEnabled" to true');
    expect(kotlin).not.toContain('.any { service ->');
    expect(kotlin).not.toMatch(
      /getInstalledPackages|getInstalledApplications|queryAccessibilityServices|queryIntentServices/u,
    );
    expect(kotlin).not.toMatch(
      /Build\.SERIAL|ANDROID_ID|Telephony|Account|Location|Wifi|Bluetooth|Socket|Http|Database|SharedPreferences|System\.currentTimeMillis/u,
    );
  });

  it('is excluded from ordinary Product autolinking', async () => {
    const packageJson = JSON.parse(await readFile(
      fileURLToPath(new URL('../../package.json', import.meta.url)),
      'utf8',
    ));
    expect(packageJson.expo.autolinking.exclude).toEqual([
      'taptime-da5-v5-validation-device-binding',
    ]);
  });
});
