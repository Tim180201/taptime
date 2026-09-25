import { AddTimeControl,TimeRecordControls } from './TimeEditingControls';
import {
	BUSINESS_TIME_ZONE,businessDay,dayStart,formatClock,formatDuration,formatHours,
	intervalMilliseconds,monthDays,provenance,rangeSummary,monthTimeSummary,recordDaySummary,recordsForDay,shiftDay,shiftMonth,weekStart
} from '@taptime/core';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { useState } from 'react';
import { Panel } from './ui';

export function TimeCalendar({value,month,onMonthChange,onRefresh}: {
  readonly value:MobileOwnTimeQueryResponse; readonly month:string;
  readonly onMonthChange:(month:string)=>void; readonly onRefresh:()=>void;
}) {
  const today=businessDay(Date.parse(value.windowEndedAt)-1);
  const [selection,setSelection]=useState(today);
  const selected=selection.startsWith(month) ? selection : `${month}-01`;
  const week=weekStart(selected);
  const summaries=[['Monat',monthTimeSummary(value,month)],
    [`Woche vom ${week.split('-').reverse().join('.')}`,rangeSummary(value,week,shiftDay(week,7))],
    ['Ausgewählter Tag',rangeSummary(value,selected,shiftDay(selected,1))]] as const;
  const records=recordsForDay(value,selected);
  const monthTitle=new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00:00Z`));
  return <section aria-label="Zeitkalender">
    <div className="metric-grid">{summaries.map(([label,summary])=><article className="metric-card" key={label}>
      <span>{label}</span><strong>{summary.complete ? `${formatHours(summary.milliseconds)} h` : '—'}</strong>
      <small>{summary.complete ? `${formatDuration(summary.breakMilliseconds)} Pause` : 'Zeitraum nicht vollständig geladen'}</small>
    </article>)}</div>
    <div className="calendar-layout"><Panel title={monthTitle}>
      <div className="toolbar"><button className="quiet" aria-label="Voriger Monat" onClick={()=>onMonthChange(shiftMonth(month,-1))}>←</button>
        <span>{monthTitle}</span><button className="quiet" aria-label="Nächster Monat" onClick={()=>onMonthChange(shiftMonth(month,1))}>→</button></div>
      <div className="calendar-grid" aria-hidden="true">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=><span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{monthDays(month).map((day,index)=>{
        if(day === null) return <span key={`empty-${index}`}/>;
        const summary=rangeSummary(value,day,shiftDay(day,1));
        return <button key={day} className="calendar-day" aria-pressed={selected === day}
          aria-label={`${day.split('-').reverse().join('.')}, ${summary.complete ? `${formatHours(summary.milliseconds)} Stunden` : 'nicht vollständig geladen'}`}
          onClick={()=>setSelection(day)}><span>{Number(day.slice(8))}</span><small>{summary.complete
            ? summary.milliseconds > 0 ? formatHours(summary.milliseconds) : '' : '—'}</small></button>;
      })}</div>
    </Panel><Panel title={new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,weekday:'long',day:'numeric',month:'long'}).format(new Date(`${selected}T12:00:00Z`))}>
      <AddTimeControl day={selected}/><ul className="time-day-list">{records.map(record=><li key={record.timeRecordId}><strong>{record.targetDisplayName}</strong>
        <p>{formatClock(Math.max(dayStart(selected),Date.parse(record.startedAt)))} – {record.stoppedAt === null ? 'läuft'
          : formatClock(Math.min(dayStart(shiftDay(selected,1)),Date.parse(record.stoppedAt)))} · {record.details?({nfc:'gescannt',manual:'manuell',backfilled:'nachgetragen',recovered:'wiederhergestellt'}[record.details.origin]):provenance(record)}</p>
        <strong>{formatDuration(recordDaySummary(record,selected).milliseconds)}</strong>
        <p>{formatDuration(recordDaySummary(record,selected).breakMilliseconds)} Pause</p>
        <TimeRecordControls record={record}/>
      </li>)}</ul>
      {records.length === 0 ? <p>{rangeSummary(value,selected,shiftDay(selected,1)).complete
        ? 'Für diesen Tag sind keine Zeiten erfasst.' : 'Dieser Tag liegt außerhalb des vollständig geladenen Zeitraums.'}</p> : null}
    </Panel></div>
    <p className="supporting">Arbeitszeit nach Pausen · {BUSINESS_TIME_ZONE}</p>
    <p className="supporting">Geladener Zeitraum: {new Date(value.windowStartedAt).toLocaleString('de-DE',{timeZone:BUSINESS_TIME_ZONE})} – {new Date(value.windowEndedAt).toLocaleString('de-DE',{timeZone:BUSINESS_TIME_ZONE})}</p>
    <button className="secondary" onClick={onRefresh}>Zeiten aktualisieren</button>
  </section>;
}
