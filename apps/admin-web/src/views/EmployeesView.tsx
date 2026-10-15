import {useSearchPages,useDebouncedSearch} from '../../../mobile/src/search/useSearchPages';
import {SearchField,SearchStatus} from '../SearchControls';
import { businessDay,shiftMonth,formatZonedDateTime } from '@taptime/core';
import {
	useEffect,
	useRef,
	useState
} from 'react';
import { EmployeeAccountInvitationForm,type EmployeeAccountInvitationCapability } from '../EmployeeAccountInvitationForm';
import { ACCOUNT_INVITATION_SUCCESS_NOTICES,type AccountInvitationSuccess } from '../accountInvitation';
import type {
	AdminWebCapability
} from '../contracts';
import {
	monthLabel,canonicalRoutePath, defaultRoute, type AdminRoute
} from '../navigation';
import { Confirmation,DataTable,SectionBoundary } from '../ui';
import { useIntentFocusReturn } from '../viewHelpers';
import { PeopleTable } from './PeopleShared';
import {PageHeader} from '../PageHeader';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function EmployeesView({ state, administration, accountInvitations, navigate, route }: {
  readonly route?: AdminRoute;
  readonly navigate: (route:AdminRoute)=>void;
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly accountInvitations?: EmployeeAccountInvitationCapability;
}) {
  const current=businessDay(Date.now()).slice(0,7),months=Array.from({length:24},(_,i)=>shiftMonth(current,-i));
  const month=route?.month && months.includes(route.month) ? route.month : current;
  const changeMonth=(month:string)=>navigate({...route ?? defaultRoute('beschaeftigte',state.selectedLocation?.id ?? null),month});
  const [adding, setAdding] = useState(false);
  const [editingMembership,setEditingMembership]=useState<string|null>(null);
  const [input,setInput]=useState('');const search=useDebouncedSearch(input);
  const members=useSearchPages((term,cursor)=>administration.querySearch?.('memberships',{search:term,cursor,locationId:state.selectedLocation?.id??null})??Promise.resolve({status:'unavailable'} as const),value=>value.employeeMemberships,member=>member.id,[administration,state.membershipId,state.selectedLocation?.id]);
  const [runningFilter,setRunningFilter] = useState<boolean|null>(null);
  useEffect(()=>{ void administration.refreshManagedPeople?.(runningFilter,false,month,search); },[administration,state.selectedLocation?.id,runningFilter,month,search]);
  const [invitationSuccess, setInvitationSuccess] = useState<AccountInvitationSuccess | null>(null);
  useEffect(() => { setInvitationSuccess(null); }, [state.selectedLocation?.id]);
  const [revocationIntent, setRevocationIntent] = useState<{
    readonly id: string;
    readonly displayName: string;
    readonly rowVersion: number;
  } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const revocationTrigger = useRef<HTMLButtonElement>(null);
  useIntentFocusReturn(revocationIntent !== null, revocationTrigger);
  const revocationCalendar = state.calendar?.targetMembershipId === revocationIntent?.id ? state.calendar : null;
  const running = revocationCalendar?.status === 'ready' ? revocationCalendar.value.activeRecord : null;
  const checking = revocationIntent !== null && administration.loadPersonTime !== undefined && revocationCalendar?.status !== 'ready';
  const tooLong = running !== null && Date.now() - Date.parse(running.startedAt) > 24 * 3600_000;
  const personRoute = {...defaultRoute('beschaeftigte',state.selectedLocation?.id ?? null),personId:revocationIntent?.id,
    month:running ? businessDay(Date.parse(running.startedAt)).slice(0,7) : null};
  const packageUsage=state.managementScope.kind==='organization' && state.managedPeople?.status==='ready'
    ? state.managedPeople.value.packageUsage : null;
  const invitation=<>      <EmployeeAccountInvitationForm key={state.selectedLocation?.id ?? 'organization'}
        triggerLabel="+ Mitarbeiter einladen" triggerClassName={state.role==='administrator'?'primary-action':'secondary'} packageUsage={packageUsage}
        capability={accountInvitations} state={state} open={adding} setOpen={(open) => {
          if (open) setInvitationSuccess(null);
          setAdding(open);
        }} onCreated={async (status) => {
          setInvitationSuccess(status);
          await administration.retrySection('employees');await members.pager.refresh();
        }} />
</>;
  return <><PageHeader organization={state.projection.organization.name} title="Mitarbeiter"
    subtitle={state.managedPeople?.status==='ready'?`${state.managedPeople.value.totalCount} Mitarbeiter · ${state.managedPeople.value.runningCount} aktiv`:'Mitarbeiter und ihre Zeiten im gewählten Monat.'}
    actions={<><label className="header-month"><span className="sr-only">Monat</span><select value={month} onChange={event=>changeMonth(event.target.value)}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>{state.role==='administrator'?invitation:null}</>}
    onRefresh={()=>void administration.refresh()}/>
    {invitationSuccess === null ? null : <p role="status">{ACCOUNT_INVITATION_SUCCESS_NOTICES[invitationSuccess]}</p>}
    <SectionBoundary state={state.sections.employees}
    onRetry={() => void administration.retrySection('employees')}>
    <div className="employees-view">
      {packageUsage?.packageSize != null ? <p className={packageUsage.activeAccessCount > packageUsage.packageSize ? 'package-warning' : undefined}>
        {packageUsage.activeAccessCount} Zugänge, Paket {packageUsage.packageSize}
        {packageUsage.activeAccessCount > packageUsage.packageSize ? ' · Paket überschritten. Alle Zugänge bleiben nutzbar.' : ''}
      </p> : null}
      {state.roleAssignmentMembershipId && state.notice?.kind==='success' && state.notice.text==='Rolle geändert. Weisen Sie jetzt die Standorte zu, die diese Person verwalten darf.' ? <a className="button-link"
        href={canonicalRoutePath({...defaultRoute('einrichtung'),setupTab:'standorte',setupMembershipId:state.roleAssignmentMembershipId})}
        onClick={event=>{event.preventDefault();navigate({...defaultRoute('einrichtung'),setupTab:'standorte',setupMembershipId:state.roleAssignmentMembershipId});}}>Verwaltete Standorte zuweisen</a> : null}
      <SearchField value={input} onChange={setInput}/>
      <p role="status">{state.managedPeople?.status==='ready'?`${state.managedPeople.value.nextCursor?'mehr als ':''}${state.managedPeople.value.people.length} Treffer`:'Wird geladen …'}</p>
      {state.managedPeople?.status==='ready'&&!state.managedPeople.value.people.length&&search?<p>{`Keine Treffer für „${search}“`} <button type="button" onClick={()=>setInput('')}>Suche löschen</button></p>:null}
      {state.managedPeople?.failed?<button onClick={()=>void administration.refreshManagedPeople?.(runningFilter,state.managedPeople?.status==='ready',month,search)}>Erneut versuchen</button>:null}
      <div className="filter-chips" role="group" aria-label="Aktivitätsfilter">{[['Alle',null],['Zeit läuft',true],['Keine Zeit',false]].map(([label,value])=>
        <button key={String(label)} className="secondary" aria-pressed={runningFilter === value}
          onClick={()=>setRunningFilter(value as boolean|null)}>{label}</button>)}</div>
      {state.managedPeople?.status === 'ready' && state.managedPeople.month===month ? <><PeopleTable people={state.managedPeople.value.people}
        navigate={navigate} locationId={state.selectedLocation?.id ?? null} locationsEnabled={state.locationsEnabled} month={month}/>
        {state.managedPeople.value.nextCursor === null ? null : <button className="secondary"
          onClick={()=>void administration.refreshManagedPeople?.(runningFilter,true,month,search)} disabled={state.managedPeople.busy}>Weitere laden</button>}</> : null}
      <details className="membership-tools"><summary>Zugänge verwalten</summary>{state.role!=='administrator'?invitation:null}
      <SearchField value={members.input} onChange={members.setSearch}/><SearchStatus state={members.state} onRetry={members.pager.retry} onClear={()=>members.setSearch('')}/>
      <DataTable label="Zugänge" headers={['Person','Zugang','Standort','Aktionen']}>{members.state.items.map((membership) =>
        <tr key={membership.id}><td>{membership.displayName}</td><td>
          <small className={`pill ${membership.active ? 'success' : ''}`}>
            {membership.role === 'administrator'
              ? 'Administrator'
              : membership.role === 'standortleitung' ? 'Standortleitung' : 'Mitarbeiter'}
            {' · '}{membership.active ? 'Zugang aktiv' : 'Zugang entzogen'}
          </small></td><td>
          {state.locationsEnabled && membership.location !== null
            ? <small>Standort {membership.location.name}</small> : null}
          </td><td>{membership.active
            && (state.managementScope.kind === 'organization' || membership.role === 'employee')
            ? <div className="entity-actions">
            {state.managementScope.kind === 'organization'
              ? editingMembership === membership.id ? <><p className="supporting">Änderungen werden sofort gespeichert.</p><label>Rolle
                  <select value={membership.role}
                    aria-label={`Rolle für ${membership.displayName}`}
                    onChange={(event) => void administration.changeMembershipRole(
                      membership.id,
                      membership.rowVersion,
                      event.target.value as 'administrator' | 'standortleitung' | 'employee',
                    ).then(()=>members.pager.refresh())}>
                    <option value="employee">Mitarbeiter</option>
                    <option value="standortleitung">Standortleitung</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </label></> : <button className="quiet" onClick={()=>setEditingMembership(membership.id)}>Rolle bearbeiten</button>
              : null}
            <button className="warning-action" onClick={(event) => {
              revocationTrigger.current = event.currentTarget;
              void administration.loadPersonTime?.(membership.id,businessDay(Date.now()).slice(0,7));
              setRevocationIntent({
                id: membership.id,
                displayName: membership.displayName,
                rowVersion: membership.rowVersion,
              });
            }}>Zugang entziehen</button>
          </div> : null}
        </td></tr>)}</DataTable>
      {revocationIntent === null ? null : <Confirmation
        label="Zugangsentzug ausdrücklich bestätigen"
        title={`Zugang für ${revocationIntent.displayName} wirklich entziehen?`}
        warning
        confirmLabel="Zugang entziehen"
        busyLabel="Zugang wird entzogen …"
        busy={revoking}
        confirmDisabled={checking || tooLong}
        onConfirm={() => {
          setRevoking(true);
          void administration.revokeMembership(
            revocationIntent.id,
            revocationIntent.rowVersion,
          ).then(()=>members.pager.refresh()).finally(() => {
            setRevoking(false);
            setRevocationIntent(null);
          });
        }}
        onCancel={() => setRevocationIntent(null)}
      >
        <p>Der Mitarbeiter kann sich danach nicht mehr anmelden.</p>
        {checking ? <p role="status">{revocationCalendar?.status === 'unavailable' ? 'Die laufende Zeit konnte nicht geladen werden. Bitte öffnen Sie die Personenansicht.' : 'Laufende Zeit wird geprüft …'}</p>
          : tooLong && running ? <p>Diese Zeit läuft seit {formatZonedDateTime(running.startedAt)}. Bitte zuerst in der Personenansicht mit passender Endzeit beenden, dann den Zugang entziehen.</p>
          : <p>Läuft gerade eine Zeit, wird sie jetzt beendet{running ? `: ${running.targetDisplayName} · seit ${formatZonedDateTime(running.startedAt)}` : ''}.</p>}
        <a href={canonicalRoutePath(personRoute)} onClick={event=>{event.preventDefault();setRevocationIntent(null);navigate(personRoute);}}>Zur Personenansicht</a>
      </Confirmation>}
      {members.state.nextCursor?<button disabled={members.state.busy} onClick={()=>void members.pager.loadMore()}>Weitere laden</button>:null}
      </details>
      {state.employeeProjection.employeeMemberships.length === 0
        && state.employeeProjection.nextCursor === null
        ? state.selectedLocation === null
          ? <p className="empty">Keine Mitarbeiter vorhanden.</p>
          : <div className="empty first-list-empty">
              <strong>Noch keine Mitarbeiter am Standort {state.selectedLocation.name}</strong>
              <p>Laden Sie die erste beschäftigte Person für diesen Standort ein.</p>
              <button className="secondary" onClick={() => setAdding(true)}>
                Mitarbeiter einladen
              </button>
            </div>
        : null}

    </div>
  </SectionBoundary></>;
}
