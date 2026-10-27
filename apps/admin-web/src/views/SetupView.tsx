import {PageHeader} from '../PageHeader';
import {MobileSheet} from '../MobileSheet';
import {DataTable,EmptyState,Person,Pill} from '../ui';
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
import { FeedbackBand,returnFocus,useIntentFocusReturn } from '../viewHelpers';
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
  const [deletingProject,setDeletingProject]=useState<{id:string;name:string}|null>(null);
  const projectDeleteTrigger=useRef<HTMLButtonElement>(null);
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
  const [tab,setTab]=useState(route?.setupMembershipId?'mitarbeiter':route?.setupTab ?? (state.reassignmentIntent!==null?'tags':state.managementScope.kind==='organization'?'standorte':'arbeitsziele'));
  const [createOpen,setCreateOpen]=useState(false),[filter,setFilter]=useState('');
  const changeTab=(next:string)=>{setTab(next);setCreateOpen(false);setFilter('');customers.setSearch('');projects.setSearch('');};
  useEffect(()=>{if(route?.setupTab)changeTab(route.setupMembershipId?'mitarbeiter':route.setupTab);},[route?.setupTab]);
  useEffect(()=>{
    if(tab==='mitarbeiter' && route?.setupMembershipId && state.locationSetup && !state.locationSetupBusy)
      document.getElementById(`setup-membership-${route.setupMembershipId}`)?.focus();
  },[tab,route?.setupMembershipId,state.locationSetup,state.locationSetupBusy]);
  const [projectName, setProjectName] = useState('');
  const [projectLocationId, setProjectLocationId] = useState('');
  const selectedProjectLocation = projectLocationId || (state.assignableLocations.length === 1 ? state.assignableLocations[0]!.id : '');
  const [tagId, setTagId] = useState(state.reassignmentIntent?.nfcTagId??'');
  const lastTagId=useRef<string|null>(state.reassignmentIntent?.nfcTagId??null);
  const [targetId, setTargetId] = useState(state.reassignmentIntent?.targetCustomerId??'');
  useEffect(()=>{if(customers.state.status==='ready'&&!customers.state.busy&&!customers.state.failed&&targetId&&!customers.state.items.some(c=>c.id===targetId))setTargetId('');},[customers.state,targetId]);
  useEffect(()=>{if(tags.state.status==='ready'&&!tags.state.busy&&!tags.state.failed&&tagId&&!tags.state.items.some(t=>t.id===tagId))setTagId('');},[tags.state,tagId]);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const tagSelect = useRef<HTMLSelectElement>(null);
  const targetSelect = useRef<HTMLFieldSetElement>(null);
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
      changeTab(gap.kind==='membership'?'mitarbeiter':'arbeitsziele');
      if(gap.kind==='nfc_assignment'){
        const card=tags.state.items.find(tag=>tag.activeAssignmentId===gap.id)
          ??latest.projection.nfcTags.find(tag=>tag.activeAssignmentId===gap.id);
        if(!card){changeTab('tags');setGapNotice('Die Karte ist noch nicht geladen. Nutzen Sie die Suche oder „Weitere laden“.');return;}
        const customer=latest.locationSetup?.workTargets.find(target=>target.targetType==='customer'&&target.targetId===card.targetCustomerId);
        destination=customer?`setup-customer-${customer.targetId}`:'setup-reassignment';
        if(!customer){changeTab('tags');setTagId(card.id);}else changeTab('arbeitsziele');
      }
      requestAnimationFrame(()=>{
        if(!current())return;
        const target=document.getElementById(destination);
        target?.scrollIntoView({block:'center'});(target?.querySelector<HTMLElement>('select,[data-required-choice]')??target)?.focus();
      });
    } catch {if(current())setGapNotice('Die Zuordnung konnte nicht geladen werden. Bitte versuchen Sie es erneut.');}
  };

  useEffect(() => {
    if (state.completedAction === 'project_created') {setProjectName('');setCreateOpen(false);void projects.pager.refresh();}
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
  const setupRows=[
              ...customers.state.items.map(c=>({id:c.id,name:c.displayName,type:'customer' as const,active:c.active})),
              ...projects.state.items.map(c=>({id:c.projectId,name:c.displayName,type:'project' as const,active:c.active})),
              ...(state.locationSetup?.workTargets??[]).filter(t=>t.targetType!=='general_work'&&(t.targetType==='customer'?!customers.state.items.some(c=>c.id===t.targetId):!projects.state.items.some(p=>p.projectId===t.targetId))&&t.displayName.toLocaleLowerCase('de').includes(filter.trim().normalize('NFC').toLocaleLowerCase('de'))).map(t=>({id:t.targetId,name:t.displayName,type:t.targetType,active:undefined}))
            ].filter(item=>item.active!==false);
  const explanation=tab==='standorte'?'Standorte bilden die Arbeitsorte Ihres Betriebs ab.':tab==='mitarbeiter'?'Ordnen Sie Personen ihre Arbeits- und Verwaltungsstandorte zu.':tab==='arbeitsziele'?'Kunden und Projekte erhalten hier ihren Standort.':'Karten werden mit dem Handy zugeordnet; hier ändern Sie Zuordnungen.';
  return <>
    <PageHeader organization={state.projection.organization.name} title="Einrichtung" subtitle="Standorte, Kunden und Projekte Ihres Betriebs." onRefresh={()=>{void administration.refresh();void administration.refreshLocationSetup?.();void customers.pager.refresh();void projects.pager.refresh();void tags.pager.refresh();}} actions={tab==='standorte'||tab==='arbeitsziele'?<button className={createOpen?'secondary':'primary-action'} onClick={()=>setCreateOpen(true)}>{tab==='standorte'?'+ Standort':'+ Projekt'}</button>:undefined}/>
    {deletingProject ? <Confirmation warning trigger={projectDeleteTrigger.current} label="Projekt löschen" busyLabel="Wird gelöscht …" title={`Projekt ${deletingProject.name} löschen?`} confirmLabel="Projekt löschen" busy={state.projectBusy ?? false}
      onCancel={()=>setDeletingProject(null)} onConfirm={()=>{void administration.deactivateProject?.(deletingProject.id).then(()=>{setDeletingProject(null);void projects.pager.refresh();void administration.refreshLocationSetup?.();});}}>
      <p>Danach steht {deletingProject.name} im Archiv. Die Zeiten bleiben im Lohnexport erhalten. Das lässt sich nicht rückgängig machen.</p>
    </Confirmation> : null}
    <SectionBoundary state={state.sections.setup} retryButtonRef={sectionRetryButton} onRetry={()=>void administration.retrySection('setup')}>
      <div className="setup-tabs" role="tablist" aria-label="Einrichtungsbereiche">{[
        ...(state.managementScope.kind==='organization'?[['standorte','Standorte'],['mitarbeiter','Mitarbeiter']]:[]),['arbeitsziele','Kunden und Projekte'],['tags','Karten']
      ].map(([key,label],index)=><button type="button" role="tab" key={key} id={`tab-${key}`} aria-controls={`setup-tab-${key}`} aria-selected={tab===key} tabIndex={tab===key?0:-1} disabled={state.reassignmentIntent!==null} onKeyDown={event=>{
        const buttons=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const next=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index+buttons.length-1)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
        if(next!==null){event.preventDefault();buttons[next]!.click();buttons[next]!.focus();}
      }} onClick={()=>changeTab(key!)}>{label}</button>)}</div>
      {gapNotice?<p role="alert">{gapNotice}</p>:null}
      <section role="tabpanel" id={`setup-tab-${tab}`} aria-labelledby={`tab-${tab}`}>
        <div className="section-tools"><p>{explanation}</p><SearchField value={tab==='tags'?tags.input:filter} onChange={value=>{if(tab==='tags')tags.setSearch(value);else{setFilter(value);if(tab==='arbeitsziele'){customers.setSearch(value);projects.setSearch(value);}}}}/></div>
        {state.managementScope.kind==='organization'&&(tab==='standorte'||tab==='mitarbeiter')?<LocationSetupPanel cards={[...tags.state.items,...state.projection.nfcTags]} tab={tab} filter={filter} createOpen={createOpen} closeCreate={()=>setCreateOpen(false)} state={state} administration={administration} onGap={gap=>{void navigateGap(gap);}}/>:null}
        {tab==='arbeitsziele'?<>
          <SearchStatus state={{...customers.state,items:setupRows,search:customers.state.search,nextCursor:customers.state.nextCursor??projects.state.nextCursor,failed:customers.state.failed||projects.state.failed,busy:customers.state.busy||projects.state.busy,status:customers.state.status==='ready'&&projects.state.status==='ready'?'ready':customers.state.failed||projects.state.failed?'unavailable':'loading'}} onRetry={()=>{if(customers.state.failed)void customers.pager.retry();if(projects.state.failed)void projects.pager.retry();}} onClear={()=>{setFilter('');customers.setSearch('');projects.setSearch('');}}/>
          <DataTable label="Kunden und Projekte" headers={['Name','Art','Standort','Aktion']}>
            {setupRows.map(item=>{const binding=state.locationSetup?.workTargets.find(t=>t.targetId===item.id&&t.targetType===item.type);return <tr key={`${item.type}:${item.id}`} id={`setup-${item.type}-${item.id}`} tabIndex={-1}>
              <td><strong>{item.name}</strong>{item.active===false?<small> · inaktiv</small>:null}</td><td>{item.type==='customer'?'Kunde':'Projekt'}</td>
              <td>{binding?<select aria-label={`Standort für ${item.name}`} value={binding.locationId??''} disabled={state.locationSetupBusy} onChange={event=>{if(event.target.value)void administration.setWorkTargetLocation?.(item.type,item.id,event.target.value);}}><option value="">Noch nicht zugewiesen</option>{state.locationSetup?.locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.displayName}</option>)}</select>:<span className="muted">–</span>}</td>
              <td>{item.type==='project'&&item.active?<button className="warning-action" disabled={state.projectBusy} onClick={event=>{projectDeleteTrigger.current=event.currentTarget;setDeletingProject({id:item.id,name:item.name});}}>Projekt löschen</button>:null}</td>
            </tr>;})}
          </DataTable>
          {moreCustomers}{projects.state.nextCursor?<button className="text-button" disabled={projects.state.busy} onClick={()=>void projects.pager.loadMore()}>Weitere Projekte laden</button>:null}
          {customers.state.status==='ready'&&projects.state.status==='ready'&&!setupRows.length?<EmptyState action={<button className="text-button" onClick={()=>setCreateOpen(true)}>Projekt anlegen</button>}>Keine Kunden oder Projekte vorhanden.</EmptyState>:null}
          {createOpen?<MobileSheet label="Projekt anlegen" className="right-sheet" busy={state.projectBusy} onCancel={()=>setCreateOpen(false)}><h2>Projekt anlegen</h2>{state.notice?<FeedbackBand message={state.notice}/>:null}<RequiredForm className="form-grid" onSubmit={event=>{event.preventDefault();void administration.createProject?.(projectName,state.locationsEnabled?selectedProjectLocation||undefined:undefined);}}>
            <label>Name<input required maxLength={120} value={projectName} disabled={state.projectBusy} onChange={event=>setProjectName(event.target.value)}/></label>
            {state.locationsEnabled?<label>Standort<select required value={selectedProjectLocation} disabled={state.projectBusy} onChange={event=>setProjectLocationId(event.target.value)}><option value="">Standort wählen</option>{state.assignableLocations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>:null}
            <button className="primary-action" disabled={state.projectBusy}>{state.projectBusy?'Wird verarbeitet …':'Projekt anlegen'}</button><button type="button" className="secondary" disabled={state.projectBusy} onClick={()=>setCreateOpen(false)}>Abbrechen</button>
          </RequiredForm></MobileSheet>:null}
        </>:null}
        {tab==='tags'?<div ref={cardsPanel} id="setup-card-assignments" tabIndex={-1}>
          <SearchStatus state={tags.state} onRetry={tags.pager.retry} onClear={()=>tags.setSearch('')}/>
          <DataTable label="Karten" headers={['Karte','Kunde','Zustand','Aktion']}>{tags.state.items.map(tag=><tr key={tag.id}>
            <td><strong>{tag.displayName}</strong><details><summary>Kartenkennung</summary><small className="block">Technische Kennung {tag.validationFingerprint}</small></details></td>
            <td>{tag.assignmentType==='break'?'Pausenkarte':tag.customerDisplayName??'Nicht zugeordnet'}</td>
            <td><Pill>{tag.assignmentState==='assigned'?'zugeordnet':'nicht zugeordnet'}</Pill></td>
            <td><div className="row-actions">{tag.assignmentType==='work'&&tag.assignmentState==='assigned'?<button ref={node=>{if(lastTagId.current===tag.id)prepareButton.current=node;}} className="text-button" aria-label={`Zuordnung für ${tag.displayName} ändern`} disabled={state.reassigning||state.reassignmentIntent!==null} onClick={event=>{prepareButton.current=event.currentTarget;lastTagId.current=tag.id;setTagId(tag.id);setTargetId('');setFilter('');customers.setSearch('');projects.setSearch('');}}>Zuordnung ändern</button>:null}
              {state.role==='administrator'&&tag.activeAssignmentId!==null?<button className="warning-action" aria-label={`Karte ${tag.displayName} entfernen`} disabled={removing||state.reassignmentIntent!==null} onClick={event=>{removalButton.current=event.currentTarget;setRemovalMessage(null);setRemoval({id:tag.id,assignmentId:tag.activeAssignmentId!,name:tag.displayName});}}>Entfernen</button>:null}</div></td>
          </tr>)}</DataTable>{moreTags}
          {tags.state.status==='ready'&&!tags.state.items.length&&!tags.state.search?<EmptyState>Karten werden mit dem Handy zugeordnet. Keine Karten registriert.</EmptyState>:null}
          {removal?<Confirmation trigger={removalButton.current} label="Karte entfernen" title={`Karte „${removal.name}“ entfernen?`} confirmLabel="Entfernen bestätigen" busyLabel="Wird entfernt …" busy={removing} warning onConfirm={()=>void confirmRemoval()} onCancel={()=>setRemoval(null)}><p>{NFC_TAG_REMOVAL_EXPLANATION}</p></Confirmation>:null}
          {removalMessage?<p role="status">{removalMessage}</p>:null}
          {selectedTag?<MobileSheet label="Zuordnung ändern" className="right-sheet" busy={state.reassigning} onCancel={()=>{administration.cancelReassignment();setTagId('');}}><h2>Zuordnung ändern</h2>{state.notice?<FeedbackBand message={state.notice}/>:null}<p>{selectedTag.displayName} · {selectedTag.validationFingerprint}</p><p>Eine laufende Arbeitszeit blockiert die Änderung.</p>
            <RequiredForm id="setup-reassignment" className="form-grid" onSubmit={event=>{event.preventDefault();administration.prepareReassignment(tagId,targetId);}}>
              <fieldset ref={targetSelect} data-required-choice tabIndex={-1} data-field-error={!targetId?'Bitte einen Kunden wählen.':selectedTag.targetCustomerId===targetId?'Die Karte gehört bereits zu diesem Kunden.':undefined} disabled={state.reassigning||state.reassignmentIntent!==null}>
                <legend>Neuer aktiver Kunde</legend>{customerControls}
                <ul className="target-list">{customers.state.items.filter(c=>c.active).map(c=><li key={c.id}><button type="button" className="target-choice secondary" aria-pressed={targetId===c.id} onClick={()=>setTargetId(c.id)}>{c.displayName}{targetId===c.id?<span aria-hidden="true">✓</span>:null}</button></li>)}</ul>{moreCustomers}
              </fieldset>
              <button className="warning-action" disabled={state.reassigning||customers.state.busy||customers.state.failed||state.reassignmentIntent!==null}>Zuordnung ändern</button>
            </RequiredForm>
            {state.reassignmentIntent!==null&&intentTag&&intentTarget?<Confirmation warning label="Zuordnung ausdrücklich bestätigen" title="Zuordnung wirklich ändern?" confirmLabel="Änderung ausdrücklich bestätigen" busyLabel="Wird sicher geändert …" busy={state.reassigning} onConfirm={()=>void administration.confirmReassignment().then(()=>{
              const latest=administration.getState();if(latest.status==='ready'&&authorityKey(latest)===authorityKey(state)&&latest.reassignmentIntent===null){setTagId('');return tags.pager.refresh().then(()=>returnFocus(prepareButton,sectionRetryButton));}
            })} onCancel={()=>{administration.cancelReassignment();returnFocus(targetSelect);}}><dl><dt>Karte</dt><dd>{intentTag.displayName} · {intentTag.validationFingerprint}</dd><dt>Vorher</dt><dd>{intentTag.customerDisplayName??'Bisheriger Kunde'}</dd><dt>Nachher</dt><dd>{intentTarget.displayName}</dd></dl></Confirmation>:null}
            <button className="secondary" disabled={state.reassigning} onClick={()=>{administration.cancelReassignment();setTagId('');}}>Schließen</button>
          </MobileSheet>:null}
        </div>:null}
      </section>
    </SectionBoundary>
  </>;
}

function LocationSetupPanel({cards,tab,filter,createOpen,closeCreate,state,administration,onGap}:{
  readonly cards:ReadyState['projection']['nfcTags'];readonly tab:string;readonly filter:string;
  readonly createOpen:boolean;readonly closeCreate:()=>void;readonly state:ReadyState;
  readonly administration:AdminWebCapability;readonly onGap:(gap:ActivationGap)=>void;
}) {
  const [locationName,setLocationName]=useState('');
  const [rename,setRename]=useState<{id:string;rowVersion:number;name:string}|null>(null);
  const [deactivate,setDeactivate]=useState<{id:string;rowVersion:number;name:string}|null>(null);
  const [confirmMode,setConfirmMode]=useState(false),[saved,setSaved]=useState<string|null>(null);
  useEffect(()=>{if(state.completedAction==='location_created'){setLocationName('');closeCreate();}},[state.completedAction]);
  useEffect(()=>{if(saved){const timer=setTimeout(()=>setSaved(null),3000);return()=>clearTimeout(timer);}},[saved]);
  const setup=state.locationSetup;
  const activeLocations=setup?.locations.filter(l=>l.active)??[];
  const matches=(name:string)=>name.toLocaleLowerCase('de').includes(filter.trim().normalize('NFC').toLocaleLowerCase('de'));
  const save=async(id:string,action:Promise<void>|undefined)=>{
    if(!action)return;
    await action;
    const latest=administration.getState();
    if(latest.status==='ready'&&authorityKey(latest)===authorityKey(state)&&latest.notice?.kind==='success')setSaved(id);
  };
  const chips=(membership:NonNullable<ReadyState['locationSetup']>['memberships'][number],management=false)=>{
    const assigned=management?membership.managementLocationIds:membership.workLocationIds;
    const choices=activeLocations.filter(l=>management||l.id!==membership.homeLocationId);
    const change=(id:string,assigned:boolean)=>void save(membership.id,management?administration.setManagementLocation?.(membership.id,id,assigned):administration.setWorkLocation?.(membership.id,id,assigned));
    return <div className="location-chips">{choices.filter(l=>assigned.includes(l.id)).map(l=><button key={l.id} className="location-chip" disabled={state.locationSetupBusy} aria-label={`${l.displayName} für ${membership.displayName}${management?' als Verwaltungsstandort':''} entfernen`} onClick={()=>change(l.id,false)}>{l.displayName} <span aria-hidden="true">×</span></button>)}
      {choices.some(l=>!assigned.includes(l.id))?<details><summary className="location-chip add-chip">+ Standort</summary><div className="chip-choices">{choices.filter(l=>!assigned.includes(l.id)).map(l=><button key={l.id} className="text-button" disabled={state.locationSetupBusy} onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');change(l.id,true);}}>{l.displayName}</button>)}</div></details>:null}
    </div>;
  };
  if(!setup)return <Panel title={tab==='mitarbeiter'?'Mitarbeiter':'Standorte'}>{state.locationSetupBusy?<DelayedSkeleton label="Standort-Einrichtung wird geladen"/>:<button className="secondary" onClick={()=>void administration.refreshLocationSetup?.()}>Standort-Einrichtung laden</button>}</Panel>;
  const gapLabels={membership:'Für diese Mitarbeiter fehlt der Hauptarbeitsstandort',customer:'Für diese Kunden fehlt der Standort',project:'Für diese Projekte fehlt der Standort',work_target:'Für diese Kunden oder Projekte fehlt der Standort',nfc_assignment:'Für diese Karten fehlt der Standort'} as const;
  return <>
    {tab==='mitarbeiter'?<><DataTable label="Mitarbeiter zuweisen" headers={['Person','Rolle','Hauptstandort','Weitere Standorte','Verwaltet']}>
      {setup.memberships.filter(m=>matches(m.displayName)).map(m=><tr id={`setup-membership-${m.id}`} tabIndex={-1} key={m.id}>
        <td><Person name={m.displayName}/>{saved===m.id?<small role="status">gespeichert</small>:null}</td>
        <td>{m.role==='administrator'?'Administrator':m.role==='standortleitung'?'Standortleitung':'Mitarbeiter'}</td>
        <td><select aria-label={`Hauptarbeitsstandort für ${m.displayName}`} value={m.homeLocationId??''} disabled={state.locationSetupBusy} onChange={event=>{if(event.target.value)void save(m.id,administration.setHomeLocation?.(m.id,event.target.value));}}><option value="">Noch nicht zugewiesen</option>{activeLocations.map(l=><option key={l.id} value={l.id}>{l.displayName}</option>)}</select></td>
        <td>{chips(m)}</td><td>{m.role==='administrator'?'alle':m.role==='standortleitung'?chips(m,true):'–'}</td>
      </tr>)}
    </DataTable>{!setup.memberships.length?<EmptyState>Noch keine Mitarbeiter vorhanden.</EmptyState>:null}<p className="supporting">Änderungen werden sofort gespeichert.</p></>:<>
      <DataTable label="Standorte" headers={['Standort',{label:'Mitarbeiter',numeric:true},{label:'Kunden',numeric:true},'Zustand','Aktion']}>
        {setup.locations.filter(l=>matches(l.displayName)).map(l=><tr key={l.id}>
          <td><strong>{l.displayName}</strong></td><td className="numeric">{setup.memberships.filter(m=>m.homeLocationId===l.id||m.workLocationIds.includes(l.id)).length}</td><td className="numeric">{setup.workTargets.filter(t=>t.targetType==='customer'&&t.locationId===l.id).length}</td><td><Pill>{l.active?'aktiv':'aus'}</Pill></td>
          <td>{l.active?<div className="row-actions"><button className="icon-button" title={`${l.displayName} umbenennen`} aria-label={`${l.displayName} umbenennen`} disabled={state.locationSetupBusy} onClick={()=>setRename({id:l.id,rowVersion:l.rowVersion,name:l.displayName})}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20H4v-4ZM14 6l4 4"/></svg></button><button className="text-button" disabled={state.locationSetupBusy} onClick={()=>setDeactivate({id:l.id,rowVersion:l.rowVersion,name:l.displayName})}>Stilllegen</button></div>:<small>Stillgelegt · historisch sichtbar</small>}</td>
        </tr>)}
      </DataTable>
      {!setup.locations.length?<EmptyState>Noch kein Standort vorhanden. Legen Sie mit „+ Standort“ den ersten an.</EmptyState>:null}
      {!state.locationsEnabled?<Panel title="Vor dem Einschalten">
        {setup.activationGaps.length===0?<p>Alle erforderlichen Standortzuordnungen sind vollständig. Allgemeine Arbeitszeit braucht keine Standortbindung.</p>:<><p>Diese Standortzuordnungen fehlen noch:</p><ul>{setup.activationGaps.map(gap=>{
          const card=gap.kind==='nfc_assignment'?cards.find(t=>t.activeAssignmentId===gap.id):undefined;
          const customer=card?setup.workTargets.find(t=>t.targetType==='customer'&&t.targetId===card.targetCustomerId):undefined;
          const destination=gap.kind==='nfc_assignment'?customer?`setup-customer-${customer.targetId}`:'setup-reassignment':`setup-${gap.kind}-${gap.id}`;
          return <li key={`${gap.kind}:${gap.id}`}><strong>{gapLabels[gap.kind]}:</strong> <a href={`#${destination}`} onClick={event=>{event.preventDefault();onGap(gap);}}>{gap.displayName}</a></li>;
        })}</ul></>}
        <button className="secondary" disabled={state.locationSetupBusy||state.locationSetupFailed||setup.activationGaps.length>0} onClick={()=>setConfirmMode(true)}>Standorte einschalten</button>
      </Panel>:<button className="text-button" disabled={state.locationSetupBusy} onClick={()=>setConfirmMode(true)}>Standorte nicht mehr verwenden</button>}
      {confirmMode?<Confirmation label="Standortmodus ändern" title={state.locationsEnabled?'Standorte nicht mehr verwenden?':'Standorte einschalten?'} confirmLabel={state.locationsEnabled?'Standorte nicht mehr verwenden':'Standorte einschalten'} busyLabel="Wird verarbeitet …" busy={state.locationSetupBusy??false} onCancel={()=>setConfirmMode(false)} onConfirm={()=>void administration.setLocationsEnabled?.(!state.locationsEnabled).then(()=>setConfirmMode(false))}><p>{state.locationsEnabled?'Die Standort-Funktion wird ausgeschaltet.':'Die vorbereiteten Standortzuordnungen werden jetzt wirksam.'}</p></Confirmation>:null}
    </>}
    {createOpen?<MobileSheet label="Standort anlegen" className="right-sheet" busy={state.locationSetupBusy} onCancel={closeCreate}><h2>Standort anlegen</h2>{state.notice?<FeedbackBand message={state.notice}/>:null}<RequiredForm className="form-grid" onSubmit={event=>{event.preventDefault();void administration.createLocation?.(locationName);}}><label>Name<input required maxLength={120} value={locationName} disabled={state.locationSetupBusy} onChange={event=>setLocationName(event.target.value)}/></label><button className="primary-action" disabled={state.locationSetupBusy}>{state.locationSetupBusy?'Wird angelegt …':'Standort anlegen'}</button><button className="secondary" type="button" disabled={state.locationSetupBusy} onClick={closeCreate}>Abbrechen</button></RequiredForm></MobileSheet>:null}
    {rename?<MobileSheet label="Standort umbenennen" className="right-sheet" busy={state.locationSetupBusy} onCancel={()=>setRename(null)}><h2>Standort umbenennen</h2>{state.notice?<FeedbackBand message={state.notice}/>:null}<RequiredForm className="form-grid" onSubmit={event=>{event.preventDefault();void administration.renameLocation?.(rename.id,rename.rowVersion,rename.name).then(()=>{const latest=administration.getState();if(latest.status==='ready'&&latest.notice?.kind==='success')setRename(null);});}}><label>Name<input required maxLength={120} disabled={state.locationSetupBusy} value={rename.name} onChange={event=>setRename({...rename,name:event.target.value})}/></label><button className="primary-action" disabled={state.locationSetupBusy}>Namen speichern</button><button className="secondary" type="button" disabled={state.locationSetupBusy} onClick={()=>setRename(null)}>Abbrechen</button></RequiredForm></MobileSheet>:null}
    {deactivate?<Confirmation warning label="Standort stilllegen" title={`Standort „${deactivate.name}“ stilllegen?`} confirmLabel="Stilllegen" busyLabel="Wird stillgelegt …" busy={state.locationSetupBusy??false} onCancel={()=>setDeactivate(null)} onConfirm={()=>void administration.deactivateLocation?.(deactivate.id,deactivate.rowVersion).then(()=>setDeactivate(null))}><p>Der Standort bleibt historisch sichtbar.</p></Confirmation>:null}
  </>;
}
