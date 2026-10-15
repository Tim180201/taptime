import {MonthSwitch} from '../MonthSwitch';
import {businessDay} from '@taptime/core';
import { TimeEditingProvider } from '../TimeEditingControls';

import { useEffect, useRef } from 'react';
import type { AdminWebCapability,AdminWebState } from '../contracts';
import { selectedMonth, type AdminRoute } from '../navigation';
import { TimeCalendar } from '../TimeCalendar';
import { DelayedSkeleton } from '../ui';
export default function OwnTimeView({state,administration,route,navigate}: {
  readonly state:Extract<AdminWebState,{status:'ready'}>;readonly administration:AdminWebCapability;
  readonly route:AdminRoute;readonly navigate:(route:AdminRoute)=>void;
}) {
  const month=selectedMonth(route.month,'meine-zeiten');
  useEffect(()=>{void administration.loadOwnTime?.(month);},[administration,month]);
  const calendar=state.calendar;
  const range=useRef<{min:string;max:string}|null>(null);
  if(calendar?.targetMembershipId===null&&calendar.status==='ready')range.current={
    min:businessDay(Date.parse(calendar.value.windowStartedAt)).slice(0,7),
    max:businessDay(Date.parse(calendar.value.windowEndedAt)-1).slice(0,7),
  };
  return <TimeEditingProvider state={state} administration={administration}><p className="supporting">Ihre eigenen Zeiten. Die verfügbaren Tage bestimmt der geladene Zeitraum.</p>
    {range.current?<MonthSwitch value={month} {...range.current} onChange={month=>navigate({...route,month})}/>:null}
    {calendar?.targetMembershipId === null && calendar.month === month && calendar.status === 'ready'
      ? <TimeCalendar showMonthSwitch={false} ownTime value={calendar.value} month={month} onMonthChange={next=>navigate({...route,month:next})}
          onRefresh={()=>void administration.loadOwnTime?.(month)}/>
      : calendar?.targetMembershipId === null && calendar.status === 'unavailable'
        ? <div role="status"><p>{calendar.message}</p><button onClick={()=>void administration.loadOwnTime?.(month)}>Zeiten erneut laden</button></div>
        : <DelayedSkeleton label="Eigene Zeiten werden geladen"/>}</TimeEditingProvider>;
}
