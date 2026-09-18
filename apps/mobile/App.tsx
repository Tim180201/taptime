import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ProductMobileApp } from './src/ProductMobileApp';
import { AppText as Text, FontReadyContext } from './src/design/primitives';
import { mobileTokens } from './src/design/tokens';
import { selectMobileCompositionMode } from './src/runtime/compositionMode';

import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';

const DevelopmentDemoMobileApp = lazy(async () => {
  const module = await import('./src/demo/DemoMobileApp');
  return { default: module.DemoMobileApp };
});

const PhysicalValidationMobileApp = lazy(async () => {
  const module = await import('./src/validation/PhysicalValidationMobileApp');
  return { default: module.PhysicalValidationMobileApp };
});

export default function App() {
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_800ExtraBold });
  const mode = selectMobileCompositionMode(
    process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT === 'physical-validation',
    process.env.EXPO_PUBLIC_TAPTIME_DEMO_MODE === 'true',
    __DEV__,
  );
  return (
    <SafeAreaProvider style={styles.root}>
    <FontReadyContext.Provider value={fontsLoaded}>
      {mode === 'physical_validation'
        ? (
            <Suspense fallback={<View />}>
              <PhysicalValidationMobileApp />
            </Suspense>
          )
        : mode === 'demo'
        ? (
            <Suspense fallback={<View />}>
              <DevelopmentDemoMobileApp />
            </Suspense>
          )
        : mode === 'product'
          ? <ProductMobileApp />
          : <ForbiddenConfiguration />}
      <StatusBar style="light" hidden={false} animated={false} />
    </FontReadyContext.Provider>
    </SafeAreaProvider>
  );
}

function ForbiddenConfiguration() {
  return (
    <SafeAreaView style={styles.container}>
      <Text>Die gewählte App-Komposition ist in diesem Build nicht zulässig.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileTokens.color.ground },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: mobileTokens.color.ground,
  },
});
