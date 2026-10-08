import { ProductRuntimeStartup } from './runtime/ProductRuntimeStartup';
import { APP_NAME } from '../../../shared/product';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBuildIdentity } from './design/AppBuildIdentity';
import { ActionButton, AppText as Text } from './design/primitives';
import { mobileTokens } from './design/tokens';
import { AppNavigator } from './navigation/AppNavigator';
import { createProductMobileRuntime } from './runtime/ProductMobileRuntime';

export function ProductMobileApp() {
  const [attempt, setAttempt] = useState(0);
  const creation = useMemo(() => createProductMobileRuntime(), [attempt]);
  const retryCreation = () => setAttempt(value => value + 1);
  useEffect(() => {
    if (creation.status !== 'unavailable') return;
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && previous !== 'active') retryCreation();
      previous = state;
    });
    return () => listener.remove();
  }, [creation]);

  if (Platform.OS === 'web') {
    return <UnsupportedNfcPlatform />;
  }
  if (creation.status === 'unavailable') {
    return <UnavailableProductRuntime retry={retryCreation} code="R1" />;
  }
  return <ReadyProductMobileApp runtime={creation.runtime} />;
}

function UnsupportedNfcPlatform() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>NFC wird hier nicht unterstützt.</Text>
      <Text>Produktive NFC-Scans sind in dieser Version ausschließlich auf Android verfügbar.</Text>
      <AppBuildIdentity style={styles.buildIdentity} />
    </SafeAreaView>
  );
}

function ReadyProductMobileApp({
  runtime,
}: {
  readonly runtime: Extract<ReturnType<typeof createProductMobileRuntime>, { status: 'ready' }>['runtime'];
}) {
  const startup = useMemo(() => new ProductRuntimeStartup(runtime, onActive => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && previous !== 'active') onActive();
      previous = state;
    });
    return () => subscription.remove();
  }), [runtime]);
  const state = useSyncExternalStore(startup.subscribe, startup.getState, startup.getState);
  useEffect(() => {
    void startup.start();
    return () => startup.stop();
  }, [startup]);

  if (state === 'failed') return <UnavailableProductRuntime retry={() => startup.retry()} code="R2" />;
  if (state === 'starting') return <SafeAreaView style={styles.container}>
    <Text>Sitzung wird sicher wiederhergestellt …</Text>
  </SafeAreaView>;
  return <AppNavigator timeEditing={runtime.timeEditing} employees={runtime.employees}
    session={runtime.session}
    scan={runtime.scan}
    administration={runtime.administration}
    work={runtime.work}
    offlineManual={runtime.offlineManual}
  />;
}

function UnavailableProductRuntime({ retry, code }: { readonly retry: () => void; readonly code: string }) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{APP_NAME} ist nicht verfügbar.</Text>
      <Text>Bitte versuche es erneut.</Text>
      <ActionButton title="Erneut versuchen" onPress={retry} />
      <Text style={{fontSize: 12}}>Code {code}</Text>
      <AppBuildIdentity style={styles.buildIdentity} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: mobileTokens.color.ground,
  },
  title: {
    color: mobileTokens.color.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: mobileTokens.spacing.sm,
  },
  buildIdentity: { marginTop: mobileTokens.spacing.lg },
});
