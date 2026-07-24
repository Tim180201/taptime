import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { AndroidConfig } = require('expo/config-plugins');
const {
  mutateAndroidManifest,
  patchMainActivityAtProjectRootAsync,
  patchMainActivitySource,
  techFilterXml,
} = require('../../plugins/withNfcTagDispatch');

describe('Android NFC Tag Dispatch configuration plugin', () => {
  it('adds only TECH_DISCOVERED plus the reviewed technology metadata idempotently', () => {
    const manifest = {
      manifest: {
        'uses-permission': [],
        application: [{
          $: {},
          activity: [{
            $: { 'android:name': '.MainActivity' },
            'intent-filter': [],
          }],
        }],
      },
    };
    mutateAndroidManifest(manifest);
    mutateAndroidManifest(manifest);
    const serialized = JSON.stringify(manifest);

    expect(serialized).toContain('android.permission.NFC');
    expect(serialized).toContain('android.nfc.action.TECH_DISCOVERED');
    expect(serialized).toContain('@xml/taptime_nfc_tech_filter');
    expect(serialized).not.toContain('android.nfc.action.TAG_DISCOVERED');
    expect(serialized).not.toContain('NDEF_DISCOVERED');
    expect(serialized.match(/android\.permission\.NFC/g)).toHaveLength(1);
  });

  it('patches cold and warm intents exactly once without a background service', () => {
    const source = `package com.taptime.mobile

import android.os.Bundle

class MainActivity {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
  }
}
`;
    const once = patchMainActivitySource(source);
    const twice = patchMainActivitySource(once);

    expect(twice).toBe(once);
    expect(once).toContain('TapTimeNfcIngress.captureIntent(intent)');
    expect(once).toContain('override fun onNewIntent(intent: Intent)');
    expect(once).not.toContain('Service');
    expect(once).not.toContain('WakeLock');
  });

  it('keeps the supported filter UID-only and technology-bounded', () => {
    const xml = techFilterXml();
    expect(xml).toContain('android.nfc.tech.NfcA');
    expect(xml).toContain('android.nfc.tech.MifareUltralight');
    expect(xml.match(/<tech-list>/g)).toHaveLength(1);
    expect(xml).not.toContain('android.nfc.tech.NfcB');
    expect(xml).not.toContain('android.nfc.tech.NfcF');
    expect(xml).not.toContain('android.nfc.tech.NfcV');
    expect(xml).not.toContain('Ndef');
    expect(xml).not.toContain('IsoDep');
  });

  it('adds the warm capture to an existing onNewIntent override', () => {
    const source = `package com.taptime.mobile

import android.content.Intent
import android.os.Bundle

class MainActivity {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
  }
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
  }
}
`;
    const patched = patchMainActivitySource(source);
    expect(patched.match(/TapTimeNfcIngress\.captureIntent\(intent\)/g)).toHaveLength(2);
    expect(patchMainActivitySource(patched)).toBe(patched);
  });

  it('uses the locked Expo path API to patch the exact Kotlin MainActivity idempotently', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'taptime-nfc-plugin-'));
    const mainActivityPath = join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'java',
      'com',
      'taptime',
      'mobile',
      'MainActivity.kt',
    );
    const source = `package com.taptime.mobile

import android.os.Bundle

class MainActivity {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
  }
}
`;

    try {
      mkdirSync(dirname(mainActivityPath), { recursive: true });
      writeFileSync(mainActivityPath, source, 'utf8');

      const discovered = await AndroidConfig.Paths.getMainActivityAsync(projectRoot);
      expect(discovered.path).toBe(mainActivityPath);
      expect(discovered.language).toBe('kt');

      await patchMainActivityAtProjectRootAsync(projectRoot);
      const once = readFileSync(mainActivityPath, 'utf8');
      await patchMainActivityAtProjectRootAsync(projectRoot);
      const twice = readFileSync(mainActivityPath, 'utf8');

      expect(twice).toBe(once);
      expect(once).toContain(
        'override fun onCreate(savedInstanceState: Bundle?) {\n'
        + '    TapTimeNfcIngress.captureIntent(intent)',
      );
      expect(once).toContain(
        'override fun onNewIntent(intent: Intent) {\n'
        + '    super.onNewIntent(intent)\n'
        + '    setIntent(intent)\n'
        + '    TapTimeNfcIngress.captureIntent(intent)',
      );
      expect(once.match(/TapTimeNfcIngress\.captureIntent\(intent\)/g)).toHaveLength(2);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when the locked Expo path API cannot find MainActivity', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'taptime-nfc-plugin-missing-'));

    try {
      await expect(
        patchMainActivityAtProjectRootAsync(projectRoot),
      ).rejects.toThrow('Project file "MainActivity" does not exist');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
