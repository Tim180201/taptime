import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SafeWorkTarget } from '@taptime/mobile-work-contract';
import type {
  ManualOfflineAcknowledgement,
  OfflineManualCaptureCapability,
} from '../offline/OfflineCaptureCoordinator';
import { ActionButton, Card, Screen } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

type ProjectionState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly targets: readonly SafeWorkTarget[] }
  | { readonly status: 'unavailable' | 'protected' };
type OfflineManualOutcome =
  | 'pending'
  | 'rejected'
  | Extract<
      ManualOfflineAcknowledgement,
      { status: 'server_decision' }
    >['outcome'];

export function OfflineManualCaptureScreen({
  manual,
  restorationKey,
}: {
  readonly manual: OfflineManualCaptureCapability;
  readonly restorationKey: string;
}) {
  const [projection, setProjection] = useState<ProjectionState>({ status: 'loading' });
  const [selected, setSelected] = useState<SafeWorkTarget | null>(null);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<OfflineManualOutcome | null>(null);
  const [pendingWorkEventId, setPendingWorkEventId] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    setProjection({ status: 'loading' });
    setSelected(null);
    const result = await manual.readOfflineManualTargets();
    setProjection(result);
  };
  useEffect(() => {
    let current = true;
    setProjection({ status: 'loading' });
    setSelected(null);
    void manual.readOfflineManualTargets().then((result) => {
      if (current) setProjection(result);
    });
    return () => { current = false; };
  }, [manual, restorationKey]);
  useEffect(() => manual.subscribeManualAcknowledgements?.(() => {
    if (pendingWorkEventId === null) return;
    const acknowledgement = manual.readManualAcknowledgement?.(pendingWorkEventId);
    if (acknowledgement?.status === 'server_decision') {
      setPendingWorkEventId(null);
      setOutcome(acknowledgement.outcome);
    } else if (acknowledgement?.status === 'rejected') {
      setPendingWorkEventId(null);
      setOutcome('rejected');
    }
  }) ?? (() => undefined), [manual, pendingWorkEventId]);

  const visible = useMemo(() => projection.status === 'ready'
    ? projection.targets.filter((target) => target.displayName.toLocaleLowerCase('de-DE')
        .includes(search.trim().toLocaleLowerCase('de-DE')))
    : [], [projection, search]);

  if (projection.status !== 'ready') {
    return <Screen title="Manuell erfassen" eyebrow="OFFLINE">
      <Card>
        <Text accessibilityRole={projection.status === 'loading' ? undefined : 'alert'}>
          {projection.status === 'loading'
            ? 'Sicher geleaste Arbeitsziele werden geladen …'
            : projection.status === 'protected'
              ? 'Die lokale Zielzuordnung ist geschützt und kann nicht verwendet werden.'
              : 'Offline-Arbeitsziele sind derzeit nicht verfügbar.'}
        </Text>
        {projection.status === 'loading'
          ? null
          : <ActionButton title="Erneut laden" onPress={load} />}
      </Card>
    </Screen>;
  }

  const trigger = async (): Promise<void> => {
    if (
      selected === null
      || submitting
      || outcome === 'pending'
      || pendingWorkEventId !== null
    ) return;
    if (!projection.targets.some((target) => sameTarget(target, selected))) return;
    setSubmitting(true);
    const result = await manual.captureManual(selected);
    setSubmitting(false);
    if (result.status !== 'saved') {
      setPendingWorkEventId(null);
      setOutcome('rejected');
      return;
    }
    const acknowledgement = manual.readManualAcknowledgement?.(result.workEventId);
    if (acknowledgement?.status === 'server_decision') {
      setPendingWorkEventId(null);
      setOutcome(acknowledgement.outcome);
    } else if (acknowledgement?.status === 'rejected') {
      setPendingWorkEventId(null);
      setOutcome('rejected');
    } else {
      setPendingWorkEventId(result.workEventId);
      setOutcome('pending');
    }
  };

  return <Screen title="Manuell erfassen" eyebrow="OFFLINE">
    <Text style={styles.explanation}>
      Nur sicher geleaste Ziele sind offline verfügbar. Start oder Stopp entscheidet der Server.
    </Text>
    <TextInput
      value={search}
      onChangeText={setSearch}
      placeholder="Kunde oder Projekt suchen"
      accessibilityLabel="Offline-Arbeitsziel suchen"
      style={styles.search}
    />
    <ScrollView contentContainerStyle={styles.list}>
      {(['customer', 'project', 'general_work'] as const).map((type) => {
        const targets = visible.filter((target) => target.targetType === type);
        if (targets.length === 0) return null;
        return <View key={type} accessibilityRole="list">
          <Text style={styles.group}>{groupLabel(type)}</Text>
          {targets.map((target) => <ActionButton
            key={`${target.targetType}:${target.targetId}`}
            title={target.displayName}
            tone={selected !== null && sameTarget(selected, target) ? 'primary' : 'secondary'}
            disabled={pendingWorkEventId !== null}
            onPress={() => {
              setSelected(target);
              setOutcome(null);
            }}
          />)}
        </View>;
      })}
    </ScrollView>
    <Card>
      <Text>{selected?.displayName ?? 'Noch kein Arbeitsziel ausgewählt'}</Text>
      <ActionButton
        title={submitting ? 'Wird sicher gespeichert …' : 'Arbeitszeit auslösen'}
        disabled={
          selected === null
          || submitting
          || outcome === 'pending'
          || pendingWorkEventId !== null
        }
        onPress={trigger}
      />
      {outcome === null ? null
        : <Text accessibilityLiveRegion="polite">
            {offlineOutcomeLabel(outcome)}
          </Text>}
    </Card>
  </Screen>;
}

function offlineOutcomeLabel(outcome: OfflineManualOutcome): string {
  if (outcome === 'pending') {
    return 'Auslöser sicher vorgemerkt; Serverbestätigung ausstehend';
  }
  if (outcome === 'time_entry_started') return 'Arbeitszeit vom Server gestartet';
  if (outcome === 'time_entry_stopped') return 'Arbeitszeit vom Server gestoppt';
  if (outcome === 'duplicate_scan_ignored') return 'Doppelter Auslöser vom Server ignoriert';
  if (outcome === 'active_entry_for_other_target_rejected') {
    return 'Eine andere Arbeitszeit ist aktiv.';
  }
  if (outcome === 'escalation_required') return 'Sichere Prüfung erforderlich';
  return 'Auslöser wurde abgelehnt';
}

function sameTarget(left: SafeWorkTarget, right: SafeWorkTarget): boolean {
  return left.targetType === right.targetType && left.targetId === right.targetId;
}

function groupLabel(type: SafeWorkTarget['targetType']): string {
  if (type === 'customer') return 'Kunden';
  if (type === 'project') return 'Projekte';
  return 'Allgemeine Arbeit';
}

const styles = StyleSheet.create({
  explanation: { color: mobileTokens.color.inkMuted, fontSize: 16, lineHeight: 23 },
  search: {
    minHeight: mobileTokens.touchMinimum,
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.border,
    borderWidth: 1,
    borderRadius: mobileTokens.radius.control,
    paddingHorizontal: mobileTokens.spacing.md,
    fontSize: 16,
  },
  list: { gap: mobileTokens.spacing.md, paddingBottom: mobileTokens.spacing.sm },
  group: {
    color: mobileTokens.color.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: mobileTokens.spacing.sm,
  },
});
