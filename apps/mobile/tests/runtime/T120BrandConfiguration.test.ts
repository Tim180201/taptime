import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../..');
const config = require('../../app.config.js');
const brand = resolve(root, '../../shared/brand/app');
const bundled = require('expo/bundledNativeModules.json');

it('T120 uses the supplied icons for every platform and removes the Expo placeholders', () => {
  expect(config.icon).toBe('../../shared/brand/app/icon.png');
  expect(config.ios.icon).toEqual({ light: '../../shared/brand/app/icon.png', dark: '../../shared/brand/app/icon-dark.png', tinted: '../../shared/brand/app/icon-tinted.png' });
  expect(config.android.adaptiveIcon).toEqual({ backgroundColor: '#0E1512', foregroundImage: '../../shared/brand/app/android-icon-foreground.png', monochromeImage: '../../shared/brand/app/android-icon-monochrome.png' });
  expect(config.web.favicon).toBe('../../shared/brand/app/favicon.png');
  for (const path of [config.icon, ...Object.values(config.ios.icon), config.android.adaptiveIcon.foregroundImage, config.android.adaptiveIcon.monochromeImage, config.web.favicon]) {
    expect(resolve(root, path as string).startsWith(brand + '/')).toBe(true);
    expect(existsSync(resolve(root, path as string))).toBe(true);
  }
  for (const name of ['icon.png', 'android-icon-background.png', 'android-icon-foreground.png', 'android-icon-monochrome.png', 'splash-icon.png', 'favicon.png']) expect(existsSync(resolve(root, 'assets', name))).toBe(false);
});

it('T120 configures the SDK-compatible native splash from the shared image on the brand ground', () => {
  const plugin = config.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-splash-screen');
  expect(plugin).toBeDefined();
  expect(plugin[1]).toMatchObject({ image: '../../shared/brand/app/splash-icon.png', backgroundColor: '#0E1512', resizeMode: 'contain' });
  expect(plugin[1].imageWidth).toBeGreaterThan(0);
  expect(existsSync(resolve(root, plugin[1].image))).toBe(true);
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  expect(pkg.dependencies['expo-splash-screen']).toBe(bundled['expo-splash-screen']);
});
