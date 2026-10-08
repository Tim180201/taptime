import {useSyncExternalStore} from 'react';
import {captureClock,type MobileOwnTimeQueryResponse} from '@taptime/mobile-work-contract';
import type {OfflineActiveCapture} from '../work/OfflineActiveCapture';
import {ActiveTimeCard} from './ActiveTimeCard';
import {AppText as Text} from '../design/primitives';
export function OfflineActiveTimeCard({capture,value,disabled=false,disabledReason,compact=false}:{capture:OfflineActiveCapture;value:MobileOwnTimeQueryResponse;disabled?:boolean;disabledReason?:string;compact?:boolean}) {
  const state=useSyncExternalStore(capture.subscribe,capture.getState,capture.getState);
  const record=value.activeRecord;
  if(!record)return null;
  return <>
    <ActiveTimeCard compact={compact} record={record} disabled={disabled||state.busy||state.pending} disabledReason={disabledReason??(state.pending?'Deine letzte Erfassung wartet noch auf Bestätigung.':undefined)} onStop={()=>void capture.stop(record)} onBreak={()=>void capture.pause(record)}/>
    <Text>Stand {captureClock(record.calendar?.asOf??value.windowEndedAt)}, offline</Text>
    {state.feedback?<Text accessibilityLiveRegion="polite">{state.feedback}</Text>:null}
  </>;
}
