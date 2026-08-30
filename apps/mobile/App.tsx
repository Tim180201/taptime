import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense } from 'react';
import { StyleSheet, View } from 'react-native';
import { ProductMobileApp } from './src/ProductMobileApp';
import { AppText as Text } from './src/design/primitives';
import { mobileTokens } from './src/design/tokens';
import { selectMobileCompositionMode } from './src/runtime/compositionMode';

const DevelopmentDemoMobileApp = lazy(async () => {
  const module = await import('./src/demo/DemoMobileApp');
  return { default: module.DemoMobileApp };
});

const PhysicalValidationMobileApp = lazy(async () => {
  const module = await import('./src/validation/PhysicalValidationMobileApp');
  return { default: module.PhysicalValidationMobileApp };
});

export default function App() {
  const mode = selectMobileCompositionMode(
    process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT === 'physical-validation',
    process.env.EXPO_PUBLIC_TAPTIME_DEMO_MODE === 'true',
    __DEV__,
  );
  return (
    <>
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
      <StatusBar style="light" />
    </>
  );
}

function ForbiddenConfiguration() {
  return (
    <View style={styles.container}>
      <Text>Die gewählte App-Komposition ist in diesem Build nicht zulässig.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: mobileTokens.spacing.lg,
    backgroundColor: mobileTokens.color.ground,
  },
});
