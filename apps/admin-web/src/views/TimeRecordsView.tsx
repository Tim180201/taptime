import {MonthSwitch} from '../MonthSwitch';
import {useState} from 'react';
import type {AdminWebCapability} from '../contracts';
import {canonicalRoutePath,defaultRoute,monthLabel,monthTimeWindow,monthRange,selectedMonth,type AdminRoute} from '../navigation';
import {formatZonedDateTime} from '../timeZone';
import {DataTable,Pill,SectionBoundary} from '../ui';
import {captureLabel,navigateFromLink} from '../viewHelpers';
import {PageHeader} from '../PageHeader';
type ReadyState=Extract<ReturnType<AdminWebCapability['getState']>,{status:'ready'}>;
export default function TimeRecordsView({state,administration,route,navigate}:{readonly state:ReadyState;readonly administration:AdminWebCapability;readonly route:AdminRoute;readonly navigate:(route:AdminRoute)=>void}) {
  const [exportVersion,setExportVersion]=useState<3|4>(4);
  const month=selectedMonth(route.month,'lohnexport');
  const range=monthRange();
  const expectedWindow=monthTimeWindow(month);
  const windowReady=expectedWindow!==null&&state.timeWindow.fromInclusive===expectedWindow.fromInclusive&&state.timeWindow.toExclusive===expectedWindow.toExclusive;
  const reviewRoute=defaultRoute('pruefungen',route.locationId);
  const records=state.timeRecords.filter(record=>(route.status==='alle'||(route.status==='laufend'?record.status==='started':record.status==='stopped'))&&
    (route.captureType==='alle'||(route.captureType==='gescannt'?(record.startedVia==='nfc'||record.stoppedVia==='nfc'):(record.startedVia==='manual'||record.stoppedVia==='manual'))));
  const openCases=state.availableSections.includes('review_items')&&state.sections.reviewItems.status==='ready'&&state.reviewItems.length>0
    ?<a href={canonicalRoutePath(reviewRoute)} onClick={e=>navigateFromLink(e,reviewRoute,navigate)}>{state.reviewItemsNextCursor?'Mindestens ':''}{state.reviewItems.length} {state.reviewItems.length===1?'offener Fall':'offene Fälle'} · Zeiten prüfen</a>:null;
  const exportAction=state.availableSections.includes('time_export')?<><label><span className="sr-only">Datei</span><select value={exportVersion} disabled={state.timeReviewBusy} onChange={e=>setExportVersion(Number(e.target.value) as 3|4)}><option value={4}>Einzelzeiten · Standard</option><option value={3}>Einzelzeiten · Früheres Format</option></select></label><button className="primary-action" disabled={!windowReady||state.timeReviewBusy||state.sections.timeRecords.status==='loading'} aria-busy={state.timeReviewBusy} onClick={()=>void administration.exportTimeRecords(exportVersion)}>CSV herunterladen</button></>:null;
  return <><PageHeader organization={state.projection.organization.name} title="Lohnexport" subtitle={<>{monthLabel(month)} · {month>=range.max?'läuft noch':'abgeschlossen'}{openCases?<> · {openCases}</>:null}</>}
    actions={<><MonthSwitch value={month} {...range} onChange={month=>navigate({...route,month})}/>{exportAction}</>}
    onRefresh={()=>void administration.refresh()}/>
    <p className="supporting">Einzelzeiten (CSV): alle Einträge des Monats, unabhängig von den Filtern.</p>
    {!state.availableSections.includes('time_records')?null:<SectionBoundary state={windowReady?state.sections.timeRecords:{status:'loading'}} onRetry={()=>void administration.retrySection('timeRecords')}>
      <div className="payroll-filters">
        <div className="filter-chips" role="group" aria-label="Status"><span className="filter-group-label">Status</span>{([['alle','Alle'],['laufend','Laufend'],['abgeschlossen','Abgeschlossen']] as const).map(([value,label])=><button className="secondary" key={value} aria-pressed={route.status===value} onClick={()=>navigate({...route,month,status:value})}>{label}</button>)}</div>
        <div className="filter-chips" role="group" aria-label="Erfasst mit"><span className="filter-group-label">Erfasst mit</span>{([['alle','Alle'],['gescannt','Gescannt'],['manuell-erfasst','Manuell erfasst']] as const).map(([value,label])=><button className="secondary" key={value} aria-pressed={route.captureType===value} onClick={()=>navigate({...route,month,captureType:value})}>{label}</button>)}</div>
      </div>
      <DataTable label="Geladene Arbeitszeiten" headers={['Mitarbeiter','Kunde oder Projekt','Von–Bis','Art','Status']}>
        {records.map(record=><tr key={record.timeRecordId}>
          <td>{record.employeeMembershipId?<a href={canonicalRoutePath({...defaultRoute('beschaeftigte',route.locationId),personId:record.employeeMembershipId,month})} onClick={e=>navigateFromLink(e,{...defaultRoute('beschaeftigte',route.locationId),personId:record.employeeMembershipId,month},navigate)}>{record.employeeDisplayName}</a>:record.employeeDisplayName}</td>
          <td>{record.targetDisplayName}</td><td>{formatZonedDateTime(record.startedAt)} – {record.stoppedAt?formatZonedDateTime(record.stoppedAt):'läuft'}</td>
          <td>{record.details?{nfc:'Karte',manual:'manuell',backfilled:'nachgetragen',recovered:'wiederhergestellt'}[record.details.origin]:record.source==='recovered'?'Wiederhergestellt':captureLabel(record.startedVia,record.stoppedVia)}</td>
          <td><Pill kind={record.status==='started'?'running':undefined}>{record.status==='started'?'läuft':'Abgeschlossen'}</Pill>{record.overlapsAnotherRecord?<Pill kind="notice">Überschneidung mit einer weiteren Zeit</Pill>:null}</td>
        </tr>)}
      </DataTable>
      {!records.length&&state.timeRecordsNextCursor===null?<div className="empty"><p>Keine Arbeitszeiten in dieser Auswahl</p>{route.status!=='alle'||route.captureType!=='alle'?<button className="text-button" onClick={()=>navigate({...route,month,status:'alle',captureType:'alle'})}>Filter zurücksetzen</button>:null}</div>:null}
      {state.timeRecordsNextCursor?<button className="text-button" onClick={()=>void administration.loadMoreTimeRecords()}>Weitere Arbeitszeiten laden</button>:null}
    </SectionBoundary>}
  </>;
}
