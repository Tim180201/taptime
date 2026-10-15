import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { mobileThemes } from './tokens';
import { useMobileTheme } from './useMobileTheme';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { APP_NAME } from '../../../../shared/product';
import { brandColors } from '../../../../shared/brandGeometry';
import splashIcon from '../../../../shared/brand/app/splash-icon.png';
import layout from './startupLayout.json';
import { AppText } from './primitives';

// Called while the entry module loads, before React mounts or starts restoring a session.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export function StartupBoundary({ loading, children }: { readonly loading: boolean; readonly children?: ReactNode }) {
  const { theme, tokens } = useMobileTheme();
  const systemBarStyle = loading || theme === 'dark' ? 'light' : 'dark';
  const [slow, setSlow] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const onLayout = useCallback(() => setLaidOut(true), []);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), layout.delayMs);
    return () => clearTimeout(timer);
  }, [loading]);
  useEffect(() => {
    // Never hide onto an empty native surface. A stalled startup still hands over after 3 s.
    if (laidOut && (!loading || slow)) SplashScreen.hide();
  }, [laidOut, loading, slow]);
  return <View style={[styles.root, !loading && { backgroundColor: tokens.color.ground }]} onLayout={onLayout}>
    <StatusBar style={systemBarStyle} hidden={false} animated={false} />
    <NavigationBar style={systemBarStyle} />
    {loading ? <StartupScreen slow={slow} /> : children}
  </View>;
}

export function StartupScreen({ slow = false }: { readonly slow?: boolean }) {
  return <View style={styles.screen} accessible accessibilityLabel={`${APP_NAME} wird gestartet`}>
    <View style={styles.imageFrame}>
      <Image testID="startup-image" source={splashIcon} style={styles.image} resizeMode="contain"
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      {slow ? <AppText accessibilityLiveRegion="polite" style={styles.message}>Wird geladen …</AppText> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brandColors.ground },
  // Both native launch screens center on the full window, without safe-area padding.
  screen: { flex: 1, backgroundColor: brandColors.ground, justifyContent: 'center', alignItems: 'center' },
  imageFrame: { width: layout.imageWidth, height: layout.imageWidth },
  image: { width: layout.imageWidth, height: layout.imageWidth },
  message: { position: 'absolute', top: layout.imageWidth, left: 0, right: 0, textAlign: 'center', color: mobileThemes.dark.color.text },
});
