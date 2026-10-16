import {MissingNameNotice, MissingNameLink} from './MissingName';
import type {AdminRoute} from '../navigation';
import {MonthSwitch} from '../MonthSwitch';
import {monthRange, selectedMonth} from '../navigation';
import {TimeFields,resolveTimeFields,advanceTimeField} from '../TimeFields';
import { RequiredForm } from '../RequiredForm';
import { isTimeReviewRole, isKnownTimeReviewReason } from '@taptime/time-review-contract';
import {
	useEffect,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent
} from 'react';
import type {
	AdminWebCapability,
	SafeReviewItem
} from '../contracts';
import {
	formatZonedDateTime,
	toZonedMinuteInput,
} from '../timeZone';
import { Confirmation,DataTable,SectionBoundary } from '../ui';
import { resolutionLabel,returnFocus,reviewReasonLabel,useIntentFocusReturn } from '../viewHelpers';
import {PageHeader} from '../PageHeader';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function ReviewsView({state,administration,navigate}: {readonly state:ReadyState;readonly administration:AdminWebCapability;readonly navigate?:(route:AdminRoute)=>void}) {
  const retry=useRef<HTMLButtonElement>(null);
  const [selectedCase,setSelectedCase]=useState<string|null>(state.adjudicationIntent?.reviewItem.reviewItemId??null);
  const authority=JSON.stringify([state.membershipId,state.role,state.managementScope,state.selectedLocation?.id]);
  const [days,setDays]=useState<{authority:string;items:ReadyState['reviewItems'];values:Record<string,NonNullable<ReadyState['reviewDay']>>}>({authority,items:state.reviewItems,values:{}});
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let current=true;
    setDays({authority,items:state.reviewItems,values:{}});
    if(state.sections.reviewItems.status!=='ready'||!administration.loadReviewDay)return;
    // The existing capability has one result slot. Read serially and retain only this view's responses.
    void (async()=>{
      for(const item of state.reviewItems){
        if(!current)return;
        let failed=false;
        try {await administration.loadReviewDay?.(item.reviewItemId);} catch {failed=true;}
        if(!current)return;
        const latest=administration.getState();
        if(latest.status!=='ready'||JSON.stringify([latest.membershipId,latest.role,latest.managementScope,latest.selectedLocation?.id])!==authority)return;
        const response=latest.reviewDay;
        const day:NonNullable<ReadyState['reviewDay']>=!failed&&response?.reviewItemId===item.reviewItemId&&response.status!=='loading'
          ?response:{reviewItemId:item.reviewItemId,status:'unavailable',value:null,message:'Die Tageszeiten konnten nicht vollständig geladen werden. Bitte versuchen Sie es erneut.'};
        setDays(previous=>({...previous,values:{...previous.values,[item.reviewItemId]:day}}));
      }
    })();
    return()=>{current=false;};
  },[administration,authority,state.reviewItems,state.sections.reviewItems.status,reload]);
  const visibleDays=days.authority===authority && days.items===state.reviewItems ? days.values : {};

  const focusFallback=useRef<HTMLElement>(null);
  const lastIntent=useRef(state.adjudicationIntent?.reviewItem.reviewItemId ?? null);
  useEffect(()=>{
    if(state.adjudicationIntent !== null) {lastIntent.current=state.adjudicationIntent.reviewItem.reviewItemId;return;}
    if(lastIntent.current === null || state.sections.reviewItems.status === 'loading') return;
    if(state.sections.reviewItems.status === 'unavailable' || !state.reviewItems.some(item=>item.reviewItemId === lastIntent.current)) {
      (retry.current ?? focusFallback.current)?.focus();
    }
    lastIntent.current=null;
  },[state.adjudicationIntent,state.sections.reviewItems.status,state.reviewItems]);
  if (!isTimeReviewRole(state.role)) return null;
  return <><PageHeader organization={state.projection.organization.name} title="Zeiten prüfen"
    subtitle={`${state.reviewItemsNextCursor?'Mindestens ':''}${state.reviewItems.length} ${state.reviewItems.length===1?'offener Fall':'offene Fälle'}`}
    onRefresh={()=>void administration.refresh()}/><section ref={focusFallback} tabIndex={-1} aria-label="Ungeklärte Erfassungen"><SectionBoundary state={state.sections.reviewItems} retryButtonRef={retry} onRetry={()=>void administration.retrySection('reviewItems')}>
      {state.reviewItems.some(item => !item.employeeDisplayName.trim()) ? <MissingNameNotice /> : null}
      <ul className="review-list">{state.reviewItems.map(item=><ReviewDecisionRow key={item.reviewItemId}
        navigate={navigate} item={item} state={state} administration={administration} open={selectedCase===item.reviewItemId}
        setOpen={open=>setSelectedCase(open?item.reviewItemId:null)} day={visibleDays[item.reviewItemId] ?? (state.reviewDay?.reviewItemId===item.reviewItemId?state.reviewDay:undefined)}
        retryDay={()=>setReload(n=>n+1)}/>)}</ul>
      {state.reviewItems.length === 0 && state.reviewItemsNextCursor === null ? <p className="empty">Keine ungeklärten Erfassungen.</p> : null}
      {state.reviewItemsNextCursor === null ? null : <button className="secondary" onClick={()=>void administration.loadMoreReviewItems()}>Weitere Erfassungen laden</button>}
  </SectionBoundary></section></>;
}
function ReviewDecisionRow({item,state,administration,day,open,setOpen,retryDay,navigate}: {readonly navigate?:(route:AdminRoute)=>void;readonly item:SafeReviewItem;readonly state:ReadyState;readonly administration:AdminWebCapability;
  readonly day:ReadyState['reviewDay'];readonly open:boolean;readonly setOpen:(open:boolean)=>void;readonly retryDay:()=>void}) {
  const noteOnly=item.source==='offline_skip' || item.targetType==='break';
  const [resolution,setResolution]=useState<'no_time_record_change'|'adjust_existing_time_record'|'create_recovered_time_record'>('no_time_record_change');
  const [month,setMonth]=useState(selectedMonth(toZonedMinuteInput(item.occurredAt).slice(0,7),'pruefungen'));
  const selection=state.reviewCorrectionRecords?.reviewItemId===item.reviewItemId ? state.reviewCorrectionRecords : undefined;
  const records=selection?.records ?? [];
  const loadRecords=(nextMonth=month,append=false)=>void administration.loadReviewCorrectionRecords?.(item.reviewItemId,nextMonth,append);
  const changeResolution=(next:typeof resolution)=>{
    setResolution(next);setRecordId('');setDate('');setStartedAt('');setStoppedAt('');setOriginalStart(null);setOriginalStop(null);
    if(next==='adjust_existing_time_record') loadRecords();
  };
  const [recordId,setRecordId]=useState('');
  const [date,setDate]=useState('');
  const [startedAt,setStartedAt]=useState('');
  const [stoppedAt,setStoppedAt]=useState('');
  const [reason,setReason]=useState('');
  const [originalStart,setOriginalStart]=useState<string|null>(null);
  const [originalStop,setOriginalStop]=useState<string|null>(null);
  const [timeError,setTimeError]=useState<string|null>(null);
  const prepareButton=useRef<HTMLButtonElement>(null);
  const rowTrigger=useRef<HTMLButtonElement>(null);
  const reasonInput=useRef<HTMLTextAreaElement>(null);
  useIntentFocusReturn(state.adjudicationIntent?.reviewItem.reviewItemId === item.reviewItemId,prepareButton,rowTrigger);
  useEffect(()=>{ if(open) reasonInput.current?.focus(); },[open]);
  const format=formatZonedDateTime;
  const formatExact=formatZonedDateTime;
  const choose=(event:ReactMouseEvent<HTMLButtonElement>,next:typeof resolution)=>{
    rowTrigger.current=event.currentTarget;changeResolution(next);setOpen(true);
  };
  return <li className="review-case" id={`review-${item.reviewItemId}`} tabIndex={-1}><div className="review-case-heading"><div>
    <h2>{item.employeeDisplayName.trim() || <MissingNameLink membershipId={item.employeeMembershipId} locationId={state.selectedLocation?.id ?? null} month={toZonedMinuteInput(item.occurredAt).slice(0,7)} navigate={navigate}/>} · {item.targetDisplayName}</h2>
    <h3>Was ist passiert</h3>
    <p className="review-reason">{reviewReasonLabel(item.reviewReason,item)}</p>
    {!isKnownTimeReviewReason(item.reviewReason)?<p className="review-support">Für Rückfragen: {item.reviewReason}</p>:null}
    <section aria-label={`Tageszeiten von ${item.employeeDisplayName}`}>
      <h3>Was heute dort steht</h3>
      {day?.status==='ready' ? <>
        {day.value.records.length===0 && !day.value.activeRecord ? <p>Keine Arbeitszeiten an diesem Tag.</p> : <DataTable label={`Tageszeiten von ${item.employeeDisplayName}`} headers={['Von–Bis','Kunde oder Projekt']}>
          {[...day.value.records,...(day.value.activeRecord ? [day.value.activeRecord] : [])].map(record=><tr key={record.timeRecordId}>
            <td>{format(record.startedAt)} – {record.stoppedAt ? format(record.stoppedAt) : 'Zeit läuft'}</td><td>{record.targetDisplayName}</td>
          </tr>)}
        </DataTable>}
      </> : !day || day.status==='loading' ? <p role="status">Tageszeiten werden geladen …</p> : <>
        {day?.status==='unavailable' ? <p role="alert">{day.message}</p> : null}
        <button className="secondary" disabled={state.timeReviewBusy || state.adjudicationIntent!==null} onClick={retryDay}>Tageszeiten erneut laden</button>
      </>}
    </section>
    {item.source==='offline_skip' ? <p className="supporting">Fehlende Zeit über „Zeit hinzufügen“ bei der Person ergänzen, danach diesen Fall mit Notiz schließen.</p> : null}
  </div><div className="entity-actions">
    {noteOnly ? null : <button className={open&&resolution==='create_recovered_time_record'?'primary-action':'secondary'} aria-pressed={open&&resolution==='create_recovered_time_record'} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onClick={event=>choose(event,'create_recovered_time_record')}>Ende nachtragen</button>}
    {noteOnly ? null : <button className={open&&resolution==='adjust_existing_time_record'?'primary-action':'secondary'} aria-pressed={open&&resolution==='adjust_existing_time_record'} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onClick={event=>choose(event,'adjust_existing_time_record')}>Zeit ändern</button>}
    <button className={open&&resolution==='no_time_record_change'?'primary-action':'secondary'} aria-pressed={open&&resolution==='no_time_record_change'} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onClick={event=>choose(event,'no_time_record_change')}>So lassen</button>
  </div></div>
  {open ? <div className="row-decision">
    <p className="supporting">{resolutionLabel(resolution)}. Bitte begründen Sie Ihre Entscheidung.</p>
      <RequiredForm className="form-grid" onKeyDown={advanceTimeField} onSubmit={(event) => {
        event.preventDefault();
        let canonicalStart: string | null = null;
        let canonicalStop: string | null = null;
        if (resolution !== 'no_time_record_change') {
          ({startedAt:canonicalStart,stoppedAt:canonicalStop}=resolveTimeFields({date,start:startedAt,end:stoppedAt,originalStart:resolution==='adjust_existing_time_record'?originalStart:null,originalEnd:resolution==='adjust_existing_time_record'?originalStop:null}));
          if (canonicalStart === null || canonicalStop === null) {
            setTimeError('Die Uhrzeit ist wegen der Zeitumstellung ungültig oder nicht eindeutig. Ihre Eingaben bleiben erhalten; prüfen Sie Beginn und Ende.');
            return;
          }
        }
        setTimeError(null);
        administration.prepareAdjudication(
          item.reviewItemId,
          resolution,
          resolution === 'adjust_existing_time_record' ? recordId : null,
          canonicalStart,
          canonicalStop,
          reason,
        );
      }}>
        {resolution === 'adjust_existing_time_record' ? <>
          <div><p>Monat der Arbeitszeit</p><MonthSwitch label="Monat der Arbeitszeit" value={month} {...monthRange()}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={month=>{setMonth(month);setRecordId('');setDate('');setStartedAt('');setStoppedAt('');loadRecords(month);}}/></div>
          <p className="supporting">Arbeitszeiten von {item.employeeDisplayName}</p>
          {selection?.status==='loading' ? <p role="status">Arbeitszeiten werden geladen …</p> : null}
          {selection?.status==='unavailable' ? <div role="alert"><p>{selection.message}</p><button type="button" className="secondary" onClick={()=>loadRecords(month,selection.records.length>0)}>Erneut laden</button></div> : null}
          {selection?.status==='ready' && records.length===0 ? <p>Keine abgeschlossenen Arbeitszeiten in diesem Monat.</p> : null}
          <label>Bestehende Arbeitszeit
          <select required value={recordId}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => {
              const id = event.target.value;
              const selected = records.find((record) => record.timeRecordId === id);
              setRecordId(id);
              setOriginalStart(selected?.startedAt??null);
              setOriginalStop(selected?.stoppedAt??null);
              setDate(selected === undefined ? '' : toZonedMinuteInput(selected.startedAt).slice(0,10));
              setStartedAt(selected === undefined ? '' : toZonedMinuteInput(selected.startedAt).slice(11));
              setStoppedAt(selected?.stoppedAt == null ? '' : toZonedMinuteInput(selected.stoppedAt).slice(11));
            }}>
            <option value="">Arbeitszeit auswählen</option>
            {records.map((record) =>
              <option key={record.timeRecordId} value={record.timeRecordId}>
                {record.employeeDisplayName} · {format(record.startedAt)}
              </option>)}
          </select>
        </label>
          {selection?.nextCursor ? <button type="button" className="secondary"
            disabled={selection.status==='loading' || state.timeReviewBusy || state.adjudicationIntent !== null}
            onClick={()=>loadRecords(month,true)}>Weitere Arbeitszeiten laden</button> : null}
        </> : null}
        {resolution === 'no_time_record_change' ? null : <>
          {timeError === null ? null : <p id={`review-time-error-${item.reviewItemId}`}
            className="field-error" role="alert">{timeError}</p>}
          <TimeFields date={date} start={startedAt} end={stoppedAt} originalStart={resolution==='adjust_existing_time_record'?originalStart:null} originalEnd={resolution==='adjust_existing_time_record'?originalStop:null}
            onDate={setDate} onStart={setStartedAt} onEnd={setStoppedAt} checkInterval
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}/>
        </>}
        <label className="full-field">Begründung
          <textarea ref={reasonInput} required maxLength={500} value={reason}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setReason(event.target.value)} />
        </label>
        <button ref={prepareButton} disabled={day?.status!=='ready' || state.timeReviewBusy || state.adjudicationIntent !== null}>
          Änderung prüfen
        </button>
      </RequiredForm>
      {state.adjudicationIntent?.reviewItem.reviewItemId !== item.reviewItemId ? null : <Confirmation
        label="Entscheidung ausdrücklich bestätigen"
        title="Entscheidung speichern?"
        confirmLabel={state.adjudicationIntent.resolution==='no_time_record_change' ? 'Abschluss bestätigen' : 'Änderung bestätigen'}
        busyLabel="Wird protokolliert …"
        busy={state.timeReviewBusy}
        onConfirm={() => void administration.confirmAdjudication()}
        onCancel={() => {
          administration.cancelAdjudication();
          returnFocus(prepareButton, prepareButton);
        }}
      >
        <dl>
          <dt>Prüffall</dt><dd>{item.employeeDisplayName} · {format(state.adjudicationIntent.reviewItem.occurredAt)}</dd>
          <dt>Entscheidung</dt><dd>{resolutionLabel(state.adjudicationIntent.resolution)}</dd>
          {state.adjudicationIntent.timeRecord === null ? null : <>
            <dt>Vorher</dt><dd>{formatExact(state.adjudicationIntent.timeRecord.startedAt)} – {formatExact(state.adjudicationIntent.timeRecord.stoppedAt!)}</dd>
          </>}
          {state.adjudicationIntent.startedAt === null ? null : <>
            <dt>Nachher</dt><dd>{formatExact(state.adjudicationIntent.startedAt)} – {formatExact(state.adjudicationIntent.stoppedAt!)}</dd>
          </>}
          <dt>Begründung</dt><dd className="verbatim-reason">{state.adjudicationIntent.reason}</dd>
        </dl>
      </Confirmation>}

    <button className="quiet" disabled={state.timeReviewBusy} onClick={()=>{administration.cancelAdjudication();setOpen(false);rowTrigger.current?.focus();}}>Entscheidung schließen</button>
  </div> : null}</li>;
}
