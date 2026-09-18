import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text, TouchTarget as Pressable } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
import type { ValidationSlot } from './PhysicalValidationController';
import { createPhysicalValidationRuntime } from './createPhysicalValidationRuntime';

export function PhysicalValidationMobileApp() {
  const controller = useMemo(createPhysicalValidationRuntime, []);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    void controller.start();
    return () => { void controller.stop(); };
  }, [controller]);

  const readiness = state.slots.A.count >= 10 && state.slots.B.count >= 10
    && state.slots.A.mismatches === 0 && state.slots.B.mismatches === 0
    && state.slots.A.fingerprint !== state.slots.B.fingerprint;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View><Text style={styles.brand}>TapTim.e</Text><Text style={styles.eyebrow}>INTERNAL VALIDATION</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>ANDROID · NFC</Text></View>
        </View>

        <Text style={styles.title}>NFC-Gerätetest</Text>
        <Text style={styles.subtitle}>Prüft zwei reale Tags lokal auf stabile, unterscheidbare Kennungen. Es findet keine Zeiterfassung und keine Serverübertragung statt.</Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{capabilityTitle(state.capability)}</Text>
          <Text style={styles.noticeText}>{outcomeText(state.outcome, state.scanning)}</Text>
        </View>

        <View style={styles.slotRow}>
          {(['A', 'B'] as const).map((slot) => (
            <SlotCard key={slot} slot={slot} active={state.activeSlot === slot}
              count={state.slots[slot].count} fingerprint={state.slots[slot].fingerprint}
              mismatches={state.slots[slot].mismatches} disabled={state.scanning}
              onPress={() => controller.selectSlot(slot)} />
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.primary, (pressed || state.capability !== 'ready') && styles.dim]}
          disabled={state.capability !== 'ready'} onPress={() => controller.scan()} accessibilityRole="button">
          <Text style={styles.primaryText}>{state.scanning ? 'Tag jetzt an das Gerät halten …' : `Tag ${state.activeSlot} scannen`}</Text>
        </Pressable>
        {state.scanning ? <Pressable style={styles.secondary} onPress={() => controller.cancel()}><Text style={styles.secondaryText}>Scan abbrechen</Text></Pressable> : null}

        <View style={[styles.result, readiness && styles.resultReady]}>
          <Text style={styles.resultTitle}>{readiness ? 'Stabilitätstest vollständig' : 'Ziel: 10 stabile Scans je Tag'}</Text>
          <Text style={styles.resultText}>{readiness ? 'Beide Fingerprints sind stabil und voneinander verschieden. Weitere Pflichtfälle der Checkliste bleiben separat zu protokollieren.' : 'Abweichende Kennungen werden nicht als erfolgreicher Scan gezählt.'}</Text>
        </View>
        <Pressable disabled={state.scanning} onPress={() => controller.reset()}><Text style={styles.reset}>Lokale Testwerte zurücksetzen</Text></Pressable>
        <Text style={styles.privacy}>Datenschutz: Die Oberfläche erhält nur einen gekürzten SHA-256-Fingerprint. Rohe NFC-UIDs werden weder angezeigt noch gespeichert.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SlotCard({ slot, active, count, fingerprint, mismatches, disabled, onPress }: { slot: ValidationSlot; active: boolean; count: number; fingerprint: string | null; mismatches: number; disabled: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.slot, active && styles.slotActive]}>
    <Text style={styles.slotLabel}>TAG {slot}</Text><Text style={styles.count}>{count}<Text style={styles.countTotal}> / 10</Text></Text>
    <Text style={styles.fingerprintLabel}>PRÜF-FINGERPRINT · SHA-256 GEKÜRZT</Text>
    <Text style={styles.fingerprint}>{fingerprint ?? 'Noch nicht gelesen'}</Text>
    <Text style={[styles.mismatch, mismatches > 0 && styles.mismatchError]}>{mismatches === 0 ? 'Keine Abweichung' : `${mismatches} Abweichung(en)`}</Text>
  </Pressable>;
}

function capabilityTitle(capability: string): string {
  return ({ checking: 'NFC wird geprüft', ready: 'NFC ist bereit', not_supported: 'NFC nicht unterstützt', disabled: 'NFC ist ausgeschaltet', unavailable: 'NFC nicht verfügbar' } as Record<string, string>)[capability];
}
function outcomeText(outcome: string | null, scanning: boolean): string {
  if (scanning) return 'Halte den gewählten Tag ruhig an die NFC-Antenne.';
  return ({ captured: 'Stabile Kennung erkannt.', mismatch: 'Achtung: Dieser Scan weicht vom ersten Scan des gewählten Tags ab.', unreadable: 'Der Tag war nicht eindeutig lesbar.', timed_out: 'Zeitüberschreitung: Es wurde kein Tag erkannt.', cancelled: 'Der Scan wurde sauber abgebrochen.', unavailable: 'Der Scan konnte nicht sicher gestartet werden.' } as Record<string, string>)[outcome ?? ''] ?? 'Wähle Tag A oder B und starte einen einzelnen Scan.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileTokens.color.ground },
  content: { padding: 20, gap: 16 },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  eyebrow: { fontSize: 13, fontWeight: '600', color: mobileTokens.color.textMuted },
  badge: { backgroundColor: mobileTokens.color.surfaceRaised, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: mobileTokens.color.textMuted, fontSize: 13, fontWeight: '800' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 20, color: mobileTokens.color.textMuted },
  notice: { backgroundColor: mobileTokens.color.surface, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: mobileTokens.color.line },
  noticeTitle: { fontSize: 15, fontWeight: '800' }, noticeText: { fontSize: 15 },
  slotRow: { flexDirection: 'row', gap: 16 },
  slot: { flex: 1, backgroundColor: mobileTokens.color.surface, borderWidth: 1, borderColor: mobileTokens.color.line, borderRadius: 12, padding: 12, gap: 8 },
  slotActive: { borderColor: mobileTokens.color.accent, backgroundColor: mobileTokens.color.surfaceRaised },
  slotLabel: { fontSize: 15, fontWeight: '800' }, count: { fontSize: 40, lineHeight: 48, fontWeight: '800' },
  countTotal: { fontSize: 15, color: mobileTokens.color.textMuted },
  fingerprintLabel: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: mobileTokens.color.textMuted },
  fingerprint: { fontSize: 13, fontWeight: '600', color: mobileTokens.color.textMuted },
  mismatch: { fontSize: 13, color: mobileTokens.color.textMuted }, mismatchError: { color: mobileTokens.color.notice },
  primary: { minHeight: 44, borderRadius: 10, backgroundColor: mobileTokens.color.accent, alignItems: 'center', justifyContent: 'center', padding: 12 },
  primaryText: { color: mobileTokens.color.onAccent, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  secondary: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: mobileTokens.color.textMuted, alignItems: 'center', justifyContent: 'center', padding: 12 },
  secondaryText: { fontSize: 15, fontWeight: '600' }, dim: { borderWidth: 1, borderColor: mobileTokens.color.textMuted },
  result: { padding: 12, backgroundColor: mobileTokens.color.surface, borderRadius: 12, borderWidth: 1, borderColor: mobileTokens.color.notice, gap: 8 },
  resultReady: { borderColor: mobileTokens.color.accent }, resultTitle: { fontSize: 15, fontWeight: '800' },
  resultText: { fontSize: 15 }, reset: { textAlign: 'center', fontWeight: '600' },
  privacy: { fontSize: 13, lineHeight: 20, color: mobileTokens.color.textMuted, textAlign: 'center' },
});
