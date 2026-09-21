import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { SafeWorkTarget } from '@taptime/mobile-work-contract';
import type {
  ManualOfflineAcknowledgement,
  OfflineManualCaptureCapability,
} from '../offline/OfflineCaptureCoordinator';
import { ActionButton, AppText as Text, Card, Screen, TextField } from '../design/primitives';
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
  const [pause, setPause] = useState(false);
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
            ? 'Offline-Arbeitsziele werden geladen …'
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
      (selected === null && !pause)
      || submitting
    ) return;
    if (!pause && (selected === null || !projection.targets.some((target) => sameTarget(target, selected)))) return;
    setSubmitting(true);
    const result = pause ? await manual.captureBreak?.() ?? { status: 'unavailable' as const }
      : await manual.captureManual(selected!);
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
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <Text style={styles.explanation}>
        Wähle dein Arbeitsziel. Der Vorgang wird sicher gespeichert; Start oder Stopp entscheidet der Server beim Abgleich.
      </Text>
      <Text style={styles.group}>Arbeitsziel</Text>
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Kunde oder Projekt suchen"
        accessibilityLabel="Offline-Arbeitsziel suchen"
        style={styles.search}
      />
      <View style={styles.list}>
        {(['customer', 'project', 'general_work'] as const).map((type) => {
          const targets = visible.filter((target) => target.targetType === type);
          if (targets.length === 0) return null;
          return <View key={type} accessibilityRole="list" style={styles.list}>
            <Text style={styles.group}>{groupLabel(type)}</Text>
            {targets.map((target) => <ActionButton
              key={`${target.targetType}:${target.targetId}`}
              title={target.displayName}
              tone={selected !== null && sameTarget(selected, target) ? 'primary' : 'secondary'}
              disabled={submitting}
              accessibilityState={{ selected: selected !== null && sameTarget(selected, target) }}
              onPress={() => {
                setSelected(target);
                setPause(false);
                setOutcome(null);
              }}
            />)}
          </View>;
        })}
        <ActionButton title="Pause" tone={pause ? 'primary' : 'quiet'}
          disabled={submitting} accessibilityState={{ selected: pause }}
          accessibilityHint="Der Server entscheidet beim Abgleich, ob die Pause beginnt oder endet."
          onPress={() => { setSelected(null); setPause(true); setOutcome(null); }} />
      </View>
      <Card>
        <Text>{pause ? 'Pause' : selected?.displayName ?? 'Noch kein Arbeitsziel ausgewählt'}</Text>
        <ActionButton
          tone="cta"
          title={submitting ? 'Wird sicher gespeichert …' : 'Jetzt erfassen'}
          disabled={
            (selected === null && !pause)
            || submitting
          }
          loading={submitting}
          accessibilityHint={pause ? 'Der Server entscheidet beim Abgleich, ob die Pause beginnt oder endet.'
            : 'Der Server entscheidet beim Abgleich, ob die Arbeitszeit startet oder stoppt.'}
          onPress={trigger}
        />
        {outcome === null ? null
          : <Text accessibilityLiveRegion="polite">
              {offlineOutcomeLabel(outcome)}
            </Text>}
      </Card>
      <Card><Text style={styles.group}>Zuletzt</Text><Text>
        {outcome === null ? 'Bestätigte Zeiten siehst du nach dem Abgleich.' : offlineOutcomeLabel(outcome)}
      </Text></Card>
    </ScrollView>
  </Screen>;
}

function offlineOutcomeLabel(outcome: OfflineManualOutcome): string {
  if (outcome === 'pending') {
    return 'Auslöser sicher vorgemerkt; Serverbestätigung ausstehend';
  }
  if (outcome === 'time_entry_started') return 'Arbeitszeit vom Server gestartet';
  if (outcome === 'time_entry_stopped') return 'Arbeitszeit vom Server gestoppt';
  if (outcome === 'break_started') return 'Pause vom Server begonnen';
  if (outcome === 'break_stopped') return 'Pause vom Server beendet';
  if (outcome === 'break_without_active_time_entry_rejected') return 'Ohne laufende Arbeitszeit ist keine Pause möglich.';
  if (outcome === 'work_trigger_during_break_rejected') return 'Die Pause muss zuerst mit dem Pausenauslöser beendet werden.';
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
});
