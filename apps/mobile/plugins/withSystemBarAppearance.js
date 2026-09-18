const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

// SDK 57 always draws edge-to-edge and makes both bars transparent. The old
// androidNavigationBar/androidStatusBar config fields have no effect in this SDK.
// RN reads this theme flag before enabling edge-to-edge: it prevents Android's
// three-button contrast scrim over our dark canvas, without hiding navigation.
module.exports = function withSystemBarAppearance(config) {
  return withAndroidStyles(config, (mod) => {
    for (const name of ['android:windowLightNavigationBar', 'android:enforceNavigationBarContrast']) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true, parent: AndroidConfig.Styles.getAppThemeGroup(), name, value: 'false',
      });
    }
    return mod;
  });
};
