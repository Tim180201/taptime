import { useState, useSyncExternalStore } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { MobileSessionCapability } from '../auth/contracts';
import type { ProductScanCapability } from '../scan/contracts';
import type { AdminSetupCapability } from '../administration/contracts';
import { AdminSetupScreen } from '../screens/AdminSetupScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { EmployeeEnrollmentScreen } from '../screens/EmployeeEnrollmentScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { canPresentOfflineCaptureShell } from './offlineCaptureShell';

export function AppNavigator({
  session,
  scan,
  administration,
}: {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
}) {
  const [administratorView, setAdministratorView] = useState<'scan' | 'setup'>('scan');
  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getState(),
    () => session.getState(),
  );
  const scanState = useSyncExternalStore(
    (listener) => scan.subscribe(listener),
    () => scan.getState(),
    () => scan.getState(),
  );

  if (state.status === 'authenticated') {
    if (state.session.role === 'administrator') {
      return (
        <View style={styles.administratorShell}>
          <View style={styles.tabs}>
            <Button title="Zeiterfassung" onPress={() => { void administration.cancel(); setAdministratorView('scan'); }} />
            <Button title="NFC-Einrichtung" onPress={() => { void scan.cancel(); setAdministratorView('setup'); }} />
          </View>
          {administratorView === 'setup'
            ? <AdminSetupScreen administration={administration} />
            : <ScanScreen actor={state.session.role} scan={scan} signOut={() => session.signOut()} />}
        </View>
      );
    }
    return (
      <ScanScreen
        actor={state.session.role}
        scan={scan}
        signOut={() => session.signOut()}
      />
    );
  }
  if (state.status === 'enrollment_only') {
    return <EmployeeEnrollmentScreen
      notice={state.notice}
      redeem={(invitationSecret) => session.redeemEmployeeInvitation(invitationSecret)}
      signOut={() => session.signOut()}
    />;
  }
  if (state.status === 'context_unavailable') {
    if (canPresentOfflineCaptureShell(state, scanState)) {
      return (
        <ScanScreen
          actor="offline"
          scan={scan}
          signOut={() => session.signOut()}
        />
      );
    }
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
      signInForEmployeeEnrollment={(email, password) => (
        session.signInForEmployeeEnrollment(email, password)
      )}
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
  administratorShell: { flex: 1 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 42, paddingBottom: 4, backgroundColor: '#fff' },
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
