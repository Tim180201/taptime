import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import mark from '../../../../shared/brand/mark.json';

const moduleRoot = new URL('../../modules/taptime-lock-screen/android/src/main/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, moduleRoot), 'utf8');

it('T-104d regenerates the compact white 24 dp vector and Mint accent from mark.json', () => {
  const root = mkdtempSync(join(tmpdir(), 't104d-brand-'));
  try {
    const generator = fileURLToPath(new URL('../../scripts/generateLockScreenBrand.mjs', import.meta.url));
    const generated = spawnSync(process.execPath, [generator, root], { encoding: 'utf8' });
    expect(generated.status, generated.stderr).toBe(0);
    for (const path of ['drawable/taptime_notification.xml', 'values/taptime_notification_brand.xml']) {
      expect(read(`res/${path}`)).toBe(readFileSync(join(root, path), 'utf8'));
    }
    const vector = read('res/drawable/taptime_notification.xml');
    expect(vector).toContain('android:width="24dp" android:height="24dp"');
    for (const path of mark.compact.paths) {
      expect(vector).toContain(`android:pathData="${path.d}"`);
      expect(vector).toContain(`android:strokeWidth="${path.width}" android:strokeAlpha="${path.opacity}"`);
    }
    expect([...vector.matchAll(/android:(?:fillColor|strokeColor)="([^"]+)"/g)].map(match => match[1]))
      .toEqual(expect.arrayContaining(['#FFFFFF', '@android:color/transparent']));
    expect(vector).not.toMatch(/#(?!FFFFFF)[0-9a-f]{6}/i);
    expect(read('res/values/taptime_notification_brand.xml')).toContain(`>${mark.colors.mint}</color>`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('T-104d uses the generated resources in a silent standard notification with the existing actions', () => {
  const notification = read('java/com/taptime/lockscreen/LockScreenNotification.kt');
  expect(notification).toContain('.setSmallIcon(R.drawable.taptime_notification)');
  expect(notification).toContain('.setColor(context.getColor(R.color.taptime_notification_accent))');
  expect(notification).toContain('LockScreenLogic.notificationText(');
  expect(notification).toContain('.setContentTitle(content.title).setContentText(content.text)');
  expect(notification).toContain('LockScreenLogic.actionLabel(action)');
  expect(notification).toContain('listOf(if (status == "paused") "resume" else "pause", "stop")');
  expect(notification).toContain('Display.NOT_SENT, Display.UNCONFIRMED -> listOf("retry")');
  expect(notification).toContain('"pause" -> 1041; "resume" -> 1042; "stop" -> 1043; else -> 1044');
  expect(notification).toContain('.setShowWhen(running).setUsesChronometer(running)');
  expect(notification).toContain('builder.setWhen(now - elapsed * 1000)');
  expect(notification).toContain('NotificationCompat.Builder(context, CHANNEL)');
  expect(notification).toContain('if (Build.VERSION.SDK_INT >= 36 && !stopped && manager.canPostPromotedNotifications()) {\n      builder.setRequestPromotedOngoing(true)');
  expect(notification).toContain('if (status == "paused" && display == Display.STATE) builder.setShortCriticalText(LockScreenLogic.duration(seconds))');
  expect(notification).toContain('setSound(null, null); enableVibration(false)');
  expect(notification).toContain('.setSound(null).setVibrate(longArrayOf()).setDefaults(0)');
  expect(notification).not.toMatch(/ic_lock_idle_alarm|setColorized|RemoteViews|setCustom\w*View|startForeground/);
  const manifest = read('AndroidManifest.xml');
  expect(manifest).toContain('<receiver android:name=".LockScreenActionReceiver" android:exported="false"');
  expect(manifest).toContain('android.permission.POST_PROMOTED_NOTIFICATIONS');
  expect(manifest).not.toMatch(/FOREGROUND_SERVICE|<service\b/);
  const permissions = [...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(match => match[1]);
  expect(permissions.every(name => ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.POST_NOTIFICATIONS', 'android.permission.POST_PROMOTED_NOTIFICATIONS'].includes(name))).toBe(true);
});
