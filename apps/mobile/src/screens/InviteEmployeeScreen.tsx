import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { MobileManagementScope } from '../auth/contracts';
import type { EmployeesCapability, EmployeesState } from '../employees/contracts';
import { invitationMessage } from '../employees/presentation';
import { ActionButton, AppText as Text, Card, Screen, TextField, TouchTarget } from '../design/primitives';
import { LineIcon } from '../design/LineIcon';
import { mobileTokens } from '../design/tokens';
export function InviteEmployeeScreen({employees,state,scope,locationsEnabled}: {
  readonly employees: EmployeesCapability; readonly state: Extract<EmployeesState,{status:'invite'}>;
  readonly scope: MobileManagementScope; readonly locationsEnabled: boolean;
}) {
  const [name,setName]=useState(''); const [email,setEmail]=useState('');
  const [locationId,setLocationId]=useState<string|null>(scope.kind==='location' ? scope.locationId : null);
  const succeeded=state.outcome==='succeeded' || state.outcome==='succeeded_existing_account';
  return <Screen title="Mitarbeiter einladen"><ScrollView contentContainerStyle={{gap:16,paddingBottom:24}} keyboardShouldPersistTaps="handled">
    <ActionButton title="Zurück zur Liste" tone="quiet" onPress={()=>employees.back()} />
    <Card><Text accessibilityRole="header" style={{fontSize:22,lineHeight:28,fontWeight:'800'}}>Mitarbeiter einladen</Text>
      <Text>Der Zugang wird per E-Mail eingerichtet.</Text></Card>
    <View style={{gap:8}}><Text>Name</Text><TextField accessibilityLabel="Name" value={name} onChangeText={setName} maxLength={80} editable={!state.busy && !succeeded} autoComplete="name" />
      <Text>E-Mail</Text><TextField accessibilityLabel="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} editable={!state.busy && !succeeded} /></View>
    <Card><Text>Rolle</Text><Text style={{fontWeight:'800'}}>Mitarbeiter</Text></Card>
    {scope.kind==='location' ? <Card><Text>Standort</Text><Text>{scope.locationName}</Text></Card>
      : locationsEnabled ? <Card><Text>Standort auswählen</Text>
        {state.locations.map(location=><TouchTarget key={location.id} accessibilityRole="radio" accessibilityLabel={location.name}
          accessibilityState={{checked:location.id===locationId,disabled:state.busy || succeeded}} disabled={state.busy || succeeded}
          onPress={()=>setLocationId(location.id)} style={{padding:12,minHeight:44,borderRadius:10,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:location.id===locationId ? mobileTokens.color.surfaceRaised : mobileTokens.color.surface}}>
          {location.id===locationId ? <LineIcon name="check" color={mobileTokens.color.accent} /> : null}<Text style={{flex:1}}>{location.name}</Text></TouchTarget>)}
        {state.locations.length===0 ? <Text>{state.locationsReady ? 'Es ist kein Standort verfügbar.' : 'Standorte werden geladen oder sind derzeit nicht erreichbar.'}</Text> : null}
        {!state.locationsReady ? <ActionButton title="Standorte erneut laden" tone="quiet" onPress={()=>employees.openInvitation()} /> : null}
      </Card> : <Card><Text>Standort</Text><Text>Gesamter Betrieb</Text></Card>}
    {state.outcome ? <Text accessibilityRole={succeeded ? undefined : 'alert'}>{invitationMessage(state.outcome)}</Text> : null}
    <ActionButton title={state.busy ? 'Wird gesendet …' : 'Einladung senden'} loading={state.busy}
      disabled={state.busy || succeeded || !state.locationsReady || !name.trim() || !email.trim() || (locationsEnabled && locationId===null)}
      onPress={()=>employees.invite(name,email,locationId)} />
  </ScrollView></Screen>;
}
