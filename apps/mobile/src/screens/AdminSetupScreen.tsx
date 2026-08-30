import { useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AdminSetupCapability, AdminSetupState } from '../administration/contracts';
import { ActionButton, AppText as Text, TextField } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

export function AdminSetupScreen({ administration }: { readonly administration: AdminSetupCapability }) {
  const state = useSyncExternalStore(
    (listener) => administration.subscribe(listener),
    () => administration.getState(),
    () => administration.getState(),
  );
  const [customerId, setCustomerId] = useState('');
  const [tagName, setTagName] = useState('');

  if (state.status === 'inactive' || state.status === 'loading') {
    return <Message title="Einrichtung wird sicher geladen …" />;
  }
  if (state.status === 'not_administrator') {
    return <Message title="Diese Funktion ist nur für Administratoren verfügbar." />;
  }
  const projection = state.projection;
  const busy = state.status === 'capturing' || state.status === 'submitting';
  const presentation = presentAdminSetupState(state);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>NFC-Einrichtung</Text>
      <Text style={styles.organization}>{projection.organization.name}</Text>
      <View style={styles.card} accessibilityLiveRegion="polite">
        <Text style={styles.cardTitle}>{presentation.title}</Text>
        <Text>{presentation.message}</Text>
      </View>
      <Text style={styles.label}>Kunde</Text>
      {projection.customers.filter((customer) => customer.active).map((customer) => (
        <ActionButton key={customer.id}
          title={`${customerId === customer.id ? '✓ ' : ''}${customer.displayName}`}
          tone={customerId === customer.id ? 'primary' : 'secondary'}
          onPress={() => setCustomerId(customer.id)} disabled={busy} />
      ))}
      {projection.customers.length === 0 ? <Text>Noch keine Kunden. Lege zuerst im Admin-Web einen Kunden an.</Text> : null}
      <Text style={styles.label}>Tag-Bezeichnung</Text>
      <TextField value={tagName} onChangeText={setTagName} maxLength={80} editable={!busy}
        placeholder="z. B. Eingang Werkstatt" accessibilityLabel="Bezeichnung des NFC-Tags" />
      <ActionButton title="NFC-Tag erfassen und zuordnen"
        onPress={() => administration.provision(customerId, tagName)}
        loading={state.status === 'submitting'}
        disabled={busy || customerId.length === 0 || tagName.trim().length === 0} />
      <ActionButton title="Pausen-Tag erfassen" tone="secondary"
        onPress={() => administration.provisionBreak(tagName)}
        disabled={busy || tagName.trim().length === 0} />
      {state.status === 'capturing' ? <ActionButton title="Erfassung abbrechen" tone="secondary"
        onPress={() => administration.cancel()} /> : null}
      <Text style={styles.label}>Registrierte Tags</Text>
      {projection.nfcTags.map((tag) => (
        <View key={tag.id} style={styles.tagRow}>
          <Text style={styles.cardTitle}>{tag.displayName}</Text>
          <Text>Prüf-Fingerprint: {tag.validationFingerprint}</Text>
          <Text>{presentAssignment(tag.assignmentState, tag.assignmentType)}</Text>
        </View>
      ))}
      {projection.nextCursor === null ? null : <ActionButton title="Weitere Einträge laden"
        tone="secondary" onPress={() => administration.loadMore()} disabled={busy} />}
      <ActionButton title="Ansicht aktualisieren" tone="quiet"
        onPress={() => administration.refresh()} disabled={busy} />
    </ScrollView>
  );
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
  if (state.status === 'submitting') return { title: 'Tag wird sicher eingerichtet', message: 'Registrierung und Zuordnung werden atomar vom Server geprüft.' };
  if (state.status !== 'ready' || state.outcome === null) return { title: 'Einrichtung bereit', message: 'Wähle einen Kunden und gib eine eindeutige Tag-Bezeichnung ein.' };
  switch (state.outcome.status) {
    case 'tag_provisioned': return { title: 'Tag erfolgreich zugeordnet', message: `Prüf-Fingerprint: ${state.outcome.validationFingerprint}` };
    case 'tag_already_registered': return { title: 'Tag bereits registriert', message: 'Der Server hat keine neue Zuordnung angelegt.' };
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
  container: {
    flexGrow: 1,
    gap: mobileTokens.spacing.sm,
    paddingTop: 48,
    paddingHorizontal: mobileTokens.spacing.md,
    paddingBottom: 40,
    backgroundColor: mobileTokens.color.ground,
  },
  title: { fontSize: 28, fontWeight: '700', color: mobileTokens.color.text },
  organization: { color: mobileTokens.color.textMuted, marginBottom: mobileTokens.spacing.sm },
  card: {
    padding: mobileTokens.spacing.md,
    borderRadius: mobileTokens.radius.card,
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.line,
    borderWidth: 1,
  },
  cardTitle: { color: mobileTokens.color.text, fontWeight: '700', marginBottom: mobileTokens.spacing.xs },
  label: { color: mobileTokens.color.text, fontSize: 16, fontWeight: '700', marginTop: mobileTokens.spacing.sm },
  tagRow: {
    padding: mobileTokens.spacing.md,
    borderRadius: mobileTokens.radius.card,
    backgroundColor: mobileTokens.color.surface,
  },
});
