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
  useEffect(()=>{ void administration.loadPersonTime?.(personId,month); },[administration,personId,month,state.selectedLocation?.id]);
  const calendar=state.calendar;
  const person=state.managedPeople?.status === 'ready' ? state.managedPeople.value.people.find(person=>person.membershipId === personId) : null;
  return <TimeEditingProvider key={personId} state={state} administration={administration} targetMembershipId={personId} personLabel={person?.displayName ?? 'Ausgewählte Person'}><a href={canonicalRoutePath(defaultRoute('beschaeftigte',route.locationId))}
    onClick={event=>navigateFromLink(event,defaultRoute('beschaeftigte',route.locationId),navigate)}>Zurück zu Beschäftigte</a>
    {accountInvitations?.resend ? <button disabled={resending} onClick={async()=>{
      setResending(true);
      try { const status=await accountInvitations.resend!(personId); setResendNotice(status==='succeeded'?'Einladung verschickt.':
        status==='invitation_already_accepted'?'Bereits angemeldet. Bitte „Passwort vergessen“ nutzen.':
        ACCOUNT_INVITATION_NOTICES[status as keyof typeof ACCOUNT_INVITATION_NOTICES] ?? 'Erneutes Senden ist derzeit nicht erreichbar.'); }
      catch {setResendNotice('Erneutes Senden ist derzeit nicht erreichbar.');} finally {setResending(false);}
    }}>Einladung erneut senden</button> : null}
    {resendNotice ? <p role="status">{resendNotice}</p> : null}
    <h2>{person?.displayName ?? 'Zeiten der Person'}</h2>
    {calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'ready'
      ? <>{calendar.value.activeRecord ? <div className="feedback-band"><p>{captureStatus(calendar.value.activeRecord)}</p><TimeRecordControls directStop record={calendar.value.activeRecord}/></div> : null}<TimeCalendar value={calendar.value} month={month} onMonthChange={month=>navigate({...route,month})}
        onRefresh={()=>void administration.loadPersonTime?.(personId,month)}/></>
      : calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'unavailable'
        ? <div role="alert"><p>{calendar.message}</p><button onClick={()=>void administration.loadPersonTime?.(personId,month)}>Monat erneut laden</button></div>
        : <DelayedSkeleton label="Zeiten werden geladen"/>}</TimeEditingProvider>;
}
