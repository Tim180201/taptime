import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { APP_NAME } from '../../../../shared/product';

const eas = JSON.parse(readFileSync(new URL('../../eas.json', import.meta.url), 'utf8'));
function profile(name: string): any {
  const value = eas.build[name];
  if (!value) throw new Error(`Missing profile ${name}`);
  const parent = value.extends ? profile(value.extends) : {};
  return { ...parent, ...value, env: { ...parent.env, ...value.env }, ios: { ...parent.ios, ...value.ios }, android: { ...parent.android, ...value.android } };
}
it('builds the store identity with production endpoints, AAB and automatic native versions', () => {
  const store = profile('store');
  expect(store.distribution).toBe('store');
  expect(store.ios).toMatchObject({ distribution: 'store', simulator: false });
  expect(store.android.buildType).toBe('app-bundle');
  expect(store.autoIncrement).toBe(true);
  expect(eas.cli.appVersionSource).toBe('remote');
  const publicValues = (env: Record<string, string>) => Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('EXPO_PUBLIC_')));
  expect(publicValues(store.env)).toEqual(publicValues(profile('production-validation').env));
  const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(require("./app.config.js")))'], {
    cwd: new URL('../..', import.meta.url), encoding: 'utf8', env: { ...process.env, ...store.env },
  });
  expect(result.status, result.stderr).toBe(0);
  const config = JSON.parse(result.stdout);
  expect(config.android.package).toBe('com.tim180201.mobile');
  expect(config.ios.bundleIdentifier).toBe('com.tim180201.mobile');
  expect(config.scheme).toBe('taptime');
  expect(config.name).toBe(APP_NAME);
});
