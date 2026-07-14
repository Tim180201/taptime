import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  safe: { flex: 1, backgroundColor: '#F3F7F4' }, content: { padding: 22, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }, brand: { fontSize: 27, fontWeight: '800', color: '#103A2B' }, eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#688078' },
  badge: { backgroundColor: '#DDF3E5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }, badgeText: { color: '#17633F', fontSize: 11, fontWeight: '800' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: '#102F25' }, subtitle: { marginTop: 10, fontSize: 16, lineHeight: 23, color: '#52675F' },
  notice: { marginTop: 24, backgroundColor: '#153D30', borderRadius: 20, padding: 20 }, noticeTitle: { color: '#FFF', fontSize: 19, fontWeight: '800' }, noticeText: { color: '#D8E7E1', marginTop: 7, fontSize: 14, lineHeight: 20 },
  slotRow: { flexDirection: 'row', gap: 12, marginTop: 18 }, slot: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D6E0DC', borderRadius: 18, padding: 16 }, slotActive: { borderWidth: 2, borderColor: '#1D8A58', padding: 15, backgroundColor: '#F8FFFA' }, slotLabel: { fontSize: 12, fontWeight: '800', color: '#60756D' }, count: { marginTop: 9, fontSize: 30, fontWeight: '800', color: '#12382B' }, countTotal: { fontSize: 15, color: '#84928D' }, fingerprint: { marginTop: 9, fontSize: 12, fontWeight: '700', color: '#536A61' }, mismatch: { marginTop: 8, fontSize: 11, color: '#37805C' }, mismatchError: { color: '#B2433A' },
  primary: { marginTop: 22, minHeight: 58, borderRadius: 17, backgroundColor: '#1D8A58', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 }, primaryText: { color: '#FFF', fontSize: 17, fontWeight: '800', textAlign: 'center' }, secondary: { marginTop: 10, minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: '#9AAEA6', alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#25493B', fontSize: 15, fontWeight: '700' }, dim: { opacity: 0.55 },
  result: { marginTop: 22, padding: 17, backgroundColor: '#FFF7DF', borderRadius: 16, borderWidth: 1, borderColor: '#E8D18A' }, resultReady: { backgroundColor: '#E6F6EC', borderColor: '#8BC9A3' }, resultTitle: { fontSize: 15, fontWeight: '800', color: '#263E35' }, resultText: { marginTop: 5, color: '#5B6B65', lineHeight: 19 }, reset: { marginTop: 22, textAlign: 'center', color: '#48675B', fontWeight: '700' }, privacy: { marginTop: 25, fontSize: 11, lineHeight: 16, color: '#788983', textAlign: 'center' },
});
