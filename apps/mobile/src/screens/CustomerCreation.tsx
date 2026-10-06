import {useSubviewBack} from '../navigation/SubviewBack';
import { useRequiredForm, RequiredField, RequiredTextField } from '../design/RequiredField';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { AdminSetupCapability, CustomerCreationOptions } from '../administration/contracts';
import { ActionButton, AppText as Text, Card } from '../design/primitives';
import { presentAdminSetupState } from './AdminSetupScreen';

export function CustomerCreation({ administration, onCreated, onEditingChange }: {
  readonly administration: AdminSetupCapability;
  readonly onCreated: () => void;
  readonly onEditingChange?: (open:boolean) => void;
}) {
  const state = useSyncExternalStore(administration.subscribe.bind(administration),
    administration.getState.bind(administration));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [options, setOptions] = useState<CustomerCreationOptions | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(()=>{onEditingChange?.(open);return()=>onEditingChange?.(false);},[open,onEditingChange]);
  const generation = useRef(0);
  const operation = useRef(false);
  useEffect(() => () => {
    generation.current += 1;
    const current = administration.getState();
    if (operation.current && (current.status === 'capturing' || current.status === 'writing')) {
      void administration.cancel();
    }
  }, [administration]);
  const prepare = async () => {
    form.reset();
    const request = ++generation.current;
    setOpen(true); setOptions(null); setMessage('');
    const result = await administration.prepareCustomer().catch(() => ({ status: 'unavailable' as const }));
    if (request !== generation.current) return;
    if (result.status === 'ready' && administration.getState().status !== 'ready') {
      await administration.refresh().catch(() => undefined);
      if (request !== generation.current) return;
      if (administration.getState().status !== 'ready') {
        setOptions({ status: 'unavailable' });
        return;
      }
    }
    setOptions(result);
    if (result.status === 'ready') setLocationId(result.locations.length === 1 ? result.locations[0]!.id : '');
  };
  const form = useRequiredForm();
  const submit = async (withTag: boolean) => {
    if (operation.current || options?.status !== 'ready' || createdId===null && !form.validate()) return;
    const request = generation.current;
    operation.current = true;
    setBusy(true); setMessage('');
    try {
      if (administration.getState().status !== 'ready') {
        await administration.refresh();
        if (request !== generation.current) return;
        if (administration.getState().status !== 'ready') {
          setOptions({ status: 'unavailable' });
          return;
        }
      }
      let customerId = createdId;
      if (customerId === null) {
        await administration.createCustomer(name, options.locationsEnabled ? locationId || undefined : undefined);
        if (request !== generation.current) return;
        const result = administration.getState();
        if (result.status !== 'ready' || result.outcome?.status !== 'customer_created') return;
        customerId = result.outcome.customerId;
        setCreatedId(customerId); onCreated();
        if (withTag && result.outcome.refreshFailed) {
          setMessage('Kunde angelegt. Versuche die Kartenzuordnung erneut; dabei wird die Kundenliste neu geladen.');
          return;
        }
      } else if (withTag) {
        // Creation is confirmed. Reload its projection instead of sending a new creation.
        await administration.refresh();
        if (request !== generation.current) return;
        let projection = administration.getState();
        const seen = new Set<string>();
        while (projection.status === 'ready'
          && !projection.projection.customers.some(customer => customer.id === customerId)
          && projection.projection.nextCursor !== null && !seen.has(projection.projection.nextCursor)) {
          seen.add(projection.projection.nextCursor);
          await administration.loadMore();
          if (request !== generation.current) return;
          projection = administration.getState();
        }
        if (projection.status !== 'ready' || !projection.projection.customers.some(customer => customer.id === customerId && customer.active)) {
          setMessage('Kunde angelegt. Die Kundenliste konnte noch nicht aktualisiert werden. Versuche die Kartenzuordnung erneut.');
          return;
        }
      }
      if (withTag) {
        // Use the customer name as the initial tag label; no additional form is needed.
        await administration.provision(customerId, Array.from(name.trim()).slice(0, 80).join(''));
        if (request !== generation.current) return;
        const result = administration.getState();
        if (result.status !== 'ready' || result.outcome?.status !== 'tag_provisioned') return;
        setMessage('Kunde angelegt und Karte zugeordnet.');
      } else setMessage('Kunde angelegt.');
      setOpen(false); setName(''); setCreatedId(null);
    } catch {
      if (request === generation.current) setMessage(createdId === null
        ? 'Noch keine Bestätigung. Prüfe deine Verbindung und versuche es mit denselben Eingaben erneut.'
        : 'Kunde angelegt. Die Kartenzuordnung konnte nicht abgeschlossen werden.');
    } finally {
      operation.current = false;
      if (request === generation.current) setBusy(false);
    }
  };
  const close=()=>{generation.current+=1;setOpen(false);setCreatedId(null);setName('');};
  useSubviewBack(open?()=>{if(state.status==='capturing'||state.status==='writing'){void administration.cancel();return;}if(!busy)close();}:null,3);
  const presentation = presentAdminSetupState(state, Platform.OS);
  return <Card>
    {!open ? <ActionButton title="+ Kunde hinzufügen" onPress={() => { void prepare(); }} /> : <>
      <Text accessibilityRole="header">Kunde hinzufügen</Text>
      <Text>Zum Anlegen brauchst du eine Internetverbindung.</Text>
      <Text>Name</Text>
      <RequiredTextField form={form} error={!name.trim() ? "Bitte Name eingeben." : null} accessibilityLabel="Name des neuen Kunden" value={name} onChangeText={setName} maxLength={120} editable={!busy && createdId === null} />
      {options === null ? <Text>Standorte werden geladen …</Text> : options.status !== 'ready' ? <>
        <Text accessibilityRole="alert">{options.status === 'offline' ? 'Du bist offline. Verbinde dich mit dem Internet.' : 'Die Kundeneinrichtung konnte nicht geladen werden. Prüfe deine Verbindung und Berechtigung.'}</Text>
        <ActionButton title="Erneut laden" onPress={() => { void prepare(); }} />
      </> : <>
        {options.locationsEnabled && options.locations.length > 1 ? <>
          <RequiredField form={form} error={!locationId ? "Bitte einen Standort wählen." : null}><Text>Standort</Text>
          {options.locations.map(location => <ActionButton key={location.id} title={location.displayName}
            accessibilityState={{ selected: location.id === locationId }} disabled={busy || createdId !== null}
            tone={location.id === locationId ? 'primary' : 'secondary'} onPress={() => setLocationId(location.id)} />)}</RequiredField>
        </> : options.locationsEnabled && options.locations.length === 0 ? <Text>Du hast keinen aktiven Standort zum Anlegen.</Text> : null}
        <Text>Zum Einrichten hältst du dein Handy an die NFC-Karte. Ihr bisheriger Inhalt wird dabei ersetzt.</Text>
        <ActionButton title={createdId === null ? 'Karte einrichten' : 'Kartenzuordnung erneut versuchen'} disabled={busy} onPress={() => { void submit(true); }} />
        {createdId === null ? <ActionButton title="Nur anlegen" disabled={busy} tone="secondary" onPress={() => { void submit(false); }} /> : null}
      </>}
      {state.status !== 'ready' || state.outcome !== null ? <><Text accessibilityLiveRegion="polite">{presentation.title}</Text><Text>{presentation.message}</Text></> : null}
      <ActionButton title={createdId === null ? 'Abbrechen' : 'Fertig'} tone="quiet" disabled={busy} onPress={close} />
    </>}
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
  </Card>;
}
