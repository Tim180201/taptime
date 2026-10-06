import {captureStatus} from '@taptime/mobile-work-contract';
import type { EmployeeAccountInvitationCapability } from '../EmployeeAccountInvitationForm';
import { ACCOUNT_INVITATION_NOTICES } from '../accountInvitation';
import { TimeEditingProvider, TimeRecordControls } from '../TimeEditingControls';
import { businessDay } from '@taptime/core';
import {
	useEffect, useState
} from 'react';
import { TimeCalendar } from '../TimeCalendar';
import type {
	AdminWebCapability
} from '../contracts';
import {
	canonicalRoutePath,
	defaultRoute,
	type AdminRoute
} from '../navigation';
import { DelayedSkeleton } from '../ui';
import { navigateFromLink } from '../viewHelpers';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function PersonView({state,administration,route,navigate,accountInvitations}: {readonly state:ReadyState;readonly administration:AdminWebCapability;
  readonly accountInvitations?:EmployeeAccountInvitationCapability;
  readonly route:AdminRoute;readonly navigate:(route:AdminRoute)=>void}) {
  const [resending,setResending]=useState(false);
  const [resendNotice,setResendNotice]=useState<string|null>(null);
  const month=route.month ?? businessDay(Date.now()).slice(0,7);
  const personId=route.personId!;
  const authority=JSON.stringify([state.membershipId,state.role,state.managementScope,state.selectedLocation?.id]);
  const [identity,setIdentity]=useState<{personId:string;authority:string;person:NonNullable<Extract<ReadyState['managedPeople'],{status:'ready'}>>['value']['people'][number]|null;status:'ready'|'missing'|'unavailable'}|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setIdentity(null);
    void (async()=>{
      try {
        // The existing scoped summary is paginated. Never use a URL ID as a person label.
        await administration.refreshManagedPeople?.(null);
        const seen=new Set<string>();
        for(;;){
          if(cancelled)return;
          const latest=administration.getState();
          if(latest.status!=='ready' || JSON.stringify([latest.membershipId,latest.role,latest.managementScope,latest.selectedLocation?.id])!==authority)return;
          const people=latest.managedPeople;
          if(people?.status!=='ready'){setIdentity({personId,authority,person:null,status:'unavailable'});return;}
          const person=people.value.people.find(candidate=>candidate.membershipId===personId);
          if(person){setIdentity({personId,authority,person,status:'ready'});return;}
          const cursor=people.value.nextCursor;
          if(cursor===null){setIdentity({personId,authority,person:null,status:'missing'});return;}
          if(seen.has(cursor)||!administration.refreshManagedPeople){setIdentity({personId,authority,person:null,status:'unavailable'});return;}
          seen.add(cursor);await administration.refreshManagedPeople(null,true);
        }
      } catch {if(!cancelled)setIdentity({personId,authority,person:null,status:'unavailable'});}
    })();
    return()=>{cancelled=true;};
  },[administration,personId,authority,retry]);
  const resolved=identity?.personId===personId&&identity.authority===authority?identity:null;
  const person=resolved?.person;
  useEffect(()=>{if(person)void administration.loadPersonTime?.(personId,month);},[administration,person,personId,month,authority]);
  const back=<a href={canonicalRoutePath(defaultRoute('beschaeftigte',route.locationId))} onClick={event=>navigateFromLink(event,defaultRoute('beschaeftigte',route.locationId),navigate)}>← Mitarbeiter</a>;
  if(!person)return <>{back}<p role={resolved?.status==='unavailable'?'alert':'status'}>{!resolved?'Person wird geladen …':resolved.status==='missing'?'Person nicht gefunden':'Person konnte nicht geladen werden.'}</p>{resolved?.status==='unavailable'?<button onClick={()=>setRetry(n=>n+1)}>Person erneut laden</button>:null}</>;

  const calendar=state.calendar;
  return <TimeEditingProvider key={personId} state={state} administration={administration} targetMembershipId={personId} personLabel={person.displayName}>{back}
    {accountInvitations?.resend ? <button disabled={resending} onClick={async()=>{
      setResending(true);
      try { const status=await accountInvitations.resend!(personId); setResendNotice(status==='succeeded'?'Einladung verschickt.':
        status==='invitation_already_accepted'?'Bereits angemeldet. Bitte „Passwort vergessen“ nutzen.':
        ACCOUNT_INVITATION_NOTICES[status as keyof typeof ACCOUNT_INVITATION_NOTICES] ?? 'Erneutes Senden ist derzeit nicht erreichbar.'); }
      catch {setResendNotice('Erneutes Senden ist derzeit nicht erreichbar.');} finally {setResending(false);}
    }}>Einladung erneut senden</button> : null}
    {resendNotice ? <p role="status">{resendNotice}</p> : null}
    <h2>{person.displayName}</h2>
    {calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'ready'
      ? <>{calendar.value.activeRecord ? <div className="feedback-band"><p>{captureStatus(calendar.value.activeRecord)}</p><TimeRecordControls directStop record={calendar.value.activeRecord}/></div> : null}<TimeCalendar value={calendar.value} month={month} onMonthChange={month=>navigate({...route,month})}
        onRefresh={()=>void administration.loadPersonTime?.(personId,month)}/></>
      : calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'unavailable'
        ? <div role="alert"><p>{calendar.message}</p><button onClick={()=>void administration.loadPersonTime?.(personId,month)}>Monat erneut laden</button></div>
        : <DelayedSkeleton label="Zeiten werden geladen"/>}</TimeEditingProvider>;
}
