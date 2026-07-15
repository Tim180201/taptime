import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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
    <View style={styles.container}>
      <Text style={styles.title}>NFC wird hier nicht unterstützt.</Text>
      <Text>Produktive NFC-Scans sind in dieser Version ausschließlich auf Android verfügbar.</Text>
    </View>
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
  return <AppNavigator session={runtime.session} scan={runtime.scan} administration={runtime.administration} />;
}

function UnavailableProductRuntime() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e ist nicht verfügbar.</Text>
      <Text>Die sichere Laufzeitkonfiguration konnte nicht geladen werden.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
});
