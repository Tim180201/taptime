import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run from any directory with node apps/mobile/scripts/generateLockScreenBrand.mjs.
// Development regenerates both resources whenever mark.json changes; remove them with the module.
const mark = JSON.parse(readFileSync(new URL('../../../shared/brand/mark.json', import.meta.url), 'utf8'));
const { viewBox, paths, dot } = mark.compact;
const [x, y, width, height] = viewBox.split(/\s+/).map(Number);
if (x !== 0 || y !== 0 || !(width > 0 && height > 0)) throw new Error('Unsupported brand viewport');
const output = process.argv[2] ? resolve(process.argv[2])
  : fileURLToPath(new URL('../modules/taptime-lock-screen/android/src/main/res/', import.meta.url));
const header = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from shared/brand/mark.json; run apps/mobile/scripts/generateLockScreenBrand.mjs. -->\n';
const resources = {
  'drawable/taptime_notification.xml': `${header}<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="${width}" android:viewportHeight="${height}">
${paths.map(path => `  <path android:pathData="${path.d}" android:fillColor="@android:color/transparent"
      android:strokeColor="#FFFFFF" android:strokeWidth="${path.width}" android:strokeAlpha="${path.opacity}"
      android:strokeLineCap="round" android:strokeLineJoin="round" />`).join('\n')}
  <path android:fillColor="#FFFFFF"
      android:pathData="M${dot.cx - dot.r} ${dot.cy}a${dot.r} ${dot.r} 0 1 0 ${2 * dot.r} 0a${dot.r} ${dot.r} 0 1 0 ${-2 * dot.r} 0Z" />
</vector>
`,
  'values/taptime_notification_brand.xml': `${header}<resources>
  <color name="taptime_notification_accent">${mark.colors.mint}</color>
</resources>
`,
};
for (const [name, contents] of Object.entries(resources)) {
  const destination = resolve(output, name);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}
