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
	type AdminRoute
} from '../navigation';
import { Confirmation,CountTruth,Panel,SectionBoundary } from '../ui';
import { useIntentFocusReturn } from '../viewHelpers';
import { ActivityTile,PeopleTable } from './PeopleShared';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function EmployeesView({ state, administration, accountInvitations, navigate }: {
  readonly navigate: (route:AdminRoute)=>void;
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly accountInvitations?: EmployeeAccountInvitationCapability;
}) {
  const [adding, setAdding] = useState(false);
  const [editingMembership,setEditingMembership]=useState<string|null>(null);
  const [runningFilter,setRunningFilter] = useState<boolean|null>(null);
  useEffect(()=>{ void administration.refreshManagedPeople?.(runningFilter); },[administration,state.selectedLocation?.id,runningFilter]);
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
  return <>
    {invitationSuccess === null ? null : <p role="status">{ACCOUNT_INVITATION_SUCCESS_NOTICES[invitationSuccess]}</p>}
    <SectionBoundary state={state.sections.employees}
    onRetry={() => void administration.retrySection('employees')}>
    <Panel title="Beschäftigte" description={state.selectedLocation === null
      ? 'Beschäftigte und ihre Zugänge.'
      : `Beschäftigte und ihre Zugänge am Standort ${state.selectedLocation.name}.`}>
      <CountTruth count={state.employeeProjection.employeeMemberships.length}
        noun={state.selectedLocation === null
          ? state.locationsEnabled ? 'Beschäftigte im Betrieb' : 'Beschäftigte'
          : `Beschäftigte am Standort ${state.selectedLocation.name}`}
        complete={state.employeeProjection.nextCursor === null} />
      <EmployeeAccountInvitationForm key={state.selectedLocation?.id ?? 'organization'}
        capability={accountInvitations} state={state} open={adding} setOpen={(open) => {
          if (open) setInvitationSuccess(null);
          setAdding(open);
        }} onCreated={async (status) => {
          setInvitationSuccess(status);
          await administration.retrySection('employees');
        }} />
      <ActivityTile state={state} administration={administration}/>
      <div className="filter-chips" role="group" aria-label="Aktivitätsfilter">{[['Alle',null],['Aktiv',true],['Inaktiv',false]].map(([label,value])=>
        <button key={String(label)} className="secondary" aria-pressed={runningFilter === value}
          onClick={()=>setRunningFilter(value as boolean|null)}>{label}</button>)}</div>
      {state.managedPeople?.status === 'ready' ? <><PeopleTable people={state.managedPeople.value.people}
        navigate={navigate} locationId={state.selectedLocation?.id ?? null}/>
        {state.managedPeople.value.nextCursor === null ? null : <button className="secondary"
          onClick={()=>void administration.refreshManagedPeople?.(runningFilter,true)}>Weitere Personen laden</button>}</> : null}
      <details className="membership-tools"><summary>Zugänge verwalten</summary>
      <ul className="entity-list">{state.employeeProjection.employeeMemberships.map((membership) =>
        <li key={membership.id}><span>{membership.displayName}</span>
          <small className={`pill ${membership.active ? 'success' : ''}`}>
            {membership.role === 'administrator'
              ? 'Administrator'
              : membership.role === 'standortleitung' ? 'Standortleitung' : 'Beschäftigter'}
            {' · '}{membership.active ? 'Aktiv' : 'Zugang entzogen'}
          </small>
          {state.locationsEnabled && membership.location !== null
            ? <small>Standort {membership.location.name}</small> : null}
          {membership.active
            && (state.managementScope.kind === 'organization' || membership.role === 'employee')
            ? <div className="entity-actions">
            {state.managementScope.kind === 'organization'
              ? editingMembership === membership.id ? <label>Rolle
                  <select value={membership.role}
                    aria-label={`Rolle für ${membership.displayName}`}
                    onChange={(event) => void administration.changeMembershipRole(
                      membership.id,
                      membership.rowVersion,
                      event.target.value as 'administrator' | 'standortleitung' | 'employee',
                    )}>
                    <option value="employee">Beschäftigter</option>
                    <option value="standortleitung">Standortleitung</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </label> : <button className="quiet" onClick={()=>setEditingMembership(membership.id)}>Rolle bearbeiten</button>
              : null}
            <button className="quiet" onClick={(event) => {
              revocationTrigger.current = event.currentTarget;
              setRevocationIntent({
                id: membership.id,
                displayName: membership.displayName,
                rowVersion: membership.rowVersion,
              });
            }}>Zugang entziehen</button>
          </div> : null}
        </li>)}</ul>
      {revocationIntent === null ? null : <Confirmation
        label="Zugangsentzug ausdrücklich bestätigen"
        title={`Zugang für ${revocationIntent.displayName} wirklich entziehen?`}
        confirmLabel="Zugang entziehen"
        busyLabel="Zugang wird entzogen …"
        busy={revoking}
        onConfirm={() => {
          setRevoking(true);
          void administration.revokeMembership(
            revocationIntent.id,
            revocationIntent.rowVersion,
          ).finally(() => {
            setRevoking(false);
            setRevocationIntent(null);
          });
        }}
        onCancel={() => setRevocationIntent(null)}
      >
        <p>Der Beschäftigte kann sich danach nicht mehr anmelden.</p>
      </Confirmation>}
      </details>
      {state.employeeProjection.employeeMemberships.length === 0
        && state.employeeProjection.nextCursor === null
        ? state.selectedLocation === null
          ? <p className="empty">Keine Beschäftigten vorhanden.</p>
          : <div className="empty first-list-empty">
              <strong>Noch keine Beschäftigten am Standort {state.selectedLocation.name}</strong>
              <p>Laden Sie die erste beschäftigte Person für diesen Standort ein.</p>
              <button className="secondary" onClick={() => setAdding(true)}>
                Beschäftigte Person einladen
              </button>
            </div>
        : null}
      {state.employeeProjection.nextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreEmployees()}>
            Weitere Beschäftigte laden
          </button>}
    </Panel>
  </SectionBoundary></>;
}
