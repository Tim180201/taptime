import { businessDay, shiftMonth, BUSINESS_TIME_ZONE } from '@taptime/core';
import { Fragment, useEffect, useState, useSyncExternalStore } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { MobileManagementScope } from '../auth/contracts';
import type { EmployeesCapability } from '../employees/contracts';
import { initials } from '../employees/presentation';
import { ActionButton, AppText as Text, Card, Screen, TouchTarget } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
import { formatClock, formatHours } from './ownTimeCalendar';
import { formatOwnTimeTimestamp } from './TimeCalendar';
import { PersonTimeScreen } from './PersonTimeScreen';
import { InviteEmployeeScreen } from './InviteEmployeeScreen';
export function EmployeesScreen({employees,scope,locationsEnabled}: {
  readonly employees: EmployeesCapability; readonly scope: MobileManagementScope; readonly locationsEnabled: boolean;
}) {
  const [chooseMonth,setChooseMonth]=useState(false);
  const current=businessDay(Date.now()).slice(0,7),months=Array.from({length:24},(_,i)=>shiftMonth(current,-i));
  const label=(month:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00Z`));
  const state=useSyncExternalStore(listener=>employees.subscribe(listener),()=>employees.getState(),()=>employees.getState());
  useEffect(()=>{void employees.refresh(); return ()=>employees.leave();},[employees]);
  if (state.status==='person') return <PersonTimeScreen onResend={employees.resendInvitation ? ()=>employees.resendInvitation!() : undefined} person={state.person} value={state.value} busy={state.busy} failed={state.failed} onBack={()=>employees.back()} onRefresh={()=>employees.refresh()} onMonthChange={month=>{void employees.loadPersonMonth(month);}} />;
  if (state.status==='invite') return <InviteEmployeeScreen employees={employees} state={state} scope={scope} locationsEnabled={locationsEnabled} />;
  if (state.status!=='list') return <Screen title="Mitarbeiter"><Card>
    <Text accessibilityRole={state.status==='not_authorized' || state.status==='unavailable' ? 'alert' : undefined}>
      {state.status==='not_authorized' ? 'Deine Berechtigung ist nicht mehr gültig.' : state.status==='unavailable' ? 'Mitarbeiter sind derzeit nicht erreichbar.' : 'Mitarbeiter werden geladen …'}</Text>
    <ActionButton title="Aktualisieren" onPress={()=>employees.refresh()} /></Card></Screen>;
  const month=state.month ?? current;
  const changeMonth=(month:string)=>{setChooseMonth(false);void employees.loadMonth?.(month);};
  const packageUsage=scope.kind==='organization' ? state.summary.packageUsage : null;
  const monthHours=state.summary.people.length>0 && state.summary.people.every(person=>person.monthWorkDurationSeconds!==undefined);
  return <Screen title="Mitarbeiter"><ScrollView refreshControl={<RefreshControl refreshing={state.busy} onRefresh={()=>{if(employees.getState().status==='list' && !state.busy)void employees.refresh();}}/>} contentContainerStyle={{gap:16,paddingBottom:24}}>
    {packageUsage?.packageSize != null ? <Card><Text>{packageUsage.activeAccessCount} Zugänge, Paket {packageUsage.packageSize}</Text>
      {packageUsage.activeAccessCount > packageUsage.packageSize ? <Text style={{color:mobileTokens.color.warning}}>Paket überschritten. Alle Zugänge bleiben nutzbar.</Text> : null}</Card> : null}
    <Card><Text style={{fontSize:40,lineHeight:48,fontWeight:'800'}}>{state.summary.runningCount} / {state.summary.totalCount}</Text>
      <Text>mit laufender Zeit · {scope.kind==='organization' ? 'Betrieb' : scope.locationName}</Text>
      <Text style={{fontSize:13,color:mobileTokens.color.textMuted}}>Stand {formatClock(Date.parse(state.summary.serverTime))}</Text></Card>
    <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
      <TouchTarget accessibilityRole="button" accessibilityLabel="Voriger Monat" disabled={state.busy || month===months.at(-1)} onPress={()=>changeMonth(shiftMonth(month,-1))} style={{width:44,minHeight:48,alignItems:'center',justifyContent:'center'}}><Text>←</Text></TouchTarget>
      <TouchTarget accessibilityRole="button" accessibilityLabel={`Monat auswählen: ${label(month)}`} accessibilityState={{expanded:chooseMonth}} disabled={state.busy} onPress={()=>setChooseMonth(!chooseMonth)} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center'}}><Text style={{fontWeight:'800'}}>{label(month)} ▾</Text></TouchTarget>
      <TouchTarget accessibilityRole="button" accessibilityLabel="Nächster Monat" disabled={state.busy || month===current} onPress={()=>changeMonth(shiftMonth(month,1))} style={{width:44,minHeight:48,alignItems:'center',justifyContent:'center'}}><Text>→</Text></TouchTarget>
    </View>
    {chooseMonth ? <Card>{months.map(m=><ActionButton key={m} tone="quiet" title={label(m)} onPress={()=>changeMonth(m)}/>)}</Card> : null}
    <View style={{flexDirection:'row',gap:12}}>{[true,false].map(active=><TouchTarget key={String(active)} accessibilityRole="tab" accessibilityLabel={active ? 'Zeit läuft' : 'Keine laufende Zeit'}
      accessibilityState={{selected:state.filter===active}} onPress={()=>employees.filter(active)}
      style={{flex:1,minHeight:48,padding:12,borderRadius:10,backgroundColor:state.filter===active ? mobileTokens.color.accent : mobileTokens.color.surface}}>
      <Text style={{textAlign:'center',fontWeight:'800',color:state.filter===active ? mobileTokens.color.onAccent : mobileTokens.color.text}}>{active ? 'Zeit läuft' : 'Keine laufende Zeit'}</Text></TouchTarget>)}</View>
    {[{title:null,people:state.summary.people.filter(p=>!p.departedAt)},{title:'Ausgeschiedene Mitarbeiter',people:state.summary.people.filter(p=>p.departedAt)}].map(group=><Fragment key={group.title ?? 'current'}>{group.title && group.people.length>0 ? <Text accessibilityRole="header" style={{fontWeight:'800'}}>{group.title}</Text> : null}{(monthHours && locationsEnabled ? [...new Set(group.people.map(person=>person.location?.id ?? ''))].map(id=>({
      title:group.people.find(person=>(person.location?.id ?? '')===id)?.location?.name ?? 'Ohne Standort',
      people:group.people.filter(person=>(person.location?.id ?? '')===id),key:id,
    })) : [{title:null,people:group.people,key:'all'}]).map(locationGroup=><Fragment key={locationGroup.key}>
      {locationGroup.title ? <Text accessibilityRole="header" style={{fontWeight:'800'}}>{locationGroup.title}</Text> : null}
      {locationGroup.people.map(person=>      <TouchTarget key={person.membershipId} accessibilityRole="button" accessibilityLabel={`${person.displayName}, ${person.departedAt ? 'ausgeschieden' : person.isRunning ? 'Zeit läuft' : 'Keine laufende Zeit'}${monthHours ? `, ${label(month)} ${formatHours(person.monthWorkDurationSeconds!*1000)} Stunden` : ''}`} onPress={()=>employees.openPerson(person)}
      style={{minHeight:72,padding:12,gap:12,flexDirection:'row',alignItems:'center',backgroundColor:mobileTokens.color.surface,borderRadius:12,borderWidth:1,borderColor:mobileTokens.color.line}}>
      <View style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:mobileTokens.color.surfaceRaised}}><Text style={{fontWeight:'800'}}>{initials(person.displayName)}</Text></View>
      <View style={{flex:1}}><Text style={{fontWeight:'800'}}>{person.displayName}</Text>
        <Text style={{fontSize:13,color:mobileTokens.color.textMuted}}>{person.isRunning ? `seit ${formatClock(Date.parse(person.runningSince!))} · ${person.runningTargetDisplayName}` : person.departedAt ? `Ausgeschieden am ${formatOwnTimeTimestamp(person.departedAt)}` : 'Keine laufende Zeit'}</Text>
        {monthHours ? <Text style={{fontSize:13}}>{label(month)} {formatHours(person.monthWorkDurationSeconds!*1000)} h</Text> : null}</View>
      <View style={{width:10,height:10,borderRadius:5,backgroundColor:person.isRunning ? mobileTokens.color.accent : mobileTokens.color.border}} />
    </TouchTarget>)}</Fragment>)}</Fragment>)}
    {state.summary.people.length===0 ? <Card><Text>{state.filter ? 'Gerade läuft bei niemandem eine Zeit.' : 'Alle haben eine laufende Zeit.'}</Text></Card> : null}
    {state.failed ? <Text accessibilityRole="alert">Weitere Personen konnten nicht geladen werden. Bitte versuche es erneut.</Text> : null}
    {state.summary.nextCursor!==null ? <ActionButton title="Weitere laden" tone="quiet" disabled={state.busy} loading={state.busy} onPress={()=>employees.loadMore()} /> : null}
    <ActionButton title="Mitarbeiter einladen" onPress={()=>employees.openInvitation()} />
    <ActionButton title="Aktualisieren" tone="quiet" onPress={()=>employees.refresh()} />
  </ScrollView></Screen>;
}
