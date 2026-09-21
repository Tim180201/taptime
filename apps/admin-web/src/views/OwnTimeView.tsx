import { TimeEditingProvider } from '../TimeEditingControls';
import { businessDay } from '@taptime/core';
import { useEffect } from 'react';
import type { AdminWebCapability,AdminWebState } from '../contracts';
import type { AdminRoute } from '../navigation';
import { TimeCalendar } from '../TimeCalendar';
import { DelayedSkeleton } from '../ui';
export default function OwnTimeView({state,administration,route,navigate}: {
  readonly state:Extract<AdminWebState,{status:'ready'}>;readonly administration:AdminWebCapability;
  readonly route:AdminRoute;readonly navigate:(route:AdminRoute)=>void;
}) {
  const month=route.month ?? businessDay(Date.now()).slice(0,7);
  useEffect(()=>{void administration.loadOwnTime?.(month);},[administration,month]);
  const calendar=state.calendar;
  return <TimeEditingProvider state={state} administration={administration}><p className="supporting">Ihre eigenen Zeiten. Die verfügbaren Tage bestimmt der geladene Zeitraum.</p>
    {calendar?.targetMembershipId === null && calendar.month === month && calendar.status === 'ready'
      ? <TimeCalendar value={calendar.value} month={month} onMonthChange={next=>navigate({...route,month:next})}
          onRefresh={()=>void administration.loadOwnTime?.(month)}/>
      : calendar?.targetMembershipId === null && calendar.status === 'unavailable'
        ? <div role="status"><p>{calendar.message}</p><button onClick={()=>void administration.loadOwnTime?.(month)}>Zeiten erneut laden</button></div>
        : <DelayedSkeleton label="Eigene Zeiten werden geladen"/>}</TimeEditingProvider>;
}
