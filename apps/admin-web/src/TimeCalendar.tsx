import {VoidedTimeRows} from './TimeVoidControls';
import { AddTimeControl,TimeRecordControls } from './TimeEditingControls';
import {
	BUSINESS_TIME_ZONE,businessDay,dayStart,formatClock,formatDuration,formatHours,
	intervalMilliseconds,monthDays,provenance,rangeSummary,monthTimeSummary,recordDaySummary,recordDaySectionLabels,recordsForDay,shiftDay,shiftMonth,weekStart
} from '@taptime/core';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { useRef, useState, type ReactNode } from 'react';
import { Panel,DataTable,Pill } from './ui';

import {PageHeader} from './PageHeader';
export function TimeCalendar({value,month,onMonthChange,onRefresh,personHeader}: {
  readonly personHeader?:{organization:string;name:string;subtitle:ReactNode;actions:ReactNode};
  readonly value:MobileOwnTimeQueryResponse; readonly month:string;
  readonly onMonthChange:(month:string)=>void; readonly onRefresh:()=>void;
}) {
  const dayList = useRef<HTMLDivElement>(null);
  const selectDay = (day: string) => {
    setSelection(day);
    if (window.matchMedia?.('(max-width: 68rem)').matches) {
      dayList.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  };
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
    {personHeader?<PageHeader organization={personHeader.organization} title={personHeader.name} subtitle={personHeader.subtitle} actions={<>{personHeader.actions}<AddTimeControl day={selected}/></>} onRefresh={onRefresh}/>:null}
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
          onClick={()=>selectDay(day)}><span>{Number(day.slice(8))}</span><small>{summary.complete
            ? summary.milliseconds > 0 ? formatHours(summary.milliseconds) : '' : '—'}</small></button>;
      })}</div>
    </Panel><div ref={dayList}><Panel title={new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,weekday:'long',day:'numeric',month:'long'}).format(new Date(`${selected}T12:00:00Z`))}>
      {personHeader?<DataTable label="Zeiten dieses Tages" headers={['Von–Bis','Kunde oder Projekt',{label:'Dauer',numeric:true},'Art','Hinweise und Aktionen']}>
        {records.map(record=>{
          const sections=recordDaySectionLabels(record,selected);
          const overlaps=record.details?.overlapsAnotherRecord?records.filter(other=>other.timeRecordId!==record.timeRecordId && Date.parse(other.startedAt)<Date.parse(record.stoppedAt??value.windowEndedAt) && Date.parse(record.startedAt)<Date.parse(other.stoppedAt??value.windowEndedAt)):[];
          return <tr key={record.timeRecordId} id={`time-${record.timeRecordId}`}><td>
            {formatClock(Math.max(dayStart(selected),Date.parse(record.startedAt)))}–{record.stoppedAt?formatClock(Math.min(dayStart(shiftDay(selected,1)),Date.parse(record.stoppedAt))):'läuft'}
            {sections.map((label,index)=><p className="supporting" key={index}>{label}</p>)}
          </td><td>{record.targetDisplayName}</td><td className="numeric">{formatDuration(recordDaySummary(record,selected).milliseconds)}</td>
          <td>{record.details?({nfc:'Karte',manual:'manuell',backfilled:'nachgetragen',recovered:'wiederhergestellt'}[record.details.origin]):provenance(record)}</td>
          <td>{overlaps.map(other=><a key={other.timeRecordId} href={`#time-${other.timeRecordId}`}><Pill kind="notice">überschneidet sich mit {formatClock(Date.parse(other.startedAt))}–{other.stoppedAt?formatClock(Date.parse(other.stoppedAt)):'läuft'}</Pill></a>)}<TimeRecordControls record={record} inline/></td></tr>;
        })}
      </DataTable>:<><AddTimeControl day={selected}/><ul className="time-day-list">{records.map(record=>{
        const sections=recordDaySectionLabels(record,selected);
        const origin=record.details?({nfc:'gescannt',manual:'manuell',backfilled:'nachgetragen',recovered:'wiederhergestellt'}[record.details.origin]):provenance(record);
        return <li key={record.timeRecordId}>
        {sections.length ? <>
          {sections.map((label,index)=><p key={index}>{label}</p>)}<p>{origin}</p>
        </> : <><strong>{record.targetDisplayName}</strong>
        <p>{formatClock(Math.max(dayStart(selected),Date.parse(record.startedAt)))} – {record.stoppedAt === null ? 'läuft'
          : formatClock(Math.min(dayStart(shiftDay(selected,1)),Date.parse(record.stoppedAt)))} · {origin}</p>
        <strong>{formatDuration(recordDaySummary(record,selected).milliseconds)}</strong>
        </>}
        <TimeRecordControls record={record}/>
      </li>; })}</ul></>}
      <VoidedTimeRows day={selected} value={value}/>
      {records.length === 0 ? <p>{rangeSummary(value,selected,shiftDay(selected,1)).complete
        ? 'Für diesen Tag zählt keine Arbeitszeit.' : 'Dieser Tag liegt außerhalb des vollständig geladenen Zeitraums.'}</p> : null}
    </Panel></div></div>
    <p className="supporting">Arbeitszeit nach Pausen</p>
    <p className="supporting">Geladener Zeitraum: {new Date(value.windowStartedAt).toLocaleString('de-DE',{timeZone:BUSINESS_TIME_ZONE})} – {new Date(value.windowEndedAt).toLocaleString('de-DE',{timeZone:BUSINESS_TIME_ZONE})}</p>
    <button className="secondary" onClick={onRefresh}>Zeiten aktualisieren</button>
  </section>;
}
