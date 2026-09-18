import { useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import type { AdminSetupCapability, AdminSetupState } from '../administration/contracts';
import { ActionButton, AppText as Text, TouchTarget, Card, Screen, TextField } from '../design/primitives';
import { LineIcon } from '../design/LineIcon';
import { mobileTokens } from '../design/tokens';

export function AdminSetupScreen({ administration }: { readonly administration: AdminSetupCapability }) {
  const state = useSyncExternalStore((listener) => administration.subscribe(listener),
    () => administration.getState(), () => administration.getState());
  const [assigning, setAssigning] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [tagName, setTagName] = useState('');
  const [pauseTag, setPauseTag] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    if (state.status === 'ready' && state.outcome?.status === 'tag_provisioned') {
      setAssigning(false); setCustomerId(''); setTagName(''); setInvalid(false);
    }
  }, [state]);
  const goBack = () => { void administration.cancel(); setAssigning(false); };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!assigning) return false;
      goBack(); return true;
    });
    return () => subscription.remove();
  }, [assigning, administration]);
  if (state.status === 'inactive' || state.status === 'loading') return <Message title="Tags werden geladen …" />;
  if (state.status === 'not_authorized') return <Message title="Du hast keine Berechtigung zum Zuordnen von Tags." />;
  const projection = state.projection;
  const busy = state.status === 'capturing' || state.status === 'writing' || state.status === 'submitting';
  const presentation = presentAdminSetupState(state);
  const capture = () => {
    if (busy) return;
    if (tagName.trim().length === 0 || (!pauseTag && customerId.length === 0)) { setInvalid(true); return; }
    setInvalid(false);
    if (pauseTag) void administration.provisionBreak(tagName);
    else void administration.provision(customerId, tagName);
  };
  return <Screen title="Tags"><ScrollView contentContainerStyle={styles.container}>
    {assigning ? <>
      <View style={styles.formHeader}><TouchTarget accessibilityRole="button" accessibilityLabel="Zurück zu Tags"
        onPress={goBack} style={styles.back}><LineIcon name="back" color={mobileTokens.color.text} /></TouchTarget>
        <Text style={styles.title}>Tag zuordnen</Text></View>
      <Text style={styles.muted}>Wähle ein Arbeitsziel und gib dem Tag einen Namen. Tippe dann auf den Kreis und halte dein Handy an den Tag, bis er zugeordnet ist. Dabei wird der Tag beschrieben und sein bisheriger Inhalt ersetzt.</Text>
      {invalid ? <Text accessibilityRole="alert">Wähle ein Arbeitsziel und gib eine Bezeichnung ein. Deine Eingaben bleiben erhalten.</Text> : null}
      <Text style={styles.label}>Arbeitsziel</Text>
      {projection.customers.filter((customer) => customer.active).map((customer) => <ActionButton
        key={customer.id} title={customer.displayName} tone={!pauseTag && customerId === customer.id ? 'primary' : 'secondary'}
        accessibilityState={{ selected: !pauseTag && customerId === customer.id }} disabled={busy}
        onPress={() => { setCustomerId(customer.id); setPauseTag(false); }} />)}
      {projection.customers.filter((customer) => customer.active).length === 0
        ? <Text>Lege zuerst im Admin-Web ein Arbeitsziel an.</Text> : null}
      <ActionButton title="Pause" tone={pauseTag ? 'primary' : 'quiet'} disabled={busy}
        accessibilityState={{ selected: pauseTag }} onPress={() => setPauseTag(true)} />
      <Text style={styles.label}>Bezeichnung</Text>
      <TextField value={tagName} onChangeText={setTagName} maxLength={80} editable={!busy}
        placeholder="z. B. Eingang Werkstatt" accessibilityLabel="Bezeichnung des NFC-Tags" />
      <TouchTarget accessibilityRole="button" accessibilityLabel="NFC-Tag beschreiben und zuordnen" disabled={busy}
        accessibilityState={{ disabled: busy }} onPress={capture} style={styles.capture}>
        <LineIcon name="capture" size={48} color={mobileTokens.color.accent} />
        <Text style={{ fontWeight: '800', textAlign: 'center' }}>{busy ? 'Jetzt den Tag antippen' : 'Tag erfassen'}</Text>
      </TouchTarget>
      <ActionButton title="Abbrechen" tone="quiet" onPress={goBack} />
    </> : <>
      <Text style={styles.muted}>{projection.organization.name}</Text>
      <Text style={styles.muted}>Jeder Tag gehört zu einem Arbeitsziel. Start und Stopp erkennt Taptura selbst.</Text>
      {projection.nfcTags.map((tag) => <Card key={tag.id}>
        <View style={styles.row}><LineIcon name="setup" size={24} color={mobileTokens.color.accent} />
          <View style={{ flex: 1 }}><Text style={styles.label}>{tag.displayName}</Text>
            <Text style={styles.muted}>{projection.customers.find((customer) => customer.id === tag.targetCustomerId)?.displayName
              ?? presentAssignment(tag.assignmentState, tag.assignmentType)}</Text></View></View>
      </Card>)}
      {projection.nfcTags.length === 0 ? <Card><Text>Noch keine Tags. Ordne deinen ersten Tag einem Arbeitsziel zu.</Text></Card> : null}
      <ActionButton title="Tag zuordnen" tone="cta" onPress={() => setAssigning(true)} />
      {projection.nextCursor !== null ? <ActionButton title="Weitere Tags laden" tone="secondary"
        onPress={() => administration.loadMore()} /> : null}
      <ActionButton title="Aktualisieren" tone="quiet" onPress={() => administration.refresh()} />
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
  return assignmentType === 'break' ? 'Pausen-Auslöser' : 'Arbeitsziel zugeordnet';
}

export function presentAdminSetupState(state: AdminSetupState): { title: string; message: string } {
  if (state.status === 'capturing') return { title: 'Bereit zum Erfassen', message: 'Halte das Android-Gerät an den neuen NFC-Tag.' };
  if (state.status === 'writing') return { title: 'Tag wird beschrieben', message: 'Halte dein Handy weiter an den Tag.' };
  if (state.status === 'submitting') return { title: 'Tag wird sicher eingerichtet', message: 'Registrierung und Zuordnung werden atomar vom Server geprüft.' };
  if (state.status !== 'ready' || state.outcome === null) return { title: 'Einrichtung bereit', message: 'Wähle einen Kunden und gib eine eindeutige Tag-Bezeichnung ein.' };
  switch (state.outcome.status) {
    case 'tag_provisioned': return { title: 'Tag erfolgreich zugeordnet', message: 'Der Server hat den Tag und seine Zuordnung gespeichert.' };
    case 'tag_already_registered': return { title: 'Tag bereits registriert', message: 'Der Server hat keine neue Zuordnung angelegt.' };
    case 'tag_write_failed': return { title: 'Tag konnte nicht beschrieben werden, nichts wurde registriert', message: {
      ndef_not_supported: 'Dieser Tag unterstützt das benötigte Nachrichtenformat nicht.',
      read_only: 'Dieser Tag ist schreibgeschützt. Verwende einen beschreibbaren Tag.',
      capacity_exceeded: 'Dieser Tag hat nicht genug Speicher. Verwende einen anderen Tag.',
      tag_changed: 'Es wurde ein anderer Tag erkannt. Versuche es mit demselben Tag erneut.',
      write_failed: 'Halte dein Handy am Tag und versuche es erneut.',
      cancelled: 'Das Beschreiben wurde abgebrochen. Du kannst es erneut versuchen.',
    }[state.outcome.reason] };
    case 'customer_unavailable': return { title: 'Kunde nicht verfügbar', message: 'Aktualisiere die Ansicht und wähle einen aktiven Kunden.' };
    case 'invalid_input': return { title: 'Eingabe ungültig', message: 'Prüfe Kunde und Tag-Bezeichnung.' };
    case 'unreadable': return { title: 'Tag nicht lesbar', message: 'Bitte versuche die Erfassung erneut.' };
    case 'timed_out': return { title: 'Erfassung abgelaufen', message: 'Es wurde rechtzeitig kein NFC-Tag erkannt.' };
    case 'cancelled': return { title: 'Erfassung abgebrochen', message: 'Es wurden keine Tag-Daten gesendet.' };
    case 'nfc_unavailable': return { title: 'NFC nicht verfügbar', message: 'Die geschützte Erfassung ist derzeit nicht verfügbar.' };
    case 'session_rejected': return { title: 'Sitzung nicht mehr gültig', message: 'Bitte melde dich erneut an.' };
    case 'request_failed': return { title: 'Einrichtung nicht abgeschlossen', message: 'Es wurde keine erfolgreiche Zuordnung bestätigt.' };
    default: return state.outcome satisfies never;
  }
}

function Message({ title }: { readonly title: string }) { return <View style={styles.container}><Text style={styles.title}>{title}</Text></View>; }
const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 24 }, title: { fontSize: 22, fontWeight: '800' },
  muted: { color: mobileTokens.color.textMuted, fontSize: 13, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  capture: { width: 204, height: 204, borderRadius: 999, borderWidth: 2, borderStyle: 'dashed',
    borderColor: mobileTokens.color.line, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 16 },
});
