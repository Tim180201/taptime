import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const androidDirectory = fileURLToPath(new URL('../android', import.meta.url));
const sourceManifest = read('app/src/main/AndroidManifest.xml');
const mergedManifest = read(
  'app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
);
const backupRules = read('app/src/main/res/xml/taptime_offline_backup_rules.xml');
const extractionRules = read(
  'app/src/main/res/xml/taptime_offline_data_extraction_rules.xml',
);

for (const [name, manifest] of [
  ['generated', sourceManifest],
  ['merged release', mergedManifest],
]) {
  requireText(manifest, 'android:allowBackup="false"', `${name} manifest`);
  requireText(
    manifest,
    'android:fullBackupContent="@xml/taptime_offline_backup_rules"',
    `${name} manifest`,
  );
  requireText(
    manifest,
    'android:dataExtractionRules="@xml/taptime_offline_data_extraction_rules"',
    `${name} manifest`,
  );
}

for (const [name, rules] of [
  ['legacy backup rules', backupRules],
  ['Android 12+ extraction rules', extractionRules],
]) {
  requireText(rules, '<exclude domain="sharedpref" path="SecureStore" />', name);
  requireText(rules, '<exclude domain="file" path="SQLite" />', name);
  requireText(rules, '<exclude domain="database" path="." />', name);
}
requireText(
  extractionRules,
  '<cloud-backup disableIfNoEncryptionCapabilities="true">',
  'Android 12+ extraction rules',
);
requireText(extractionRules, '<device-transfer>', 'Android 12+ extraction rules');

process.stdout.write('offline_storage_android_backup_boundary_verified\n');

function read(relativePath) {
  return readFileSync(`${androidDirectory}/${relativePath}`, 'utf8');
}

function requireText(source, expected, name) {
  if (!source.includes(expected)) {
    throw new Error(`${name} is missing the required offline-storage boundary`);
  }
}
