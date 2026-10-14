import {useSearchPages} from '../../../mobile/src/search/useSearchPages';
import {SearchField,SearchStatus} from '../SearchControls';
import {nfcTagRemovalMessage,NFC_TAG_REMOVAL_EXPLANATION} from '@taptime/mobile-work-contract';
import type { AdminRoute } from '../navigation';
import { RequiredForm } from '../RequiredForm';
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
type ActivationGap = NonNullable<ReadyState['locationSetup']>['activationGaps'][number];
const authorityKey=(state:ReadyState)=>JSON.stringify([state.membershipId,state.role,state.projection.organization.id,state.managementScope,state.selectedLocation?.id]);
export default function SetupView({
  state,
  administration,
  route,
}: {
  readonly route?: AdminRoute;
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const customers=useSearchPages((search,cursor)=>administration.querySearch?.('setup_customers',{kind:'customers',search,cursor})??Promise.resolve({status:'unavailable'} as const),value=>value.customers,item=>item.id,[administration,state.membershipId,state.selectedLocation?.id]);
  const tags=useSearchPages((search,cursor)=>administration.querySearch?.('setup_tags',{kind:'nfc_tags',search,cursor})??Promise.resolve({status:'unavailable'} as const),value=>value.nfcTags,item=>item.id,[administration,state.membershipId,state.selectedLocation?.id]);
  const projects=useSearchPages((search,cursor)=>administration.querySearch?.('projects',{search,cursor})??Promise.resolve({status:'unavailable'} as const),value=>value.projects,item=>item.projectId,[administration,state.membershipId,state.selectedLocation?.id]);
  const customerControls=<><SearchField value={customers.input} onChange={customers.setSearch} disabled={state.reassigning||state.reassignmentIntent!==null}/><SearchStatus state={customers.state} onRetry={customers.pager.retry} onClear={()=>customers.setSearch('')}/></>;
  const tagControls=<><SearchField value={tags.input} onChange={tags.setSearch} disabled={state.reassigning||state.reassignmentIntent!==null}/><SearchStatus state={tags.state} onRetry={tags.pager.retry} onClear={()=>tags.setSearch('')}/></>;
  const moreCustomers=customers.state.nextCursor?<button type="button" disabled={customers.state.busy||state.reassignmentIntent!==null} onClick={()=>void customers.pager.loadMore()}>Weitere laden</button>:null;
  const moreTags=tags.state.nextCursor?<button type="button" disabled={tags.state.busy||state.reassignmentIntent!==null} onClick={()=>void tags.pager.loadMore()}>Weitere laden</button>:null;
  const [removal,setRemoval]=useState<{id:string;assignmentId:string;name:string}|null>(null);
  const [removing,setRemoving]=useState(false);
  const [removalMessage,setRemovalMessage]=useState<string|null>(null);
  const removalAuthority=authorityKey(state);
  useEffect(()=>{setRemoval(null);setRemovalMessage(null);},[removalAuthority]);
  const confirmRemoval=async()=>{
    if(!removal||removing)return;
    setRemoving(true);
    try{
      const result=await administration.removeTag?.(removal.id,removal.assignmentId)??{status:'unavailable' as const};
      const latest=administration.getState();if(latest.status!=='ready'||authorityKey(latest)!==removalAuthority)return;
      setRemovalMessage(nfcTagRemovalMessage(result));if(result.status!=='unavailable')setRemoval(null);if(result.status==='succeeded')void tags.pager.refresh();
    }catch{setRemovalMessage(nfcTagRemovalMessage({status:'unavailable'}));}finally{setRemoving(false);}
  };
  const [tab,setTab]=useState(route?.setupTab ?? (state.reassignmentIntent === null ? 'arbeitsziele' : 'tags'));
  useEffect(()=>{if(route?.setupTab)setTab(route.setupTab);},[route?.setupTab]);
  useEffect(()=>{
    if(tab==='standorte' && route?.setupMembershipId && state.locationSetup && !state.locationSetupBusy)
      document.getElementById(`setup-membership-${route.setupMembershipId}`)?.focus();
  },[tab,route?.setupMembershipId,state.locationSetup,state.locationSetupBusy]);
  const [customerName, setCustomerName] = useState('');
  const [customerLocationId, setCustomerLocationId] = useState('');
  const selectedCustomerLocation = customerLocationId || (state.assignableLocations.length === 1 ? state.assignableLocations[0]!.id : '');
  const [projectName, setProjectName] = useState('');
  const [projectLocationId, setProjectLocationId] = useState('');
  const selectedProjectLocation = projectLocationId || (state.assignableLocations.length === 1 ? state.assignableLocations[0]!.id : '');
  const [tagId, setTagId] = useState('');
  const [targetId, setTargetId] = useState('');
  useEffect(()=>{if(customers.state.status==='ready'&&!customers.state.busy&&!customers.state.failed&&targetId&&!customers.state.items.some(c=>c.id===targetId))setTargetId('');},[customers.state,targetId]);
  useEffect(()=>{if(tags.state.status==='ready'&&!tags.state.busy&&!tags.state.failed&&tagId&&!tags.state.items.some(t=>t.id===tagId))setTagId('');},[tags.state,tagId]);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const tagSelect = useRef<HTMLSelectElement>(null);
  const targetSelect = useRef<HTMLSelectElement>(null);
  const sectionRetryButton = useRef<HTMLButtonElement>(null);
  const removalButton=useRef<HTMLButtonElement>(null);
  const cardsPanel=useRef<HTMLDivElement>(null);
  useIntentFocusReturn(removal!==null,removalButton,cardsPanel,sectionRetryButton);
  const gapNavigation=useRef(0);
  const [gapNotice,setGapNotice]=useState<string|null>(null);
  useEffect(()=>()=>{gapNavigation.current+=1;},[]);
  const navigateGap=async(gap:ActivationGap)=>{
    const request=++gapNavigation.current,authority=authorityKey(state);
    setGapNotice(null);
    const current=()=>{
      const latest=administration.getState();
      return request===gapNavigation.current&&latest.status==='ready'&&authorityKey(latest)===authority?latest:null;
    };
    try {
      let latest=current();if(!latest)return;
      let destination=`setup-${gap.kind}-${gap.id}`;
      if(gap.kind==='nfc_assignment'){
        let card=latest.projection.nfcTags.find(tag=>tag.activeAssignmentId===gap.id);
        if(!card){setTab('tags');setGapNotice('Die Karte ist noch nicht geladen. Nutzen Sie die Suche oder „Weitere laden“.');return;}
        const customer=latest.locationSetup?.workTargets.find(target=>target.targetType==='customer'&&target.targetId===card.targetCustomerId);
        destination=customer?`setup-customer-${customer.targetId}`:'setup-reassignment';
        if(!customer){setTab('tags');setTagId(card.id);}
      }
      requestAnimationFrame(()=>{
        if(!current())return;
        const target=document.getElementById(destination);
        target?.scrollIntoView({block:'center'});(target?.querySelector('select')??target)?.focus();
      });
    } catch {if(current())setGapNotice('Die Zuordnung konnte nicht geladen werden. Bitte versuchen Sie es erneut.');}
  };

  useEffect(() => {
    if (state.completedAction === 'customer_created') {setCustomerName('');void customers.pager.refresh();}
    if (state.completedAction === 'project_created') {setProjectName('');void projects.pager.refresh();}
  }, [state.completedAction]);
  useEffect(() => {
    void administration.refreshLocationSetup?.();
  }, [administration]);
  useIntentFocusReturn(
    state.reassignmentIntent !== null,
    prepareButton,
    tagSelect,
    targetSelect,
    sectionRetryButton,
  );
  const selectedTag = tags.state.items.find((tag) => tag.id === tagId);
  const intentTag = state.reassignmentIntent === null
    ? null
    : tags.state.items.find((tag) => tag.id === state.reassignmentIntent?.nfcTagId) ?? null;
  const intentTarget = state.reassignmentIntent === null
    ? null
    : customers.state.items.find(
        (customer) => customer.id === state.reassignmentIntent?.targetCustomerId,
      ) ?? null;
  return <SectionBoundary state={state.sections.setup} retryButtonRef={sectionRetryButton}
    onRetry={() => void administration.retrySection('setup')}>
    <div className="filter-chips" role="group" aria-label="Einrichtungsbereiche">{[
      ...(state.managementScope.kind === 'organization' ? [['standorte','Standorte']] : []),
      ['arbeitsziele','Arbeitsziele'],['tags','Karten'],
    ].map(([value,label])=><button key={value} className="secondary" aria-pressed={tab === value}
      disabled={state.reassignmentIntent !== null} onClick={()=>setTab(value!)}>{label}</button>)}</div>
    {gapNotice?<p role="alert">{gapNotice}</p>:null}
    <div className="content-grid">
      {state.managementScope.kind === 'organization'
        ? <div className="full-width" hidden={tab !== 'standorte'}><LocationSetupPanel state={state} administration={administration} onGap={gap=>{void navigateGap(gap);}} /></div>
        : null}
      <div hidden={tab !== 'arbeitsziele'}><Panel title="Kunden" description="Aktive und inaktive Kunden der geladenen Seiten.">
        {customerControls}
        <RequiredForm className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createCustomer(customerName, state.locationsEnabled ? selectedCustomerLocation || undefined : undefined);
        }}>
          <label htmlFor="customer-name">Neuen Kunden anlegen</label>
          {state.locationsEnabled ? <label>Standort
            <select required value={selectedCustomerLocation} onChange={event => setCustomerLocationId(event.target.value)}>
              <option value="">Standort wählen</option>
              {state.assignableLocations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label> : null}
          <div className="input-action">
            <input id="customer-name" required maxLength={120} value={customerName}
              onChange={(event) => setCustomerName(event.target.value)} />
            <button disabled={state.creating}>
              {state.creating ? 'Wird angelegt …' : 'Kunde anlegen'}
            </button>
          </div>
        </RequiredForm>
        <ul className="entity-list">{customers.state.items.map((customer) => <li key={customer.id}>
          <span>{customer.displayName}</span>
          <small className={`pill ${customer.active ? 'success' : ''}`}>
            {customer.active ? 'Für neue Zeiten verfügbar' : 'Für neue Zeiten nicht verfügbar'}
          </small>
        </li>)}</ul>
        {moreCustomers}
        {customers.state.status==='ready' && !customers.state.search && customers.state.items.length === 0 && customers.state.nextCursor === null
          && state.projection.customersComplete
          ? <p className="empty">Keine Kunden vorhanden.</p> : null}
      </Panel></div>
      <div className="full-width" hidden={tab !== 'tags'}><div ref={cardsPanel} id="setup-card-assignments" tabIndex={-1}><Panel title="NFC-Karten" description="Karten werden mit dem Handy zugeordnet. Hier sehen Sie den Bestand und ändern eine bestehende Zuordnung.">
        {tagControls}
        <ul className="entity-list">{tags.state.items.map((tag) => <li key={tag.id}>
          <div><span>{tag.displayName}</span><small>Technische Kennung {tag.validationFingerprint}</small></div>
          <small>{tag.assignmentType === 'break'
            ? 'Pausenkarte'
            : tag.assignmentType === null
              ? 'Nicht zugeordnet'
              : tag.customerDisplayName ?? 'Zugeordnet'}</small>
          {state.role==='administrator'&&tag.activeAssignmentId!==null?<button className="warning-action" aria-label={`Karte ${tag.displayName} entfernen`} disabled={removing||state.reassignmentIntent!==null}
            onClick={event=>{removalButton.current=event.currentTarget;setRemovalMessage(null);setRemoval({id:tag.id,assignmentId:tag.activeAssignmentId!,name:tag.displayName});}}>Entfernen</button>:null}
        </li>)}</ul>
        {removal?<Confirmation label="Karte entfernen" title={`Karte „${removal.name}“ entfernen?`} confirmLabel="Entfernen bestätigen" busyLabel="Wird entfernt …" busy={removing} warning
          onConfirm={()=>void confirmRemoval()} onCancel={()=>setRemoval(null)}><p>{NFC_TAG_REMOVAL_EXPLANATION}</p></Confirmation>:null}
        {removalMessage?<p role="status">{removalMessage}</p>:null}
        {moreTags}
        {tags.state.status==='ready' && !tags.state.search && tags.state.items.length === 0 && tags.state.nextCursor === null
          && state.projection.nfcTagsComplete
          ? <p className="empty">Keine Karten registriert.</p> : null}
      </Panel></div></div>
      <div hidden={tab !== 'arbeitsziele'}><Panel title="Projekte" description="Eigenständige Arbeitsziele ohne Kundenbeziehung.">
        <SearchField value={projects.input} onChange={projects.setSearch}/><SearchStatus state={projects.state} onRetry={projects.pager.retry} onClear={()=>projects.setSearch('')}/>
        <RequiredForm className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createProject?.(projectName, state.locationsEnabled ? selectedProjectLocation || undefined : undefined);
        }}>
          <label htmlFor="project-name">Neues Projekt anlegen</label>
          {state.locationsEnabled ? <label>Standort
            <select required value={selectedProjectLocation} onChange={event => setProjectLocationId(event.target.value)}>
              <option value="">Standort wählen</option>
              {state.assignableLocations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label> : null}
          <div className="input-action">
            <input id="project-name" required maxLength={120} value={projectName}
              onChange={(event) => setProjectName(event.target.value)} />
            <button disabled={state.projectBusy === true}>
              {state.projectBusy === true ? 'Wird verarbeitet …' : 'Projekt anlegen'}
            </button>
          </div>
        </RequiredForm>
        <ul className="entity-list">{projects.state.items.map((project) =>
          <li key={project.projectId}>
            <span>{project.displayName}</span>
            <div>
              <small className={`pill ${project.active ? 'success' : ''}`}>
                {project.active ? 'Aktiv' : 'Inaktiv'}
              </small>
              {project.active
                ? <button className="text-button" disabled={state.projectBusy === true}
                    aria-label={`${project.displayName} deaktivieren`}
                    onClick={() => void administration.deactivateProject?.(project.projectId).then(()=>projects.pager.refresh())}>
                    Deaktivieren
                  </button>
                : null}
            </div>
          </li>)}</ul>
        {projects.state.status==='ready' && projects.state.items.length === 0 && !projects.state.search && state.projectBusy !== true
          ? <p className="empty">Keine Projekte vorhanden.</p>
          : null}
        {projects.state.nextCursor?<button type="button" disabled={projects.state.busy} onClick={()=>void projects.pager.loadMore()}>Weitere laden</button>:null}
        <p className="supporting">
          Projektnamen bleiben unverändert. Laufende Arbeitszeit blockiert die Deaktivierung.
        </p>
      </Panel></div>
      <div id="setup-reassignment" className="full-width" hidden={tab !== 'tags'}><Panel title="Zuordnung ändern" description="Eine laufende Arbeitszeit blockiert die Änderung."
        className="full-width">
        <RequiredForm className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareReassignment(tagId, targetId);
        }}>
          <fieldset><legend>Karte suchen</legend>{tagControls}{moreTags}</fieldset>
          <label>Karte
            <select data-field-error={tagId && selectedTag?.assignmentState!=="assigned" ? "Bitte eine zugeordnete Karte wählen." : undefined} ref={tagSelect} required value={tagId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTagId(event.target.value)}>
              <option value="">Karte auswählen</option>
              {tags.state.items.filter((tag) => tag.assignmentType === 'work')
                .map((tag) => <option key={tag.id} value={tag.id}>
                  {tag.displayName} · {tag.validationFingerprint}
                </option>)}
            </select>
          </label>
          <fieldset><legend>Kunde suchen</legend>{customerControls}{moreCustomers}</fieldset>
          <label>Neuer aktiver Kunde
            <select data-field-error={targetId && selectedTag?.targetCustomerId === targetId ? "Die Karte gehört bereits zu diesem Kunden." : undefined} ref={targetSelect} required value={targetId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Arbeitsziel auswählen</option>
              {customers.state.items.filter((customer) => customer.active)
                .map((customer) => <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>)}
            </select>
          </label>
          <button className="warning-action" ref={prepareButton} disabled={
            state.reassigning || tags.state.busy || customers.state.busy || tags.state.failed || customers.state.failed
            || state.reassignmentIntent !== null

          }>Zuordnung ändern</button>
        </RequiredForm>
        {state.reassignmentIntent !== null && intentTag !== null && intentTarget !== null
          ? <Confirmation
              warning
              label="Zuordnung ausdrücklich bestätigen"
              title="Zuordnung wirklich ändern?"
              confirmLabel="Änderung ausdrücklich bestätigen"
              busyLabel="Wird sicher geändert …"
              busy={state.reassigning}
              onConfirm={() => void administration.confirmReassignment().then(()=>{
                const latest=administration.getState();
                if(latest.status==='ready'&&authorityKey(latest)===authorityKey(state)&&latest.reassignmentIntent===null)return tags.pager.refresh();
              })}
              onCancel={() => {
                administration.cancelReassignment();
                returnFocus(prepareButton, tagSelect, targetSelect);
              }}
            >
              <dl>
                <dt>Karte</dt><dd>{intentTag.displayName} · {intentTag.validationFingerprint}</dd>
                <dt>Vorher</dt><dd>{intentTag.customerDisplayName ?? 'Bisheriger Kunde'}</dd>
                <dt>Nachher</dt><dd>{intentTarget.displayName}</dd>
              </dl>
            </Confirmation>
          : null}
      </Panel></div>
    </div>
  </SectionBoundary>;
}

function LocationSetupPanel({
  state,
  administration,
  onGap,
}: {
  readonly onGap:(gap:ActivationGap)=>void;
  readonly route?: AdminRoute;
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const [locationName, setLocationName] = useState('');
  useEffect(() => { if (state.completedAction === 'location_created') setLocationName(''); }, [state.completedAction]);
  const setup = state.locationSetup;
  const activeLocations = setup?.locations.filter((location) => location.active) ?? [];
  const gapLabels = {
    membership: 'Für diese Mitarbeiter fehlt der Hauptarbeitsstandort', customer: 'Für diese Kunden fehlt der Standort', project: 'Für diese Projekte fehlt der Standort',
    work_target: 'Für diese Arbeitsziele fehlt der Standort', nfc_assignment: 'Für diese Karten fehlt der Standort',
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
    description="Ihr Betrieb umfasst alle zugehörigen Standorte. Ordnen Sie Mitarbeiter und Arbeitsziele den Standorten zu."
    className="full-width">
    <RequiredForm className="inline-form" onSubmit={(event) => {
      event.preventDefault();
      void administration.createLocation?.(locationName);
    }}>
      <label htmlFor="location-name">Neuen Standort anlegen</label>
      <div className="input-action">
        <input id="location-name" required maxLength={120} value={locationName}
          onChange={(event) => setLocationName(event.target.value)} />
        <button disabled={state.locationSetupBusy}>Standort anlegen</button>
      </div>
    </RequiredForm>
    <ul className="entity-list">{setup.locations.map((location) => <li key={location.id}>
      <RequiredForm className="input-action" onSubmit={(event) => {
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
      </RequiredForm>
      {location.active ? <button className="quiet" disabled={state.locationSetupBusy}
        onClick={() => void administration.deactivateLocation?.(location.id, location.rowVersion)}>
        Stilllegen
      </button> : null}
    </li>)}</ul>
    {setup.locations.length === 0 ? <p className="empty">Noch kein Standort vorhanden.</p> : null}

    <h3>Mitarbeiter zuweisen</h3><p className="supporting">Änderungen werden sofort gespeichert.</p>
    <ul className="entity-list">{setup.memberships.map((membership) => <li id={`setup-membership-${membership.id}`} tabIndex={-1} key={membership.id}>
      <div><strong>{membership.displayName}</strong><small>{membership.role === 'administrator'
        ? 'Administrator' : membership.role === 'standortleitung' ? 'Standortleitung' : 'Mitarbeiter'}</small></div>
      <label>Hauptarbeitsstandort<small>Der Standort, dem die Person regulär zugeordnet ist.</small>
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
      <fieldset><legend>Weitere Standorte, an denen die Person arbeiten darf</legend>
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
        <legend>Standorte, die diese Person verwalten darf</legend>
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
    <ul className="entity-list">{setup.workTargets.filter(target=>target.targetType!=='general_work').map((target) => <li
      id={`setup-${target.targetType}-${target.targetId}`} tabIndex={-1} key={`${target.targetType}:${target.targetId}`}>
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
        ? <p>Alle erforderlichen Standortzuordnungen sind vollständig. Allgemeine Arbeitszeit braucht keine Standortbindung.</p>
        : <><p><strong>Diese Standortzuordnungen fehlen noch:</strong></p>
          <ul>{setup.activationGaps.map((gap) => {
            const card=gap.kind==='nfc_assignment'?state.projection.nfcTags.find(tag=>tag.activeAssignmentId===gap.id):undefined;
            const customer=card?setup.workTargets.find(target=>target.targetType==='customer'&&target.targetId===card.targetCustomerId):undefined;
            const destination=gap.kind==='nfc_assignment'
              ? customer?`setup-customer-${customer.targetId}`:'setup-reassignment'
              : `setup-${gap.kind}-${gap.id}`;
            return <li key={`${gap.kind}:${gap.id}`}>
              <strong>{gapLabels[gap.kind]}:</strong>{' '}
              <a href={`#${destination}`} onClick={event=>{
                event.preventDefault();onGap(gap);
              }}>{gap.displayName}</a>
            </li>;
          })}</ul></>}
      <p>Die vorbereiteten Standortzuordnungen werden jetzt wirksam.</p>
      <button disabled={state.locationSetupBusy || (!state.locationsEnabled
        && setup.activationGaps.length > 0)}
        onClick={() => void administration.setLocationsEnabled?.(!state.locationsEnabled)}>
        {state.locationsEnabled ? 'Standorte nicht mehr verwenden' : 'Standorte verwenden'}
      </button>
    </section>
  </Panel>;
}
