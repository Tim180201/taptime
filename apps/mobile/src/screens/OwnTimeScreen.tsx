import { useEffect, useSyncExternalStore } from 'react';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card, Screen } from '../design/primitives';
import { TimeCalendar } from './TimeCalendar';
export { formatOwnTimeTimestamp, resolveDisplayTimeZone, ownTimeLoadStatus } from './TimeCalendar';
export function OwnTimeScreen({ work }: { readonly work: MobileWorkCapability }) {
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
  if (state.status !== 'ready') return <Screen title="Meine Zeiten"><Card>
    <Text accessibilityRole={state.status === 'unavailable' ? 'alert' : undefined}>
      {state.status === 'unavailable' ? state.message : 'Arbeitszeiten werden geladen …'}</Text>
    <ActionButton title="Aktualisieren" onPress={() => work.refresh()} />
  </Card></Screen>;
  return <Screen title="Meine Zeiten"><TimeCalendar value={state.ownTime} onRefresh={()=>work.refresh()} /></Screen>;
}
