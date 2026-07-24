import { useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import type { ProductScanCapability } from '../scan/contracts';
import { ActionButton, Card, Screen } from '../design/primitives';

export function SynchronizationScreen({ scan }: { readonly scan: ProductScanCapability }) {
  const state = useSyncExternalStore(
    (listener) => scan.subscribe(listener),
    () => scan.getState(),
    () => scan.getState(),
  );
  const count = 'queueCount' in state ? state.queueCount : 0;
  return <Screen title="Synchronisierung" eyebrow="SICHERER STATUS">
    <Card>
      <Text accessibilityRole="header">Offene Vorgänge</Text>
      <Text style={{ fontSize: 36, fontWeight: '800' }}>{count}</Text>
      <Text>{syncMessage(state.status)}</Text>
    </Card>
    {(state.status === 'retry_pending' || state.status === 'saved_locally')
      ? <ActionButton title="Unveränderte Daten erneut senden" onPress={() => scan.retry()} />
      : null}
    <Text>
      TapTim.e behält die unveränderte Reihenfolge bei. Eine lokale Start-/Stopp-Entscheidung
      wird nicht erfunden.
    </Text>
  </Screen>;
}

function syncMessage(status: ReturnType<ProductScanCapability['getState']>['status']): string {
  if (status === 'synchronizing') return 'Serverbestätigung läuft.';
  if (status === 'server_review_pending') return 'Mindestens ein Vorgang wartet auf sichere Prüfung.';
  if (status === 'protected_pending' || status === 'secure_storage_unavailable') {
    return 'Geschützte Evidenz benötigt Unterstützung.';
  }
  return 'Lokaler und bestätigter Stand.';
}
