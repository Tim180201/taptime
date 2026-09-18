import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL(
  '../../modules/taptime-nfc-ingress/android/src/main/java/com/taptime/nfcingress/TapTimeNfcIngressModule.kt',
  import.meta.url,
), 'utf8');

// Source boundary checks, not a Kotlin/device execution claim. All entrances must share the
// same tag-required predicate; a normal web link must never turn into NFC time evidence.
describe('native NFC intent boundary', () => {
  it('requires EXTRA_TAG for TECH, NDEF and Android 16 VIEW, rejecting every other action', () => {
    const predicate = source.slice(source.indexOf('private fun isNfcIntent('), source.indexOf('private fun captureIntent('));
    expect(predicate).toMatch(/if \(intent == null \|\| !intent\.hasExtra\(NfcAdapter\.EXTRA_TAG\)\) return false/);
    expect(predicate).toMatch(/when \(intent\.action\)\s*\{\s*NfcAdapter\.ACTION_TECH_DISCOVERED,\s*NfcAdapter\.ACTION_NDEF_DISCOVERED,\s*Intent\.ACTION_VIEW -> true\s*else -> false/s);
  });

  it('applies the predicate to restored launches, capture and extras cleanup without changing UID evidence', () => {
    expect(source).toContain('val isNfcIntent = isNfcIntent(intent)');
    for (const method of ['captureIntent', 'stripNfcExtras']) {
      const body = source.slice(source.indexOf(`private fun ${method}(`));
      expect(body).toMatch(/\{\s*if \(intent == null \|\| !isNfcIntent\(intent\)\) return/);
    }
    expect(source).toContain('if (isHistoryLaunch || (isRestoredCreation && !isNfcIntent))');
    expect(source).toContain('val tag = intent.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)\n    stripNfcExtras(intent)');
    expect(source).toContain('val uid = tag?.id?.copyOf() ?: return');
    for (const extra of ['EXTRA_TAG', 'EXTRA_ID', 'EXTRA_NDEF_MESSAGES']) {
      expect(source).toContain(`intent.removeExtra(NfcAdapter.${extra})`);
    }
    expect(source).not.toContain('getData(');
    expect(source).not.toContain('NdefMessage');
  });
});
