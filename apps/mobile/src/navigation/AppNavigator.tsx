import { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { MobileSessionCapability } from '../auth/contracts';
import type { ProductScanCapability } from '../scan/contracts';
import type { AdminSetupCapability } from '../administration/contracts';
import { AdminSetupScreen } from '../screens/AdminSetupScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { EmployeeEnrollmentScreen } from '../screens/EmployeeEnrollmentScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { ManualCaptureScreen } from '../screens/ManualCaptureScreen';
import { OwnTimeScreen } from '../screens/OwnTimeScreen';
import { SynchronizationScreen } from '../screens/SynchronizationScreen';
import { OfflineManualCaptureScreen } from '../screens/OfflineManualCaptureScreen';
import type { MobileWorkCapability } from '../work/contracts';
import type {
  OfflineManualCaptureCapability,
} from '../offline/OfflineCaptureCoordinator';
import {
  canPresentOfflineCaptureShell,
  OFFLINE_PRODUCT_DESTINATIONS,
} from './offlineCaptureShell';
import { mobileTokens } from '../design/tokens';
import { ActionButton, AppText as Text, TextField } from '../design/primitives';

export function AppNavigator({
  session,
  scan,
  administration,
  work,
  offlineManual,
}: {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
  readonly work?: MobileWorkCapability;
  readonly offlineManual: OfflineManualCaptureCapability;
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
  useEffect(() => {
    if (state.status === 'authenticated' && work !== undefined) {
      void work.refresh();
    }
  }, [
    state.status,
    state.status === 'authenticated' ? state.session.membershipId : null,
    work,
  ]);
  useEffect(() => {
    const handle = (url: string) => { void session.handlePasswordRecoveryUrl?.(url); };
    void Linking.getInitialURL().then((url) => { if (url !== null) handle(url); });
    const subscription = Linking.addEventListener('url', (event) => handle(event.url));
    return () => subscription.remove();
  }, [session]);

  if (state.status === 'authenticated') {
    if (work !== undefined) {
      return <AuthenticatedProductShell
        role={state.session.role}
        session={session}
        scan={scan}
        administration={administration}
        work={work}
      />;
    }
    if (state.session.role === 'administrator') {
      return (
        <View style={styles.administratorShell}>
          <View style={styles.tabs}>
            <ActionButton title="Zeiterfassung" tone="secondary"
              onPress={() => { void administration.cancel(); setAdministratorView('scan'); }} />
            <ActionButton title="NFC-Einrichtung" tone="secondary"
              onPress={() => { void scan.cancel(); setAdministratorView('setup'); }} />
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
  if (state.status === 'password_recovery') {
    return <PasswordRecoveryScreen session={session} completing={state.completing}
      notice={state.notice} />;
  }
  if (state.status === 'context_unavailable') {
    if (canPresentOfflineCaptureShell(state, scanState)) {
      return (
        <OfflineProductShell
          session={session}
          scan={scan}
          manual={offlineManual}
        />
      );
    }
    return (
      <MessageScreen title="Sitzungskontext vorübergehend nicht verfügbar.">
        <ActionButton title="Erneut versuchen" onPress={() => session.retryContext()} />
        <ActionButton title="Abmelden" tone="quiet" onPress={() => session.signOut()} />
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
      requestPasswordReset={(email) => session.requestPasswordReset?.(email)
        ?? Promise.resolve('unavailable')}
    />
  );
}

function PasswordRecoveryScreen({ session, completing, notice }: {
  readonly session: MobileSessionCapability;
  readonly completing: boolean;
  readonly notice: string | null;
}) {
  const [password, setPassword] = useState('');
  return <View style={styles.administratorShell}>
    <Text>Neues Passwort setzen</Text>
    <TextField secureTextEntry autoComplete="new-password" value={password}
      onChangeText={setPassword} placeholder="Neues Passwort" testID="recovery-password-input" />
    <ActionButton title={completing ? 'Wird geändert …' : 'Passwort ändern'}
      disabled={completing || password.length < 8}
      loading={completing}
      onPress={() => { const value = password; setPassword('');
        void session.completePasswordRecovery?.(value); }} />
    {notice === null ? null : <Text>{notice}</Text>}
  </View>;
}

type ProductDestination = 'capture' | 'manual' | 'times' | 'sync' | 'setup';
function OfflineProductShell({
  session,
  scan,
  manual,
}: {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly manual: OfflineManualCaptureCapability;
}) {
  const [destination, setDestination] = useState<
    (typeof OFFLINE_PRODUCT_DESTINATIONS)[number]
  >('capture');
  const labels = {
    capture: 'Erfassen',
    manual: 'Manuell',
    sync: 'Abgleich',
  } as const;
  const navigate = (next: (typeof OFFLINE_PRODUCT_DESTINATIONS)[number]): void => {
    if (next !== 'capture') void scan.cancel();
    setDestination(next);
  };
  return <View style={styles.productShell}>
    <View style={styles.sessionBar}>
      <Text style={styles.sessionRole}>Offline-Erfassung</Text>
      <ActionButton
        title="Abmelden"
        tone="quiet"
        style={styles.signOutAction}
        onPress={() => session.signOut()}
      />
    </View>
    <View style={styles.productContent}>
      {destination === 'capture'
        ? <ScanScreen actor="offline" scan={scan} signOut={() => session.signOut()} embedded />
        : null}
      {destination === 'manual'
        ? <OfflineManualCaptureScreen manual={manual} restorationKey="offline" />
        : null}
      {destination === 'sync' ? <SynchronizationScreen scan={scan} /> : null}
    </View>
    <View style={styles.destinationBar} accessibilityRole="tablist">
      {OFFLINE_PRODUCT_DESTINATIONS.map((item) => <ActionButton
        key={item}
        title={labels[item]}
        accessibilityRole="tab"
        accessibilityState={{ selected: item === destination }}
        onPress={() => navigate(item)}
        tone={item === destination ? 'primary' : 'quiet'}
        style={styles.destination}
      />)}
    </View>
  </View>;
}

function AuthenticatedProductShell({
  role,
  session,
  scan,
  administration,
  work,
}: {
  readonly role: 'employee' | 'administrator';
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
  readonly work: MobileWorkCapability;
}) {
  const [destination, setDestination] = useState<ProductDestination>('capture');
  const destinations: readonly {
    readonly id: ProductDestination;
    readonly label: string;
  }[] = [
    { id: 'capture', label: 'Erfassen' },
    { id: 'manual', label: 'Manuell' },
    { id: 'times', label: 'Meine Zeiten' },
    { id: 'sync', label: 'Abgleich' },
    ...(role === 'administrator'
      ? [{ id: 'setup' as const, label: 'NFC-Einrichtung' }]
      : []),
  ];

  const navigate = (next: ProductDestination): void => {
    if (next !== 'capture') void scan.cancel();
    if (next !== 'setup') void administration.cancel();
    setDestination(next);
  };

  return <View style={styles.productShell}>
    <View style={styles.sessionBar}>
      <Text style={styles.sessionRole}>
        {role === 'administrator' ? 'Administrator' : 'Beschäftigter'}
      </Text>
      <ActionButton
        title="Abmelden"
        tone="quiet"
        style={styles.signOutAction}
        onPress={() => session.signOut()}
      />
    </View>
    <View style={styles.productContent}>
      {destination === 'capture'
        ? <ScanScreen actor={role} scan={scan} signOut={() => session.signOut()} embedded />
        : null}
      {destination === 'manual' ? <ManualCaptureScreen work={work} /> : null}
      {destination === 'times' ? <OwnTimeScreen work={work} /> : null}
      {destination === 'sync' ? <SynchronizationScreen scan={scan} /> : null}
      {destination === 'setup' && role === 'administrator'
        ? <AdminSetupScreen administration={administration} />
        : null}
    </View>
    <View style={styles.destinationBar} accessibilityRole="tablist">
      {destinations.map((item) => <ActionButton
        key={item.id}
        title={item.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: item.id === destination }}
        onPress={() => navigate(item.id)}
        tone={item.id === destination ? 'primary' : 'quiet'}
        style={styles.destination}
      />)}
    </View>
  </View>;
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
  productShell: { flex: 1, backgroundColor: mobileTokens.color.canvas },
  productContent: { flex: 1 },
  sessionBar: {
    minHeight: mobileTokens.touchMinimum,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: mobileTokens.spacing.md,
    paddingTop: mobileTokens.spacing.xs,
  },
  sessionRole: { color: mobileTokens.color.inkMuted, fontSize: 13, fontWeight: '700' },
  signOutAction: {
    minHeight: mobileTokens.touchMinimum,
    paddingHorizontal: mobileTokens.spacing.sm,
  },
  destinationBar: {
    minHeight: 68,
    flexDirection: 'row',
    backgroundColor: mobileTokens.color.surface,
    borderTopColor: mobileTokens.color.border,
    borderTopWidth: 1,
    paddingHorizontal: mobileTokens.spacing.xs,
    paddingBottom: mobileTokens.spacing.sm,
  },
  destination: {
    flex: 1,
    minHeight: mobileTokens.touchMinimum,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: mobileTokens.radius.control,
    paddingHorizontal: mobileTokens.spacing.xs,
  },
  administratorShell: { flex: 1, backgroundColor: mobileTokens.color.ground },
  tabs: {
    flexDirection: 'row',
    gap: mobileTokens.spacing.sm,
    paddingTop: 40,
    paddingHorizontal: mobileTokens.spacing.md,
    paddingBottom: mobileTokens.spacing.xs,
    backgroundColor: mobileTokens.color.surface,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: mobileTokens.spacing.sm,
    paddingHorizontal: mobileTokens.spacing.lg,
    backgroundColor: mobileTokens.color.ground,
  },
  title: {
    color: mobileTokens.color.text,
    fontSize: 18,
    fontWeight: '600',
  },
});
