import { TimeRecordControls } from '../TimeEditingControls';
import { BUSINESS_TIME_ZONE } from '@taptime/core';
import {
	useEffect,
	useRef,
	useState
} from 'react';
import type {
	AdminWebCapability
} from '../contracts';
import {
	canonicalRoutePath,
	defaultRoute,
	monthLabel,
	type AdminRoute
} from '../navigation';
import {
	formatExactZonedDateTime,
	formatZonedDateTime,
	parseZonedLocalTimestamp,
	toZonedLocalInput,
} from '../timeZone';
import { Confirmation,CountTruth,Panel,SectionBoundary } from '../ui';
import { captureLabel,navigateFromLink,returnFocus,targetLabel,useIntentFocusReturn } from '../viewHelpers';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
export default function TimeRecordsView({
  state,
  administration,
  route,
  navigate,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly route: AdminRoute;
  readonly navigate: (route: AdminRoute) => void;
}) {
  const [exportVersion,setExportVersion]=useState<3|4>(4);
  const [recordId, setRecordId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [stoppedAt, setStoppedAt] = useState('');
  const [reason, setReason] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [month, setMonth] = useState(route.month ?? '');
  const [statusFilter, setStatusFilter] = useState(route.status);
  const [captureType, setCaptureType] = useState(route.captureType);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const recordSelect = useRef<HTMLSelectElement>(null);
  const sectionRetryButton = useRef<HTMLButtonElement>(null);
  useIntentFocusReturn(
    state.correctionIntent !== null,
    prepareButton,
    recordSelect,
    sectionRetryButton,
  );
  useEffect(() => {
    setMonth(route.month ?? '');
    setStatusFilter(route.status);
    setCaptureType(route.captureType);
  }, [route.captureType, route.month, route.status]);
  const format = formatZonedDateTime;
  const formatExact = formatExactZonedDateTime;
  const exportAction=state.availableSections.includes('time_export') ? <div className="export-options"><label>CSV-Fassung<select value={exportVersion} disabled={state.timeReviewBusy} onChange={e=>setExportVersion(Number(e.target.value) as 3|4)}><option value={4}>v4 · Herkunft und Kommentar</option><option value={3}>v3 · Bisheriges Format</option></select></label><button className="header-primary"
    disabled={state.timeReviewBusy} aria-busy={state.timeReviewBusy}
    onClick={()=>void administration.exportTimeRecords(exportVersion)}>CSV herunterladen</button></div> : null;
  if (!state.availableSections.includes('time_records')) {
    return <Panel title="Arbeitszeiten herunterladen"
      description="Die vollständige CSV-Datei steht für die Lohnbuchhaltung bereit.">
      {exportAction}
    </Panel>;
  }
  const visibleRecords = state.timeRecords.filter((record) => {
    const statusMatches = route.status === 'alle'
      || (route.status === 'laufend' && record.status === 'started')
      || (route.status === 'abgeschlossen' && record.status === 'stopped');
    const captureMatches = route.captureType === 'alle'
      || (route.captureType === 'gescannt'
        && (record.startedVia === 'nfc' || record.stoppedVia === 'nfc'))
      || (route.captureType === 'manuell-erfasst'
        && (record.startedVia === 'manual' || record.stoppedVia === 'manual'));
    return statusMatches && captureMatches;
  });
  const hasFilters = route.month !== null
    || route.status !== 'alle'
    || route.captureType !== 'alle';
  return <SectionBoundary state={state.sections.timeRecords} retryButtonRef={sectionRetryButton}
    onRetry={() => void administration.retrySection('timeRecords')}>
    <Panel title="Arbeitszeiten"
      description={`Zeitraum: ${format(state.timeWindow.fromInclusive)} bis ${format(state.timeWindow.toExclusive)}.`}>
      <form className="filter-form" onSubmit={(event) => {
        event.preventDefault();

      }}>
        <label>Monat
          <input type="month" value={month} min="2000-01" max="2200-12"
            onChange={(event) => navigate({...route,month:event.target.value || null})} />
        </label>
        <label>Status
          <select value={statusFilter}
            onChange={(event) => navigate({...route,status:event.target.value as typeof statusFilter})}>
            <option value="alle">Alle</option>
            <option value="laufend">Laufend</option>
            <option value="abgeschlossen">Abgeschlossen</option>
          </select>
        </label>
        <label>Erfassungsart
          <select value={captureType}
            onChange={(event) => navigate({...route,captureType:event.target.value as typeof captureType})}>
            <option value="alle">Alle</option>
            <option value="gescannt">Gescannt</option>
            <option value="manuell-erfasst">Manuell erfasst</option>
          </select>
        </label>
      </form>
      {hasFilters ? <div className="filter-summary" aria-label="Aktive Filter">
        <div className="filter-chips">
          {route.month === null ? null : <span className="filter-chip">
            Monat {monthLabel(route.month)} <strong>{visibleRecords.length}</strong>
          </span>}
          {route.status === 'alle' ? null : <span className="filter-chip">
            {route.status === 'laufend' ? 'Laufend' : 'Abgeschlossen'}
            {' '}<strong>{visibleRecords.length}</strong>
          </span>}
          {route.captureType === 'alle' ? null : <span className="filter-chip">
            {route.captureType === 'gescannt' ? 'Gescannt' : 'Manuell erfasst'}
            {' '}<strong>{visibleRecords.length}</strong>
          </span>}
        </div>
        <button className="text-button" onClick={() => navigate(
          defaultRoute('lohnexport', route.locationId),
        )}>
          Alle zurücksetzen
        </button>
      </div> : null}
      <div className="toolbar">
        <CountTruth count={visibleRecords.length} noun="Arbeitszeiten"
          complete={state.timeRecordsNextCursor === null} />
        {exportAction}
      </div>
      <div className="table-scroll" role="region" tabIndex={0} aria-label="Geladene Arbeitszeiten">
        <table>
          <thead><tr><th>Beschäftigte</th><th>Arbeitsziel</th><th>Zeitraum</th><th>Erfassungsart</th><th>Herkunft</th><th>Korrekturstand</th><th>Status</th></tr></thead>
          <tbody>{visibleRecords.map((record) => <tr key={record.timeRecordId}>
            <td data-label="Beschäftigte">{record.employeeDisplayName}</td><td data-label="Arbeitsziel">{targetLabel(record.targetType)} · {record.targetDisplayName}</td>
            <td data-label="Zeitraum">{format(record.startedAt)} – {record.stoppedAt === null ? 'läuft' : format(record.stoppedAt)}</td>
            <td data-label="Erfassungsart">{captureLabel(record.startedVia, record.stoppedVia)}</td>
            <td data-label="Herkunft">{record.details ? {nfc:'gescannt',manual:'manuell',backfilled:'nachgetragen',recovered:'wiederhergestellt'}[record.details.origin] : record.source === 'canonical' ? 'Regulär' : 'Wiederhergestellt'}</td>
            <td data-label="Korrekturstand">{record.effectiveRevisionNumber}<TimeRecordControls record={record}/></td>
            <td data-label="Status">{record.status === 'started' ? 'Läuft' : 'Abgeschlossen'}
              {record.overlapsAnotherRecord ? ' · Überschneidung' : ''}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {visibleRecords.length === 0 && state.timeRecordsNextCursor === null && hasFilters
        ? <div className="empty filter-empty">
            <strong>Keine Arbeitszeiten in dieser Auswahl</strong>
            <p>Für den gewählten Zeitraum und die aktiven Filter wurden keine Arbeitszeiten gefunden.</p>
            <button className="secondary" onClick={() => navigate(
              defaultRoute('lohnexport', route.locationId),
            )}>
              Filter zurücksetzen
            </button>
          </div>
        : null}
      {visibleRecords.length === 0 && state.timeRecordsNextCursor === null && !hasFilters
        ? <div className="empty first-list-empty">
            <strong>Noch keine Arbeitszeiten</strong>
            <p>Sobald Beschäftigte ein Arbeitsziel auslösen, erscheinen ihre Arbeitszeiten hier.</p>
            <a className="button-link secondary-link"
              href={canonicalRoutePath(defaultRoute('einrichtung', route.locationId))}
              onClick={(event) => navigateFromLink(
                event,
                defaultRoute('einrichtung', route.locationId),
                navigate,
              )}>
              Arbeitsziel einrichten
            </a>
          </div>
        : null}
      {state.timeRecordsNextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreTimeRecords()}>
            Weitere Arbeitszeiten laden
          </button>}
    </Panel>
    <Panel title="Abgeschlossene Arbeitszeit korrigieren"
      description={`Eingaben werden in ${BUSINESS_TIME_ZONE} gelesen; gespeichert wird in UTC.`}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const canonicalStart = parseZonedLocalTimestamp(startedAt);
        const canonicalStop = parseZonedLocalTimestamp(stoppedAt);
        if (canonicalStart === null || canonicalStop === null) {
          setTimeError('Die Zeitangaben können nicht verwendet werden. Mindestens ein lokaler Zeitpunkt existiert nicht oder ist wegen der Zeitumstellung mehrdeutig. Prüfen Sie Beginn und Ende; Ihre Eingaben bleiben erhalten.');
          return;
        }
        setTimeError(null);
        administration.prepareCorrection(recordId, canonicalStart, canonicalStop, reason);
      }}>
        <label>Arbeitszeit
          <select ref={recordSelect} required value={recordId}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
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
                {record.employeeDisplayName} · {targetLabel(record.targetType)} · {record.targetDisplayName} · {format(record.startedAt)}
              </option>)}
          </select>
        </label>
        {timeError === null ? null : <p id="correction-time-error"
          className="field-error" role="alert">{timeError}</p>}
        <label>Neuer Beginn
          <input required type="datetime-local" step="0.001" value={startedAt}
            aria-describedby={timeError === null ? undefined : 'correction-time-error'}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => setStartedAt(event.target.value)} />
        </label>
        <label>Neues Ende
          <input required type="datetime-local" step="0.001" value={stoppedAt}
            aria-describedby={timeError === null ? undefined : 'correction-time-error'}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => setStoppedAt(event.target.value)} />
        </label>
        <label className="full-field">Begründung
          <textarea required maxLength={500} value={reason}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => setReason(event.target.value)} />
        </label>
        <button ref={prepareButton} disabled={state.timeReviewBusy || state.correctionIntent !== null}>
          Korrektur prüfen
        </button>
      </form>
      {state.correctionIntent === null ? null : <Confirmation
        label="Korrektur ausdrücklich bestätigen"
        title="Korrektur lückenlos protokollieren?"
        confirmLabel="Korrektur ausdrücklich bestätigen"
        busyLabel="Wird protokolliert …"
        busy={state.timeReviewBusy}
        onConfirm={() => void administration.confirmCorrection()}
        onCancel={() => {
          administration.cancelCorrection();
          returnFocus(prepareButton, recordSelect);
        }}
      >
        <dl>
          <dt>Vorher</dt><dd>{formatExact(state.correctionIntent.timeRecord.startedAt)} – {formatExact(state.correctionIntent.timeRecord.stoppedAt!)}</dd>
          <dt>Nachher</dt><dd>{formatExact(state.correctionIntent.startedAt)} – {formatExact(state.correctionIntent.stoppedAt)}</dd>
          <dt>Begründung</dt><dd className="verbatim-reason">{state.correctionIntent.reason}</dd>
        </dl>
      </Confirmation>}
    </Panel>
  </SectionBoundary>;
}
