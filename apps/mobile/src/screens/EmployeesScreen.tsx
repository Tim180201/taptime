import { useEffect, useSyncExternalStore } from 'react';
import { ScrollView, View } from 'react-native';
import type { MobileManagementScope } from '../auth/contracts';
import type { EmployeesCapability } from '../employees/contracts';
import { initials } from '../employees/presentation';
import { ActionButton, AppText as Text, Card, Screen, TouchTarget } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
import { formatClock } from './ownTimeCalendar';
import { formatOwnTimeTimestamp } from './TimeCalendar';
import { PersonTimeScreen } from './PersonTimeScreen';
import { InviteEmployeeScreen } from './InviteEmployeeScreen';
export function EmployeesScreen({employees,scope,locationsEnabled}: {
  readonly employees: EmployeesCapability; readonly scope: MobileManagementScope; readonly locationsEnabled: boolean;
}) {
  const state=useSyncExternalStore(listener=>employees.subscribe(listener),()=>employees.getState(),()=>employees.getState());
  useEffect(()=>{void employees.refresh(); return ()=>employees.leave();},[employees]);
  if (state.status==='person') return <PersonTimeScreen person={state.person} value={state.value} busy={state.busy} failed={state.failed} onBack={()=>employees.back()} onRefresh={()=>employees.refresh()} onMonthChange={month=>{void employees.loadPersonMonth(month);}} />;
  if (state.status==='invite') return <InviteEmployeeScreen employees={employees} state={state} scope={scope} locationsEnabled={locationsEnabled} />;
  if (state.status!=='list') return <Screen title="Mitarbeiter"><Card>
    <Text accessibilityRole={state.status==='not_authorized' || state.status==='unavailable' ? 'alert' : undefined}>
      {state.status==='not_authorized' ? 'Deine Berechtigung ist nicht mehr gültig.' : state.status==='unavailable' ? 'Mitarbeiter sind derzeit nicht erreichbar.' : 'Mitarbeiter werden geladen …'}</Text>
    <ActionButton title="Aktualisieren" onPress={()=>employees.refresh()} /></Card></Screen>;
  return <Screen title="Mitarbeiter"><ScrollView contentContainerStyle={{gap:16,paddingBottom:24}}>
    <Card><Text style={{fontSize:40,lineHeight:48,fontWeight:'800'}}>{state.summary.runningCount} / {state.summary.totalCount}</Text>
      <Text>gerade aktiv · {scope.kind==='organization' ? 'Betrieb' : scope.locationName}</Text>
      <Text style={{fontSize:13,color:mobileTokens.color.textMuted}}>Stand {formatOwnTimeTimestamp(state.summary.serverTime)}</Text></Card>
    <View style={{flexDirection:'row',gap:12}}>{[true,false].map(active=><TouchTarget key={String(active)} accessibilityRole="tab" accessibilityLabel={active ? 'Aktiv' : 'Inaktiv'}
      accessibilityState={{selected:state.filter===active}} onPress={()=>employees.filter(active)}
      style={{flex:1,minHeight:48,padding:12,borderRadius:10,backgroundColor:state.filter===active ? mobileTokens.color.accent : mobileTokens.color.surface}}>
      <Text style={{textAlign:'center',fontWeight:'800',color:state.filter===active ? mobileTokens.color.onAccent : mobileTokens.color.text}}>{active ? 'Aktiv' : 'Inaktiv'}</Text></TouchTarget>)}</View>
    {state.summary.people.map(person=><TouchTarget key={person.membershipId} accessibilityRole="button" accessibilityLabel={`${person.displayName}, ${person.isRunning ? 'aktiv' : 'inaktiv'}`} onPress={()=>employees.openPerson(person)}
      style={{minHeight:72,padding:12,gap:12,flexDirection:'row',alignItems:'center',backgroundColor:mobileTokens.color.surface,borderRadius:12,borderWidth:1,borderColor:mobileTokens.color.line}}>
      <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:mobileTokens.color.surfaceRaised}}><Text style={{fontWeight:'800'}}>{initials(person.displayName)}</Text></View>
      <View style={{flex:1}}><Text style={{fontWeight:'800'}}>{person.displayName}</Text>
        <Text style={{fontSize:13,color:mobileTokens.color.textMuted}}>{person.isRunning ? `seit ${formatClock(Date.parse(person.runningSince!))} · ${person.runningTargetDisplayName}` : 'Gerade inaktiv'}</Text></View>
      <View style={{width:10,height:10,borderRadius:5,backgroundColor:person.isRunning ? mobileTokens.color.accent : mobileTokens.color.border}} />
    </TouchTarget>)}
    {state.summary.people.length===0 ? <Card><Text>{state.filter ? 'Gerade ist niemand aktiv.' : 'Gerade ist niemand inaktiv.'}</Text></Card> : null}
    {state.failed ? <Text accessibilityRole="alert">Weitere Personen konnten nicht geladen werden. Bitte versuche es erneut.</Text> : null}
    {state.summary.nextCursor!==null ? <ActionButton title="Weitere laden" tone="quiet" disabled={state.busy} loading={state.busy} onPress={()=>employees.loadMore()} /> : null}
    <ActionButton title="Mitarbeiter einladen" onPress={()=>employees.openInvitation()} />
    <ActionButton title="Aktualisieren" tone="quiet" onPress={()=>employees.refresh()} />
  </ScrollView></Screen>;
}
