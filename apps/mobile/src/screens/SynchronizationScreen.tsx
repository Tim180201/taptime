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
  return <Screen title="Abgleich"><ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
    <Text style={{ color: mobileTokens.color.textMuted, fontSize: 14 }}>
      Jeder Tap bleibt auf deinem Handy, bis seine externe Sicherung nachgewiesen ist.
    </Text>
    <Card><Text style={{ color: mobileTokens.color.textMuted, fontSize: 12 }}>Zustand</Text>
      <Text accessibilityLiveRegion="polite" style={{ fontSize: 22, fontWeight: '800',
        color: status.kind === 'confirmed' ? mobileTokens.color.accent : mobileTokens.color.notice }}>
        {status.kind === 'confirmed' ? 'Alles bestätigt' : status.kind === 'pending' ? 'Wird nachgereicht'
          : status.kind === 'protected' ? 'Vorgänge geschützt' : status.kind === 'review' ? 'Prüfung erforderlich' : 'Noch nicht bestätigt'}
      </Text>
      {status.kind === 'protected' || status.kind === 'review' ? <Text>{presentScanState(state).message}</Text> : null}
    </Card>
    <Card><Text style={{ fontWeight: '800' }}>Wartet auf den Server</Text>
      <Text>{status.count === null ? 'Der aktuelle Stand ist noch nicht bekannt.'
        : status.count === 0 ? 'Keine offenen Übertragungen' : `${status.count} ${status.count === 1 ? 'Vorgang wartet' : 'Vorgänge warten'} auf Bestätigung.`}</Text>
    </Card>
    {state.status === 'retry_pending' || state.status === 'saved_locally'
      ? <ActionButton title="Abgleich erneut versuchen" onPress={() => scan.retry()} /> : null}
    <Text style={{ color: mobileTokens.color.textMuted, fontSize: 13 }}>
      Nichts löschen, nichts neu installieren. Wenn hier etwas hängt, hilft dir der Support.
    </Text>
    {signOut ? <ActionButton title="Abmelden" tone="quiet" onPress={signOut} /> : null}
    <AppBuildIdentity />
  </ScrollView></Screen>;
}
