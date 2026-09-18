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
	formatExactZonedDateTime,
	formatZonedDateTime,
	parseZonedLocalTimestamp,
	toZonedLocalInput,
} from '../timeZone';
import { Confirmation,CountTruth,Panel,SectionBoundary } from '../ui';
import { resolutionLabel,returnFocus,reviewReasonLabel,triggerLabel,useIntentFocusReturn } from '../viewHelpers';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function ReviewsView({state,administration}: {readonly state:ReadyState;readonly administration:AdminWebCapability}) {
  const retry=useRef<HTMLButtonElement>(null);
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
  return <section ref={focusFallback} tabIndex={-1} aria-label="Prüfungen"><SectionBoundary state={state.sections.reviewItems} retryButtonRef={retry} onRetry={()=>void administration.retrySection('reviewItems')}>
    <Panel title="Offene Prüfungen" description="Jede Entscheidung bleibt mit Begründung erhalten. Originale werden nie überschrieben.">
      <CountTruth count={state.reviewItems.length} noun="Prüfungen" complete={state.reviewItemsNextCursor === null}/>
      <ul className="review-list">{state.reviewItems.map(item=><ReviewDecisionRow key={item.reviewItemId}
        item={item} state={state} administration={administration}/>)}</ul>
      {state.reviewItems.length === 0 && state.reviewItemsNextCursor === null ? <p className="empty">Keine offenen Prüfungen.</p> : null}
      {state.reviewItemsNextCursor === null ? null : <button className="secondary" onClick={()=>void administration.loadMoreReviewItems()}>Weitere Prüfungen laden</button>}
    </Panel>
  </SectionBoundary></section>;
}
function ReviewDecisionRow({item,state,administration}: {readonly item:SafeReviewItem;readonly state:ReadyState;readonly administration:AdminWebCapability}) {
  const [open,setOpen]=useState(state.adjudicationIntent?.reviewItem.reviewItemId === item.reviewItemId);
  const [resolution,setResolution]=useState<'no_time_record_change'|'adjust_existing_time_record'|'create_recovered_time_record'>('no_time_record_change');
  const [recordId,setRecordId]=useState('');
  const [startedAt,setStartedAt]=useState('');
  const [stoppedAt,setStoppedAt]=useState('');
  const [reason,setReason]=useState('');
  const [timeError,setTimeError]=useState<string|null>(null);
  const prepareButton=useRef<HTMLButtonElement>(null);
  const rowTrigger=useRef<HTMLButtonElement>(null);
  const reasonInput=useRef<HTMLTextAreaElement>(null);
  useIntentFocusReturn(state.adjudicationIntent?.reviewItem.reviewItemId === item.reviewItemId,prepareButton,rowTrigger);
  useEffect(()=>{ if(open) reasonInput.current?.focus(); },[open]);
  const format=formatZonedDateTime;
  const formatExact=formatExactZonedDateTime;
  const choose=(event:ReactMouseEvent<HTMLButtonElement>,next:typeof resolution)=>{
    rowTrigger.current=event.currentTarget;setResolution(next);setOpen(true);
  };
  return <li className="review-case"><div className="review-case-heading"><div>
    <strong>{item.employeeDisplayName} · {item.targetDisplayName}</strong>
    <p className="supporting">{format(item.occurredAt)} · {triggerLabel(item.triggerType)}</p>
    <p className="review-reason">{reviewReasonLabel(item.reviewReason)}{item.predecessorBlocked ? ' · Vorgänger blockiert' : ''}</p>
  </div><div className="entity-actions">
    <button disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onClick={event=>choose(event,'create_recovered_time_record')}>Freigeben</button>
    <button className="secondary" disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onClick={event=>choose(event,'adjust_existing_time_record')}>Korrigieren</button>
    <button className="quiet" disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onClick={event=>choose(event,'no_time_record_change')}>Ablehnen</button>
  </div></div>
  {open ? <div className="row-decision">
    <p className="supporting">{resolutionLabel(resolution)}. Bitte begründen Sie Ihre Entscheidung.</p>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        let canonicalStart: string | null = null;
        let canonicalStop: string | null = null;
        if (resolution !== 'no_time_record_change') {
          canonicalStart = parseZonedLocalTimestamp(startedAt);
          canonicalStop = parseZonedLocalTimestamp(stoppedAt);
          if (canonicalStart === null || canonicalStop === null) {
            setTimeError('Die Zeitangaben können nicht verwendet werden. Mindestens ein lokaler Zeitpunkt existiert nicht oder ist wegen der Zeitumstellung mehrdeutig. Prüfen Sie Beginn und Ende; Ihre Eingaben bleiben erhalten.');
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
        <label>Entscheidung
          <select value={resolution}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setResolution(event.target.value as typeof resolution)}>
            <option value="no_time_record_change">Keine Arbeitszeit ändern</option>
            <option value="create_recovered_time_record">Arbeitszeit wiederherstellen</option>
            <option value="adjust_existing_time_record">Bestehende Arbeitszeit korrigieren</option>
          </select>
        </label>
        {resolution === 'adjust_existing_time_record' ? <label>Bestehende Arbeitszeit
          <select required value={recordId}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => {
              const id = event.target.value;
              const selected = state.timeRecords.find((record) => record.timeRecordId === id);
              setRecordId(id);
              setStartedAt(selected === undefined ? '' : toZonedLocalInput(selected.startedAt));
              setStoppedAt(selected?.stoppedAt == null ? '' : toZonedLocalInput(selected.stoppedAt));
            }}>
            <option value="">Arbeitszeit auswählen</option>
            {state.timeRecords.filter((record) => record.status === 'stopped').map((record) =>
              <option key={record.timeRecordId} value={record.timeRecordId}>
                {record.employeeDisplayName} · {format(record.startedAt)}
              </option>)}
          </select>
        </label> : null}
        {resolution === 'no_time_record_change' ? null : <>
          {timeError === null ? null : <p id={`review-time-error-${item.reviewItemId}`}
            className="field-error" role="alert">{timeError}</p>}
          <label>Beginn
            <input required type="datetime-local" step="0.001" value={startedAt}
              aria-describedby={timeError === null ? undefined : `review-time-error-${item.reviewItemId}`}
              disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
              onChange={(event) => setStartedAt(event.target.value)} />
          </label>
          <label>Ende
            <input required type="datetime-local" step="0.001" value={stoppedAt}
              aria-describedby={timeError === null ? undefined : `review-time-error-${item.reviewItemId}`}
              disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
              onChange={(event) => setStoppedAt(event.target.value)} />
          </label>
        </>}
        <label className="full-field">Begründung
          <textarea ref={reasonInput} required maxLength={500} value={reason}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setReason(event.target.value)} />
        </label>
        <button ref={prepareButton} disabled={state.timeReviewBusy || state.adjudicationIntent !== null}>
          Entscheidung prüfen
        </button>
      </form>
      {state.adjudicationIntent?.reviewItem.reviewItemId !== item.reviewItemId ? null : <Confirmation
        label="Entscheidung ausdrücklich bestätigen"
        title="Entscheidung lückenlos protokollieren?"
        confirmLabel="Entscheidung protokollieren"
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
