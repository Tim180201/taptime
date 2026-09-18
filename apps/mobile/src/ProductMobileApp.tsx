import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBuildIdentity } from './design/AppBuildIdentity';
import { AppText as Text } from './design/primitives';
import { mobileTokens } from './design/tokens';
import { AppNavigator } from './navigation/AppNavigator';
import { createProductMobileRuntime } from './runtime/ProductMobileRuntime';

export function ProductMobileApp() {
  const creation = useMemo(() => createProductMobileRuntime(), []);

  if (Platform.OS === 'web') {
    return <UnsupportedNfcPlatform />;
  }
  if (creation.status === 'unavailable') {
    return <UnavailableProductRuntime />;
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
  const [startFailed, setStartFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void runtime.start().catch(() => {
      if (active) {
        setStartFailed(true);
      }
    });
    return () => {
      active = false;
      runtime.stop();
    };
  }, [runtime]);

  if (startFailed) {
    return <UnavailableProductRuntime />;
  }
  return <AppNavigator employees={runtime.employees}
    session={runtime.session}
    scan={runtime.scan}
    administration={runtime.administration}
    work={runtime.work}
    offlineManual={runtime.offlineManual}
  />;
}

function UnavailableProductRuntime() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Taptura ist nicht verfügbar.</Text>
      <Text>Die sichere Laufzeitkonfiguration konnte nicht geladen werden.</Text>
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
