const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const backupRulesName = 'taptime_offline_backup_rules';
const extractionRulesName = 'taptime_offline_data_extraction_rules';

/**
 * The SQLCipher key is held in Android Keystore-backed SecureStore and cannot survive uninstall
 * or key loss. Disable app backup and retain explicit cloud/device-transfer exclusions so an OEM
 * transfer path can never restore the encrypted store without its device-bound key.
 */
module.exports = function withOfflineStorageBackupBoundary(config) {
  const withManifest = withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];
    if (application === undefined) {
      throw new Error('TapTim.e Android application manifest is unavailable');
    }
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = `@xml/${backupRulesName}`;
    application.$['android:dataExtractionRules'] = `@xml/${extractionRulesName}`;
    return manifestConfig;
  });

  return withDangerousMod(withManifest, ['android', async (modConfig) => {
    const xmlDirectory = path.join(
      modConfig.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'res',
      'xml',
    );
    await mkdir(xmlDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(xmlDirectory, `${backupRulesName}.xml`), [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<full-backup-content>',
        '  <exclude domain="sharedpref" path="SecureStore" />',
        '  <exclude domain="file" path="SQLite" />',
        '  <exclude domain="database" path="." />',
        '</full-backup-content>',
        '',
      ].join('\n'), 'utf8'),
      writeFile(path.join(xmlDirectory, `${extractionRulesName}.xml`), [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<data-extraction-rules>',
        '  <cloud-backup disableIfNoEncryptionCapabilities="true">',
        '    <exclude domain="sharedpref" path="SecureStore" />',
        '    <exclude domain="file" path="SQLite" />',
        '    <exclude domain="database" path="." />',
        '  </cloud-backup>',
        '  <device-transfer>',
        '    <exclude domain="sharedpref" path="SecureStore" />',
        '    <exclude domain="file" path="SQLite" />',
        '    <exclude domain="database" path="." />',
        '  </device-transfer>',
        '</data-extraction-rules>',
        '',
      ].join('\n'), 'utf8'),
    ]);
    return modConfig;
  }]);
};
