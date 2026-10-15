import { useEffect, useRef, useState } from 'react';
import { BUSINESS_TIME_ZONE, businessDay, shiftMonth, formatZonedDateTime } from '@taptime/core';
import type { SearchMembershipResponse } from '@taptime/mobile-work-contract';
import { useSearchPages, useDebouncedSearch } from '../../../mobile/src/search/useSearchPages';
import { SearchField, SearchStatus } from '../SearchControls';
import { EmployeeAccountInvitationForm, type EmployeeAccountInvitationCapability } from '../EmployeeAccountInvitationForm';
import { ACCOUNT_INVITATION_SUCCESS_NOTICES, type AccountInvitationSuccess } from '../accountInvitation';
import type { AdminWebCapability } from '../contracts';
import { monthLabel, canonicalRoutePath, defaultRoute, type AdminRoute } from '../navigation';
import { Confirmation, DataTable, EmptyState, Person, SectionBoundary } from '../ui';
import { FeedbackBand, useIntentFocusReturn } from '../viewHelpers';
import { PeopleTable } from './PeopleShared';
import { PageHeader } from '../PageHeader';
import { MobileSheet } from '../MobileSheet';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
type Member = SearchMembershipResponse['employeeMemberships'][number];
const roles = [
  { value: 'employee', label: 'Mitarbeiter', description: 'Erfasst eigene Zeiten und sieht die eigenen Stunden.' },
  { value: 'standortleitung', label: 'Standortleitung', description: 'Verwaltet Mitarbeiter, Kunden und Zeiten an den zugewiesenen Standorten.' },
  { value: 'administrator', label: 'Administrator', description: 'Verwaltet alle Mitarbeiter, Standorte und Einstellungen des Betriebs.' },
] as const;
const signInDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: BUSINESS_TIME_ZONE });
export default function EmployeesView({ state, administration, accountInvitations, navigate, route }: {
  readonly route?: AdminRoute; readonly navigate: (route: AdminRoute) => void;
  readonly state: ReadyState; readonly administration: AdminWebCapability;
  readonly accountInvitations?: EmployeeAccountInvitationCapability;
}) {
  const current = businessDay(Date.now()).slice(0, 7), months = Array.from({ length: 24 }, (_, i) => shiftMonth(current, -i));
  const month = route?.month && months.includes(route.month) ? route.month : current;
  const changeMonth = (month: string) => navigate({ ...route ?? defaultRoute('beschaeftigte', state.selectedLocation?.id ?? null), month });
  const [tab, setTab] = useState<'zeiten' | 'zugaenge'>('zeiten');
  const [adding, setAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [editingMembership, setEditingMembership] = useState<Member | null>(null);
  const [selectedRole, setSelectedRole] = useState<Member['role']>('employee');
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const roleTrigger = useRef<HTMLButtonElement>(null);
  useIntentFocusReturn(editingMembership !== null, roleTrigger);
  const [input, setInput] = useState(''); const search = useDebouncedSearch(input);
  const members = useSearchPages((term, cursor) => administration.querySearch?.('memberships', {
    search: term, cursor, locationId: state.selectedLocation?.id ?? null, active: activeFilter,
  }) ?? Promise.resolve({ status: 'unavailable' } as const), value => value.employeeMemberships, member => member.id,
  [administration, state.membershipId, state.role, state.selectedLocation?.id]);
  const previousFilter = useRef(activeFilter);
  useEffect(() => {
    if (previousFilter.current !== activeFilter) { previousFilter.current = activeFilter; void members.pager.refresh(); }
  }, [activeFilter, members.pager]);
  const [runningFilter, setRunningFilter] = useState<boolean | null>(null);
  useEffect(() => { void administration.refreshManagedPeople?.(runningFilter, false, month, search); },
    [administration, state.selectedLocation?.id, runningFilter, month, search]);
  const [invitationSuccess, setInvitationSuccess] = useState<AccountInvitationSuccess | null>(null);
  const [invitedName, setInvitedName] = useState<string | null>(null);
  useEffect(() => {
    if (invitedName !== null) {
      // Show the new row even beyond the first alphabetical page or a revoked-only filter.
      members.setSearch(Array.from(invitedName.normalize('NFC').trim()).slice(0, 80).join(''));
      // An unchanged search is otherwise a no-op; a successful invitation always needs fresh rows.
      void members.pager.refresh();
      setInvitedName(null);
    }
  }, [invitedName, members.pager]);
  const [revocationIntent, setRevocationIntent] = useState<Pick<Member, 'id' | 'displayName' | 'rowVersion'> | null>(null);
  const [revoking, setRevoking] = useState(false);
  const revocationTrigger = useRef<HTMLButtonElement>(null);
  useIntentFocusReturn(revocationIntent !== null, revocationTrigger);
  useEffect(() => { setInvitationSuccess(null); setEditingMembership(null); setRevocationIntent(null); setAdding(false); },
    [state.membershipId, state.role, state.selectedLocation?.id]);
  const revocationCalendar = state.calendar?.targetMembershipId === revocationIntent?.id ? state.calendar : null;
  const running = revocationCalendar?.status === 'ready' ? revocationCalendar.value.activeRecord : null;
  const checking = revocationIntent !== null && administration.loadPersonTime !== undefined && revocationCalendar?.status !== 'ready';
  const tooLong = running !== null && Date.now() - Date.parse(running.startedAt) > 24 * 3600_000;
  const personRoute = { ...defaultRoute('beschaeftigte', state.selectedLocation?.id ?? null), personId: revocationIntent?.id,
    month: running ? businessDay(Date.parse(running.startedAt)).slice(0, 7) : null };
  const packageUsage = state.managementScope.kind === 'organization' && state.managedPeople?.status === 'ready'
    ? state.managedPeople.value.packageUsage : null;
  const assignmentRoute = (id: string) => ({ ...defaultRoute('einrichtung'), setupTab: 'standorte' as const, setupMembershipId: id });
  const assignLocations = (id: string) => <a className="button-link" href={canonicalRoutePath(assignmentRoute(id))}
    onClick={event => { event.preventDefault(); setEditingMembership(null); navigate(assignmentRoute(id)); }}>Verwaltete Standorte zuweisen</a>;
  const invitation = <EmployeeAccountInvitationForm key={state.selectedLocation?.id ?? 'organization'}
    triggerLabel="+ Mitarbeiter einladen" triggerClassName={state.role === 'administrator' && revocationIntent === null ? 'primary-action' : 'secondary'} packageUsage={packageUsage}
    capability={accountInvitations} state={state} open={adding} setOpen={open => { if (open) setInvitationSuccess(null); setAdding(open); }}
    onCreated={async (status, displayName) => {
      setInvitationSuccess(status);
      await administration.retrySection('employees');
      setTab('zugaenge'); setActiveFilter(null); setInvitedName(displayName);
    }} />;
  return <><PageHeader organization={state.projection.organization.name} title="Mitarbeiter"
    subtitle={packageUsage ? <><span>{packageUsage.activeAccessCount} Zugänge{packageUsage.packageSize === null ? '' : ` · Paket ${packageUsage.packageSize}`}</span>
      {packageUsage.packageSize !== null && packageUsage.activeAccessCount > packageUsage.packageSize
        ? <span className="access-notice">Paket überschritten, alle Zugänge bleiben nutzbar</span> : null}</> : 'Mitarbeiter und Zugänge in Ihrem Bereich.'}
    actions={<>{tab === 'zeiten' ? <label className="header-month"><span className="sr-only">Monat</span><select value={month} onChange={event => changeMonth(event.target.value)}>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label> : null}{state.role === 'administrator' ? invitation : null}</>}
    onRefresh={() => { void administration.refresh(); void members.pager.refresh(); }} />
    {invitationSuccess === null ? null : <p role="status">{ACCOUNT_INVITATION_SUCCESS_NOTICES[invitationSuccess]}</p>}
    <SectionBoundary state={state.sections.employees} onRetry={() => void administration.retrySection('employees')}>
      <div className="employees-view">
        <div className="setup-tabs" role="tablist" aria-label="Mitarbeiterbereiche">{(['zeiten', 'zugaenge'] as const).map((key, index) =>
          <button type="button" role="tab" key={key} id={`employees-tab-${key}`} aria-controls={`employees-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)} onKeyDown={event => {
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - index : null;
              if (next !== null) { event.preventDefault(); const button = event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]!; button.click(); button.focus(); }
            }}>{key === 'zeiten' ? 'Zeiten' : 'Zugänge'}</button>)}</div>
        <section role="tabpanel" id={`employees-panel-${tab}`} aria-labelledby={`employees-tab-${tab}`}>
          {tab === 'zeiten' ? <>
            <SearchField value={input} onChange={setInput} />
            <p role="status">{state.managedPeople?.status === 'ready' ? `${state.managedPeople.value.nextCursor ? 'mehr als ' : ''}${state.managedPeople.value.people.length} Treffer` : 'Wird geladen …'}</p>
            {state.managedPeople?.status === 'ready' && !state.managedPeople.value.people.length && search ? <p>{`Keine Treffer für „${search}“`} <button type="button" onClick={() => setInput('')}>Suche löschen</button></p> : null}
            {state.managedPeople?.failed ? <button onClick={() => void administration.refreshManagedPeople?.(runningFilter, state.managedPeople?.status === 'ready', month, search)}>Erneut versuchen</button> : null}
            <div className="filter-chips" role="group" aria-label="Aktivitätsfilter">{[['Alle', null], ['Zeit läuft', true], ['Keine Zeit', false]].map(([label, value]) =>
              <button key={String(label)} className="secondary" aria-pressed={runningFilter === value} onClick={() => setRunningFilter(value as boolean | null)}>{label}</button>)}</div>
            {state.managedPeople?.status === 'ready' && state.managedPeople.month === month ? <><PeopleTable people={state.managedPeople.value.people}
              navigate={navigate} locationId={state.selectedLocation?.id ?? null} locationsEnabled={state.locationsEnabled} month={month} />
              {state.managedPeople.value.nextCursor === null ? null : <button className="text-button" onClick={() => void administration.refreshManagedPeople?.(runningFilter, true, month, search)} disabled={state.managedPeople.busy}>Weitere laden</button>}</> : null}
            {state.employeeProjection.employeeMemberships.length === 0 && state.employeeProjection.nextCursor === null
              ? state.selectedLocation === null ? <p className="empty">Keine Mitarbeiter vorhanden.</p>
                : <div className="empty first-list-empty"><strong>Noch keine Mitarbeiter am Standort {state.selectedLocation.name}</strong>
                  <p>Laden Sie die erste Person für diesen Standort ein.</p>
                  <button type="button" className="secondary" onClick={() => { setTab('zugaenge'); setAdding(true); }}>Mitarbeiter einladen</button></div>
              : null}
          </> : <>
            {state.role !== 'administrator' ? invitation : null}
            {state.roleAssignmentMembershipId && state.notice?.kind === 'success' ? assignLocations(state.roleAssignmentMembershipId) : null}
            <SearchField value={members.input} onChange={members.setSearch} />
            <div className="filter-chips" role="group" aria-label="Zugangsfilter">{[['Alle', null], ['Aktiv', true], ['Entzogen', false]].map(([label, value]) =>
              <button type="button" key={String(label)} className="secondary" aria-pressed={activeFilter === value} onClick={() => setActiveFilter(value as boolean | null)}>{label}</button>)}</div>
            <SearchStatus state={members.state} onRetry={members.pager.retry} onClear={() => members.setSearch('')} />
            <DataTable label="Zugänge" headers={['Person', 'Rolle', 'Standort', 'Anmeldung', 'Zugang', 'Aktionen']}>{members.state.items.map(membership =>
              <tr key={membership.id}><td><Person name={membership.displayName} /></td><td>{roles.find(role => role.value === membership.role)?.label}</td>
                <td>{state.locationsEnabled && membership.location !== null ? membership.location.name : '–'}</td>
                <td>{membership.lastSignedInAt ? <time dateTime={membership.lastSignedInAt} title={formatZonedDateTime(membership.lastSignedInAt)}>zuletzt {signInDate.format(new Date(membership.lastSignedInAt))}</time>
                  : <span className="access-notice">noch nicht angemeldet</span>}</td>
                <td><span className={`pill ${membership.active ? 'success' : ''}`}>{membership.active ? 'aktiv' : 'entzogen'}</span></td>
                <td>{membership.active && (state.managementScope.kind === 'organization' || membership.role === 'employee') ? <div className="entity-actions">
                  {state.managementScope.kind === 'organization' ? <button type="button" className="quiet" onClick={event => {
                    roleTrigger.current = event.currentTarget; setRoleError(null); setSelectedRole(membership.role); setEditingMembership(membership);
                  }}>Rolle ändern</button> : null}
                  <button type="button" className="warning-action" onClick={event => {
                    revocationTrigger.current = event.currentTarget;
                    void administration.loadPersonTime?.(membership.id, businessDay(Date.now()).slice(0, 7));
                    setRevocationIntent({ id: membership.id, displayName: membership.displayName, rowVersion: membership.rowVersion });
                  }}>Zugang entziehen</button>
                </div> : null}</td></tr>)}</DataTable>
            {members.state.nextCursor ? <button type="button" className="text-button" disabled={members.state.busy} onClick={() => void members.pager.loadMore()}>Weitere laden</button> : null}
            {members.state.status === 'ready' && !members.state.items.length && !members.state.search ? <EmptyState>Keine {activeFilter === false ? 'entzogenen' : activeFilter === true ? 'aktiven' : ''} Zugänge vorhanden.</EmptyState> : null}
          </>}
        </section>
        {editingMembership ? <MobileSheet label="Rolle ändern" className="right-sheet" busy={savingRole} onCancel={() => setEditingMembership(null)}>
          <h2>Rolle ändern</h2><p>{editingMembership.displayName}</p>
          {roleError ? <p role="alert">{roleError}</p> : null}
          {state.notice?.kind === 'error' ? <FeedbackBand message={state.notice} /> : null}
          <form className="form-grid" onSubmit={event => {
            event.preventDefault(); if (savingRole || selectedRole === editingMembership.role) return;
            const target = editingMembership, noticeBefore = state.notice; setSavingRole(true); setRoleError(null);
            void administration.changeMembershipRole(target.id, target.rowVersion, selectedRole).then(async () => {
              await members.pager.refresh();
              const updated = members.pager.getState().items.find(m => m.id === target.id);
              const latest = administration.getState();
              if (updated?.role === selectedRole || latest.status === 'ready' && latest.notice?.kind === 'success' && latest.notice !== noticeBefore) setEditingMembership(null);
              else if (updated) setEditingMembership(updated);
            }).catch(() => setRoleError('Die Rolle konnte nicht geändert werden. Bitte versuchen Sie es erneut.')).finally(() => setSavingRole(false));
          }}>
            <fieldset className="membership-role-options" disabled={savingRole}><legend>Rolle</legend>{roles.map(role =>
              <label className="membership-role-choice" key={role.value}><input type="radio" name="membership-role" value={role.value} checked={selectedRole === role.value} onChange={() => setSelectedRole(role.value)} />
                <span><strong>{role.label}</strong><span>{role.description}</span></span></label>)}</fieldset>
            {editingMembership.role === 'standortleitung' ? assignLocations(editingMembership.id) : selectedRole === 'standortleitung' ? <p>Nach dem Speichern weisen Sie die verwalteten Standorte zu.</p> : null}
            <button className="primary-action" disabled={savingRole || selectedRole === editingMembership.role}>{savingRole ? 'Wird gespeichert …' : 'Rolle speichern'}</button>
            <button type="button" className="secondary" disabled={savingRole} onClick={() => setEditingMembership(null)}>Abbrechen</button>
          </form>
        </MobileSheet> : null}
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
        <p>Der Mitarbeiter kann sich danach nicht mehr anmelden. Das lässt sich nicht rückgängig machen.</p>
        {checking ? <p role="status">{revocationCalendar?.status === 'unavailable' ? 'Die laufende Zeit konnte nicht geladen werden. Bitte öffnen Sie die Personenansicht.' : 'Laufende Zeit wird geprüft …'}</p>
          : tooLong && running ? <p>Diese Zeit läuft seit {formatZonedDateTime(running.startedAt)}. Bitte zuerst in der Personenansicht mit passender Endzeit beenden, dann den Zugang entziehen.</p>
          : <p>Läuft gerade eine Zeit, wird sie jetzt beendet{running ? `: ${running.targetDisplayName} · seit ${formatZonedDateTime(running.startedAt)}` : ''}.</p>}
        <a href={canonicalRoutePath(personRoute)} onClick={event=>{event.preventDefault();setRevocationIntent(null);navigate(personRoute);}}>Zur Personenansicht</a>
      </Confirmation>}
      </div>
    </SectionBoundary></>;
}
