import {manualCaptureOutcome} from '../work/manualCaptureFeedback';
import { ActiveTimeCard } from './ActiveTimeCard';
import { useRequiredForm, RequiredField } from '../design/RequiredField';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { type SafeWorkTarget, type WorkTargetType } from '@taptime/mobile-work-contract';
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
  const form = useRequiredForm();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SafeWorkTarget | null>(null);
  useEffect(() => { void work.refresh(); }, [work]);
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
      {state.capturePending ? <Text accessibilityLiveRegion="polite">Wird übertragen … Deine Erfassung ist gespeichert, wird übertragen.</Text> : null}
      {state.ownTime.activeRecord ? <ActiveTimeCard record={state.ownTime.activeRecord}
        disabled={state.submitting || !!state.capturePending} onStop={()=>void work.stopActiveTime()} onBreak={()=>void work.triggerBreak()}/> : <>
        <Text style={styles.explanation}>Kunde, Projekt oder allgemeine Arbeit. Die Zeit bleibt als manuell erfasst gekennzeichnet.</Text>
        <RequiredField form={form} error={selected===null ? "Wähle ein Arbeitsziel. Deine Eingaben bleiben erhalten." : null}><Text style={styles.selection}>Wofür arbeitest du?</Text>
        <TextField value={search} onChangeText={setSearch} editable={!state.submitting} placeholder="Kunde oder Projekt suchen" accessibilityLabel="Arbeitsziel suchen" style={styles.search} />
        <View style={styles.list}>
          {(['customer', 'project', 'general_work'] as const).map(type => {
            const targets = visible.filter(target => target.targetType === type);
            return targets.length === 0 ? null : <View key={type} accessibilityRole="list" style={styles.list}>
              <Text style={styles.group}>{groupLabel(type)}</Text>
              {targets.map(target => <ActionButton key={`${target.targetType}:${target.targetId}`} title={target.displayName}
                disabled={state.submitting} tone={selected?.targetId === target.targetId ? 'primary' : 'secondary'}
                accessibilityState={{selected:selected?.targetId === target.targetId}}
                onPress={() => {setSelected(target);}} />)}
            </View>;
          })}
        </View></RequiredField>
        <Card><Text style={styles.selection}>{selected?.displayName ?? 'Noch kein Arbeitsziel ausgewählt'}</Text>
          <ActionButton title="Zeit starten" tone="cta" disabled={state.submitting || state.capturePending} loading={state.submitting}
            onPress={() => {if(form.validate() && selected)void work.triggerManual(selected);}} />
        </Card>
      </>}
      {state.submitting ? <Text accessibilityLiveRegion="polite">Bestätigung wird angefordert …</Text> : null}
      {state.feedback || state.outcome ? <Text accessibilityLiveRegion="polite" style={styles.outcome}>{state.feedback ?? manualCaptureOutcome(state.outcome!)}</Text> : null}
      <RecentTime ownTime={state.ownTime} />
    </ScrollView>
  </Screen>;
}

function groupLabel(type: WorkTargetType): string {
  if (type === 'customer') return 'Kunden';
  if (type === 'project') return 'Projekte';
  return 'Allgemeine Arbeitszeit – ohne Kunde oder Projekt';
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
