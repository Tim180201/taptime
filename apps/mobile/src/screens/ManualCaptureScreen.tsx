import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { SafeWorkTarget, WorkTargetType } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card, Screen, TextField } from '../design/primitives';
import { RecentTime } from './RecentTimeCard';
import { mobileTokens } from '../design/tokens';

export function ManualCaptureScreen({ work }: { readonly work: MobileWorkCapability }) {
  const state = useSyncExternalStore(
    (listener) => work.subscribe(listener),
    () => work.getState(),
    () => work.getState(),
  );
  const [search, setSearch] = useState('');
  const [selectionError, setSelectionError] = useState(false);
  const [selected, setSelected] = useState<SafeWorkTarget | null>(null);
  const [pauseTag, setPauseTag] = useState(false);
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
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <Text style={styles.explanation}>
        Wähle dein Arbeitsziel. Taptura entscheidet über Start oder Stopp. Die Zeit bleibt als manuell erfasst gekennzeichnet.
      </Text>
      <Text style={styles.selection}>Arbeitsziel</Text>
      {selectionError && selected === null && !pauseTag ? <Text accessibilityRole="alert">Wähle ein Arbeitsziel. Deine Eingaben bleiben erhalten.</Text> : null}
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Kunde oder Projekt suchen"
        accessibilityLabel="Arbeitsziel suchen"
        style={styles.search}
      />
      <View style={styles.list}>
        {(['customer', 'project', 'general_work'] as const).map((type) => {
          const targets = visible.filter((target) => target.targetType === type);
          if (targets.length === 0) return null;
          return <View key={type} accessibilityRole="list" style={styles.list}>
            <Text style={styles.group}>{groupLabel(type)}</Text>
            {targets.map((target) => <ActionButton
              key={`${target.targetType}:${target.targetId}`}
              title={target.displayName}
              tone={selected?.targetId === target.targetId ? 'primary' : 'secondary'}
              accessibilityState={{ selected: selected?.targetId === target.targetId }}
              onPress={() => { setSelected(target); setPauseTag(false); setSelectionError(false); }}
            />)}
          </View>;
        })}
        <ActionButton
          title="Pause"
          tone={pauseTag ? 'primary' : 'quiet'}
          accessibilityState={{ selected: pauseTag }}
          accessibilityHint="Beginnt oder beendet deine Pause automatisch."
          onPress={() => { setSelected(null); setPauseTag(true); setSelectionError(false); }}
        />
      </View>
      <Card>
        <Text style={styles.selection}>
          {pauseTag ? 'Pause' : selected === null ? 'Noch kein Arbeitsziel ausgewählt' : selected.displayName}
        </Text>
        <ActionButton
          tone="cta"
          title={state.submitting ? 'Wird erfasst …' : 'Jetzt erfassen'}
          disabled={state.submitting}
          loading={state.submitting}
          onPress={() => pauseTag ? work.triggerBreak()
            : selected === null ? setSelectionError(true) : work.triggerManual(selected)}
          accessibilityHint={pauseTag ? 'Beginnt oder beendet deine Pause automatisch.'
            : 'Startet oder stoppt deine Arbeitszeit automatisch.'}
        />
        {state.outcome === null ? null
          : <Text accessibilityLiveRegion="polite" style={styles.outcome}>
              {outcomeLabel(state.outcome)}
            </Text>}
      </Card>
      <RecentTime ownTime={state.ownTime} />
    </ScrollView>
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
  if (outcome === 'duplicate_scan_ignored') return 'Doppelte Erfassung; deine Arbeitszeit bleibt unverändert';
  if (outcome === 'active_entry_for_other_target_rejected') {
    return 'Eine andere Arbeitszeit ist aktiv.';
  }
  if (outcome === 'break_started') return 'Pause begonnen';
  if (outcome === 'break_stopped') return 'Pause beendet';
  if (outcome === 'break_without_active_time_entry_rejected') {
    return 'Ohne laufende Arbeitszeit ist keine Pause möglich.';
  }
  if (outcome === 'work_trigger_during_break_rejected') {
    return 'Deine Arbeitszeit bleibt unverändert. Beende zuerst die Pause über den Pausen-Tag oder die Pausentaste.';
  }
  if (outcome === 'escalation_required') return 'Deine Arbeitszeit bleibt unverändert. Bitte die Verwaltung, die Erfassung zu prüfen.';
  if (outcome === 'rejected') return 'Sitzung nicht mehr gültig';
  return 'Deine Erfassung ist gespeichert und wartet auf Verarbeitung.';
}

const styles = StyleSheet.create({
  explanation: { color: mobileTokens.color.inkMuted, fontSize: 13, lineHeight: 20 },
  search: {
    minHeight: mobileTokens.touchMinimum,
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.textMuted,
    borderWidth: 1,
    borderRadius: mobileTokens.radius.control,
    paddingHorizontal: mobileTokens.spacing.md,
    color: mobileTokens.color.text,
    fontSize: 15,
  },
  list: { gap: mobileTokens.spacing.md, paddingBottom: mobileTokens.spacing.sm },
  group: {
    color: mobileTokens.color.ink,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: mobileTokens.spacing.sm,
  },
  selection: { color: mobileTokens.color.ink, fontSize: 15, fontWeight: '800' },
  outcome: { color: mobileTokens.color.ink, fontSize: 15, textAlign: 'center' },
});
