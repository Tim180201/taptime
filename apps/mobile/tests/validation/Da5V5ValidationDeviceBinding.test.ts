import { describe, expect, it } from 'vitest';
import {
  requireDa5V5ValidationDeviceBinding,
} from '../../src/validation/Da5V5ValidationDeviceBinding';

const valid = {
  androidApiLevel: 35,
  androidBuild:
    'samsung/a33xeea/a33x:15/AP3A.240905.015.A2/A336BXXU9EYA1:user/release-keys',
  androidRelease: '15',
  deviceModel: 'SM-A336B',
  fontScale: 2,
  talkBackEnabled: true,
  talkBackPackageName: 'com.google.android.marvin.talkback',
  talkBackPackageVersion: '15.1.0',
} as const;

describe('DA5 V5 device and accessibility binding', () => {
  it.each([
    'com.google.android.marvin.talkback',
    'com.samsung.android.accessibility.talkback',
  ] as const)(
    'preserves an exact single active allow-listed provider: %s',
    (talkBackPackageName) => {
      const binding = { ...valid, talkBackPackageName };
      expect(requireDa5V5ValidationDeviceBinding(binding)).toEqual(binding);
      expect(Object.isFrozen(
        requireDa5V5ValidationDeviceBinding(binding),
      )).toBe(true);
    },
  );

  it('preserves only the exact closed local device evidence', () => {
    expect(Object.isFrozen(
      requireDa5V5ValidationDeviceBinding(valid),
    )).toBe(true);
  });

  it.each([
    null,
    { ...valid, serial: 'forbidden' },
    { ...valid, deviceModel: '' },
    { ...valid, androidRelease: ' 15' },
    { ...valid, androidApiLevel: 35.5 },
    { ...valid, androidBuild: 'line\nbreak' },
    { ...valid, fontScale: Number.NaN },
    { ...valid, fontScale: 1.999 },
    { ...valid, fontScale: 2.001 },
    { ...valid, talkBackPackageName: '' },
    { ...valid, talkBackPackageName: 'com.example.talkback' },
    {
      ...valid,
      talkBackPackageName: [
        'com.google.android.marvin.talkback',
        'com.samsung.android.accessibility.talkback',
      ],
    },
    { ...valid, talkBackPackageVersion: '' },
    { ...valid, talkBackPackageVersion: ' 15.1.0' },
    { ...valid, talkBackPackageVersion: '15.1.0\nsecret' },
    { ...valid, talkBackEnabled: false },
  ])('fails closed for missing, malformed or expanded evidence %#', (value) => {
    expect(() => requireDa5V5ValidationDeviceBinding(value)).toThrow(
      /device binding/u,
    );
  });
});
