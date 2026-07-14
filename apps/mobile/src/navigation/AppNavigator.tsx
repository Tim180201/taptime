import { useSyncExternalStore } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { MobileSessionCapability } from '../auth/contracts';
import type { ProductScanCapability } from '../scan/contracts';
import { LoginScreen } from '../screens/LoginScreen';
import { ScanScreen } from '../screens/ScanScreen';

export function AppNavigator({
  session,
  scan,
}: {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
}) {
  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getState(),
    () => session.getState(),
  );

  if (state.status === 'authenticated') {
    return (
      <ScanScreen
        session={state.session}
        scan={scan}
        signOut={() => session.signOut()}
      />
    );
  }
  if (state.status === 'context_unavailable') {
    return (
      <MessageScreen title="Sitzungskontext vorübergehend nicht verfügbar.">
        <Button title="Erneut versuchen" onPress={() => session.retryContext()} />
        <Button title="Abmelden" onPress={() => session.signOut()} />
      </MessageScreen>
    );
  }
  if (state.status === 'runtime_unavailable') {
    return <MessageScreen title="TapTim.e ist derzeit nicht verfügbar." />;
  }
  if (state.status === 'initializing') {
    return <MessageScreen title="Sitzung wird sicher wiederhergestellt …" />;
  }
  return (
    <LoginScreen
      signIn={(email, password) => session.signIn(email, password)}
      disabled={state.status === 'signing_in'}
    />
  );
}

function MessageScreen({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});
