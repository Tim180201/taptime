import type { EmployeesCapability } from '../employees/contracts';
import { EmployeesScreen } from '../screens/EmployeesScreen';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, View } from 'react-native';
import type { MobileSessionCapability, ProductMembershipRole, MobileManagementScope } from '../auth/contracts';
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
import { LineIcon } from '../design/LineIcon';
import { destinationLabels, productDestinations, syncIndicator, type ProductDestination } from './presentation';
import { mobileTokens } from '../design/tokens';
import { ActionButton, AppText as Text, TouchTarget, EmbeddedScreenContext, TextField } from '../design/primitives';

export function AppNavigator({
  session,
  scan,
  administration,
  work,
  offlineManual,
  employees,
}: {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
  readonly employees?: EmployeesCapability;
  readonly work?: MobileWorkCapability;
  readonly offlineManual: OfflineManualCaptureCapability;
}) {
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
    const accountKey = `${state.session.organizationId}/${state.session.membershipId}/${state.session.userId}`;
    return <ProductShell key={accountKey} role={state.session.role} nfcSetupAvailable={state.session.nfcSetupAvailable} managementScope={state.session.managementScope} locationsEnabled={state.session.locationsEnabled} employees={employees} session={session}
      scan={scan} administration={administration} work={work} offlineManual={offlineManual} />;
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
        <ProductShell key="offline" role="offline" session={session} scan={scan}
          administration={administration} offlineManual={offlineManual} />
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
    return <MessageScreen title="Taptura ist derzeit nicht verfügbar." />;
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

function ProductShell({ role, nfcSetupAvailable = false, managementScope, locationsEnabled=false, employees, session, scan, administration, work, offlineManual }: {
  readonly role: ProductMembershipRole | 'offline';
  readonly nfcSetupAvailable?: boolean;
  readonly managementScope?: MobileManagementScope | null;
  readonly locationsEnabled?: boolean;
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
  readonly employees?: EmployeesCapability;
  readonly work?: MobileWorkCapability;
  readonly offlineManual: OfflineManualCaptureCapability;
}) {
  const [destination, setDestination] = useState<ProductDestination>('capture');
  const [showSync, setShowSync] = useState(false);
  const scanState = useSyncExternalStore((listener) => scan.subscribe(listener),
    () => scan.getState(), () => scan.getState());
  const previousCount = useRef<number | null>(null);
  const status = syncIndicator(scanState, previousCount.current);
  useEffect(() => {
    if ('queueCount' in scanState) previousCount.current = scanState.queueCount;
    else if (scanState.status === 'ready' && scanState.outcome === null) previousCount.current = 0;
  }, [scanState]);
  const destinations = role === 'offline' ? OFFLINE_PRODUCT_DESTINATIONS : productDestinations({ role, nfcSetupAvailable, managementScope });
  useEffect(() => { if (!destinations.includes(destination)) setDestination('capture'); }, [destination, managementScope, nfcSetupAvailable]);
  const navigate = (next: ProductDestination) => {
    if (next !== 'capture') void scan.cancel();
    if (next !== 'setup') void administration.cancel();
    setShowSync(false);
    setDestination(next);
  };
  const openSync = () => {
    void scan.cancel();
    void administration.cancel();
    setShowSync(true);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSync) { setShowSync(false); return true; }
      if (destination !== 'capture') { navigate('capture'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [showSync, destination, scan, administration]);
  const roleLabel = role === 'administrator' ? 'Administrator' : role === 'standortleitung'
    ? 'Standortleitung' : role === 'offline' ? 'Offline-Erfassung' : 'Deine Arbeitszeit';
  return <View style={styles.productShell}>
    <View style={styles.header}>
      {showSync ? <TouchTarget accessibilityRole="button" accessibilityLabel="Zurück"
        onPress={() => setShowSync(false)} style={styles.iconAction}>
        <LineIcon name="back" color={mobileTokens.color.text} />
      </TouchTarget> : null}
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{showSync ? 'Abgleich' : destinationLabels[destination]}</Text>
        <Text style={styles.subtitle}>{roleLabel}</Text>
      </View>
      <TouchTarget accessibilityRole="button" accessibilityLabel={status.label}
        onPress={openSync} style={styles.iconAction}>
        {status.kind === 'confirmed' ? <View style={styles.confirmedDot} />
          : <View style={styles.pendingBadge}><Text style={styles.badgeText}>
            {status.count !== null && status.count > 0 ? status.count
              : status.kind === 'checking' ? '…' : '!'}
          </Text></View>}
      </TouchTarget>
    </View>
    <EmbeddedScreenContext.Provider value>
      <View style={styles.productContent}>
        <View style={{ flex: 1, display: !showSync && destination === 'capture' ? 'flex' : 'none' }}
          accessibilityElementsHidden={showSync || destination !== 'capture'}
          importantForAccessibility={showSync || destination !== 'capture' ? 'no-hide-descendants' : 'auto'}>
          <ScanScreen actor={role} scan={scan} work={work} signOut={() => session.signOut()} embedded />
        </View>
        {showSync ? <SynchronizationScreen scan={scan} indicator={status} signOut={() => session.signOut()} />
          : destination === 'capture' ? null
          : destination === 'manual' ? role === 'offline'
              ? <OfflineManualCaptureScreen manual={offlineManual} restorationKey="offline" />
              : work ? <ManualCaptureScreen work={work} /> : <MessageScreen title="Arbeitsziele sind derzeit nicht verfügbar." />
          : destination === 'employees' ? managementScope && employees ? <EmployeesScreen employees={employees} scope={managementScope} locationsEnabled={locationsEnabled} /> : null
          : destination === 'times' ? work ? <OwnTimeScreen work={work} />
              : <MessageScreen title="Deine Zeiten sind derzeit nicht verfügbar." />
          : nfcSetupAvailable ? <AdminSetupScreen administration={administration} /> : null}
      </View>
    </EmbeddedScreenContext.Provider>
    <View style={styles.destinationBar} accessibilityRole="tablist">
      {destinations.map((item) => <TouchTarget key={item} accessibilityRole="tab"
        accessibilityLabel={destinationLabels[item]}
        accessibilityState={{ selected: !showSync && item === destination }}
        onPress={() => navigate(item)}
        style={({ pressed }) => [styles.destination, pressed && styles.pressed]}>
        <LineIcon name={item} size={24} color={!showSync && item === destination
          ? mobileTokens.color.accent : mobileTokens.color.textMuted} />
        <Text style={[styles.tabLabel, !showSync && item === destination && styles.activeLabel]}>
          {destinationLabels[item]}
        </Text>
      </TouchTarget>)}
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
  productShell: { flex: 1, backgroundColor: mobileTokens.color.canvas,
    paddingTop: Platform.OS === 'android' ? 32 : 48 },
  productContent: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 8, gap: 8 },
  heading: { flex: 1 },
  title: { color: mobileTokens.color.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  subtitle: { color: mobileTokens.color.textMuted, fontSize: 13, fontWeight: '600' },
  iconAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  confirmedDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: mobileTokens.color.accent },
  pendingBadge: { minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: 999,
    backgroundColor: mobileTokens.color.notice, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: mobileTokens.color.onAccent, fontSize: 12, fontWeight: '800' },
  destinationBar: { flexDirection: 'row', backgroundColor: mobileTokens.color.surface,
    borderTopColor: mobileTokens.color.border, borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  destination: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', gap: 2 },
  tabLabel: { color: mobileTokens.color.textMuted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  activeLabel: { color: mobileTokens.color.accent },
  pressed: { backgroundColor: mobileTokens.color.surfaceRaised },
  focused: { outlineWidth: 3, outlineColor: mobileTokens.color.focus, outlineStyle: 'solid' },
  administratorShell: { flex: 1, backgroundColor: mobileTokens.color.ground, padding: 24, gap: 16 },
  container: { flex: 1, justifyContent: 'center', gap: 8, paddingHorizontal: 24,
    backgroundColor: mobileTokens.color.ground },
});
