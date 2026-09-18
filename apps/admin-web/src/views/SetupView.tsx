import {
	useEffect,
	useRef,
	useState
} from 'react';
import type {
	AdminWebCapability
} from '../contracts';
import { Confirmation,CountTruth,DelayedSkeleton,Panel,SectionBoundary } from '../ui';
import { returnFocus,useIntentFocusReturn } from '../viewHelpers';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function SetupView({
  state,
  administration,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const [tab,setTab]=useState(state.reassignmentIntent === null ? 'arbeitsziele' : 'tags');
  const [customerName, setCustomerName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [tagId, setTagId] = useState('');
  const [targetId, setTargetId] = useState('');
  const prepareButton = useRef<HTMLButtonElement>(null);
  const tagSelect = useRef<HTMLSelectElement>(null);
  const targetSelect = useRef<HTMLSelectElement>(null);
  const sectionRetryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.completedAction === 'customer_created') setCustomerName('');
    if (state.completedAction === 'project_created') setProjectName('');
  }, [state.completedAction]);
  useEffect(() => {
    void administration.refreshProjects?.();
    void administration.refreshLocationSetup?.();
  }, [administration]);
  useIntentFocusReturn(
    state.reassignmentIntent !== null,
    prepareButton,
    tagSelect,
    targetSelect,
    sectionRetryButton,
  );
  const customerNameById = new Map(
    state.projection.customers.map((customer) => [customer.id, customer.displayName]),
  );
  const selectedTag = state.projection.nfcTags.find((tag) => tag.id === tagId);
  const intentTag = state.reassignmentIntent === null
    ? null
    : state.projection.nfcTags.find((tag) => tag.id === state.reassignmentIntent?.nfcTagId) ?? null;
  const intentTarget = state.reassignmentIntent === null
    ? null
    : state.projection.customers.find(
        (customer) => customer.id === state.reassignmentIntent?.targetCustomerId,
      ) ?? null;
  return <SectionBoundary state={state.sections.setup} retryButtonRef={sectionRetryButton}
    onRetry={() => void administration.retrySection('setup')}>
    <div className="filter-chips" role="group" aria-label="Einrichtungsbereiche">{[
      ...(state.managementScope.kind === 'organization' ? [['standorte','Standorte']] : []),
      ['arbeitsziele','Arbeitsziele'],['tags','Tags'],
    ].map(([value,label])=><button key={value} className="secondary" aria-pressed={tab === value}
      disabled={state.reassignmentIntent !== null} onClick={()=>setTab(value!)}>{label}</button>)}</div>
    <div className="content-grid">
      {state.managementScope.kind === 'organization'
        ? <div className="full-width" hidden={tab !== 'standorte'}><LocationSetupPanel state={state} administration={administration} /></div>
        : null}
      <div hidden={tab !== 'arbeitsziele'}><Panel title="Kunden" description="Aktive und inaktive Kunden der geladenen Seiten.">
        <CountTruth count={state.projection.customers.length} noun="Kunden"
          complete={state.projection.nextCursor === null && state.projection.customersComplete} />
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createCustomer(customerName);
        }}>
          <label htmlFor="customer-name">Neuen Kunden anlegen</label>
          <div className="input-action">
            <input id="customer-name" required maxLength={120} value={customerName}
              onChange={(event) => setCustomerName(event.target.value)} />
            <button disabled={state.creating}>
              {state.creating ? 'Wird angelegt …' : 'Kunde anlegen'}
            </button>
          </div>
        </form>
        <ul className="entity-list">{state.projection.customers.map((customer) => <li key={customer.id}>
          <span>{customer.displayName}</span>
          <small className={`pill ${customer.active ? 'success' : ''}`}>
            {customer.active ? 'Aktiv' : 'Inaktiv'}
          </small>
        </li>)}</ul>
        {state.projection.customers.length === 0 && state.projection.nextCursor === null
          && state.projection.customersComplete
          ? <p className="empty">Keine Kunden vorhanden.</p> : null}
      </Panel></div>
      <div className="full-width" hidden={tab !== 'tags'}><Panel title="NFC-Tags" description="Tags werden mit dem Handy zugeordnet. Hier sehen Sie den Bestand und ändern eine bestehende Zuordnung.">
        <CountTruth count={state.projection.nfcTags.length} noun="NFC-Tags"
          complete={state.projection.nextCursor === null && state.projection.nfcTagsComplete} />
        <ul className="entity-list">{state.projection.nfcTags.map((tag) => <li key={tag.id}>
          <div><span>{tag.displayName}</span><small>Prüffingerabdruck {tag.validationFingerprint}</small></div>
          <small>{tag.assignmentType === 'break'
            ? 'Pausen-Tag'
            : tag.assignmentType === null
              ? 'Nicht zugeordnet'
              : customerNameById.get(tag.targetCustomerId) ?? 'Zugeordnet'}</small>
        </li>)}</ul>
        {state.projection.nfcTags.length === 0 && state.projection.nextCursor === null
          && state.projection.nfcTagsComplete
          ? <p className="empty">Keine NFC-Tags registriert.</p> : null}
      </Panel></div>
      <div hidden={tab !== 'arbeitsziele'}><Panel title="Projekte" description="Eigenständige Arbeitsziele ohne Kundenbeziehung.">
        <CountTruth count={state.projects?.length ?? 0} noun="Projekte"
          complete={state.projectsNextCursor === null} />
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createProject?.(projectName);
        }}>
          <label htmlFor="project-name">Neues Projekt anlegen</label>
          <div className="input-action">
            <input id="project-name" required maxLength={120} value={projectName}
              onChange={(event) => setProjectName(event.target.value)} />
            <button disabled={state.projectBusy === true}>
              {state.projectBusy === true ? 'Wird verarbeitet …' : 'Projekt anlegen'}
            </button>
          </div>
        </form>
        <ul className="entity-list">{(state.projects ?? []).map((project) =>
          <li key={project.projectId}>
            <span>{project.displayName}</span>
            <div>
              <small className={`pill ${project.active ? 'success' : ''}`}>
                {project.active ? 'Aktiv' : 'Inaktiv'}
              </small>
              {project.active
                ? <button className="text-button" disabled={state.projectBusy === true}
                    aria-label={`${project.displayName} deaktivieren`}
                    onClick={() => void administration.deactivateProject?.(project.projectId)}>
                    Deaktivieren
                  </button>
                : null}
            </div>
          </li>)}</ul>
        {(state.projects?.length ?? 0) === 0 && state.projectBusy !== true
          ? <p className="empty">Keine Projekte vorhanden.</p>
          : null}
        {state.projectsNextCursor === null || state.projectsNextCursor === undefined
          ? null
          : <button className="secondary load-more"
              disabled={state.projectBusy === true}
              onClick={() => void administration.loadMoreProjects?.()}>
              Weitere Projekte laden
            </button>}
        <p className="supporting">
          Projektnamen bleiben unverändert. Laufende Arbeitszeit blockiert die Deaktivierung.
        </p>
      </Panel></div>
      <div className="full-width" hidden={tab !== 'tags'}><Panel title="Tag neu zuordnen" description="Eine laufende Arbeitszeit blockiert die Änderung."
        className="full-width">
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareReassignment(tagId, targetId);
        }}>
          <label>NFC-Tag
            <select ref={tagSelect} required value={tagId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTagId(event.target.value)}>
              <option value="">NFC-Tag auswählen</option>
              {state.projection.nfcTags.filter((tag) => tag.assignmentType === 'work')
                .map((tag) => <option key={tag.id} value={tag.id}>
                  {tag.displayName} · {tag.validationFingerprint}
                </option>)}
            </select>
          </label>
          <label>Neuer aktiver Kunde
            <select ref={targetSelect} required value={targetId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Arbeitsziel auswählen</option>
              {state.projection.customers.filter((customer) => customer.active)
                .map((customer) => <option key={customer.id} value={customer.id}
                  disabled={customer.id === selectedTag?.targetCustomerId}>
                  {customer.displayName}
                </option>)}
            </select>
          </label>
          <button ref={prepareButton} disabled={
            state.reassigning
            || state.reassignmentIntent !== null
            || selectedTag?.assignmentState !== 'assigned'
            || targetId.length === 0
            || selectedTag.targetCustomerId === targetId
          }>Zuordnung prüfen</button>
        </form>
        {state.reassignmentIntent !== null && intentTag !== null && intentTarget !== null
          ? <Confirmation
              label="Zuordnung ausdrücklich bestätigen"
              title="Zuordnung wirklich ändern?"
              confirmLabel="Änderung ausdrücklich bestätigen"
              busyLabel="Wird sicher geändert …"
              busy={state.reassigning}
              onConfirm={() => void administration.confirmReassignment()}
              onCancel={() => {
                administration.cancelReassignment();
                returnFocus(prepareButton, tagSelect, targetSelect);
              }}
            >
              <dl>
                <dt>NFC-Tag</dt><dd>{intentTag.displayName} · {intentTag.validationFingerprint}</dd>
                <dt>Vorher</dt><dd>{customerNameById.get(intentTag.targetCustomerId!) ?? 'Bisheriger Kunde'}</dd>
                <dt>Nachher</dt><dd>{intentTarget.displayName}</dd>
              </dl>
            </Confirmation>
          : null}
      </Panel></div>
    </div>
    {state.projection.nextCursor === null ? null
      : <button className="secondary load-more" onClick={() => void administration.loadMore()}>
          Weitere Einrichtungsdaten laden
        </button>}
  </SectionBoundary>;
}

function LocationSetupPanel({
  state,
  administration,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const [locationName, setLocationName] = useState('');
  const setup = state.locationSetup;
  const activeLocations = setup?.locations.filter((location) => location.active) ?? [];
  const gapLabels = {
    membership: 'Zugehörigkeit', customer: 'Kunde', project: 'Projekt',
    work_target: 'Arbeitsziel', nfc_assignment: 'NFC-Zuordnung',
  } as const;
  if (setup === null) {
    return <Panel title="Standorte" description="Standorte und Bindungen werden vollständig geladen."
      className="full-width">
      {state.locationSetupBusy
        ? <DelayedSkeleton label="Standort-Einrichtung wird geladen" />
        : <button className="secondary" onClick={() => void administration.refreshLocationSetup?.()}>
            Standort-Einrichtung laden
          </button>}
    </Panel>;
  }
  return <Panel title="Standorte"
    description="Standorte vorbereiten, Menschen und Arbeitsziele binden und danach atomar einschalten."
    className="full-width">
    <form className="inline-form" onSubmit={(event) => {
      event.preventDefault();
      void administration.createLocation?.(locationName).then(() => setLocationName(''));
    }}>
      <label htmlFor="location-name">Neuen Standort anlegen</label>
      <div className="input-action">
        <input id="location-name" required maxLength={120} value={locationName}
          onChange={(event) => setLocationName(event.target.value)} />
        <button disabled={state.locationSetupBusy}>Standort anlegen</button>
      </div>
    </form>
    <ul className="entity-list">{setup.locations.map((location) => <li key={location.id}>
      <form className="input-action" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void administration.renameLocation?.(
          location.id, location.rowVersion, String(form.get('displayName') ?? ''),
        );
      }}>
        <input name="displayName" aria-label={`${location.displayName} umbenennen`}
          defaultValue={location.displayName} disabled={!location.active || state.locationSetupBusy}
          maxLength={120} required />
        {location.active ? <button className="secondary" disabled={state.locationSetupBusy}>
          Namen speichern
        </button> : <small className="pill">Stillgelegt · historisch sichtbar</small>}
      </form>
      {location.active ? <button className="quiet" disabled={state.locationSetupBusy}
        onClick={() => void administration.deactivateLocation?.(location.id, location.rowVersion)}>
        Stilllegen
      </button> : null}
    </li>)}</ul>
    {setup.locations.length === 0 ? <p className="empty">Noch kein Standort vorhanden.</p> : null}

    <h3>Menschen zuweisen</h3>
    <ul className="entity-list">{setup.memberships.map((membership) => <li key={membership.id}>
      <div><strong>{membership.displayName}</strong><small>{membership.role === 'administrator'
        ? 'Administrator' : membership.role === 'standortleitung' ? 'Standortleitung' : 'Beschäftigter'}</small></div>
      <label>Heimatstandort
        <select value={membership.homeLocationId ?? ''} disabled={state.locationSetupBusy}
          onChange={(event) => {
            if (event.target.value.length > 0) void administration.setHomeLocation?.(
              membership.id, event.target.value,
            );
          }}>
          <option value="">Noch nicht zugewiesen</option>
          {activeLocations.map((location) => <option key={location.id} value={location.id}>
            {location.displayName}
          </option>)}
        </select>
      </label>
      <fieldset><legend>Zusätzliche Arbeitszuweisungen</legend>
        {activeLocations.filter((location) => location.id !== membership.homeLocationId)
          .map((location) => <label key={location.id}>
            <input type="checkbox" checked={membership.workLocationIds.includes(location.id)}
              disabled={state.locationSetupBusy}
              onChange={(event) => void administration.setWorkLocation?.(
                membership.id, location.id, event.target.checked,
              )} /> {location.displayName}
          </label>)}
      </fieldset>
      {membership.role === 'standortleitung' ? <fieldset>
        <legend>Verwaltungszuweisungen</legend>
        {activeLocations.map((location) => <label key={location.id}>
          <input type="checkbox" checked={membership.managementLocationIds.includes(location.id)}
            disabled={state.locationSetupBusy}
            onChange={(event) => void administration.setManagementLocation?.(
              membership.id, location.id, event.target.checked,
            )} /> {location.displayName}
        </label>)}
      </fieldset> : null}
    </li>)}</ul>

    <h3>Arbeitsziele zuweisen</h3>
    <ul className="entity-list">{setup.workTargets.map((target) => <li
      key={`${target.targetType}:${target.targetId}`}>
      <span>{target.displayName}</span>
      <small>{target.targetType === 'customer' ? 'Kunde' : target.targetType === 'project'
        ? 'Projekt' : 'Allgemeines Arbeitsziel'}</small>
      <select aria-label={`Standort für ${target.displayName}`} value={target.locationId ?? ''}
        disabled={state.locationSetupBusy}
        onChange={(event) => {
          if (event.target.value.length > 0) void administration.setWorkTargetLocation?.(
            target.targetType, target.targetId, event.target.value,
          );
        }}>
        <option value="">Noch nicht zugewiesen</option>
        {activeLocations.map((location) => <option key={location.id} value={location.id}>
          {location.displayName}
        </option>)}
      </select>
    </li>)}</ul>

    <section className="activation-check" aria-labelledby="location-activation-title">
      <h3 id="location-activation-title">Vor dem Einschalten</h3>
      {setup.activationGaps.length === 0
        ? <p>Alle aktiven Zugehörigkeiten, Kunden, Projekte, Arbeitsziele und NFC-Zuordnungen
          sind eindeutig gebunden.</p>
        : <><p><strong>Diese Bindungen fehlen noch:</strong></p>
          <ul>{setup.activationGaps.map((gap) => <li key={`${gap.kind}:${gap.id}`}>
            <strong>{gapLabels[gap.kind]}:</strong> {gap.displayName}
          </li>)}</ul></>}
      <button disabled={state.locationSetupBusy || (!state.locationsEnabled
        && setup.activationGaps.length > 0)}
        onClick={() => void administration.setLocationsEnabled?.(!state.locationsEnabled)}>
        {state.locationsEnabled ? 'Standort-Funktion ausschalten' : 'Standort-Funktion einschalten'}
      </button>
    </section>
  </Panel>;
}
