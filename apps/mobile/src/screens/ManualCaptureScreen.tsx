import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SafeWorkTarget, WorkTargetType } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, Card, Screen } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

export function ManualCaptureScreen({ work }: { readonly work: MobileWorkCapability }) {
  const state = useSyncExternalStore(
    (listener) => work.subscribe(listener),
    () => work.getState(),
    () => work.getState(),
  );
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SafeWorkTarget | null>(null);
  const visible = useMemo(() => state.status === 'ready'
    ? state.targets.targets.filter((target) => (
        target.displayName.toLocaleLowerCase('de-DE')
          .includes(search.trim().toLocaleLowerCase('de-DE'))
      ))
    : [], [search, state]);

  if (state.status === 'inactive' || state.status === 'loading') {
    return <Screen title="Manuell erfassen" eyebrow="ARBEITSZEIT">
      <Card><Text accessibilityLiveRegion="polite">Arbeitsziele werden geladen …</Text></Card>
    </Screen>;
  }
  if (state.status === 'unavailable') {
    return <Screen title="Manuell erfassen" eyebrow="ARBEITSZEIT">
      <Card>
        <Text accessibilityRole="alert">{state.message}</Text>
        <ActionButton title="Erneut laden" onPress={() => work.refresh()} />
      </Card>
    </Screen>;
  }

  return <Screen title="Manuell erfassen" eyebrow="ARBEITSZEIT">
    <Text style={styles.explanation}>
      Ziel auswählen und einmal auslösen. TapTim.e entscheidet sicher über Start oder Stopp.
    </Text>
    <TextInput
      value={search}
      onChangeText={setSearch}
      placeholder="Kunde oder Projekt suchen"
      accessibilityLabel="Arbeitsziel suchen"
      style={styles.search}
    />
    <ScrollView contentContainerStyle={styles.list}>
      {(['customer', 'project', 'general_work'] as const).map((type) => {
        const targets = visible.filter((target) => target.targetType === type);
        if (targets.length === 0) return null;
        return <View key={type} accessibilityRole="list">
          <Text style={styles.group}>{groupLabel(type)}</Text>
          {targets.map((target) => <ActionButton
            key={`${target.targetType}:${target.targetId}`}
            title={target.displayName}
            tone={selected?.targetId === target.targetId ? 'primary' : 'secondary'}
            accessibilityState={{ selected: selected?.targetId === target.targetId }}
            onPress={() => setSelected(target)}
          />)}
        </View>;
      })}
    </ScrollView>
    <Card>
      <Text style={styles.selection}>
        {selected === null ? 'Noch kein Arbeitsziel ausgewählt' : selected.displayName}
      </Text>
      <ActionButton
        title={state.submitting ? 'Wird sicher ausgelöst …' : 'Arbeitszeit auslösen'}
        disabled={selected === null || state.submitting}
        onPress={() => selected === null ? undefined : work.triggerManual(selected)}
        accessibilityHint="Der Server entscheidet, ob die Arbeitszeit startet oder stoppt."
      />
      {state.outcome === null ? null
        : <Text accessibilityLiveRegion="polite" style={styles.outcome}>
            {outcomeLabel(state.outcome)}
          </Text>}
    </Card>
  </Screen>;
}

function groupLabel(type: WorkTargetType): string {
  if (type === 'customer') return 'Kunden';
  if (type === 'project') return 'Projekte';
  return 'Allgemeine Arbeit';
}

function outcomeLabel(outcome: NonNullable<
  Extract<ReturnType<MobileWorkCapability['getState']>, { status: 'ready' }>['outcome']
>): string {
  if (outcome === 'time_entry_started') return 'Arbeitszeit gestartet';
  if (outcome === 'time_entry_stopped') return 'Arbeitszeit gestoppt';
  if (outcome === 'duplicate_scan_ignored') return 'Doppelter Auslöser ignoriert';
  if (outcome === 'active_entry_for_other_target_rejected') {
    return 'Eine andere Arbeitszeit ist aktiv.';
  }
  if (outcome === 'escalation_required') return 'Sichere Prüfung erforderlich';
  if (outcome === 'rejected') return 'Sitzung nicht mehr gültig';
  return 'Auslöser sicher vorgemerkt';
}

const styles = StyleSheet.create({
  explanation: { color: mobileTokens.color.inkMuted, fontSize: 16, lineHeight: 23 },
  search: {
    minHeight: mobileTokens.touchMinimum,
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.border,
    borderWidth: 1,
    borderRadius: mobileTokens.radius.control,
    paddingHorizontal: mobileTokens.spacing.md,
    fontSize: 16,
  },
  list: { gap: mobileTokens.spacing.md, paddingBottom: mobileTokens.spacing.sm },
  group: {
    color: mobileTokens.color.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: mobileTokens.spacing.sm,
  },
  selection: { color: mobileTokens.color.ink, fontSize: 17, fontWeight: '700' },
  outcome: { color: mobileTokens.color.ink, fontSize: 15, textAlign: 'center' },
});
