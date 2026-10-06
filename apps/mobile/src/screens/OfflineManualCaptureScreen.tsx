import type {OfflineActiveCapture} from '../work/OfflineActiveCapture';
import {OfflineActiveTimeCard} from './OfflineActiveTimeCard';
import { useRequiredForm, RequiredField } from '../design/RequiredField';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { captureStatus, captureClock, type MobileOwnTimeQueryResponse, type SafeWorkTarget } from '@taptime/mobile-work-contract';
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
  | 'not_transferred'
  | Extract<
      ManualOfflineAcknowledgement,
      { status: 'server_decision' }
    >['outcome'];

export function OfflineManualCaptureScreen({
  manual,
  offlineActive,
  restorationKey,
  confirmedOwnTime,
  capturePending=false,
  transmissionPaused=false,
  transmissionRetryAvailable=false,
}: {
  readonly manual: OfflineManualCaptureCapability;
  readonly offlineActive?:OfflineActiveCapture;
  readonly confirmedOwnTime?: MobileOwnTimeQueryResponse | null;
  readonly capturePending?: boolean;
  readonly transmissionPaused?: boolean;
  readonly transmissionRetryAvailable?: boolean;
  readonly restorationKey: string;
}) {
  const [projection, setProjection] = useState<ProjectionState>({ status: 'loading' });
  const [selected, setSelected] = useState<SafeWorkTarget | null>(null);
  const [pause, setPause] = useState(false);
  const form = useRequiredForm();
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
    } else if (acknowledgement?.status === 'not_transferred') {
      setPendingWorkEventId(null);
      setOutcome('not_transferred');
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
      submitting || !form.validate()
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
    } else if (acknowledgement?.status === 'not_transferred') {
      setPendingWorkEventId(null);
      setOutcome('not_transferred');
    } else {
      setPendingWorkEventId(result.workEventId);
      setOutcome('pending');
    }
  };

  return <Screen title="Manuell erfassen" eyebrow="OFFLINE">
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      {offlineActive && confirmedOwnTime ? <OfflineActiveTimeCard capture={offlineActive} value={confirmedOwnTime} disabled={capturePending||transmissionPaused||pendingWorkEventId!==null}/> : null}
      <Card>
        {transmissionPaused ? <Text accessibilityRole="alert">{transmissionRetryAvailable
          ? 'Übertragung angehalten. Bitte versuche es erneut.' : 'Übertragung angehalten. Bitte wende dich an deine Verwaltung.'}</Text>
          : capturePending || pendingWorkEventId!==null ? <Text accessibilityLiveRegion="polite">Wird übertragen …</Text> : null}
        <Text>{confirmedOwnTime?.activeRecord ? captureStatus(confirmedOwnTime.activeRecord)
          : confirmedOwnTime ? 'Keine laufende Zeit bestätigt' : 'Noch kein bestätigter Stand verfügbar'}</Text>
        <Text>{confirmedOwnTime ? `Stand ${captureClock(confirmedOwnTime.activeRecord?.calendar?.asOf ?? confirmedOwnTime.windowEndedAt)}, offline` : 'Offline'}</Text>
      </Card>
      <Text style={styles.explanation}>
        Wähle dein Arbeitsziel. Deine Erfassung bleibt auf dem Handy gespeichert und startet oder stoppt die Arbeitszeit nach der Übertragung.
      </Text>
      <RequiredField form={form} error={selected===null && !pause ? "Bitte ein Arbeitsziel oder Pause wählen." : null}><Text style={styles.group}>Arbeitsziel</Text>
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
          accessibilityHint="Beginnt oder beendet deine Pause automatisch, sobald die Erfassung übertragen ist."
          onPress={() => { setSelected(null); setPause(true); setOutcome(null); }} />
      </View></RequiredField>
      <Card>
        <Text>{pause ? 'Pause' : selected?.displayName ?? 'Noch kein Arbeitsziel ausgewählt'}</Text>
        <ActionButton
          tone="cta"
          title={submitting ? 'Wird sicher gespeichert …' : 'Jetzt erfassen'}
          disabled={submitting}
          loading={submitting}
          accessibilityHint={pause ? 'Beginnt oder beendet deine Pause automatisch, sobald die Erfassung übertragen ist.'
            : 'Startet oder stoppt deine Arbeitszeit automatisch, sobald die Erfassung übertragen ist.'}
          onPress={trigger}
        />
        {outcome === null ? null
          : <Text accessibilityLiveRegion="polite">
              {offlineOutcomeLabel(outcome,transmissionPaused)}
            </Text>}
      </Card>
      <Card><Text style={styles.group}>Zuletzt</Text><Text>
        {outcome === null ? 'Bestätigte Zeiten siehst du nach dem Abgleich.' : offlineOutcomeLabel(outcome,transmissionPaused)}
      </Text></Card>
    </ScrollView>
  </Screen>;
}

function offlineOutcomeLabel(outcome: OfflineManualOutcome,transmissionPaused=false): string {
  if (outcome === 'pending') {
    return transmissionPaused ? 'Deine Erfassung ist gespeichert. Die Übertragung ist angehalten.' : 'Deine Erfassung ist gespeichert, wird übertragen.';
  }
  if (outcome === 'not_transferred') return 'Deine Erfassung konnte nicht übertragen werden. Der Beleg bleibt auf dem Handy. Prüfe „Meine Zeiten“.';
  if (outcome === 'time_entry_started') return 'Arbeitszeit gestartet';
  if (outcome === 'time_entry_stopped') return 'Arbeitszeit gestoppt';
  if (outcome === 'break_started') return 'Pause begonnen';
  if (outcome === 'break_stopped') return 'Pause beendet';
  if (outcome === 'break_without_active_time_entry_rejected') return 'Ohne laufende Arbeitszeit ist keine Pause möglich.';
  if (outcome === 'work_trigger_during_break_rejected') return 'Deine Arbeitszeit bleibt unverändert. Beende zuerst die Pause über die Pausentaste.';
  if (outcome === 'duplicate_scan_ignored') return 'Doppelte Erfassung; deine Arbeitszeit bleibt unverändert';
  if (outcome === 'active_entry_for_other_target_rejected') {
    return 'Eine andere Arbeitszeit ist aktiv.';
  }
  if (outcome === 'work_location_unavailable') return 'Das Arbeitsziel ist keinem für dich berechtigten Standort zugeordnet. Deine Arbeitszeit bleibt unverändert; bitte die Verwaltung um Prüfung.';
  if (outcome === 'escalation_required') return 'Deine Arbeitszeit bleibt unverändert. Bitte die Verwaltung, die Erfassung zu prüfen.';
  return 'Deine Erfassung wurde abgelehnt. Melde dich erneut an.';
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
