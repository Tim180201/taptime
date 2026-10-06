import { useRequiredForm, RequiredField, RequiredTextField } from '../design/RequiredField';
import {useContext,useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {dayStart,shiftDay,formatZonedDateTime,hasVisibleText} from '@taptime/core';
import {VOID_REASONS,isVoidReason,type VoidReasonCode,type SafeOwnTimeRecord,type MobileOwnTimeQueryResponse,type VoidedTimeSelection} from '@taptime/mobile-work-contract';
import {TimeEditingContext,timeEditMessages} from './TimeEditingControls';
import {ActionButton,AppText as Text,Card} from '../design/primitives';
import {mobileTokens} from '../design/tokens';

export function VoidTimeForm({record,onSaved,onClose}:{record:SafeOwnTimeRecord;onSaved:()=>Promise<void>;onClose:()=>void}) {
  const form = useRequiredForm();
  const context=useContext(TimeEditingContext)!;
  const [code,setCode]=useState<VoidReasonCode|null>(null),[text,setText]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const save=async()=>{
    if(saving || !form.validate())return;
    if(!context.online){setError('Löschen geht nur online. Deine Eingaben bleiben erhalten.');return;}
    const reasonText=code==='other'?text:null;
    if(!isVoidReason(code,reasonText)){setError('Wähle einen Grund. Bei „Sonstiges“ sind 1 bis 500 Zeichen erforderlich.');return;}
    setSaving(true);setError('');
    try {
      const result=await context.capability.save('void',{timeRecordId:record.timeRecordId,reasonCode:code,reasonText});
      if(!mounted.current)return;
      if(result.status==='committed'){await onSaved();if(mounted.current)onClose();}else setError(timeEditMessages[result.status]);
    }catch{if(mounted.current)setError(timeEditMessages.unavailable);}
    finally{if(mounted.current)setSaving(false);}
  };
  return <Card><Text accessibilityRole="header">Zeiteintrag löschen</Text>
    <Text>Der Eintrag zählt danach nicht mehr. Er bleibt mit dem Grund in der Historie sichtbar. Du kannst das Löschen nicht rückgängig machen.</Text>
    <RequiredField form={form} error={!code ? "Wähle einen Grund." : null}><Text>Grund</Text>
    {Object.entries(VOID_REASONS).map(([value,label])=><ActionButton key={value} title={`${code===value?'✓ ':''}${label}`} tone="quiet" disabled={saving}
      onPress={()=>setCode(value as VoidReasonCode)}/>)}</RequiredField>
    {code==='other'?<><Text>Kurze Begründung (1 bis 500 Zeichen)</Text><RequiredTextField form={form} error={!hasVisibleText(text) || Array.from(text).length>500 ? "Bitte gib eine Begründung mit 1 bis 500 Zeichen ein." : null} accessibilityLabel="Kurze Begründung" value={text} onChangeText={setText} editable={!saving} multiline/></>:null}
    {error?<Text accessibilityRole="alert">{error}</Text>:null}
    {!context.online?<Text>Löschen geht nur online. Deine Eingaben bleiben erhalten.</Text>:null}
    <ActionButton title={saving?'Wird gelöscht …':'Löschen'} disabled={saving} onPress={()=>void save()}/>
    <ActionButton title="Abbrechen" tone="quiet" disabled={saving} onPress={onClose}/>
  </Card>;
}

export function VoidedTimeRows({day,value,targetMembershipId}:{day:string;value:MobileOwnTimeQueryResponse;targetMembershipId?:string}) {
  const context=useContext(TimeEditingContext),load=context?.capability.loadVoided,owner=context?.membershipId;
  const target=targetMembershipId??owner,key=`${owner}/${context?.role}/${target}/${day}`;
  const [state,setState]=useState<VoidedTimeSelection|{status:'loading'}>({status:'loading'}),[loadedKey,setLoadedKey]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{
    let current=true;setLoadedKey('');setState({status:'loading'});
    const from=Math.max(dayStart(day),Date.parse(value.windowStartedAt)),to=Math.min(dayStart(shiftDay(day,1)),Date.parse(value.windowEndedAt));
    if(!load||!target||to<=from){setState({status:'ready',records:[]});setLoadedKey(key);return;}
    void load.call(context!.capability,target,new Date(from).toISOString(),new Date(to).toISOString())
      .then(result=>{if(current){setState(result);setLoadedKey(key);}}).catch(()=>{if(current){setState({status:'unavailable'});setLoadedKey(key);}});
    return()=>{current=false;};
  },[load,context?.capability,owner,target,day,key,value,reload]);
  if(!load)return null;
  if(loadedKey!==key||state.status==='loading')return <Text>Historie wird geladen …</Text>;
  if(state.status!=='ready')return <Card><Text>Die gelöschten Einträge konnten nicht geladen werden.</Text><ActionButton title="Historie erneut laden" tone="quiet" onPress={()=>setReload(n=>n+1)}/></Card>;
  const muted={color:mobileTokens.color.textMuted};
  return <View style={{gap:16}}>{state.records.map(record=><Card key={record.timeRecordId}>
    <Text style={muted}>{record.targetDisplayName}</Text><Text style={muted}>Gelöscht am {formatZonedDateTime(record.voidedAt)} von {record.actorDisplayName} · {VOID_REASONS[record.reasonCode]}{record.reasonText?`: ${record.reasonText}`:''}</Text>
  </Card>)}</View>;
}
