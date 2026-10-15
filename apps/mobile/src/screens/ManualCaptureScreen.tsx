import {useAssignedTargets,combineTargets,targetLabel} from '../search/useAssignedTargets';
import {SearchStatus} from '../search/SearchControls';
import { useDebouncedSearch } from '../search/useSearchPages';
import { SearchField } from '../search/SearchControls';
import {manualCaptureOutcome} from '../work/manualCaptureFeedback';
import { ActiveTimeCard } from './ActiveTimeCard';
import { useRequiredForm, RequiredField } from '../design/RequiredField';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { type SafeWorkTarget, type WorkTargetType } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card, Screen } from '../design/primitives';
import { RecentTime } from './RecentTimeCard';
import { useThemedStyles } from '../design/useMobileTheme';
import type { MobileTokens } from '../design/tokens';

export function ManualCaptureScreen({ work }: { readonly work: MobileWorkCapability }) {
  const styles = useThemedStyles(createStyles);

  const state = useSyncExternalStore(
    (listener) => work.subscribe(listener),
    () => work.getState(),
    () => work.getState(),
  );
  const form = useRequiredForm();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SafeWorkTarget | null>(null);
  useEffect(() => { void work.refresh(); }, [work]);
  const query=useDebouncedSearch(search);
  useEffect(()=>{if(query!==null||work.getState().status==='ready')void work.searchTargets?.(query);},[work,query]);
  const assigned=useAssignedTargets(work,null,query,[],state.status==='ready');
  const favorites=query===null?assigned.state.items:[];
  const visible=state.status==='ready'?state.targets.targets:[];
  const selectedTarget = combineTargets(visible,favorites).find(target => target.targetId === selected?.targetId
    && target.targetType === selected.targetType);
  useEffect(() => { if (state.status==='ready'&&!state.targetsBusy&&!state.targetsFailed&&!assigned.state.busy&&selected&&!selectedTarget) setSelected(null); }, [selected, selectedTarget,state]);

  if (state.status === 'inactive' || state.status === 'loading') {
    return <Screen title="Manuell erfassen" eyebrow="ARBEITSZEIT">
      <Card><Text accessibilityLiveRegion="polite">Arbeitsziele werden geladen …</Text></Card>
    </Screen>;
  }
  if (state.status === 'unavailable') {
    return <Screen title="Manuell erfassen" eyebrow="ARBEITSZEIT">
      <Card>
        <Text accessibilityRole="alert">{state.message}</Text>
        <ActionButton title="Erneut versuchen" onPress={() => work.refresh()} />
      </Card>
    </Screen>;
  }

  return <Screen title="Manuell erfassen" eyebrow="ARBEITSZEIT">
    <ScrollView style={{flex: 1}} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      {state.capturePending ? <Text accessibilityLiveRegion="polite">Wird übertragen … Deine Erfassung ist gespeichert, wird übertragen.</Text> : null}
      {state.ownTime.activeRecord ? <ActiveTimeCard record={state.ownTime.activeRecord}
        disabled={state.submitting || !!state.capturePending} onStop={()=>void work.stopActiveTime()} onBreak={()=>void work.triggerBreak()}/> : <>
        <Text style={styles.explanation}>Kunde, Projekt oder allgemeine Arbeit. Die Zeit bleibt als manuell erfasst gekennzeichnet.</Text>
        <RequiredField form={form} error={selected===null ? "Wähle ein Arbeitsziel. Deine Eingaben bleiben erhalten." : null}><Text style={styles.selection}>Wofür arbeitest du?</Text>
        <SearchField value={search} onChange={setSearch} disabled={state.submitting}/>
        {!favorites.length?<Text accessibilityLiveRegion="polite">{state.targetsBusy?'Wird geladen …':`${state.targets.nextCursor!==null?'mehr als ':''}${visible.length} Treffer`}</Text>:null}
        {state.targetsFailed?<View><Text accessibilityRole="alert">Arbeitsziele konnten nicht geladen werden.</Text><ActionButton title="Erneut versuchen" onPress={()=>work.searchTargets?.(query,state.targets.nextCursor!==null)}/></View>:null}
        {!state.targetsBusy&&!state.targetsFailed&&visible.length===0&&query?<View><Text>{`Keine Treffer für „${query}“`}</Text><ActionButton title="Suche löschen" onPress={()=>setSearch('')}/></View>:null}
        {query===null&&assigned.state.failed?<SearchStatus state={assigned.state} onRetry={assigned.pager.retry}/>:null}
        {favorites.length?<View style={styles.list}><Text accessibilityRole="header">Meine Kunden und Projekte</Text>
          {favorites.map(target=><ActionButton key={`${target.targetType}:${target.targetId}`} title={target.displayName} disabled={state.submitting||assigned.state.busy||assigned.state.failed}
            tone={selected?.targetId===target.targetId?'primary':'secondary'} accessibilityState={{selected:selected?.targetId===target.targetId}}
            onPress={()=>{Keyboard.dismiss();setSelected(target);AccessibilityInfo.announceForAccessibility(`Ausgewählt: ${target.displayName}`);}}/>)}
          {assigned.state.nextCursor?<ActionButton title="Weitere zugeordnete laden" disabled={assigned.state.busy||state.submitting} onPress={()=>assigned.pager.loadMore()}/>:null}
          <Text>Weitere Kunden und Projekte über die Suche</Text>
        </View>:null}
        {!favorites.length?<><Text accessibilityRole="header">{query?'Treffer':'Alle Kunden und Projekte'}</Text>
        <View style={styles.list}>
          {(['customer', 'project', 'general_work'] as const).map(type => {
            const targets = visible.filter(target => target.targetType === type);
            return targets.length === 0 ? null : <View key={type} accessibilityRole="list" style={styles.list}>
              <Text style={styles.group}>{groupLabel(type)}</Text>
              {targets.map(target => <ActionButton key={`${target.targetType}:${target.targetId}`} title={targetLabel(target,query)}
                disabled={state.submitting} tone={selected?.targetId === target.targetId ? 'primary' : 'secondary'}
                accessibilityState={{selected:selected?.targetId === target.targetId}}
                onPress={() => {Keyboard.dismiss();setSelected(target); AccessibilityInfo.announceForAccessibility(`Ausgewählt: ${target.displayName}`);}} />)}
            </View>;
          })}
        </View>
        {state.targets.nextCursor!==null?<ActionButton title="Weitere laden" disabled={state.targetsBusy||state.submitting} onPress={()=>work.searchTargets?.(query,true)}/>:null}
        </>:null}
        </RequiredField>
      </>}
      {state.submitting ? <Text accessibilityLiveRegion="polite">Bestätigung wird angefordert …</Text> : null}
      {state.feedback || state.outcome ? <Text accessibilityLiveRegion="polite" style={styles.outcome}>{state.feedback ?? manualCaptureOutcome(state.outcome!)}</Text> : null}
      <RecentTime ownTime={state.ownTime} />
    </ScrollView>
    {!state.ownTime.activeRecord && selectedTarget ? <Card style={{flexShrink: 0}}>
      <Text style={styles.selection}>{selectedTarget.displayName}</Text>
      <ActionButton title="Zeit starten" tone="cta" disabled={state.submitting || state.capturePending || state.targetsBusy || state.targetsFailed || (!visible.some(t=>t.targetId===selectedTarget.targetId&&t.targetType===selectedTarget.targetType)&&(assigned.state.busy||assigned.state.failed))} loading={state.submitting}
        onPress={() => {if(form.validate())void work.triggerManual(selectedTarget);}} />
    </Card> : null}
  </Screen>;
}

function groupLabel(type: WorkTargetType): string {
  if (type === 'customer') return 'Kunden';
  if (type === 'project') return 'Projekte';
  return 'Allgemeine Arbeitszeit – ohne Kunde oder Projekt';
}

const createStyles = (mobileTokens: MobileTokens) => StyleSheet.create({
  explanation: { color: mobileTokens.color.inkMuted, fontSize: 13, lineHeight: 20 },
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
