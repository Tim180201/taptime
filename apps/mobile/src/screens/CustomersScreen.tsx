import { CustomerQuota, QuotaProgress } from './CustomerQuota';
import { businessDay, shiftMonth, formatHours, BUSINESS_TIME_ZONE } from '@taptime/core';
import type { CustomerHoursResult } from '@taptime/mobile-work-contract';
import { useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card, Screen, TouchTarget } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

const label = (month: string) => new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00Z`));
export function CustomersScreen({work, authorityContext, openCustomer}: {readonly work: MobileWorkCapability; readonly authorityContext: object; readonly openCustomer?:{readonly customerId:string;readonly month:string}}) {
  const current=businessDay(Date.now()).slice(0,7),months=Array.from({length:24},(_,i)=>shiftMonth(current,-i));
  const [month,setMonth]=useState(openCustomer?.month??current),[choose,setChoose]=useState(false),[selected,setSelected]=useState<string|null>(openCustomer?.customerId??null);
  const [loaded,setLoaded]=useState<{month:string;authorityContext:object;result:CustomerHoursResult}|null>(null),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(openCustomer){setMonth(openCustomer.month);setSelected(openCustomer.customerId);setChoose(false);}
  },[openCustomer]);
  useEffect(()=>{
    let cancelled=false;setLoaded(null);
    void Promise.resolve(work.readCustomerHours?.(month)??{status:'unavailable' as const}).catch(()=>({status:'unavailable' as const}))
      .then(result=>{if(!cancelled)setLoaded({month,authorityContext,result});});
    return ()=>{cancelled=true;};
  },[work,month,refresh,authorityContext]);
  // A refreshed session can change role, grants or home without changing membership.
  // Hide the old projection during render, before the reload effect has run.
  const result=loaded?.month===month && loaded.authorityContext===authorityContext?loaded.result:null,value=result?.status==='ready'?result.value:null;
  const customer=value?.customers.find(c=>c.customerId===selected);
  return <Screen title="Kunden"><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.month}>
      <TouchTarget accessibilityRole="button" accessibilityLabel="Voriger Monat" accessibilityState={{disabled:month===months.at(-1)}} disabled={month===months.at(-1)} style={styles.arrow} onPress={()=>setMonth(shiftMonth(month,-1))}><Text>←</Text></TouchTarget>
      <TouchTarget accessibilityRole="button" accessibilityLabel={`Monat auswählen: ${label(month)}`} accessibilityState={{expanded:choose}} style={styles.monthTitle} onPress={()=>setChoose(!choose)}><Text style={styles.bold}>{label(month)} ▾</Text></TouchTarget>
      <TouchTarget accessibilityRole="button" accessibilityLabel="Nächster Monat" accessibilityState={{disabled:month===current}} disabled={month===current} style={styles.arrow} onPress={()=>setMonth(shiftMonth(month,1))}><Text>→</Text></TouchTarget>
    </View>
    {choose ? <Card>{months.map(m=><ActionButton key={m} tone="quiet" title={label(m)} onPress={()=>{setMonth(m);setChoose(false);}}/>)}</Card> : null}
    {result===null ? <Text accessibilityLiveRegion="polite">Kundenstunden werden geladen …</Text> : !value ? <Card><Text accessibilityRole="alert">Kundenstunden konnten nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.</Text><ActionButton title="Erneut versuchen" onPress={()=>setRefresh(n=>n+1)}/></Card> : <>
      <Text style={styles.muted}>{value.scope==='self'?'Deine eigenen Stunden je Kunde.':'Geleistete Stunden je Kunde und Person.'} Stand {new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(value.asOf))}</Text>
      {customer ? <Card><ActionButton title="Zur Kundenliste" tone="quiet" onPress={()=>setSelected(null)}/><Text accessibilityRole="header" style={styles.title}>{customer.displayName}</Text>
        {!customer.active?<Text>inaktiv</Text>:null}<Text style={styles.total}>{formatHours(customer.workDurationSeconds*1000)} h</Text>{customer.running?<Text>läuft</Text>:null}
        {'quotaStage' in customer?<CustomerQuota key={`${month}/${customer.customerId}`} customer={customer} work={work} editable={month===current && (authorityContext as {role?:string}).role!=='employee' && (customer.active || (authorityContext as {role?:string}).role==='administrator')} onSaved={()=>setRefresh(n=>n+1)}/>:null}
        <Text style={styles.bold}>{'people' in customer?'Stunden je Person':'Deine Stunden je Tag'}</Text>
        {('people' in customer?customer.people.map(p=>({key:p.membershipId,label:p.displayName,...p})):customer.days.map(d=>({key:d.date,label:d.date.split('-').reverse().join('.'),...d}))).map(p=><View key={p.key} style={styles.row}><Text style={styles.name}>{p.label}{p.running?' · läuft':''}</Text><Text style={styles.bold}>{formatHours(p.workDurationSeconds*1000)} h</Text></View>)}
        {customer.workDurationSeconds===0?<Text>In diesem Monat noch keine Stunden.</Text>:null}
        {'days' in customer?<Text style={styles.muted}>Zuordnung nach dem Tag, an dem der Eintrag beginnt.</Text>:null}
      </Card> : value.customers.length===0 ? <Card><Text accessibilityRole="header" style={styles.title}>Keine Kunden in diesem Monat</Text><Text>Für deinen Bereich sind noch keine Kunden mit einer aktiven Zuordnung oder Stunden vorhanden.</Text></Card>
        : value.customers.map(c=><TouchTarget key={c.customerId} accessibilityRole="button" accessibilityLabel={`${c.displayName}, ${formatHours(c.workDurationSeconds*1000)} Stunden${c.active?'':', inaktiv'}${c.running?', läuft':''}`} onPress={()=>setSelected(c.customerId)} style={styles.customer}>
          <View style={styles.name}><Text style={styles.bold}>{c.displayName}</Text>{!c.active?<Text style={styles.muted}>inaktiv</Text>:null}{c.running?<Text>läuft</Text>:null}</View>{'quotaStage' in c && c.quotaSeconds!=null?<QuotaProgress customer={c}/>:<Text style={styles.bold}>{formatHours(c.workDurationSeconds*1000)} h</Text>}<Text>→</Text>
        </TouchTarget>)}
      <ActionButton title="Kundenstunden aktualisieren" tone="quiet" onPress={()=>setRefresh(n=>n+1)}/>
    </>}
  </ScrollView></Screen>;
}
const styles=StyleSheet.create({content:{gap:16,paddingBottom:24},month:{flexDirection:'row',alignItems:'center',gap:4},monthTitle:{flex:1,minHeight:48,justifyContent:'center',alignItems:'center'},arrow:{width:44,minHeight:48,alignItems:'center',justifyContent:'center'},row:{flexDirection:'row',gap:12,paddingVertical:12},name:{flex:1,flexShrink:1},customer:{minHeight:76,flexDirection:'row',alignItems:'center',gap:12,padding:16,borderRadius:12,backgroundColor:mobileTokens.color.surface,borderWidth:1,borderColor:mobileTokens.color.border},bold:{fontWeight:'800',fontVariant:['tabular-nums']},muted:{color:mobileTokens.color.textMuted,fontSize:13},title:{fontSize:22,fontWeight:'800'},total:{fontSize:40,lineHeight:48,fontWeight:'800',fontVariant:['tabular-nums']}});
