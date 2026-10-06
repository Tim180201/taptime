import { Fragment } from 'react';
import { BUSINESS_TIME_ZONE, formatHours } from '@taptime/core';
import type {
	AdminWebCapability
} from '../contracts';
import {
	canonicalRoutePath,
	defaultRoute,
	type AdminRoute
} from '../navigation';
import { navigateFromLink } from '../viewHelpers';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export function ActivityTile({state,administration}: {readonly state:ReadyState;readonly administration:AdminWebCapability}) {
  const summary=state.managedPeople;
  const scope=state.selectedLocation === null ? 'Betrieb' : `Standort ${state.selectedLocation.name}`;
  return <article className="metric-card" aria-label="Gerade aktiv">
    <span>Gerade aktiv · {scope}</span>
    {summary?.status === 'ready' ? <><strong>{summary.value.runningCount} / {summary.value.totalCount}</strong>
      <small>Stand <time dateTime={summary.value.serverTime}>{new Intl.DateTimeFormat('de-DE', {timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(summary.value.serverTime))}</time> · Serverzeit</small>
    </> : summary?.status === 'unavailable' ? <p role="alert">{summary.message}</p> : <p>Aktivübersicht wird geladen …</p>}
    <button className="text-button" onClick={()=>void administration.refreshManagedPeople?.(summary?.isRunning ?? null)}>Aktivübersicht aktualisieren</button>
  </article>;
}

export function PeopleTable({people,navigate,locationId,locationsEnabled=false}: {readonly people:readonly import('@taptime/administration-contract/managed-people').ManagedPerson[];
  readonly navigate:(route:AdminRoute)=>void;readonly locationId:string|null;readonly locationsEnabled?:boolean}) {
  const monthHours = people.length > 0 && people.every(person=>person.monthWorkDurationSeconds !== undefined);
  return <>{[{title:null,rows:people.filter(p=>!p.departedAt)},{title:'Ausgeschiedene Mitarbeiter',rows:people.filter(p=>p.departedAt)}].map(group =>
    group.title && group.rows.length===0 ? null : <Fragment key={group.title ?? 'current'}>{group.title ? <h3>{group.title}</h3> : null}{(monthHours && locationsEnabled ? [...new Set(group.rows.map(person=>person.location?.id ?? ''))].map(id=>({
      title:group.rows.find(person=>(person.location?.id ?? '')===id)?.location?.name ?? 'Ohne Standort',
      rows:group.rows.filter(person=>(person.location?.id ?? '')===id),key:id,
    })) : [{title:null,rows:group.rows,key:'all'}]).map(locationGroup=><Fragment key={locationGroup.key}>
      {locationGroup.title ? group.title ? <h4>{locationGroup.title}</h4> : <h3>{locationGroup.title}</h3> : null}<div className="table-scroll" role="region" tabIndex={0} aria-label={locationGroup.title ?? group.title ?? "Mitarbeiter und laufende Zeiten"}><table>
    <thead><tr><th>Person</th><th>Standort</th>{monthHours ? <th>Diesen Monat</th> : null}<th>Status</th></tr></thead>
    <tbody>{locationGroup.rows.map(person=><tr key={person.membershipId}><td data-label="Person"><a className="person-link"
      href={canonicalRoutePath({...defaultRoute('beschaeftigte',locationId),personId:person.membershipId})}
      onClick={event=>navigateFromLink(event,{...defaultRoute('beschaeftigte',locationId),personId:person.membershipId},navigate)}>
      <span className="avatar" aria-hidden="true">{person.displayName.split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</span>
      {person.displayName}</a></td><td data-label="Standort">{person.location?.name ?? '—'}</td>{monthHours ? <td data-label="Diesen Monat">{formatHours(person.monthWorkDurationSeconds!*1000)} h</td> : null}<td data-label="Status">{person.isRunning
        ? <>Zeit läuft · seit {new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(person.runningSince!))} · {person.runningTargetDisplayName}</>
        : person.departedAt ? `Ausgeschieden am ${new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE}).format(new Date(person.departedAt))}` : 'Keine laufende Zeit'}</td></tr>)}</tbody>
  </table>{group.rows.length === 0 ? <p className="empty">Keine Personen in dieser Auswahl.</p> : null}</div></Fragment>)}</Fragment>)}</>;
}
