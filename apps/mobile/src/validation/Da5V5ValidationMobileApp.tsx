import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DA5_V5_VALIDATION_ROLES,
  DA5_V5_VALIDATION_STABLE_READS,
  type Da5V5ValidationRole,
} from './Da5V5ValidationController';
import { createDa5V5ValidationRuntime } from './createDa5V5ValidationRuntime';

export function Da5V5ValidationMobileApp() {
  const controller = useMemo(createDa5V5ValidationRuntime, []);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  useEffect(() => {
    void controller.start();
    return () => {
      void controller.stop();
    };
  }, [controller]);

  const captureEnabled = state.phase === 'ready'
    && state.capability === 'ready';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>DA5 · LOKALE BINDUNG</Text>
        <Text style={styles.title}>NFC A/B/X Validation</Text>
        <Text style={styles.subtitle}>
          Isolierte lokale Prüfung ohne Anmeldung, Netzwerk, Datenbank oder
          Zeiterfassung.
        </Text>

        <View style={styles.status} accessibilityLiveRegion="polite">
          <Text style={styles.statusTitle}>{statusTitle(state.phase)}</Text>
          <Text style={styles.statusText}>
            {statusText(state.phase, state.activeRole)}
          </Text>
        </View>

        {state.deviceBinding === null ? null : (
          <View
            accessibilityLabel="Verpflichtende Gerätebindung"
            style={styles.binding}
          >
            <Text style={styles.bindingTitle}>GERÄTE-CHECKPOINT</Text>
            <BindingValue
              label="MODELL"
              value={state.deviceBinding.deviceModel}
            />
            <BindingValue
              label="ANDROID"
              value={
                `${state.deviceBinding.androidRelease} · API `
                + `${state.deviceBinding.androidApiLevel} · `
                + state.deviceBinding.androidBuild
              }
            />
            <BindingValue
              label="SCHRIFTSKALIERUNG (EXAKT)"
              value={`${state.deviceBinding.fontScale * 100}%`}
            />
            <BindingValue
              label="TALKBACK PROVIDER-PAKET (EXAKT)"
              value={state.deviceBinding.talkBackPackageName}
            />
            <BindingValue
              label="TALKBACK PROVIDER-VERSION (EXAKT)"
              value={`${state.deviceBinding.talkBackPackageVersion} · aktiviert`}
            />
          </View>
        )}

        {state.phase === 'device_checkpoint' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exakte Gerätebindung bestätigen"
            onPress={() => controller.confirmDeviceBinding()}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>
              Gerätebindung exakt bestätigen
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.slots}>
          {DA5_V5_VALIDATION_ROLES.map((role) => (
            <ValidationSlot
              key={role}
              role={role}
              active={state.activeRole === role}
              fingerprint={state.slots[role].fingerprint}
              technology={state.slots[role].technology}
              progress={state.slots[role].progress}
            />
          ))}
        </View>

        {state.phase === 'device_checkpoint' ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tag ${state.activeRole} lokal prüfen`}
            disabled={!captureEnabled}
            onPress={() => controller.captureRole(state.activeRole)}
            style={({ pressed }) => [
              styles.primary,
              (!captureEnabled || pressed) && styles.dimmed,
            ]}
          >
            <Text style={styles.primaryText}>
              {state.phase === 'capturing'
                ? `Tag ${state.activeRole} an das Gerät halten …`
                : `Tag ${state.activeRole} scannen`}
            </Text>
          </Pressable>
        )}

        {state.phase === 'capturing' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => controller.cancel()}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Scan abbrechen</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => controller.reset()}
          style={styles.reset}
        >
          <Text style={styles.resetText}>Lokale Nachweise löschen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function BindingValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View style={styles.bindingValue}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ValidationSlot({
  role,
  active,
  fingerprint,
  technology,
  progress,
}: {
  readonly role: Da5V5ValidationRole;
  readonly active: boolean;
  readonly fingerprint: string | null;
  readonly technology: string | null;
  readonly progress: number;
}) {
  return (
    <View
      accessibilityLabel={
        `Rolle ${role}, Fortschritt ${progress} von `
        + `${DA5_V5_VALIDATION_STABLE_READS}`
      }
      style={[styles.slot, active && styles.slotActive]}
    >
      <View style={styles.slotHeader}>
        <Text style={styles.role}>ROLLE {role}</Text>
        <Text style={styles.progress}>
          {progress} / {DA5_V5_VALIDATION_STABLE_READS}
        </Text>
      </View>
      <Text style={styles.label}>12-HEX SHA-256 FINGERPRINT</Text>
      <Text style={styles.value}>{fingerprint ?? '—'}</Text>
      <Text style={styles.label}>ERLAUBTE TECHNOLOGY</Text>
      <Text style={styles.value}>
        {technology ?? 'Noch nicht geprüft'}
      </Text>
    </View>
  );
}

function statusTitle(phase: string): string {
  if (phase === 'complete') return 'Alle drei Rollen stabil gebunden';
  if (phase === 'failed') return 'Prüfung sicher gestoppt';
  if (phase === 'stopped') return 'Lokale Prüfung beendet';
  if (phase === 'capturing') return 'Einzelner Scan aktiv';
  if (phase === 'device_checkpoint') {
    return 'Geräte- und Bedienungshilfen-Bindung prüfen';
  }
  if (phase === 'ready') return 'NFC bereit';
  return 'NFC wird geprüft';
}

function statusText(phase: string, role: Da5V5ValidationRole): string {
  if (phase === 'complete') {
    return 'A, B und X sind stabil, eindeutig und voneinander verschieden.';
  }
  if (phase === 'failed') {
    return 'Lokale Nachweise löschen und den vollständigen Ablauf neu beginnen.';
  }
  if (phase === 'capturing') {
    return `Ausschließlich den physisch markierten Tag ${role} präsentieren.`;
  }
  if (phase === 'device_checkpoint') {
    return 'Alle angezeigten Werte exakt mit dem Hardware-Runbook abgleichen.';
  }
  return `Nächster verpflichtender Slot: ${role}.`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F6F4' },
  content: { padding: 22, paddingBottom: 44 },
  eyebrow: {
    color: '#507065',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: '#102F25',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    marginTop: 8,
  },
  subtitle: {
    color: '#52675F',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  status: {
    backgroundColor: '#153D30',
    borderRadius: 18,
    marginTop: 22,
    padding: 18,
  },
  statusTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  statusText: {
    color: '#D8E7E1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  slots: { gap: 12, marginTop: 16 },
  binding: {
    backgroundColor: '#FFF8E8',
    borderColor: '#C58A13',
    borderRadius: 16,
    borderWidth: 2,
    marginTop: 16,
    padding: 16,
  },
  bindingTitle: {
    color: '#6A4500',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bindingValue: { marginTop: 8 },
  slot: {
    backgroundColor: '#FFF',
    borderColor: '#D4DFDA',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  slotActive: {
    backgroundColor: '#F7FFF9',
    borderColor: '#1D8A58',
    borderWidth: 2,
    padding: 15,
  },
  slotHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  role: { color: '#305F4E', fontSize: 13, fontWeight: '900' },
  progress: { color: '#12382B', fontSize: 18, fontWeight: '800' },
  label: {
    color: '#788983',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 12,
  },
  value: {
    color: '#263E35',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginTop: 4,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: '#1D8A58',
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondary: {
    alignItems: 'center',
    borderColor: '#91A79E',
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 50,
  },
  secondaryText: { color: '#25493B', fontSize: 15, fontWeight: '700' },
  reset: { alignItems: 'center', marginTop: 20, padding: 10 },
  resetText: { color: '#48675B', fontSize: 14, fontWeight: '700' },
  dimmed: { opacity: 0.5 },
});
