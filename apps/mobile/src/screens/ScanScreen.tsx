import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import type { OfflineActiveCapture } from '../work/OfflineActiveCapture';
import { OfflineActiveTimeCard } from './OfflineActiveTimeCard';
import { ActiveTimeCard } from './ActiveTimeCard';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProductMembershipRole } from '../auth/contracts';
import { ActionButton, AppText as Text, TouchTarget, Card } from '../design/primitives';
import { ScanRing } from '../design/ScanRing';
import { RecentTimeCard } from './RecentTimeCard';
import { connectTapMoment, TapMomentPresenter } from './tapMoment';
import type { MobileWorkCapability } from '../work/contracts';
import { mobileTokens } from '../design/tokens';
import {
  type ProductScanCapability,
  type ProductScanState,
} from '../scan/contracts';

interface ScanScreenProps {
  readonly offline?:boolean;
  readonly offlineActive?:OfflineActiveCapture;
  readonly confirmedOwnTime?:MobileOwnTimeQueryResponse|null;
  readonly actor: ProductMembershipRole | 'offline';
  readonly scan: ProductScanCapability;
  readonly signOut: () => Promise<void>;
  readonly embedded?: boolean;
  readonly onManualCapture?: () => void;
  readonly work?: MobileWorkCapability;
}

export interface ScanScreenPresentation {
  readonly title: string;
  readonly message: string;
  readonly tone: 'neutral' | 'success' | 'warning' | 'error';
}

export function ScanScreen({ actor, scan, signOut, embedded = false, work, onManualCapture, offline=false,offlineActive,confirmedOwnTime }: ScanScreenProps) {
  const workState = useSyncExternalStore(listener=>work?.subscribe(listener)??(()=>{}),()=>work?.getState()??null,()=>work?.getState()??null);
  const ios = Platform.OS === 'ios';
  const state = useSyncExternalStore((listener) => scan.subscribe(listener),
    () => scan.getState(), () => scan.getState());
  const presenter = useMemo(() => new TapMomentPresenter(), []);
  const moment = useSyncExternalStore(presenter.subscribe, presenter.getState, presenter.getState);
  useEffect(() => {
    const unsubscribe = connectTapMoment(scan, presenter, work);
    return () => { unsubscribe(); presenter.dispose(); };
  }, [scan, presenter, work]);
  const showMoment = moment !== null && !state.transmissionPaused;
  const ready = isScanReadyState(state) && !(workState?.status==='ready' && workState.submitting);
  const scanBusy=state.status==='scanning' || state.status==='submitting';
  const resting = !state.transmissionPaused && ((ready && (state.status === 'saved_locally' || state.status === 'server_decision' && presentScanState(state).tone === 'success' || ('outcome' in state && (state.outcome === null || presentScanState(state).tone === 'success'))))
    || state.status === 'scanning');
  const presentation = presentScanState(state, Platform.OS);
  return <SafeAreaView edges={embedded ? [] : ['top', 'bottom', 'left', 'right']} style={[styles.container, embedded && styles.embeddedContainer]}>
    {embedded ? null : <View style={styles.header}><Text style={styles.brand}>Taptura</Text>
      <Text style={styles.role}>{presentActor(actor)}</Text></View>}
    <ScrollView contentContainerStyle={styles.content}>
      {offline && offlineActive && confirmedOwnTime ? <OfflineActiveTimeCard capture={offlineActive} value={confirmedOwnTime} disabledReason={scanBusy?'Der Scan läuft. Beende ihn oder brich ihn ab.':state.updateRequired?'Bitte App aktualisieren':state.transmissionPaused?'Die Übertragung ist angehalten. Öffne „Übertragung“.':'Deine letzte Erfassung wartet noch auf Bestätigung.'} disabled={scanBusy || !!state.transmissionPaused || !!state.updateRequired || ('queueCount' in state && state.queueCount>0)}/> : null}
      {!offline && work && workState?.status==='ready' && workState.ownTime.activeRecord ? <ActiveTimeCard record={workState.ownTime.activeRecord}
        disabled={scanBusy || workState.submitting || !!workState.capturePending || !!state.transmissionPaused || !!state.updateRequired}
        disabledReason={scanBusy?'Der Scan läuft. Beende ihn oder brich ihn ab.':state.updateRequired?'Bitte App aktualisieren':state.transmissionPaused?'Die Übertragung ist angehalten. Öffne „Übertragung“.':workState.capturePending?'Deine letzte Erfassung wartet noch auf Bestätigung.':undefined}
        onStop={()=>void work.stopActiveTime()} onBreak={()=>void work.triggerBreak()}/> : null}
      {workState?.status==='ready' && workState.feedback ? <Text accessibilityLiveRegion="polite">{workState.feedback}</Text> : null}
      <View style={styles.scene} accessibilityLiveRegion="polite" testID="scan-status">
        <TouchTarget accessibilityRole="button" accessibilityLabel="Karte scannen"
          accessibilityState={{ disabled: !ready }} disabled={!ready}
          onPress={() => scan.scan()} testID="scan-button">
          <ScanRing animate={!showMoment && resting} scanning={!state.transmissionPaused && state.status === 'scanning'}
            result={showMoment ? moment.confirmed ? 'confirmed' : 'pending' : null} />
          {ios ? <Text style={styles.statusTitle}>Karte scannen</Text> : null}
        </TouchTarget>
        <Text style={[styles.statusTitle, showMoment && { color: moment.confirmed
          ? mobileTokens.color.accent : mobileTokens.color.notice }]}>
          {state.transmissionPaused ? `${presentation.title}: ${presentation.message}` : showMoment ? moment.title : resting ? ios ? 'Bereit zum Erfassen' : 'Karte antippen' : presentation.title}
        </Text>
        <Text style={styles.statusMessage}>
          {state.transmissionPaused ? null : showMoment ? moment.confirmed ? 'Gespeichert'
            : 'Sicher gespeichert, wird nachgereicht'
            : resting ? state.status === 'scanning'
              ? 'Halte dein Handy an die Karte.'
              : ios ? 'Tippe auf „Karte scannen“ und halte dein iPhone an die NFC-Karte. Start und Stopp erkennt Taptura selbst.'
                : 'Tippe auf den Kreis und halte dein Handy an die NFC-Karte. Start und Stopp erkennt Taptura selbst.'
              : presentation.message}
        </Text>
        {showMoment ? <Text style={styles.statusMessage}>Bereit für den nächsten Tap</Text> : null}
        {state.status === 'scanning' ? <ActionButton title="Scan abbrechen" tone="quiet"
          onPress={() => scan.cancel()} testID="cancel-scan-button" /> : null}
        {state.transmissionPaused && state.transmissionRetryAvailable ? <ActionButton title="Erneut versuchen"
          onPress={() => scan.retry()} /> : null}
        {!state.transmissionPaused && state.status === 'retry_pending' ? <ActionButton title="Unveränderte Daten erneut senden"
          onPress={() => scan.retry()} testID="retry-same-evidence-button" /> : null}
      </View>
      {workState?.status==='ready' && workState.capturePending && !state.transmissionPaused ? <Text accessibilityLiveRegion="polite">Wird übertragen … Deine Erfassung ist gespeichert, wird übertragen.</Text> : null}
      {state.updateRequired ? <Card><Text accessibilityRole="alert">Bitte App aktualisieren</Text><Text>Deine Erfassungen bleiben auf dem Handy gespeichert. Die Übertragung wartet auf die neue App.</Text></Card> : null}
      {state.untransferred?.length ? <Card>
        {state.untransferred.map(entry => <View key={entry.workEventId}>
          <Text accessibilityRole="alert">{entry.reported ? '1 Erfassung · Wird von der Verwaltung geprüft' : '1 Erfassung konnte nicht übertragen werden'} · {entry.displayName} · {new Date(entry.occurredAt).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'})}</Text>
          <Text>{entry.reported ? 'Der Originalbeleg bleibt auf dem Handy erhalten.' : 'Siehe „Meine Zeiten“. Der Beleg bleibt erhalten und sperrt den Kontowechsel.'}</Text>
        </View>)}
      </Card> : null}
      {work ? <RecentTimeCard work={work} /> : <Card><Text style={styles.role}>Zuletzt</Text>
        <Text>Bestätigte Zeiten siehst du nach der Übertragung.</Text></Card>}
    </ScrollView>
    {onManualCapture ? <ActionButton title="Manuell erfassen" tone="secondary"
      accessibilityLabel="Manuell erfassen" accessibilityHint="Arbeitsziel oder Pause auswählen. Start, Pause, Fortsetzen und Stopp von Hand erfassen."
      disabled={workState?.status==='ready' && workState.submitting} onPress={onManualCapture} /> : null}
      {onManualCapture?<Text>Für jetzt. Vergessene Zeiten findest du unter Meine Zeiten → Zeit hinzufügen.</Text>:null}
    {embedded ? null : <ActionButton title="Abmelden" tone="quiet" onPress={signOut} />}
  </SafeAreaView>;
}

export function presentActor(actor: ProductMembershipRole | 'offline'): string {
  return actor === 'administrator' ? 'Administrator' : actor === 'standortleitung' ? 'Standortleitung'
    : actor === 'offline' ? 'Offline-Erfassung' : 'Mitarbeiter';
}

export function shouldAnimateScanIndicator(state: ProductScanState, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  if (state.transmissionPaused) return false;
  return state.status === 'scanning' || (state.status === 'ready' && state.outcome === null)
    || (state.status === 'offline_ready' && state.outcome === null);
}

export function presentScanState(state: ProductScanState, platform = 'android'): ScanScreenPresentation {
  if(state.transmissionPaused) {
    if (state.transmissionRetryAvailable) return {
      title:'Übertragung angehalten',
      message:'Die Übertragung ist derzeit nicht verfügbar. Bitte versuche es erneut.',
      tone:'warning',
    };
    const count=state.untransferred?.length || 1;
    return {title:'Übertragung angehalten',message:`${count} ${count===1?'Erfassung konnte':'Erfassungen konnten'} nicht übertragen werden. Bitte wende dich an deine Verwaltung.`,tone:'warning'};
  }
  switch (state.status) {
    case 'archive_signout_pending':
      return {title:'Abmelden',message:'Deine Erfassungen werden noch gesichert. Abmelden ist gleich möglich.',tone:'neutral'};
    case 'inactive':
    case 'checking':
      return {
        title: 'NFC wird geprüft',
        message: 'Die Scan-Funktion wird sicher vorbereitet.',
        tone: 'neutral',
      };
    case 'not_supported':
      return {
        title: 'NFC nicht unterstützt',
        message: platform === 'ios' ? 'Dieses iPhone unterstützt das Lesen unserer Karten nicht.'
          : 'NFC-Scans sind in dieser App-Version nur auf unterstützten Android-Geräten möglich.',
        tone: 'warning',
      };
    case 'disabled':
      return {
        title: 'NFC ist ausgeschaltet',
        message: 'Aktiviere NFC in den Android-Einstellungen und öffne die App anschließend erneut.',
        tone: 'warning',
      };
    case 'unavailable':
      return {
        title: 'NFC nicht verfügbar',
        message: 'Die Scan-Funktion konnte nicht sicher vorbereitet werden.',
        tone: 'error',
      };
    case 'scanning':
      return {
        title: 'Bereit zum Erfassen',
        message: platform === 'ios' ? 'Halte dein iPhone an die Karte.' : 'Halte das Android-Gerät an die Karte.',
        tone: 'neutral',
      };
    case 'submitting':
      return {
        title: 'Scan wird sicher verarbeitet',
        message: 'Bitte warte auf die Speicherbestätigung.',
        tone: 'neutral',
      };
    case 'retry_pending':
      return {
        title: 'Übertragung noch offen',
        message: 'Der Scan ist sicher auf diesem Gerät vorgemerkt. Es können ausschließlich dieselben unveränderten Daten erneut gesendet werden – auch nach einem App-Neustart.',
        tone: 'warning',
      };
    case 'offline_ready':
      return state.outcome === null
        ? {
            title: 'Offline bereit',
            message: `Du kannst Karten scannen; deine Erfassungen bleiben auf dem Handy gespeichert. ${state.queueCount} Erfassungen warten auf Bestätigung.`,
            tone: 'success',
          }
        : presentOutcome(state.outcome.status);
    case 'saved_locally':
      return {
        title: 'Sicher lokal gespeichert',
        message: `${state.queueCount} Erfassungen sind auf dem Handy gespeichert und warten auf Bestätigung.`,
        tone: 'warning',
      };
    case 'synchronizing':
      return {
        title: 'Synchronisierung läuft',
        message: `${state.queueCount} Vorgänge werden der Reihe nach sicher bestätigt.`,
        tone: 'neutral',
      };
    case 'server_review_pending':
      return {
        title: 'Wird von der Verwaltung geprüft. Deine Arbeitszeit bleibt unverändert.',
        message: 'Wird von der Verwaltung geprüft',
        tone: 'warning',
      };
    case 'server_decision':
      return presentOutcome(state.outcome.status);
    case 'secure_storage_unavailable':
      return {
        title: 'Sicherer Speicher nicht verfügbar',
        message: 'Neue Scans sind gesperrt; starte die App neu, aber lösche weder die App noch ihre Daten. Bleibt die Meldung bestehen, wende dich an den Support.',
        tone: 'error',
      };
    case 'protected_pending':
      if (state.reason === 'quarantine') return {
        title: 'Nicht übertragene Erfassung geschützt',
        message: 'Ein Beleg konnte nicht übertragen werden und bleibt auf dem Handy erhalten. Er sperrt den Kontowechsel. Melde dich mit dem bisherigen Konto an und prüfe „Meine Zeiten“.',
        tone: 'warning',
      };
      if (state.reason === 'local_evidence_protected') return {
        title: 'Lokaler Speicher geschützt',
        message: 'Die Vorgänge im lokalen Speicher können gerade nicht sicher gelesen oder verarbeitet werden. Lösche weder die App noch ihre Daten und wende dich an den Support.',
        tone: 'warning',
      };
      return state.reason === 'legacy_membership_unknown'
        ? {
            title: 'Älterer Vorgang geschützt',
            message: 'Diese Erfassung kann keinem Konto zugeordnet werden. Lösche weder die App noch ihre Daten und wende dich an den Support.',
            tone: 'warning',
          }
        : {
            title: 'Vorgänge eines anderen Kontos offen',
            message: 'Auf diesem Gerät warten noch Vorgänge eines anderen Kontos auf den Server. Melde dich mit diesem Konto an, damit sie übertragen werden; danach kannst du wechseln.',
            tone: 'warning',
          };
    case 'ready':
      return state.outcome === null
        ? {
            title: 'Bereit zum Scannen',
            message: 'Tippe auf „Karte scannen“ und halte das Gerät anschließend an die Karte.',
            tone: 'success',
          }
        : presentOutcome(state.outcome.status);
    default:
      return state satisfies never;
  }
}

function presentOutcome(
  status: NonNullable<Extract<ProductScanState, { status: 'ready' }>['outcome']>['status'],
): ScanScreenPresentation {
  switch (status) {
    case 'unreadable':
      return { title: 'Karte nicht lesbar', message: 'Bitte versuche den Scan erneut.', tone: 'error' };
    case 'timed_out':
      return { title: 'Scan abgelaufen', message: 'Es wurde keine Karte erkannt und nichts gesendet. Versuche den Scan erneut.', tone: 'warning' };
    case 'cancelled':
      return { title: 'Scan abgebrochen', message: 'Es wurden keine Scan-Daten gesendet.', tone: 'neutral' };
    case 'nfc_unavailable':
      return { title: 'NFC nicht verfügbar', message: 'Ein Scan ist gerade nicht möglich; deine Zeiten bleiben erhalten. Prüfe, ob NFC am Handy eingeschaltet ist.', tone: 'error' };
    case 'tag_not_assigned':
      return { title: 'Karte nicht zugeordnet', message: 'Die Karte gehört zu keinem verfügbaren Arbeitsziel; deine Zeiten bleiben unverändert. Bitte die Verwaltung, die Zuordnung zu prüfen.', tone: 'warning' };
    case 'scan_context_unavailable':
      return { title: 'Zuordnung nicht erreichbar', message: 'Es wurden noch keine Arbeitszeit-Daten gesendet. Bitte starte später einen neuen Scan.', tone: 'error' };
    case 'time_entry_started':
      return { title: 'Arbeitszeit gestartet', message: 'Dein Arbeitsbeginn ist gespeichert.', tone: 'success' };
    case 'time_entry_stopped':
      return { title: 'Arbeitszeit gestoppt', message: 'Dein Arbeitsende ist gespeichert.', tone: 'success' };
    case 'break_started':
      return { title: 'Pause begonnen', message: 'Dein Pausenbeginn ist gespeichert. Das Arbeitsziel bleibt aktiv.', tone: 'success' };
    case 'break_stopped':
      return { title: 'Pause beendet', message: 'Dein Pausenende ist gespeichert.', tone: 'success' };
    case 'duplicate_scan_ignored':
      return { title: 'Doppelter Scan ignoriert', message: 'Deine Arbeitszeit wurde nicht verändert.', tone: 'neutral' };
    case 'active_entry_for_other_target_rejected':
      return { title: 'Andere Arbeitszeit ist aktiv', message: 'Beende zuerst die bereits aktive Arbeitszeit. Es wurde nichts verändert.', tone: 'warning' };
    case 'break_without_active_time_entry_rejected':
      return { title: 'Keine Arbeitszeit aktiv', message: 'Deine Zeiten bleiben unverändert. Starte zuerst eine Arbeitszeit, um eine Pause zu erfassen.', tone: 'warning' };
    case 'work_trigger_during_break_rejected':
      return { title: 'Pause ist aktiv', message: 'Dein Arbeitsziel bleibt unverändert. Beende die Pause über „Pause beenden“.', tone: 'warning' };
    case 'work_location_unavailable':
      return { title: 'Arbeitsziel nicht verfügbar', message: 'Das Arbeitsziel ist keinem für dich berechtigten Standort zugeordnet. Deine Arbeitszeit bleibt unverändert; bitte die Verwaltung um Prüfung.', tone: 'warning' };
    case 'escalation_required':
      return { title: 'Wird von der Verwaltung geprüft', message: 'Wird von der Verwaltung geprüft. Deine Arbeitszeit bleibt unverändert.', tone: 'warning' };
    case 'server_review_pending':
      return { title: 'Scan sicher gespeichert', message: 'Wird von der Verwaltung geprüft. Dein Scan ist gespeichert; deine Arbeitszeit bleibt vorerst unverändert.', tone: 'warning' };
    case 'session_rejected':
      return { title: 'Sitzung nicht mehr gültig', message: 'Bitte melde dich erneut an.', tone: 'error' };
    case 'queue_full':
      return {
        title: 'Lokaler Speicher ist voll',
        message: 'Der Scan wurde nicht als gespeichert bestätigt. Synchronisiere die offenen Vorgänge und versuche es anschließend erneut.',
        tone: 'error',
      };
    default:
      return status satisfies never;
  }
}

function isScanReadyState(state: ProductScanState): boolean {
  return state.status === 'ready'
    || state.status === 'offline_ready'
    || state.status === 'saved_locally'
    || state.status === 'server_review_pending'
    || state.status === 'server_decision';
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 20, backgroundColor: mobileTokens.color.ground },
  embeddedContainer: { paddingTop: 0 },
  content: { flexGrow: 1, paddingBottom: 16, gap: 16 },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  brand: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  role: { fontSize: 13, color: mobileTokens.color.textMuted },
  statusTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  statusMessage: { fontSize: 13, lineHeight: 22, color: mobileTokens.color.textMuted, textAlign: 'center', maxWidth: 320 },
});
