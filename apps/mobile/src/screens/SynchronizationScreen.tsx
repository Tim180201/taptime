import { AppUpdateButton } from '../design/AppUpdateButton';
import { useSyncExternalStore } from 'react';
import { ScrollView } from 'react-native';
import type { ProductScanCapability } from '../scan/contracts';
import { AppBuildIdentity } from '../design/AppBuildIdentity';
import { ActionButton, AppText as Text, Card, Screen } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
import { syncIndicator, type SyncIndicator } from '../navigation/presentation';
import { presentScanState } from './ScanScreen';

export function SynchronizationScreen({ scan, indicator, signOut }: {
  readonly scan: ProductScanCapability; readonly indicator?: SyncIndicator; readonly signOut?: () => Promise<void>;
}) {
  const state = useSyncExternalStore((listener) => scan.subscribe(listener), () => scan.getState(), () => scan.getState());
  const status = indicator ?? syncIndicator(state);
  const unreported=state.untransferred?.filter(entry=>!entry.reported) ?? [];
  const reported=state.untransferred?.filter(entry=>entry.reported) ?? [];
  const pendingCount='queueCount' in state ? state.queueCount : state.status==='ready' && state.outcome===null ? 0 : null;
  return <Screen title="Übertragung"><ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
    <Text style={{ color: mobileTokens.color.textMuted, fontSize: 13 }}>
      Jeder Tap bleibt auf deinem Handy, bis seine externe Sicherung nachgewiesen ist.
    </Text>
    <Card><Text style={{ color: mobileTokens.color.textMuted, fontSize: 13 }}>Zustand</Text>
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, fontWeight: '800',
        color: status.kind === 'confirmed' ? mobileTokens.color.accent : mobileTokens.color.notice }}>
        {state.transmissionPaused ? `Übertragung angehalten: ${presentScanState(state).message}` : state.updateRequired ? 'Bitte App aktualisieren' : unreported.length ? `${unreported.length} Erfassung konnte nicht übertragen werden` : reported.length ? `${reported.length} Erfassung · Wird von der Verwaltung geprüft` : status.kind === 'confirmed' ? 'Alles bestätigt' : status.kind === 'pending' ? 'Wird nachgereicht'
          : status.kind === 'protected' ? 'Vorgänge geschützt' : status.kind === 'review' ? 'Wird von der Verwaltung geprüft' : 'Noch nicht bestätigt'}
      </Text>
      {unreported.length ? <Text>Der Beleg bleibt erhalten und sperrt den Kontowechsel. Prüfe „Meine Zeiten“; fehlende Zeit kannst du über „Zeit hinzufügen“ ergänzen.</Text> : !reported.length && (status.kind === 'protected' || status.kind === 'review') ? <Text>{presentScanState(state).message}</Text> : null}
      {reported.length ? <Text>Wird von der Verwaltung geprüft. Der Originalbeleg bleibt auf dem Handy erhalten.</Text> : null}
      {state.transmissionPaused ? state.untransferred?.map(entry=><Text key={entry.workEventId}>{entry.displayName} · {new Date(entry.occurredAt).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'})}</Text>) : null}
    </Card>
    {state.updateRequired ? <AppUpdateButton /> : null}
    <Card><Text style={{ fontWeight: '800' }}>Wartet auf den Server</Text>
      <Text>{pendingCount === null ? 'Der aktuelle Stand ist noch nicht bekannt.'
        : pendingCount === 0 ? 'Keine offenen Übertragungen' : `${pendingCount} ${pendingCount === 1 ? 'Vorgang wartet' : 'Vorgänge warten'} auf Bestätigung.`}</Text>
    </Card>
    {state.transmissionPaused && state.transmissionRetryAvailable
      ? <ActionButton title="Erneut versuchen" onPress={() => scan.retry()} /> : null}
    {!state.transmissionPaused && (state.status === 'retry_pending' || state.status === 'saved_locally')
      ? <ActionButton title="Übertragung erneut versuchen" onPress={() => scan.retry()} /> : null}
    <Text style={{ color: mobileTokens.color.textMuted, fontSize: 13 }}>
      Nichts löschen, nichts neu installieren. Wenn hier etwas hängt, hilft dir der Support.
    </Text>
    {signOut ? <Card><Text accessibilityRole="header" style={{fontWeight:'800'}}>Konto</Text><ActionButton title="Abmelden" tone="secondary" onPress={signOut} /></Card> : null}
    <AppBuildIdentity />
  </ScrollView></Screen>;
}
