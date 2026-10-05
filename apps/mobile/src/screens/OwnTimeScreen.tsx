import { useEffect, useSyncExternalStore } from 'react';
import type { MobileWorkCapability } from '../work/contracts';
import type { ProductScanCapability } from '../scan/contracts';
import { ActionButton, AppText as Text, Card, Screen } from '../design/primitives';
import { TimeCalendar } from './TimeCalendar';
export { formatOwnTimeTimestamp, resolveDisplayTimeZone, ownTimeLoadStatus } from './TimeCalendar';
export function OwnTimeScreen({ work, scan }: { readonly work: MobileWorkCapability; readonly scan?:ProductScanCapability }) {
  const scanState = useSyncExternalStore(listener => scan?.subscribe(listener) ?? (()=>{}), () => scan?.getState() ?? null, () => scan?.getState() ?? null);
  const state = useSyncExternalStore((listener) => work.subscribe(listener), () => work.getState(), () => work.getState());
  useEffect(() => {
    // Pick up changes under Mitarbeiter without replacing a manual capture/acknowledgement.
    const current = work.getState();
    if (current.status === 'loading' || current.status === 'ready'
      && (current.submitting || current.outcome === 'pending')) return;
    void work.refresh();
  }, [work]);
  useEffect(() => {
    if (state.status === 'ready' && state.ownTime.nextCursor !== null && !state.loadingMore) void work.loadMoreOwnTime();
  }, [state, work]);
  const untransferred=scanState?.untransferred?.length ? <Card>
    {scanState.untransferred.map(entry => <Text key={entry.workEventId}>{entry.displayName} · {new Date(entry.occurredAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})} · nicht übertragen</Text>)}
    <Text>Prüfe die gespeicherten Zeiten. Fehlende Zeit kannst du über „Nachtragen“ ergänzen. Der Originalbeleg bleibt erhalten und sperrt den Kontowechsel.</Text>
  </Card> : null;
  if (state.status !== 'ready') return <Screen title="Meine Zeiten">{untransferred}<Card>
    <Text accessibilityRole={state.status === 'unavailable' ? 'alert' : undefined}>
      {state.status === 'unavailable' ? state.message : 'Arbeitszeiten werden geladen …'}</Text>
    <ActionButton title="Aktualisieren" onPress={() => work.refresh()} />
  </Card></Screen>;
  return <Screen title="Meine Zeiten">{untransferred}<TimeCalendar value={state.ownTime} onRefresh={()=>work.refresh()} /></Screen>;
}
