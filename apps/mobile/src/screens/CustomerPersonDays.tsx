import type {ReactNode} from 'react';
import {RefreshControl,ScrollView,View} from 'react-native';
import {formatHours} from '@taptime/core';
import type {MobileWorkCapability} from '../work/contracts';
import {useCustomerPersonDays} from '../search/useCustomerPersonDays';
import {SearchStatus} from '../search/SearchControls';
import {ActionButton,AppText as Text,Card,Screen} from '../design/primitives';
import {useSubviewBack} from '../navigation/SubviewBack';

export function CustomerPersonDays({work,month,monthLabel,monthControl,customerId,personId,authority,refresh,onRefresh,onBack}:{
  work:MobileWorkCapability;month:string;monthLabel:string;monthControl:ReactNode;customerId:string;personId:string;
  authority:unknown;refresh:number;onRefresh:()=>void;onBack:()=>void;
}) {
  useSubviewBack(onBack,2);
  const {state,pager}=useCustomerPersonDays(work,month,customerId,personId,authority,refresh);
  const value=state.value;
  return <Screen title="Stunden je Tag"><ScrollView contentContainerStyle={{gap:16,paddingBottom:24}} refreshControl={<RefreshControl refreshing={state.busy} onRefresh={onRefresh}/>}>
    <ActionButton title="← Zum Kunden" accessibilityLabel="Zurück zum Kunden" tone="secondary" onPress={onBack}/>
    {monthControl}
    <SearchStatus state={state} onRetry={()=>void pager.retry()} onClear={()=>{}}/>
    {value?<Card>
      <Text accessibilityRole="header" style={{fontSize:22,fontWeight:'800'}}>{value.person.displayName} · {value.customer.displayName} · {monthLabel}</Text>
      <Text style={{fontSize:32,fontWeight:'800',fontVariant:['tabular-nums']}}>{formatHours(value.person.workDurationSeconds*1000)} h</Text>
      {value.person.running?<Text>läuft</Text>:null}
      <View accessibilityRole="list" accessibilityLabel="Stunden je Tag">{state.items.map(day=><View key={day.date} accessible role="listitem" accessibilityLabel={`${day.date.split('-').reverse().join('.')}, ${formatHours(day.workDurationSeconds*1000)} Stunden${day.running?', läuft':''}`} style={{flexDirection:'row',gap:12,paddingVertical:12}}>
        <Text style={{flex:1}}>{day.date.split('-').reverse().join('.')}</Text><Text style={{fontWeight:'800'}}>{formatHours(day.workDurationSeconds*1000)} h{day.running?' · läuft':''}</Text>
      </View>)}</View>
      {state.items.length===0?<Text>In diesem Monat noch keine Stunden.</Text>:null}
      {state.nextCursor?<ActionButton title="Weitere Tage laden" disabled={state.busy} onPress={()=>void pager.loadMore()}/>:null}
      <Text>Zuordnung nach dem Tag, an dem der Eintrag beginnt.</Text>
    </Card>:null}
  </ScrollView></Screen>;
}
