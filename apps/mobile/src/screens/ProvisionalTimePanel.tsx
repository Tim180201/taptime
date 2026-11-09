import {useEffect,useState,useSyncExternalStore} from 'react';
import {captureClock,captureDuration} from '@taptime/mobile-work-contract';
import type {ManualOfflineCapturePort} from '../offline/OfflineCaptureCoordinator';
import type {OfflineActiveCapture} from '../work/OfflineActiveCapture';
import {EMPTY_OWN_TIME_DISPLAY} from '../work/ProvisionalOwnTime';
import {ActiveTimeCard} from './ActiveTimeCard';
import {AppText as Text,Card} from '../design/primitives';

export function useOwnTimeDisplay(manual?:ManualOfflineCapturePort){
  return useSyncExternalStore(listener=>manual?.subscribeOwnTimeDisplay?.(listener)??(()=>{}),
    ()=>manual?.getOwnTimeDisplay?.()??EMPTY_OWN_TIME_DISPLAY,()=>EMPTY_OWN_TIME_DISPLAY);
}
/** A provisional clock is elapsed time, never a guessed paid-duration/calendar sum.
 * D-159 deliberately does not retain prior completed breaks or history. */
export function ProvisionalTimePanel({manual,capture,disabled=false,compact=false,history=false}:{manual:ManualOfflineCapturePort;capture:OfflineActiveCapture;disabled?:boolean;compact?:boolean;history?:boolean}){
  const display=useOwnTimeDisplay(manual);
  const controls=useSyncExternalStore(capture.subscribe,capture.getState,capture.getState);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(!display.activeRecord)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[display.activeRecord]);
  const active=display.activeRecord;
  // Capture is the next action, not a history view. Even a rejected next capture
  // ends the previous stop notice; the projection and own-times history stay intact.
  const lastStopped=!active&&[...display.decisions.values()].at(-1)==='time_entry_stopped'?display.records.at(-1):null;
  return <>
    {display.known&&active?<>
      <ActiveTimeCard record={active} compact={compact} disabled={disabled||controls.busy}
        onStop={()=>void capture.stop(active)} onBreak={()=>void capture.pause(active)}/>
      <Text>{captureDuration(Math.max(0,Math.floor((now-Date.parse(active.breakStartedAt??active.startedAt))/1000)))} {active.breakStartedAt?'seit Pausenbeginn':'seit Beginn'}</Text>
    </>:null}
    {display.known&&display.pending?<Text accessibilityLiveRegion="polite">offline gespeichert</Text>:null}
    {display.known&&history?display.records.map(record=><Card key={record.timeRecordId}><Text>Zeit beendet · {record.targetDisplayName}</Text>
      <Text>{captureClock(record.startedAt)} – {captureClock(record.stoppedAt!)}</Text></Card>):null}
    {display.known&&!history&&lastStopped?<Text numberOfLines={1}>Zeit beendet · {lastStopped.targetDisplayName} · {captureClock(lastStopped.startedAt)} – {captureClock(lastStopped.stoppedAt!)}</Text>:null}
    {display.notice?<Text accessibilityLiveRegion="polite">{display.notice}</Text>:null}
    {controls.feedback?<Text accessibilityLiveRegion="polite">{controls.feedback}</Text>:null}
  </>;
}
