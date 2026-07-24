import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSyncExternalStore } from 'react';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, Card, Screen } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

export function OwnTimeScreen({ work }: { readonly work: MobileWorkCapability }) {
  const state = useSyncExternalStore(
    (listener) => work.subscribe(listener),
    () => work.getState(),
    () => work.getState(),
  );
  if (state.status !== 'ready') {
    return <Screen title="Meine Zeiten" eyebrow="31 TAGE">
      <Card>
        <Text>{state.status === 'unavailable' ? state.message : 'Arbeitszeiten werden geladen …'}</Text>
        <ActionButton title="Aktualisieren" onPress={() => work.refresh()} />
      </Card>
    </Screen>;
  }
  const timeZone = resolveDisplayTimeZone();
  return <Screen title="Meine Zeiten" eyebrow="31 TAGE">
    <ActionButton title="Aktualisieren" tone="secondary" onPress={() => work.refresh()} />
    <Text style={styles.zone}>Zeitzone: {timeZone}</Text>
    <ScrollView contentContainerStyle={styles.list}>
      {state.ownTime.activeRecord === null ? null
        : <TimeCard record={state.ownTime.activeRecord} active timeZone={timeZone} />}
      {state.ownTime.records.map((record) =>
        <TimeCard
          key={record.timeRecordId}
          record={record}
          active={false}
          timeZone={timeZone}
        />)}
      {state.ownTime.activeRecord === null && state.ownTime.records.length === 0
        ? <Card><Text>Im sicheren Zeitfenster sind keine Arbeitszeiten vorhanden.</Text></Card>
        : null}
      <Text accessibilityLiveRegion="polite">
        {ownTimeLoadStatus(state.ownTime.records.length, state.ownTime.nextCursor)}
      </Text>
      {state.ownTime.nextCursor === null ? null
        : <ActionButton
            title={state.loadingMore ? 'Weitere Zeiten werden geladen …' : 'Weitere Zeiten laden'}
            disabled={state.loadingMore}
            onPress={() => work.loadMoreOwnTime()}
          />}
    </ScrollView>
  </Screen>;
}

function TimeCard({ record, active, timeZone }: {
  readonly record: SafeOwnTimeRecord;
  readonly active: boolean;
  readonly timeZone: string;
}) {
  return <Card accessibilityLabel={`${record.targetDisplayName}, ${active ? 'läuft' : 'beendet'}`}>
    <Text style={styles.target}>{record.targetDisplayName}</Text>
    <Text style={styles.meta}>{targetLabel(record.targetType)} · {active ? 'Läuft' : 'Beendet'}</Text>
    <Text style={styles.time}>{formatOwnTimeTimestamp(record.startedAt, timeZone)} – {
      record.stoppedAt === null ? 'jetzt' : formatOwnTimeTimestamp(record.stoppedAt, timeZone)
    }</Text>
    <Text style={styles.provenance}>
      Auslöser: {record.startedVia === null ? 'Wiederhergestellt' : provenance(record.startedVia)}
      {record.stoppedVia === null ? '' : ` → ${provenance(record.stoppedVia)}`}
    </Text>
  </Card>;
}

export function formatOwnTimeTimestamp(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

export function resolveDisplayTimeZone(
  resolved: () => string | undefined = () => (
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ),
): string {
  try {
    const candidate = resolved();
    if (candidate === undefined || candidate.length === 0) return 'UTC';
    new Intl.DateTimeFormat('de-DE', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function ownTimeLoadStatus(count: number, nextCursor: string | null): string {
  return nextCursor === null
    ? `${count} Einträge geladen · vollständig`
    : `${count} Einträge geladen · weitere verfügbar`;
}
function targetLabel(type: SafeOwnTimeRecord['targetType']): string {
  return type === 'customer' ? 'Kunde' : type === 'project' ? 'Projekt' : 'Allgemeine Arbeit';
}
function provenance(value: 'nfc' | 'manual'): string {
  return value === 'nfc' ? 'NFC' : 'Manuell';
}

const styles = StyleSheet.create({
  list: { gap: mobileTokens.spacing.sm, paddingBottom: mobileTokens.spacing.xl },
  target: { color: mobileTokens.color.ink, fontSize: 18, fontWeight: '700' },
  meta: { color: mobileTokens.color.inkMuted, fontSize: 14 },
  time: { color: mobileTokens.color.ink, fontSize: 16 },
  provenance: { color: mobileTokens.color.inkMuted, fontSize: 13 },
  zone: { color: mobileTokens.color.inkMuted, fontSize: 13 },
});
