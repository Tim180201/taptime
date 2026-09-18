import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import type { MobileWorkCapability } from '../work/contracts';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { AppText as Text, Card } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
import { businessDay, formatClock, formatDuration, timeRecords } from './ownTimeCalendar';

export function RecentTimeCard({ work }: { readonly work: MobileWorkCapability }) {
  const state = useSyncExternalStore((listener) => work.subscribe(listener), () => work.getState(), () => work.getState());
  return <RecentTime ownTime={state.status === 'ready' ? state.ownTime : null} />;
}
export function RecentTime({ ownTime }: { readonly ownTime: MobileOwnTimeQueryResponse | null }) {
  const latest = ownTime === null ? undefined : [...timeRecords(ownTime)]
    .sort((a, b) => (b.stoppedAt ?? b.startedAt).localeCompare(a.stoppedAt ?? a.startedAt))[0];
  const at = latest?.stoppedAt ?? latest?.startedAt;
  return <Card>
    <Text style={{ color: mobileTokens.color.textMuted, fontSize: 12, fontWeight: '600' }}>Zuletzt</Text>
    {latest && at ? <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: '600' }}>{latest.stoppedAt === null ? 'Start' : 'Stopp'} {formatClock(at)} · {latest.targetDisplayName}</Text>
      <Text style={{ fontSize: 13, color: mobileTokens.color.textMuted }}>
        {businessDay(at).split('-').reverse().join('.')} · {latest.stoppedAt === null ? 'läuft'
          : `Zeitspanne ${formatDuration(Date.parse(latest.stoppedAt) - Date.parse(latest.startedAt))}`}
      </Text>
    </View> : <Text style={{ fontSize: 14, color: mobileTokens.color.textMuted }}>
      {ownTime === null ? 'Bestätigte Zeiten werden geladen.' : 'Noch keine bestätigte Zeit im geladenen Zeitraum.'}
    </Text>}
  </Card>;
}
