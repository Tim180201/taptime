import { APP_NAME } from '../../../../shared/product';
import {SubviewBack, useSubviewBack} from '../navigation/SubviewBack';
import { useRequiredForm, RequiredField, RequiredTextField } from '../design/RequiredField';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RefreshControl, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { AdminSetupCapability, AdminSetupState } from '../administration/contracts';
import { ActionButton, AppText as Text, TouchTarget, Card, Screen } from '../design/primitives';
import { LineIcon } from '../design/LineIcon';
import { mobileTokens } from '../design/tokens';

export function AdminSetupScreen({ administration }: { readonly administration: AdminSetupCapability }) {
  const state = useSyncExternalStore((listener) => administration.subscribe(listener),
    () => administration.getState(), () => administration.getState());
  useEffect(()=>()=>{const current=administration.getState();if(current.status==='capturing'||current.status==='writing')void administration.cancel();},[administration]);
  const form = useRequiredForm();
  const [loadedAt,setLoadedAt]=useState<number|null>(null);
  const initialProjection=useRef('projection' in state?state.projection:null);
  useEffect(()=>{
    const current=administration.getState();
    if(current.status==='ready'||current.status==='inactive')void administration.refresh().catch(()=>undefined);
  },[administration]);
  const projectionVersion='projection' in state?state.projection:null;
  useEffect(()=>{
    // A cached projection does not become fresh merely because this screen reopened.
    if(state.status==='ready'&&projectionVersion!==initialProjection.current){
      initialProjection.current=projectionVersion;setLoadedAt(Date.now());
    }
  },[projectionVersion,state.status]);
  const [assigning, setAssigning] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [tagName, setTagName] = useState('');
  const [pauseTag, setPauseTag] = useState(false);
  useEffect(() => {
    if (state.status === 'ready' && state.outcome?.status === 'tag_provisioned') {
      setAssigning(false); setCustomerId(''); setTagName('');
    }
  }, [state]);
  const scanning=state.status==='capturing'||state.status==='writing';
  const locked=state.status==='submitting'||state.status==='creating_customer';
  const goBack=()=>{if(locked)return;if(scanning){void administration.cancel();return;}setAssigning(false);};
  useSubviewBack(scanning||locked?goBack:null,3);
  if (state.status === 'inactive' || state.status === 'loading') return <Message title="Karten werden geladen …" />;
  if (state.status === 'not_authorized') return <Message title="Du hast keine Berechtigung zum Zuordnen von Karten." />;
  const projection = state.projection;
  const busy = state.status === 'creating_customer' || state.status === 'capturing' || state.status === 'writing' || state.status === 'submitting';
  const presentation = presentAdminSetupState(state, Platform.OS);
  const capture = () => {
    if (busy) return;
    if (!form.validate()) return;

    if (pauseTag) void administration.provisionBreak(tagName);
    else void administration.provision(customerId, tagName);
  };
  return <Screen title="Karten"><ScrollView refreshControl={<RefreshControl refreshing={false} enabled={!assigning&&!busy} onRefresh={()=>{if(!assigning&&!busy)void administration.refresh();}}/>} contentContainerStyle={styles.container}>
    {assigning ? <>
      <SubviewBack label="Karten" disabled={locked} onBack={goBack}/>
      <Text accessibilityRole="header" style={styles.title}>NFC-Karte einrichten</Text>
      <Text style={styles.muted}>Wähle ein Arbeitsziel und gib der Karte einen Namen. Tippe dann auf den Kreis und halte dein Handy an die Karte, bis sie zugeordnet ist. Dabei wird die Karte beschrieben und ihr bisheriger Inhalt ersetzt.</Text>
      <RequiredField form={form} error={!pauseTag && !customerId ? "Bitte einen Kunden oder Pause wählen." : null}><Text style={styles.label}>Arbeitsziel</Text>
      {projection.customers.filter((customer) => customer.active).map((customer) => <ActionButton
        key={customer.id} title={customer.displayName} tone={!pauseTag && customerId === customer.id ? 'primary' : 'secondary'}
        accessibilityState={{ selected: !pauseTag && customerId === customer.id }} disabled={busy}
        onPress={() => { setCustomerId(customer.id); setPauseTag(false); }} />)}
      {projection.customers.filter((customer) => customer.active).length === 0
        ? <Text>Lege deinen ersten Kunden im Reiter „Kunden“ an. Danach kannst du seine Karte einrichten.</Text> : null}
      <ActionButton title="Pause" tone={pauseTag ? 'primary' : 'quiet'} disabled={busy}
        accessibilityState={{ selected: pauseTag }} onPress={() => setPauseTag(true)} /></RequiredField>
      <Text style={styles.label}>Bezeichnung</Text>
      <RequiredTextField form={form} error={!tagName.trim() ? "Bitte Bezeichnung eingeben." : null} value={tagName} onChangeText={setTagName} maxLength={80} editable={!busy}
        placeholder="z. B. Eingang Werkstatt" accessibilityLabel="Bezeichnung der Karte" />
      <TouchTarget accessibilityRole="button" accessibilityLabel="Karte einrichten" disabled={busy}
        accessibilityState={{ disabled: busy }} onPress={capture} style={styles.capture}>
        <LineIcon name="capture" size={48} color={mobileTokens.color.accent} />
        <Text style={{ fontWeight: '800', textAlign: 'center' }}>{state.status === 'creating_customer' ? 'Kunde wird angelegt …' : busy ? 'Jetzt die Karte antippen' : 'Karte einrichten'}</Text>
      </TouchTarget>
      <ActionButton title="Abbrechen" tone="quiet" disabled={locked} onPress={goBack} />
    </> : <>
      <Text style={styles.muted}>{projection.organization.name}</Text>
      <Text style={styles.muted}>Jede NFC-Karte gehört zu einem Arbeitsziel. Start und Stopp erkennt {APP_NAME} selbst.</Text>
      {loadedAt!==null?<Text style={styles.muted}>Stand {new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(loadedAt)}</Text>:null}
      {projection.nfcTags.map((tag) => <Card key={tag.id}>
        <View style={styles.row}><LineIcon name="setup" size={24} />
          <View style={{ flex: 1 }}><Text style={styles.label}>{tag.displayName}</Text>
            <Text style={styles.muted}>{projection.customers.find((customer) => customer.id === tag.targetCustomerId)?.displayName
              ?? presentAssignment(tag.assignmentState, tag.assignmentType)}</Text></View></View>
      </Card>)}
      {projection.nfcTags.length === 0 ? <Card><Text>Noch keine Karten. Ordne deine erste Karte einem Arbeitsziel zu.</Text></Card> : null}
      <ActionButton title="Karte einrichten" tone="cta" disabled={busy} onPress={() => {form.reset();setAssigning(true);}} />
      <ActionButton title="Karte prüfen" disabled={busy} onPress={()=>void administration.inspectTag?.()}/>
      {busy?<ActionButton title="Scan abbrechen" tone="quiet" onPress={()=>void administration.cancel()}/>:null}
      {projection.nextCursor !== null ? <ActionButton title="Weitere Karten laden" tone="secondary" disabled={busy}
        onPress={() => administration.loadMore()} /> : null}
      <ActionButton title="Aktualisieren" tone="quiet" disabled={busy} onPress={() => administration.refresh()} />
    </>}
    {state.status !== 'ready' || state.outcome !== null ? <Card>
      <Text accessibilityLiveRegion="polite" style={styles.label}>{presentation.title}</Text>
      <Text>{presentation.message}</Text>
    </Card> : null}
  </ScrollView></Screen>;
}

function presentAssignment(
  state: 'assigned' | 'unassigned',
  assignmentType: 'work' | 'break' | null,
): string {
  if (state === 'unassigned') return 'Nicht zugeordnet';
  return assignmentType === 'break' ? 'Pausenkarte' : 'Arbeitsziel zugeordnet';
}

export function presentAdminSetupState(state: AdminSetupState, platform = 'android'): { title: string; message: string } {
  if (state.status === 'creating_customer') return { title: 'Kunde wird angelegt', message: 'Kunde und Standort werden gemeinsam gespeichert.' };
  if (state.status === 'capturing') return { title: 'Bereit zum Erfassen', message: platform === 'ios' ? 'Halte dein iPhone an die neue Karte.' : 'Halte das Android-Gerät an die neue Karte.' };
  if (state.status === 'writing') return { title: 'Karte wird beschrieben', message: 'Halte dein Handy weiter an die Karte.' };
  if (state.status === 'submitting') return { title: 'Karte wird sicher eingerichtet', message: 'Die Karte und ihre Zuordnung werden gemeinsam gespeichert.' };
  if (state.status !== 'ready' || state.outcome === null) return { title: 'Einrichtung bereit', message: 'Wähle einen Kunden und gib eine eindeutige Kartenbezeichnung ein.' };
  switch (state.outcome.status) {
    case 'tag_checked': return {title: state.outcome.assignment==='customer'?state.outcome.customerName??'Kunde':state.outcome.assignment==='break'?'Pause':'Nicht zugeordnet', message:`Standort: ${state.outcome.locationName??'Ohne Standortzuordnung'}`};
    case 'customer_created': return { title: 'Kunde angelegt', message: state.outcome.refreshFailed
      ? 'Der Kunde ist gespeichert. Die Liste konnte noch nicht neu geladen werden. Aktualisiere die Ansicht, bevor du die Karte zuordnest.'
      : 'Der neue Kunde ist ausgewählt. Du kannst jetzt seine Karte einrichten.' };
    case 'customer_offline': return { title: 'Du bist offline', message: 'Verbinde dich mit dem Internet, um den Kunden anzulegen. Deine Eingaben bleiben erhalten; es wird nichts automatisch nachgesendet.' };
    case 'customer_location_required': return { title: 'Standort fehlt', message: 'Wähle einen Standort für den neuen Kunden. Deine Eingaben bleiben erhalten.' };
    case 'customer_forbidden': return { title: 'Kunde nicht angelegt', message: 'Du darfst an diesem Standort keinen Kunden anlegen. Aktualisiere die Standortauswahl. Deine Eingaben bleiben erhalten.' };
    case 'customer_request_failed': return { title: 'Noch keine Bestätigung', message: 'Prüfe deine Verbindung und versuche es mit denselben Eingaben erneut. Der Kunde wird dabei nicht doppelt angelegt.' };
    case 'tag_provisioned': return { title: 'Karte erfolgreich zugeordnet', message: 'Die Karte und ihre Zuordnung sind gespeichert.' };
    case 'tag_already_registered': return { title: 'Karte bereits registriert', message: 'Die bisherige Zuordnung bleibt erhalten.' };
    case 'tag_write_failed': return { title: 'Karte konnte nicht beschrieben werden, nichts wurde registriert', message: {
      ndef_not_supported: 'Die Karte wurde nicht eingerichtet. Verwende eine andere beschreibbare Karte.',
      read_only: 'Diese Karte ist schreibgeschützt. Verwende eine beschreibbare Karte.',
      capacity_exceeded: 'Diese Karte hat nicht genug Speicher. Verwende eine andere Karte.',
      tag_changed: 'Es wurde eine andere Karte erkannt. Versuche es mit derselben Karte erneut.',
      write_failed: 'Halte dein Handy an der Karte und versuche es erneut.',
      cancelled: 'Das Beschreiben wurde abgebrochen. Du kannst es erneut versuchen.',
    }[state.outcome.reason] };
    case 'customer_unavailable': return { title: 'Kunde nicht verfügbar', message: 'Aktualisiere die Ansicht und wähle einen aktiven Kunden.' };
    case 'invalid_input': return { title: 'Eingabe ungültig', message: 'Prüfe Kunde und Kartenbezeichnung.' };
    case 'unreadable': return { title: 'Karte nicht lesbar', message: 'Bitte versuche die Erfassung erneut.' };
    case 'timed_out': return { title: 'Erfassung abgelaufen', message: 'Es wurde keine Karte erkannt und nichts gesendet. Versuche den Scan erneut.' };
    case 'cancelled': return { title: 'Erfassung abgebrochen', message: 'Es wurden keine Kartendaten gesendet.' };
    case 'nfc_unavailable': return { title: 'NFC nicht verfügbar', message: 'Die Karte wurde nicht eingerichtet. Prüfe, ob NFC am Handy eingeschaltet ist.' };
    case 'session_rejected': return { title: 'Sitzung nicht mehr gültig', message: 'Bitte melde dich erneut an.' };
    case 'request_failed': return { title: 'Einrichtung nicht abgeschlossen', message: 'Ob die Zuordnung gespeichert wurde, ist noch unklar. Aktualisiere die Kartenliste und prüfe die Zuordnung.' };
    default: return state.outcome satisfies never;
  }
}

function Message({ title }: { readonly title: string }) { return <Screen title="Karten"><Card><Text>{title}</Text></Card></Screen>; }
const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 24 }, title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  muted: { color: mobileTokens.color.textMuted, fontSize: 13, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  capture: { width: 204, height: 204, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed',
    borderColor: mobileTokens.color.line, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 16 },
});
