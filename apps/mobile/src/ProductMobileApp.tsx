import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppNavigator } from './navigation/AppNavigator';
import { createProductMobileRuntime } from './runtime/ProductMobileRuntime';

export function ProductMobileApp() {
  const creation = useMemo(() => createProductMobileRuntime(), []);

  if (creation.status === 'unavailable') {
    return <UnavailableProductRuntime />;
  }
  return <ReadyProductMobileApp runtime={creation.runtime} />;
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
    return () => runtime.stop();
  }, [runtime]);

  if (startFailed) {
    return <UnavailableProductRuntime />;
  }
  return <AppNavigator session={runtime.session} />;
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
