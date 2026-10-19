import { BUSINESS_TIME_ZONE } from '@taptime/core';
import { Pill } from '../ui';
import {MembershipNameChange} from './MembershipNameChange';
import {MonthSwitch} from '../MonthSwitch';
import TargetAssignments from './TargetAssignments';
import {captureStatus} from '@taptime/mobile-work-contract';
import type { EmployeeAccountInvitationCapability } from '../EmployeeAccountInvitationForm';
import { ACCOUNT_INVITATION_NOTICES } from '../accountInvitation';
import { TimeEditingProvider, TimeRecordControls } from '../TimeEditingControls';

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
	selectedMonth,
	monthRange,
	type AdminRoute
} from '../navigation';
import {PageHeader} from '../PageHeader';
import { DelayedSkeleton } from '../ui';
import { navigateFromLink } from '../viewHelpers';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function PersonView({state,administration,route,navigate,accountInvitations}: {readonly state:ReadyState;readonly administration:AdminWebCapability;
  readonly accountInvitations?:EmployeeAccountInvitationCapability;
  readonly route:AdminRoute;readonly navigate:(route:AdminRoute)=>void}) {
  const [resending,setResending]=useState(false);
  const [resendNotice,setResendNotice]=useState<string|null>(null);
  const month=selectedMonth(route.month,'beschaeftigte');
  const personId=route.personId!;
  const authority=JSON.stringify([state.membershipId,state.role,state.managementScope,state.selectedLocation?.id]);
  const [identity,setIdentity]=useState<{personId:string;authority:string;person:NonNullable<Extract<ReadyState['managedPeople'],{status:'ready'}>>['value']['people'][number]|null;status:'ready'|'missing'|'unavailable'}|null>(null);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setIdentity(null);
    void (async()=>{
      try {
        if (administration.queryArchive) {
          const archived = await administration.queryArchive('people', { search: null, cursor: null,
            locationId: state.selectedLocation?.id ?? null, membershipId: personId });
          if (cancelled) return;
          if (archived.status !== 'ready' || !archived.value) { setIdentity({personId,authority,person:null,status:'unavailable'}); return; }
          const former = archived.value.people.find(row => row.membershipId === personId);
          if (former) {
            setIdentity({personId,authority,status:'ready',person:{membershipId:former.membershipId,
              displayName:former.displayName ?? 'Name fehlt',role:former.role,location:former.location,departedAt:former.revokedAt,
              isRunning:false,runningSince:null,runningTargetDisplayName:null}});
            return;
          }
        }
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
  const back=<a className="button-link secondary-link" href={canonicalRoutePath(defaultRoute('beschaeftigte',route.locationId))} onClick={event=>navigateFromLink(event,defaultRoute('beschaeftigte',route.locationId),navigate)}>← Mitarbeiter</a>;
  if(!person)return <><PageHeader organization={state.projection.organization.name} title="Person" actions={back} onRefresh={()=>setRetry(n=>n+1)}/><p role={resolved?.status==='unavailable'?'alert':'status'}>{!resolved?'Person wird geladen …':resolved.status==='missing'?'Person nicht gefunden':'Person konnte nicht geladen werden.'}</p>{resolved?.status==='unavailable'?<button onClick={()=>setRetry(n=>n+1)}>Person erneut laden</button>:null}</>;

  const calendar=state.calendar;
  const canRename = !person.departedAt && (state.role === 'administrator' || person.role === 'employee' && state.managementScope.kind === 'locations'
    && state.managementScope.locations.some(location => location.id === person.location?.id));
  const actions=<>{back}{canRename && administration.renameMembership && administration.readMembershipName
    ? <MembershipNameChange key={personId + authority} administration={administration} membershipId={personId} onSaved={() => setRetry(n => n + 1)} /> : null}</>;
  const resendAction=!person.departedAt && accountInvitations?.resend ? <button className="text-button" disabled={resending} onClick={async()=>{
      setResending(true);
      try { const status=await accountInvitations.resend!(personId); setResendNotice(status==='succeeded'?'Einladung verschickt.':
        status==='invitation_already_accepted'?'Bereits angemeldet. Bitte „Passwort vergessen“ nutzen.':
        ACCOUNT_INVITATION_NOTICES[status as keyof typeof ACCOUNT_INVITATION_NOTICES] ?? 'Erneutes Senden ist derzeit nicht erreichbar.'); }
      catch {setResendNotice('Erneutes Senden ist derzeit nicht erreichbar.');} finally {setResending(false);}
    }}>Einladung erneut senden</button> : null;
  const subtitle=<>{[person.location?.name,person.role==='administrator'?'Administrator':person.role==='standortleitung'?'Standortleitung':'Mitarbeiter'].filter(Boolean).join(' · ')}{person.departedAt ? <> · <Pill>ehemalig</Pill> · Ausgeschieden am {new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE}).format(new Date(person.departedAt))}</> : null}</>;
  const ready=calendar?.targetMembershipId===personId && calendar.month===month && calendar.status==='ready';
  const canManage = ready && calendar.canManageTime === true;
  return <TimeEditingProvider key={`${personId}/${authority}/${canManage}`} readOnly={!canManage} state={state} administration={administration} targetMembershipId={personId} personLabel={person.displayName}>
    {!ready?<PageHeader organization={state.projection.organization.name} title={person.displayName} subtitle={subtitle} actions={actions} onRefresh={()=>void administration.loadPersonTime?.(personId,month)}/>:null}
    {resendAction}
    {resendNotice ? <p role="status">{resendNotice}</p> : null}
    <MonthSwitch value={month} {...monthRange()} onChange={month=>navigate({...route,month})}/>
    {ready && !canManage ? <p>Diese Zeiten können nur noch angesehen werden.</p> : null}
    {!person.departedAt ? <TargetAssignments administration={administration} selector={{membershipId:personId}} personName={person.displayName}/> : null}
    {calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'ready'
      ? <>{calendar.value.activeRecord ? <div className="feedback-band"><p>{captureStatus(calendar.value.activeRecord)}</p><TimeRecordControls directStop record={calendar.value.activeRecord}/></div> : null}<TimeCalendar showMonthSwitch={false} personHeader={{organization:state.projection.organization.name,name:person.displayName,subtitle,actions}} value={calendar.value} month={month} onMonthChange={month=>navigate({...route,month})}
        onRefresh={()=>void administration.loadPersonTime?.(personId,month)}/></>
      : calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'unavailable'
        ? <div role="alert"><p>{calendar.message}</p><button onClick={()=>void administration.loadPersonTime?.(personId,month)}>Monat erneut laden</button></div>
        : <DelayedSkeleton label="Zeiten werden geladen"/>}</TimeEditingProvider>;
}
