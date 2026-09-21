import { TimeEditingProvider } from '../TimeEditingControls';
import { businessDay } from '@taptime/core';
import {
	useEffect
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
export default function PersonView({state,administration,route,navigate}: {readonly state:ReadyState;readonly administration:AdminWebCapability;
  readonly route:AdminRoute;readonly navigate:(route:AdminRoute)=>void}) {
  const month=route.month ?? businessDay(Date.now()).slice(0,7);
  const personId=route.personId!;
  useEffect(()=>{ void administration.loadPersonTime?.(personId,month); },[administration,personId,month,state.selectedLocation?.id]);
  const calendar=state.calendar;
  const person=state.managedPeople?.status === 'ready' ? state.managedPeople.value.people.find(person=>person.membershipId === personId) : null;
  return <TimeEditingProvider key={personId} state={state} administration={administration} targetMembershipId={personId}><a href={canonicalRoutePath(defaultRoute('beschaeftigte',route.locationId))}
    onClick={event=>navigateFromLink(event,defaultRoute('beschaeftigte',route.locationId),navigate)}>Zurück zu Beschäftigte</a>
    <h2>{person?.displayName ?? 'Zeiten der Person'}</h2>
    {calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'ready'
      ? <TimeCalendar value={calendar.value} month={month} onMonthChange={month=>navigate({...route,month})}
        onRefresh={()=>void administration.loadPersonTime?.(personId,month)}/>
      : calendar?.targetMembershipId === personId && calendar.month === month && calendar.status === 'unavailable'
        ? <div role="alert"><p>{calendar.message}</p><button onClick={()=>void administration.loadPersonTime?.(personId,month)}>Monat erneut laden</button></div>
        : <DelayedSkeleton label="Zeiten werden geladen"/>}</TimeEditingProvider>;
}
