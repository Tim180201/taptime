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
  it('canonicalizes only the exact NFC dispatch while preserving unrelated filters idempotently', () => {
    const launcherFilter = {
      action: [{
        $: { 'android:name': 'android.intent.action.MAIN' },
      }],
      category: [{
        $: { 'android:name': 'android.intent.category.LAUNCHER' },
      }],
    };
    const deepLinkFilter = {
      action: [{
        $: { 'android:name': 'android.intent.action.VIEW' },
      }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
      ],
      data: [{ $: { 'android:scheme': 'taptime' } }],
    };
    const manifest = manifestFixture({
      mainFilters: [launcherFilter, deepLinkFilter],
    });
    mutateAndroidManifest(manifest);
    mutateAndroidManifest(manifest);
    const serialized = JSON.stringify(manifest);
    const mainActivity = (
      manifest.manifest.application[0].activity[0]
    ) as unknown as {
      'intent-filter': {
        action?: { $?: { 'android:name'?: string } }[];
      }[];
      'meta-data': {
        $?: {
          'android:name'?: string;
          'android:resource'?: string;
        };
      }[];
    };

    expect(serialized).toContain('android.permission.NFC');
    expect(serialized).toContain('android.nfc.action.TECH_DISCOVERED');
    expect(serialized).toContain('@xml/taptime_nfc_tech_filter');
    expect(serialized).not.toContain('android.nfc.action.TAG_DISCOVERED');
    expect(serialized).not.toContain('NDEF_DISCOVERED');
    expect(serialized.match(/android\.permission\.NFC/g)).toHaveLength(1);
    expect(mainActivity['intent-filter']).toContain(launcherFilter);
    expect(mainActivity['intent-filter']).toContain(deepLinkFilter);
    expect(
      mainActivity['intent-filter']
        .filter((filter: {
          action?: { $?: { 'android:name'?: string } }[];
        }) => filter.action?.some((action) =>
          action.$?.['android:name']
            === 'android.nfc.action.TECH_DISCOVERED')),
    ).toHaveLength(1);
    expect(
      mainActivity['meta-data']
        .filter((metadata: {
          $?: {
            'android:name'?: string;
            'android:resource'?: string;
          };
        }) => (
          metadata.$?.['android:name']
            === 'android.nfc.action.TECH_DISCOVERED'
          && metadata.$?.['android:resource']
            === '@xml/taptime_nfc_tech_filter'
        )),
    ).toHaveLength(1);
  });

  it.each([
    {
      create: () => manifestFixture({
        additionalActivities: [activity('.MainActivity')],
      }),
      name: 'duplicate MainActivity',
    },
    {
      create: () => manifestFixture({
        mainFilters: [exactNfcFilter(), exactNfcFilter()],
      }),
      name: 'duplicate NFC filters',
    },
    {
      create: () => manifestFixture({
        mainFilters: [{
          ...exactNfcFilter(),
          action: [
            named('android.nfc.action.TECH_DISCOVERED'),
            named('android.nfc.action.TECH_DISCOVERED'),
          ],
        }],
      }),
      name: 'duplicate TECH actions',
    },
    {
      create: () => manifestFixture({
        mainMetadata: [exactNfcMetadata(), exactNfcMetadata()],
      }),
      name: 'duplicate TECH metadata',
    },
    {
      create: () => manifestFixture({
        mainFilters: [{
          action: [named('android.nfc.action.TECH_DISCOVERED')],
        }],
      }),
      name: 'missing DEFAULT category',
    },
    {
      create: () => manifestFixture({
        mainFilters: [{
          ...exactNfcFilter(),
          category: [
            named('android.intent.category.DEFAULT'),
            named('android.intent.category.BROWSABLE'),
          ],
        }],
      }),
      name: 'additional category',
    },
    {
      create: () => manifestFixture({
        mainFilters: [{
          ...exactNfcFilter(),
          data: [{ $: { 'android:mimeType': 'text/plain' } }],
        }],
      }),
      name: 'data-constrained TECH filter',
    },
    {
      create: () => manifestFixture({
        mainFilters: [{
          ...exactNfcFilter(),
          action: [
            named('android.nfc.action.TECH_DISCOVERED'),
            named('android.nfc.action.TAG_DISCOVERED'),
          ],
        }],
      }),
      name: 'TECH plus TAG action',
    },
    {
      create: () => manifestFixture({
        mainFilters: [nfcFilter('android.nfc.action.TAG_DISCOVERED')],
      }),
      name: 'TAG action',
    },
    {
      create: () => manifestFixture({
        mainFilters: [nfcFilter('android.nfc.action.NDEF_DISCOVERED')],
      }),
      name: 'NDEF action',
    },
    {
      create: () => manifestFixture({
        mainFilters: [nfcFilter('android.nfc.action.FOREIGN')],
      }),
      name: 'foreign NFC action',
    },
    {
      create: () => manifestFixture({
        mainMetadata: [{
          $: {
            'android:name': 'android.nfc.action.TECH_DISCOVERED',
            'android:resource': '@xml/broader_nfc_filter',
          },
        }],
      }),
      name: 'wrong TECH resource',
    },
    {
      create: () => manifestFixture({
        additionalActivities: [activity(
          '.ForeignActivity',
          [exactNfcFilter()],
        )],
      }),
      name: 'foreign activity NFC filter',
    },
    {
      create: () => manifestFixture({
        aliases: [activity(
          '.ForeignAlias',
          [exactNfcFilter()],
        )],
      }),
      name: 'foreign activity-alias NFC filter',
    },
    {
      create: () => manifestFixture({
        additionalActivities: [activity(
          '.ForeignActivity',
          [],
          [exactNfcMetadata()],
        )],
      }),
      name: 'foreign activity NFC metadata',
    },
  ])('fails closed without partial mutation for $name', ({ create }) => {
    const manifest = create();
    const before = JSON.stringify(manifest);

    expect(() => mutateAndroidManifest(manifest)).toThrow(/manifest entry mismatch/u);
    expect(JSON.stringify(manifest)).toBe(before);
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
    expect(xml.match(/<tech-list>/g)).toHaveLength(1);
    expect(xml.match(/<tech>/g)).toHaveLength(1);
    expect(xml).toContain('android.nfc.tech.NfcA');
    expect(xml).not.toContain('android.nfc.tech.MifareUltralight');
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

function named(name: string) {
  return { $: { 'android:name': name } };
}

function exactNfcFilter() {
  return nfcFilter('android.nfc.action.TECH_DISCOVERED');
}

function nfcFilter(action: string) {
  return {
    action: [named(action)],
    category: [named('android.intent.category.DEFAULT')],
  };
}

function exactNfcMetadata() {
  return {
    $: {
      'android:name': 'android.nfc.action.TECH_DISCOVERED',
      'android:resource': '@xml/taptime_nfc_tech_filter',
    },
  };
}

function activity(
  name: string,
  filters: readonly object[] = [],
  metadata: readonly object[] = [],
) {
  return {
    $: { 'android:name': name },
    'intent-filter': [...filters],
    'meta-data': [...metadata],
  };
}

function manifestFixture(options: Readonly<{
  additionalActivities?: readonly object[];
  aliases?: readonly object[];
  mainFilters?: readonly object[];
  mainMetadata?: readonly object[];
}> = {}) {
  return {
    manifest: {
      'uses-permission': [] as object[],
      application: [{
        $: {},
        activity: [
          activity(
            '.MainActivity',
            options.mainFilters,
            options.mainMetadata,
          ),
          ...(options.additionalActivities ?? []),
        ],
        'activity-alias': [...(options.aliases ?? [])],
      }],
    },
  };
}
