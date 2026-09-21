import type { TimeEditInput,TimeEditResult } from './timeEditing';
import { isBackfillTimeRequest,isCommentTimeRequest } from '@taptime/mobile-work-contract';
import type { ManualBreakLifecycleRequest,ManualLifecycleRequest,MobileOwnTimeQueryResponse,SafeWorkTarget } from '@taptime/mobile-work-contract';
import { TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS } from '@taptime/time-entry-export-contract';
import { isValidTimeReviewReason } from '@taptime/time-review-contract';
import {
	AdminWebApiClient,
	type AdminWebApiPort,
	type ApiResult,
	type Session,
} from './AdminWebApiClient';
import type {
	AdministrationLocation,
	AdministrationSection,
	AdminSection,
	AdminWebCapability,
	AdminWebState,
	CursorPage,
	LocationSetupState,
	ReviewAdjudicationIntent,
	SafeEmployeeProjection,
	SafeProjection,
	SafeReviewItem,
	SafeTimeRecord,
	VolatileInvitationSecret,
} from './contracts';
import { isSafeEmployeeProjectionPage } from './employeeProjectionSafety';
import { manualResultMessage } from './manualCapture';
import { monthTimeWindow } from './navigation';

// T-040: the sign-in adapter names the cause; the coordinator never guesses "wrong password".
export type AdminWebSignInOutcome =
  | 'signed_in'
  | 'credentials_rejected'
  | 'email_not_confirmed'
  | 'access_blocked'
  | 'rate_limited'
  | 'service_unavailable';

export const SIGN_IN_FAILURE_NOTICES: Readonly<Record<
  Exclude<AdminWebSignInOutcome, 'signed_in'>, string
>> = Object.freeze({
  credentials_rejected:
    'Die Anmeldung war nicht erfolgreich. E-Mail-Adresse oder Passwort stimmen nicht. '
    + 'Prüfen Sie die Eingaben und versuchen Sie es erneut.',
  email_not_confirmed:
    'Diese E-Mail-Adresse ist noch nicht bestätigt. Öffnen Sie die Bestätigungsmail und folgen '
    + 'Sie dem Link, bevor Sie sich anmelden.',
  access_blocked:
    'Dieser Zugang ist gesperrt. Wenden Sie sich an die Betriebsverwaltung.',
  rate_limited:
    'Zu viele Anmeldeversuche in kurzer Zeit. Warten Sie eine Minute und versuchen Sie es dann erneut.',
  service_unavailable:
    'Der Anmeldedienst ist gerade nicht erreichbar. Ihre Eingaben wurden nicht geprüft. Versuchen '
    + 'Sie es in ein paar Minuten erneut. Bleibt die Meldung bestehen, wenden Sie sich an die '
    + 'Betriebsverwaltung.',
});

export interface AdminWebAuthPort {
  signIn(email: string, password: string): Promise<AdminWebSignInOutcome>;
  withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null>;
  signOut(): Promise<void>;
  requestPasswordReset?(email: string): Promise<boolean>;
  updateRecoveredPassword?(password: string): Promise<boolean>;
  subscribePasswordRecovery?(listener: () => void): () => void;
}

type ApiFailureStatus = 'unreachable' | 'invalid_response';

type ApiSectionResult<Value> =
  | { readonly status: 'succeeded'; readonly value: Value }
  | { readonly status: 'unreachable' }
  | { readonly status: 'invalid_response' }
  | { readonly status: 'closed' };

type ReadyDataResult =
  | {
      readonly status: 'succeeded' | 'partial';
      readonly projection: ApiSectionResult<SafeProjection>;
      readonly employeeProjection: ApiSectionResult<SafeEmployeeProjection>;
      readonly timeRecords: ApiSectionResult<CursorPage<SafeTimeRecord>>;
      readonly reviewItems: ApiSectionResult<CursorPage<SafeReviewItem>>;
      readonly timeWindow: { readonly fromInclusive: string; readonly toExclusive: string };
    }
  | { readonly status: 'rejected' }
  | { readonly status: 'location_scope_forbidden' };

export class AdminWebCoordinator implements AdminWebCapability {
  private state: AdminWebState = Object.freeze({ status: 'signed_out' });
  private membershipId: string | null = null;
  private session: Session | null = null;
  private requestedLocationId: string | null = null;
  private generation = 0;
  private peopleEpoch = 0;
  private calendarEpoch = 0;
  private targetsEpoch = 0;
  // Volatile, session-bound retry identity. A lost acknowledgement can follow a committed event.
  private pendingManual: {generation:number;request:ManualLifecycleRequest | ManualBreakLifecycleRequest} | null = null;
  private pendingTimeEdit: {generation:number;key:string;commandId:string} | null = null;
  private refreshEpoch = 0;
  private timeWindowPinned = false;
  private readonly sectionEpochs: Record<AdminSection, number> = {
    setup: 0,
    employees: 0,
    timeRecords: 0,
    reviewItems: 0,
  };
  private authenticationQueue: Promise<void> = Promise.resolve();
  private invitationExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private invitationDisclosureEpoch = 0;
  private readonly invitationDisclosureEpochs = new WeakMap<VolatileInvitationSecret, number>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly auth: AdminWebAuthPort,
    private readonly api: AdminWebApiPort = new AdminWebApiClient(),
    private readonly now: () => number = () => Date.now(),
  ) {
    this.auth.subscribePasswordRecovery?.(() => {
      this.generation += 1;
      this.refreshEpoch += 1;
      this.membershipId = null;
      this.session = null;
    this.pendingManual = null;
      this.clearInvitationExpiryTimer();
      this.setState({ status: 'password_recovery', completing: false, notice: null });
    });
  }

  getState(): AdminWebState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async saveTimeEdit(input: TimeEditInput): Promise<TimeEditResult> {
    const current=this.state,session=this.session,generation=this.generation;
    const calendarEpoch=this.calendarEpoch;
    if(current.status!=='ready' || !session || session.role==='standortleitung') return {status:'authority_rejected'};
    if(current.timeEditBusy) return {status:'busy'};
    if(typeof navigator!=='undefined' && navigator.onLine===false) return {status:'offline'};
    const calendar=current.calendar;
    if(calendar?.status!=='ready' || (calendar.targetMembershipId??session.membershipId)!==input.targetMembershipId
      || (session.role==='employee' && input.targetMembershipId!==session.membershipId)
      || (input.kind==='comment' && input.targetMembershipId!==session.membershipId)
      || (input.kind==='correct' && session.role!=='administrator')) return {status:'authority_rejected'};
    if(input.kind!=='backfill' && ![...calendar.value.records,...(calendar.value.activeRecord?[calendar.value.activeRecord]:[])]
      .some(r=>r.timeRecordId===input.record.timeRecordId)) return {status:'authority_rejected'};
    if(input.kind==='correct' && (input.record.status!=='stopped' || !input.record.details)) return {status:'not_adjustable'};
    if(input.kind==='correct' && !isValidTimeReviewReason(input.reason)) return {status:'invalid_request'};
    const key=JSON.stringify(input);
    if(this.pendingTimeEdit?.generation!==generation || this.pendingTimeEdit.key!==key)
      this.pendingTimeEdit={generation,key,commandId:crypto.randomUUID()};
    const commandId=this.pendingTimeEdit.commandId;
    this.setState({...current,timeEditBusy:true,notice:null});
    let outcome:TimeEditResult={status:'unavailable'};
    try {
      if(input.kind==='correct') {
        const record:SafeTimeRecord={...input.record,employeeDisplayName:'',...input.record.details!};
        const result=await this.auth.withAccessToken(token=>this.api.correctTimeRecord(token,session.membershipId,
          commandId,record,input.startedAt,input.stoppedAt,input.reason));
        if(result?.status==='succeeded') outcome={status:'committed',timeRecordId:input.record.timeRecordId,idempotentRetry:false};
        else if(result===null || result.status==='rejected') outcome={status:'authority_rejected'};
        else if(result.status==='conflict') outcome={status:result.code==='not_adjustable'?'not_adjustable':result.code==='command_id_conflict'?'command_id_conflict':'conflict'};
      } else {
        const request=input.kind==='backfill'?{expectedMembershipId:session.membershipId,commandId,targetMembershipId:input.targetMembershipId,
          targetType:input.target.targetType,targetId:input.target.targetId,startedAt:input.startedAt,stoppedAt:input.stoppedAt,reason:input.reason,comment:input.comment}
          :{expectedMembershipId:session.membershipId,commandId,timeRecordId:input.record.timeRecordId,comment:input.comment};
        if(!(input.kind==='backfill'?isBackfillTimeRequest(request):isCommentTimeRequest(request))) outcome={status:'invalid_request'};
        else {
          const result=await this.auth.withAccessToken(token=>this.api.supplementTime?.(token,input.kind as 'backfill'|'comment',request)??Promise.resolve({status:'unreachable' as const}));
          if(result?.status==='succeeded') outcome=result.value;
          else if(result===null || result.status==='rejected') outcome={status:'authority_rejected'};
        }
      }
    } catch { outcome={status:'unavailable'}; }
    if(generation!==this.generation || this.state.status!=='ready') return {status:'authority_rejected'};
    this.setState({...this.state,timeEditBusy:false});
    if(outcome.status==='committed') {
      this.pendingTimeEdit=null;
      if(calendarEpoch!==this.calendarEpoch) return outcome;
      this.setState({...this.state as Extract<AdminWebState,{status:'ready'}>,notice:'Gespeichert.'});
      if(this.state.status==='ready' && this.state.calendar?.targetMembershipId===calendar.targetMembershipId
        && this.state.calendar.month===calendar.month) {
        if(calendar.targetMembershipId===null) await this.loadOwnTime(calendar.month);
        else await this.loadPersonTime(calendar.targetMembershipId,calendar.month);
      }
    }
    return outcome;
  }

  async loadOwnTime(month: string): Promise<void> {
    const current=this.state, session=this.session;
    if (current.status !== 'ready' || session === null || !session.availableSections.includes('own_time') || monthTimeWindow(month) === null) return;
    const generation=this.generation, epoch=++this.calendarEpoch;
    this.setState({...current,calendar:{status:'loading',value:null,targetMembershipId:null,month}});
    let value: MobileOwnTimeQueryResponse | null = null;
    let cursor: string | null = null;
    const seen=new Set<string>();
    do {
      const result=await this.safeSectionRead(()=>this.auth.withAccessToken(token=>this.api.ownTime?.(token,
        {expectedMembershipId:session.membershipId,cursor,limit:20}) ?? Promise.resolve({status:'unreachable'})));
      if (generation !== this.generation || epoch !== this.calendarEpoch || this.state.status !== 'ready') return;
      if (result.status === 'rejected') { await this.rejectOutsideAuthentication(generation,'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.'); return; }
      if (result.status !== 'succeeded') break;
      const page=result.value;
      if ((value !== null && (page.windowStartedAt !== value.windowStartedAt || page.windowEndedAt !== value.windowEndedAt || !sameActiveRecord(page.activeRecord,value.activeRecord)))
        || (page.nextCursor !== null && (seen.has(page.nextCursor) || page.records.length === 0))) break;
      const records: MobileOwnTimeQueryResponse["records"]=[...(value?.records ?? []),...page.records];
      if (new Set(records.map(record=>record.timeRecordId)).size !== records.length) break;
      value={...page,records}; cursor=page.nextCursor;
      if (cursor !== null) seen.add(cursor);
      else {this.setState({...this.state,calendar:{status:'ready',value,targetMembershipId:null,month}});return;}
    } while (cursor !== null);
    if (this.state.status === 'ready') this.setState({...this.state,calendar:{status:'unavailable',value:null,targetMembershipId:null,month,
      message:'Ihre Zeiten konnten nicht vollständig bestätigt werden. Versuchen Sie es erneut.'}});
  }

  async loadWorkTargets(): Promise<void> {
    const current=this.state,session=this.session;
    if (current.status !== 'ready' || session === null || !session.availableSections.includes('manual_capture')) return;
    const generation=this.generation,epoch=++this.targetsEpoch;
    this.setState({...current,workTargets:{status:'loading',value:null}});
    let targets: SafeWorkTarget[]=[];
    let cursor:string|null=null;
    const seen=new Set<string>();
    do {
      const result=await this.safeSectionRead(()=>this.auth.withAccessToken(token=>this.api.workTargets?.(token,
        {expectedMembershipId:session.membershipId,cursor,limit:50}) ?? Promise.resolve({status:'unreachable'})));
      if (generation !== this.generation || epoch !== this.targetsEpoch || this.state.status !== 'ready') return;
      if (result.status === 'rejected') {await this.rejectOutsideAuthentication(generation,'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.');return;}
      if (result.status !== 'succeeded') break;
      const page=result.value;
      targets=[...targets,...page.targets];
      if (new Set(targets.map(target=>`${target.targetType}:${target.targetId}`)).size !== targets.length
        || (page.nextCursor !== null && (seen.has(page.nextCursor) || page.targets.length === 0))) break;
      cursor=page.nextCursor;
      if (cursor !== null) seen.add(cursor);
      else {this.setState({...this.state,workTargets:{status:'ready',value:targets}});return;}
    } while (cursor !== null);
    if (this.state.status === 'ready') this.setState({...this.state,workTargets:{status:'unavailable',value:null,
      message:'Die Arbeitsziele konnten nicht vollständig geladen werden.'}});
  }

  async captureManual(target: SafeWorkTarget | 'break'): Promise<void> {
    const current=this.state,session=this.session;
    if (current.status !== 'ready' || session === null || !session.availableSections.includes('manual_capture') || current.manual?.busy) return;
    const generation=this.generation;
    let pending=this.pendingManual?.generation === generation ? this.pendingManual : null;
    if (pending === null) {
      if (target !== 'break' && (current.workTargets?.status !== 'ready' || !current.workTargets.value.some(
        item=>item.targetId === target.targetId && item.targetType === target.targetType))) return;
      const workEvent=target === 'break' ? {id:crypto.randomUUID(),subject:{type:'break' as const}}
          : {id:crypto.randomUUID(),target:{targetType:target.targetType,targetId:target.targetId}};
      const request: ManualLifecycleRequest | ManualBreakLifecycleRequest = 'subject' in workEvent && workEvent.subject
        ? {expectedMembershipId:session.membershipId,workEvent:{id:workEvent.id,subject:workEvent.subject},receipt:{id:crypto.randomUUID(),attemptNumber:1}}
        : {expectedMembershipId:session.membershipId,workEvent:{id:workEvent.id,target:workEvent.target!},receipt:{id:crypto.randomUUID(),attemptNumber:1}};
      pending={generation,request};this.pendingManual=pending;
    }
    this.setState({...current,manual:{busy:true,pending:true,message:'Die Bestätigung wird vom Server angefordert.'}});
    const result=await this.safeSectionRead(()=>this.auth.withAccessToken(token=>this.api.manualLifecycle?.(token,pending!.request)
      ?? Promise.resolve({status:'unreachable'})));
    if (generation !== this.generation || this.state.status !== 'ready') return;
    if (result.status === 'rejected') {await this.rejectOutsideAuthentication(generation,'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.');return;}
    if (result.status !== 'succeeded') {
      this.setState({...this.state,manual:{busy:false,pending:true,message:'Die Bestätigung fehlt. Das Ereignis kann bereits gespeichert sein. Fragen Sie dieselbe Bestätigung erneut ab.'}});return;
    }
    const stillPending=result.value.status === 'deferred' && result.value.evidenceStored;
    if (!stillPending) this.pendingManual=null;
    this.setState({...this.state,manual:{busy:false,pending:stillPending,message:manualResultMessage(result.value)}});
  }

  async loadPersonTime(targetMembershipId: string, month: string): Promise<void> {
    const current = this.state;
    const session = this.session;
    const window = monthTimeWindow(month);
    if (current.status !== 'ready' || session === null || !session.availableSections.includes('employees') || window === null) return;
    const generation = this.generation;
    const epoch = ++this.calendarEpoch;
    const locationId = current.selectedLocation?.id ?? null;
    const toExclusive = new Date(Math.min(Date.parse(window.toExclusive), this.now())).toISOString();
    this.setState({...current,calendar:{status:'loading',value:null,targetMembershipId,month}});
    if (toExclusive <= window.fromInclusive) {
      this.setState({...this.state as typeof current,calendar:{status:'unavailable',value:null,targetMembershipId,month,
        message:'Für einen zukünftigen Monat liegen noch keine bestätigten Zeiten vor.'}});
      return;
    }
    let value: MobileOwnTimeQueryResponse | null = null;
    let cursor: string | null = null;
    const seen = new Set<string>();
    do {
      const result = await this.safeSectionRead(()=>this.auth.withAccessToken(token => this.api.managedPersonTime?.(token,
        {expectedMembershipId:session.membershipId,targetMembershipId,...window,toExclusive,cursor,limit:20})
        ?? Promise.resolve({status:'unreachable'})));
      if (generation !== this.generation || epoch !== this.calendarEpoch || this.state.status !== 'ready'
        || locationId !== (this.state.selectedLocation?.id ?? null)) return;
      if (result.status === 'rejected') {
        await this.rejectOutsideAuthentication(generation,'Ihre Berechtigung wurde nicht bestätigt. Melden Sie sich erneut an.');
        return;
      }
      if (result.status !== 'succeeded') break;
      const page = result.value;
      if ((value !== null && !sameActiveRecord(page.activeRecord,value.activeRecord))
        || page.windowStartedAt !== window.fromInclusive || page.windowEndedAt !== toExclusive
        || (page.nextCursor !== null && (seen.has(page.nextCursor) || page.records.length === 0))) break;
      const records: MobileOwnTimeQueryResponse["records"] = [...(value?.records ?? []), ...page.records];
      if (new Set(records.map(record=>record.timeRecordId)).size !== records.length) break;
      value={...page,records};
      cursor=page.nextCursor;
      if (cursor !== null) seen.add(cursor);
      else { this.setState({...this.state,calendar:{status:'ready',value,targetMembershipId,month}}); return; }
    } while (cursor !== null);
    if (this.state.status === 'ready') this.setState({...this.state,calendar:{status:'unavailable',value:null,targetMembershipId,month,
      message:'Die Zeiten konnten nicht vollständig bestätigt werden. Laden Sie den Monat erneut.'}});
  }

  async refreshManagedPeople(isRunning: boolean | null = null, append = false): Promise<void> {
    const current = this.state;
    const session = this.session;
    if (current.status !== 'ready' || session === null || !session.availableSections.includes('employees')) return;
    const previous = current.managedPeople;
    const cursor = append && previous?.status === 'ready' && previous.isRunning === isRunning
      ? previous.value.nextCursor : null;
    if (append && cursor === null) return;
    const generation = this.generation;
    const epoch = ++this.peopleEpoch;
    const locationId = current.selectedLocation?.id ?? null;
    this.setState({ ...current, managedPeople: { status: 'loading', value: null, isRunning } });
    const result = await this.safeSectionRead(() => this.auth.withAccessToken(token =>
      this.api.managedActiveSummary?.(token, {expectedMembershipId: session.membershipId,
        locationId, isRunning, cursor, limit: 20}) ?? Promise.resolve({status:'unreachable'})));
    if (generation !== this.generation || epoch !== this.peopleEpoch || this.state.status !== 'ready'
      || locationId !== (this.state.selectedLocation?.id ?? null)) return;
    if (result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Berechtigung wurde nicht bestätigt. Melden Sie sich erneut an.');
      return;
    }
    if (result.status === 'succeeded') {
      const people = append && previous?.status === 'ready'
        ? [...previous.value.people, ...result.value.people] : result.value.people;
      if (new Set(people.map(person=>person.membershipId)).size === people.length
        && (cursor === null || result.value.nextCursor !== cursor)
        && (result.value.nextCursor === null || result.value.people.length > 0)) {
        this.setState({...this.state,managedPeople:{status:'ready',isRunning,value:{...result.value,people}}});
        return;
      }
    }
    this.setState({...this.state,managedPeople:{status:'unavailable',value:null,isRunning,
      message:'Die Aktivübersicht konnte nicht bestätigt werden. Laden Sie sie erneut.'}});
  }

  async signIn(email: string, password: string): Promise<void> {
    const generation = ++this.generation;
    this.refreshEpoch += 1;
    this.membershipId = null;
    this.session = null;
    this.pendingManual = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signing_in' });
    await this.enqueueAuthentication(() => this.completeSignIn(generation, email, password));
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (this.state.status !== 'signed_out' || email.trim().length < 3) return;
    let accepted = false;
    try {
      accepted = await this.auth.requestPasswordReset?.(email.trim()) ?? false;
    } catch { /* surfaced as a generic availability result */ }
    this.setState(accepted
      ? { status: 'signed_out', notice: 'Falls das Konto existiert, wurde eine Wiederherstellungs-E-Mail versendet.' }
      : { status: 'signed_out', notice: 'Die Wiederherstellungs-E-Mail konnte nicht angefordert werden. Der Anmeldedienst ist derzeit nicht erreichbar. Versuchen Sie es später erneut.' });
  }

  async completePasswordRecovery(password: string): Promise<void> {
    if (this.state.status !== 'password_recovery' || password.length < 8) return;
    this.setState({ status: 'password_recovery', completing: true, notice: null });
    let changed = false;
    try {
      changed = await this.auth.updateRecoveredPassword?.(password) ?? false;
    } catch { /* surfaced without provider details */ }
    if (!changed) {
      this.setState({ status: 'password_recovery', completing: false,
        notice: 'Das Passwort konnte nicht geändert werden. Der Anmeldedienst hat die Änderung nicht bestätigt. Prüfen Sie das neue Passwort und versuchen Sie es erneut.' });
      return;
    }
    let recorded: ApiResult<true> | null = null;
    try {
      recorded = await this.auth.withAccessToken(
        (accessToken) => this.api.recordPasswordReset(accessToken),
      );
    } catch { /* fail closed until the reset has an audit trail */ }
    if (recorded?.status !== 'succeeded') {
      this.setState({ status: 'password_recovery', completing: false,
        notice: 'Das Passwort wurde geändert, der Abschluss konnte aber nicht protokolliert werden. Die sichere Bestätigung durch den Server fehlt. Bestätigen Sie die Änderung erneut.' });
      return;
    }
    await this.safeSignOut();
    this.setState({ status: 'signed_out', notice: 'Das Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.' });
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    this.refreshEpoch += 1;
    this.membershipId = null;
    this.session = null;
    this.pendingManual = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signed_out' });
    await this.enqueueAuthentication(() => this.safeSignOut());
  }

  async refresh(): Promise<void> {
    const membershipId = this.membershipId;
    const current = this.state;
    if (membershipId === null || current.status !== 'ready') return;
    const generation = this.generation;
    const refreshEpoch = ++this.refreshEpoch;
    for (const section of Object.keys(this.sectionEpochs) as AdminSection[]) {
      this.sectionEpochs[section] += 1;
    }
    this.setState({
      ...current,
      invitation: null,
      reassignmentIntent: null,
      correctionIntent: null,
      adjudicationIntent: null,
      sections: sectionStatesWithValue(current.availableSections, { status: 'loading' }),
      notice: null,
    });
    const session = this.session;
    if (session === null) return;
    const result = await this.loadReadyData(
      session,
      this.timeWindowPinned ? current.timeWindow : undefined,
      current.selectedLocation?.id ?? null,
    );
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    if (result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      return;
    }
    if (result.status === 'location_scope_forbidden') {
      this.setState({
        ...current,
        sections: {
          ...current.sections,
          employees: {
            status: 'unavailable',
            message: 'Der gewählte Standort gehört nicht mehr zu Ihrem Verwaltungsumfang. Wählen Sie einen der angezeigten Standorte.',
          },
        },
      });
      return;
    }
    const latest = this.state;
    if (latest.status !== 'ready') return;
    this.setState(mergeRefreshResult(latest, result));
    // Refresh every already-opened live view as well as the legacy administration projections.
    const opened=this.state;
    if(opened.status !== 'ready') return;
    await Promise.all([
      opened.managedPeople === undefined ? undefined : this.refreshManagedPeople(opened.managedPeople.isRunning),
      opened.calendar === undefined ? undefined : opened.calendar.targetMembershipId === null
        ? this.loadOwnTime(opened.calendar.month) : this.loadPersonTime(opened.calendar.targetMembershipId,opened.calendar.month),
      opened.workTargets === undefined ? undefined : this.loadWorkTargets(),
    ]);
  }

  async selectLocation(locationId: string | null): Promise<void> {
    this.requestedLocationId = locationId;
    const current = this.state;
    const membershipId = this.membershipId;
    const session = this.session;
    if (
      current.status !== 'ready'
      || membershipId === null
      || session === null
      || !session.locationsEnabled
      || session.managementScope.kind !== 'locations'
      || !session.availableSections.includes('employees')
    ) return;
    const targetId = locationId ?? session.managementScope.locations[0]?.id ?? null;
    if (targetId === null || targetId === current.selectedLocation?.id) return;
    this.peopleEpoch += 1;
    this.calendarEpoch += 1;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    const sectionEpoch = ++this.sectionEpochs.employees;
    this.setState({
      ...current,
      invitation: null,
      managedPeople: undefined,
      calendar: undefined,
      sections: { ...current.sections, employees: { status: 'loading' } },
      notice: null,
    });
    let result: ApiResult<SafeEmployeeProjection> | null;
    try {
      result = await this.auth.withAccessToken(
        (token) => this.api.employeeProjection(token, membershipId, null, targetId),
      );
    } catch {
      result = { status: 'unreachable' };
    }
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs.employees
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(
        generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
      );
      return;
    }
    if (result.status === 'conflict' && result.code === 'location_scope_forbidden') {
      this.setState({
        ...latest,
        sections: { ...latest.sections, employees: { status: 'ready' } },
        notice: 'Der angeforderte Standort gehört nicht zu Ihren Verwaltungsstandorten. Der bisherige Standort bleibt geöffnet.',
      });
      return;
    }
    const target = session.managementScope.locations.find((location) => location.id === targetId);
    if (
      result.status !== 'succeeded'
      || target === undefined
      || !sameOrganization(latest.projection.organization, result.value.organization)
    ) {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          employees: {
            status: 'unavailable',
            message: 'Der Standort konnte nicht geöffnet werden. Die Standortdaten sind derzeit nicht verfügbar. Der bisherige Standort bleibt geöffnet; versuchen Sie es erneut.',
          },
        },
      });
      return;
    }
    this.peopleEpoch += 1;
    this.calendarEpoch += 1;
    this.setState({
      ...latest,
      managedPeople: undefined,
      calendar: undefined,
      selectedLocation: target,
      employeeProjection: result.value,
      sections: { ...latest.sections, employees: { status: 'ready' } },
      notice: null,
    });
  }

  async setTimeWindow(
    fromInclusive: string,
    toExclusive: string,
    pinned = true,
  ): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('time_records')
      || !isBoundedTimeWindow(fromInclusive, toExclusive)
      || (
        current.timeWindow.fromInclusive === fromInclusive
        && current.timeWindow.toExclusive === toExclusive
      )
    ) return;
    this.timeWindowPinned = pinned;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    const sectionEpoch = ++this.sectionEpochs.timeRecords;
    const previousRecords = current.timeRecords;
    const previousCursor = current.timeRecordsNextCursor;
    this.setState({
      ...current,
      correctionIntent: null,
      timeReviewBusy: false,
      timeWindow: { fromInclusive, toExclusive },
      sections: { ...current.sections, timeRecords: { status: 'loading' } },
      notice: null,
    });
    const result = await this.loadSection(
      'timeRecords',
      membershipId,
      { fromInclusive, toExclusive },
    );
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs.timeRecords
    ) return;
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(
        generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
      );
      return;
    }
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result.status !== 'succeeded') {
      this.setState({
        ...latest,
        timeRecords: previousRecords,
        timeRecordsNextCursor: previousCursor,
        sections: {
          ...latest.sections,
          timeRecords: {
            status: 'unavailable',
            message: sectionUnavailableMessage('timeRecords', result.status),
          },
        },
      });
      return;
    }
    this.setState(applySectionResult(latest, 'timeRecords', result.value));
  }

  async retrySection(section: AdminSection): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !isAdminSectionAvailable(current.availableSections, section)
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    const sectionEpoch = ++this.sectionEpochs[section];
    this.setState({
      ...current,
      invitation: null,
      sections: { ...current.sections, [section]: { status: 'loading' } },
      notice: null,
    });
    const result = await this.loadSection(section, membershipId, current.timeWindow);
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs[section]
    ) return;
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      return;
    }
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result.status !== 'succeeded') {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          [section]: {
            status: 'unavailable',
            message: sectionUnavailableMessage(section, result.status),
          },
        },
      });
      return;
    }
    this.setState(applySectionResult(latest, section, result.value));
  }

  async loadMore(): Promise<void> {
    let current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('setup')
      || current.projection.nextCursor === null
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    const sectionEpoch = ++this.sectionEpochs.setup;
    const requestedCursor = current.projection.nextCursor;
    current = {
      ...current,
      invitation: null,
      reassignmentIntent: null,
      reassigning: false,
    };
    this.setState({
      ...current,
      sections: { ...current.sections, setup: { status: 'loading' } },
    });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.projection(token, membershipId, requestedCursor));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs.setup
    ) return;
    const latest = this.state;
    if (
      latest.status !== 'ready'
      || latest.projection.nextCursor !== requestedCursor
    ) return;
    if (result?.status === 'succeeded') {
      const merged = mergeProjection(latest.projection, result.value, requestedCursor);
      if (merged !== null) {
        this.setState({
          ...latest,
          projection: merged,
          creating: false,
          sections: { ...latest.sections, setup: { status: 'ready' } },
        });
      } else {
        this.setState({
          ...latest,
          sections: {
            ...latest.sections,
            setup: {
              status: 'unavailable',
              message: 'Weitere Einrichtungsdaten konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
            },
          },
        });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          setup: {
            status: 'unavailable',
            message: setupPageUnavailableMessage(apiFailureStatus(result), true),
          },
        },
      });
    }
  }

  async createCustomer(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('setup')
      || displayName.trim().length < 1
      || Array.from(displayName.normalize('NFC').trim()).length > 120
    ) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    this.setState({ ...current, creating: true, notice: null, completedAction: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createCustomer(token, membershipId, crypto.randomUUID(), displayName));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || requestRefreshEpoch !== this.refreshEpoch
    ) return;
    if (result?.status === 'succeeded') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation !== this.generation
        || followupRefreshEpoch !== this.refreshEpoch
      ) return;
      const next = this.state;
      if (next.status === 'ready') this.setState({
        ...next,
        notice: 'Kunde wurde sicher angelegt.',
        completedAction: 'customer_created',
      });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else {
      const latest = this.state;
      if (latest.status === 'ready') {
        this.setState({
          ...latest,
          creating: false,
          notice: 'Der Kunde konnte nicht angelegt werden. Der Server hat das Anlegen nicht bestätigt. Der eingegebene Name bleibt erhalten; versuchen Sie es erneut.',
        });
      }
    }
  }

  async refreshProjects(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('setup')
      || current.projectBusy === true
      || this.api.projects === undefined
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    this.setState({ ...current, projectBusy: true });
    let result;
    try {
      result = await this.auth.withAccessToken(
        (token) => this.api.projects!(token, membershipId, null),
      );
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      this.setState({
        ...latest,
        projects: Object.freeze([...result.value.items]),
        projectsNextCursor: result.value.nextCursor,
        projectBusy: false,
      });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(
        generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
      );
    } else {
      this.setState({
        ...latest,
        projectBusy: false,
        notice: 'Die Projekte konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Versuchen Sie es erneut.',
      });
    }
  }

  async loadMoreProjects(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    const requestedCursor = current.status === 'ready' ? current.projectsNextCursor : undefined;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('setup')
      || current.projectBusy === true
      || requestedCursor === undefined
      || requestedCursor === null
      || this.api.projects === undefined
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    this.setState({ ...current, projectBusy: true });
    let result;
    try {
      result = await this.auth.withAccessToken(
        (token) => this.api.projects!(token, membershipId, requestedCursor),
      );
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.projectsNextCursor !== requestedCursor) return;
    if (result?.status === 'succeeded') {
      const merged = mergeCursorPage(
        latest.projects ?? [],
        result.value,
        requestedCursor,
        'projectId',
      );
      this.setState(merged === null
        ? {
            ...latest,
            projectBusy: false,
            notice: 'Weitere Projekte konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie die Projekte erneut.',
          }
        : {
            ...latest,
            projects: merged.items,
            projectsNextCursor: merged.nextCursor,
            projectBusy: false,
          });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(
        generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
      );
    } else {
      this.setState({
        ...latest,
        projectBusy: false,
        notice: 'Weitere Projekte konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Versuchen Sie es erneut.',
      });
    }
  }

  async createProject(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    const normalized = displayName.normalize('NFC').trim();
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('setup')
      || current.projectBusy === true
      || normalized.length === 0
      || Array.from(normalized).length > 120
      || this.api.createProject === undefined
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    this.setState({ ...current, projectBusy: true, notice: null, completedAction: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createProject!(
        token,
        membershipId,
        crypto.randomUUID(),
        crypto.randomUUID(),
        normalized,
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      this.setState({ ...latest, projectBusy: false });
      await this.refreshProjects();
      const refreshed = this.state;
      if (refreshed.status === 'ready') {
        this.setState({
          ...refreshed,
          notice: 'Projekt wurde sicher angelegt.',
          completedAction: 'project_created',
        });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(
        generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
      );
    } else {
      this.setState({
        ...latest,
        projectBusy: false,
        notice: result.status === 'conflict'
          ? 'Das Projekt konnte nicht angelegt werden. Eine andere Anfrage hat denselben Vorgang bereits verändert. Laden Sie die Projekte neu und versuchen Sie es erneut.'
          : 'Das Projekt konnte nicht angelegt werden. Der Server hat den Vorgang nicht bestätigt. Der eingegebene Name bleibt erhalten; versuchen Sie es erneut.',
      });
    }
  }

  async deactivateProject(projectId: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    const project = current.status === 'ready'
      ? current.projects?.find((candidate) => candidate.projectId === projectId)
      : undefined;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('setup')
      || current.projectBusy === true
      || project === undefined
      || !project.active
      || this.api.deactivateProject === undefined
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    this.setState({ ...current, projectBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.deactivateProject!(
        token,
        membershipId,
        crypto.randomUUID(),
        project,
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      this.setState({ ...latest, projectBusy: false });
      await this.refreshProjects();
      const refreshed = this.state;
      if (refreshed.status === 'ready') {
        this.setState({ ...refreshed, notice: 'Projekt wurde deaktiviert.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(
        generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
      );
    } else {
      const notice = result.status === 'conflict' && result.code === 'project_in_use'
        ? 'Das Projekt konnte nicht deaktiviert werden. Darauf läuft noch eine Arbeitszeit. Beenden Sie diese Arbeitszeit und versuchen Sie es erneut.'
        : 'Das Projekt konnte nicht deaktiviert werden. Sein Status wurde zwischenzeitlich geändert. Laden Sie die Projekte neu und versuchen Sie es erneut.';
      this.setState({ ...latest, projectBusy: false, notice });
    }
  }

  async refreshLocationSetup(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null
      || (!this.session?.availableSections.includes('employees') && !this.session?.availableSections.includes('setup'))
      || this.api.assignableLocations === undefined || current.locationSetupBusy) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    this.setState({ ...current, locationSetupBusy: true });
    let result: {
      readonly locations: readonly AdministrationLocation[];
      readonly setup: LocationSetupState | null;
      readonly locationsEnabled: boolean;
    } | null = null;
    try {
      result = await this.auth.withAccessToken(async (token) => {
        const locations = await loadAllAssignableLocations(this.api, token, membershipId);
        if (locations === null) return null;
        if (current.managementScope.kind !== 'organization' || !this.session?.availableSections.includes('setup')) {
          return { locations, setup: null, locationsEnabled: current.locationsEnabled };
        }
        if (this.api.locationSetupPage === undefined) return null;
        const [locationPage, membershipPage, targetPage, gapPage] = await Promise.all([
          loadAllLocationSetupItems(this.api, token, membershipId, 'locations'),
          loadAllLocationSetupItems(this.api, token, membershipId, 'memberships'),
          loadAllLocationSetupItems(this.api, token, membershipId, 'work_targets'),
          loadAllLocationSetupItems(this.api, token, membershipId, 'activation_gaps'),
        ]);
        if (locationPage === null || membershipPage === null || targetPage === null
          || gapPage === null || new Set([
            locationPage.locationsEnabled, membershipPage.locationsEnabled,
            targetPage.locationsEnabled, gapPage.locationsEnabled,
          ]).size !== 1) return null;
        return {
          locations,
          locationsEnabled: locationPage.locationsEnabled,
          setup: {
            locations: locationPage.items as LocationSetupState['locations'],
            memberships: membershipPage.items as LocationSetupState['memberships'],
            workTargets: targetPage.items as LocationSetupState['workTargets'],
            activationGaps: gapPage.items as LocationSetupState['activationGaps'],
          },
        };
      }) ?? null;
    } catch { result = null; }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result === null) {
      this.setState({ ...latest, locationSetupBusy: false,
        notice: 'Die Standort-Einrichtung konnte nicht vollständig geladen werden. Versuchen Sie es erneut.' });
      return;
    }
    this.setState({ ...latest, assignableLocations: result.locations,
      locationSetup: result.setup, locationSetupBusy: false,
      locationsEnabled: result.locationsEnabled });
  }

  async createLocation(displayName: string): Promise<void> {
    await this.runLocationMutation({ action: 'create_location', locationId: crypto.randomUUID(),
      displayName }, 'Standort wurde angelegt.');
  }

  async renameLocation(locationId: string, expectedRowVersion: number,
    displayName: string): Promise<void> {
    await this.runLocationMutation({ action: 'rename_location', locationId,
      expectedRowVersion, displayName }, 'Standort wurde umbenannt.');
  }

  async deactivateLocation(locationId: string, expectedRowVersion: number): Promise<void> {
    await this.runLocationMutation({ action: 'deactivate_location', locationId,
      expectedRowVersion }, 'Standort wurde stillgelegt.');
  }

  async setHomeLocation(membershipId: string, locationId: string): Promise<void> {
    await this.runLocationMutation({ action: 'set_home_location', membershipId, locationId },
      'Heimatstandort wurde zugewiesen.');
  }

  async setWorkLocation(membershipId: string, locationId: string,
    assigned: boolean): Promise<void> {
    await this.runLocationMutation({ action: 'set_work_location', membershipId, locationId,
      assigned }, assigned ? 'Arbeitszuweisung wurde vergeben.' : 'Arbeitszuweisung wurde widerrufen.');
  }

  async setManagementLocation(membershipId: string, locationId: string,
    assigned: boolean): Promise<void> {
    await this.runLocationMutation({ action: 'set_management_location', membershipId, locationId,
      assigned }, assigned ? 'Verwaltungszuweisung wurde vergeben.' : 'Verwaltungszuweisung wurde widerrufen.');
  }

  async setWorkTargetLocation(targetType: 'customer' | 'project' | 'general_work',
    targetId: string, locationId: string): Promise<void> {
    await this.runLocationMutation({ action: 'set_work_target_location', targetType, targetId,
      locationId }, 'Arbeitsziel wurde einem Standort zugewiesen.');
  }

  async setLocationsEnabled(enabled: boolean): Promise<void> {
    const succeeded = await this.runLocationMutation({ action: 'set_locations_enabled', enabled },
      enabled ? 'Standort-Funktion wurde eingeschaltet.' : 'Standort-Funktion wurde ausgeschaltet.');
    if (!succeeded) return;
    const generation = this.generation;
    const session = await this.auth.withAccessToken((token) => this.api.session(token));
    if (generation !== this.generation || session?.status !== 'succeeded') return;
    this.session = session.value;
    const current = this.state;
    if (current.status !== 'ready') return;
    this.setState({ ...current, locationsEnabled: session.value.locationsEnabled,
      managementScope: session.value.managementScope,
      availableSections: session.value.availableSections });
    await this.refreshLocationSetup();
  }

  private async runLocationMutation(
    mutation: Record<string, unknown>,
    successNotice: string,
  ): Promise<boolean> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null
      || current.managementScope.kind !== 'organization'
      || !this.session?.availableSections.includes('setup')
      || this.api.mutateLocationSetup === undefined || current.locationSetupBusy) return false;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    this.setState({ ...current, locationSetupBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.mutateLocationSetup!(
        token, membershipId, crypto.randomUUID(), mutation,
      ));
    } catch { result = { status: 'unreachable' as const }; }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return false;
    const latest = this.state;
    if (latest.status !== 'ready') return false;
    if (result?.status === 'succeeded') {
      this.setState({ ...latest, locationSetupBusy: false, notice: successNotice });
      await this.refreshLocationSetup();
      const refreshed = this.state;
      if (refreshed.status === 'ready') this.setState({ ...refreshed, notice: successNotice });
      return true;
    }
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation,
        'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      return false;
    }
    const notice = result.status === 'conflict'
      ? locationMutationNotice(result.code)
      : 'Die Standort-Änderung wurde vom Server nicht bestätigt. Laden Sie die Einrichtung neu und versuchen Sie es erneut.';
    this.setState({ ...latest, locationSetupBusy: false, notice });
    await this.refreshLocationSetup();
    return false;
  }

  async loadMoreEmployees(): Promise<void> {
    let current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('employees')
      || current.employeeProjection.nextCursor === null
    ) return;
    const requestedCursor = current.employeeProjection.nextCursor;
    current = {
      ...current,
      reassignmentIntent: null,
      reassigning: false,
    };
    this.setState({
      ...current,
      sections: { ...current.sections, employees: { status: 'loading' } },
    });
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    const sectionEpoch = ++this.sectionEpochs.employees;
    let result;
    try {
      result = await this.auth.withAccessToken(
        (token) => this.api.employeeProjection(
          token,
          membershipId,
          requestedCursor,
          current.selectedLocation?.id ?? null,
        ),
      );
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs.employees
    ) return;
    const latest = this.state;
    if (
      latest.status !== 'ready'
      || latest.employeeProjection.nextCursor !== requestedCursor
    ) return;
    if (result?.status === 'succeeded') {
      const merged = mergeEmployeeProjection(
        latest.employeeProjection,
        result.value,
        requestedCursor,
      );
      if (merged !== null) {
        this.setState({
          ...latest,
          employeeProjection: merged,
          sections: { ...latest.sections, employees: { status: 'ready' } },
        });
      } else {
        this.setState({
          ...latest,
          sections: {
            ...latest.sections,
            employees: {
              status: 'unavailable',
              message: 'Weitere Beschäftigte konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
            },
          },
        });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          employees: {
            status: 'unavailable',
            message: 'Weitere Beschäftigte konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.',
          },
        },
      });
    }
  }

  async createEmployeeInvitation(
    displayName: string,
    role: 'administrator' | 'standortleitung' | 'employee',
    locationId?: string | null,
  ): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('employees')
      || (current.managementScope.kind === 'locations' && role !== 'employee')
      || !['administrator', 'standortleitung', 'employee'].includes(role)
      || (current.locationsEnabled && (
        typeof locationId !== 'string'
        || !current.assignableLocations.some((location) => location.id === locationId)
      ))
      || displayName.trim().length < 1
      || Array.from(displayName.normalize('NFC').trim()).length > 120
    ) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    this.setState({
      ...current,
      creatingEmployee: true,
      invitation: null,
      notice: null,
      completedAction: null,
    });
    const disclosureEpoch = this.invitationDisclosureEpoch;
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createEmployeeInvitation(
        token,
        membershipId,
        crypto.randomUUID(),
        displayName,
        role,
        current.locationsEnabled ? locationId ?? null : undefined,
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || requestRefreshEpoch !== this.refreshEpoch
      || disclosureEpoch !== this.invitationDisclosureEpoch
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      this.setState({
        ...latest,
        creatingEmployee: false,
        invitation: result.value,
        notice: 'Einladung wurde einmalig erzeugt.',
        completedAction: 'invitation_created',
      });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else if (result.status === 'conflict') {
      const notice = result.code === 'invitation_limit_reached'
        ? 'Die Einladung konnte nicht erzeugt werden. Es sind bereits fünf aktive Einladungen vorhanden. Verwerfen Sie eine nicht mehr benötigte Einladung und versuchen Sie es erneut.'
        : result.code === 'invitation_created_token_unavailable'
          ? 'Die Einladung wurde bereits erzeugt. Ihr Geheimnis kann aus Sicherheitsgründen nicht erneut angezeigt werden. Erzeugen Sie bei Bedarf eine neue Einladung.'
          : 'Die Einladung konnte nicht erzeugt werden. Eine andere Anfrage hat denselben Vorgang bereits verändert. Laden Sie die Beschäftigten neu und versuchen Sie es erneut.';
      this.setState({ ...latest, creatingEmployee: false, invitation: null, notice });
    } else {
      this.setState({
        ...latest,
        creatingEmployee: false,
        invitation: null,
        notice: 'Die Einladung konnte nicht erzeugt werden. Der Server hat den Vorgang nicht bestätigt. Der eingegebene Name bleibt erhalten; versuchen Sie es erneut.',
      });
    }
  }

  async revokeMembership(targetMembershipId: string, expectedRowVersion: number): Promise<void> {
    await this.mutateMembership(targetMembershipId, expectedRowVersion, null);
  }

  async changeMembershipRole(
    targetMembershipId: string,
    expectedRowVersion: number,
    role: 'administrator' | 'standortleitung' | 'employee',
  ): Promise<void> {
    await this.mutateMembership(targetMembershipId, expectedRowVersion, role);
  }

  private async mutateMembership(
    targetMembershipId: string,
    expectedRowVersion: number,
    role: 'administrator' | 'standortleitung' | 'employee' | null,
  ): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    const target = current.status === 'ready'
      ? current.employeeProjection.employeeMemberships.find((entry) => entry.id === targetMembershipId)
      : undefined;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !current.availableSections.includes('employees')
      || target === undefined
      || target.rowVersion !== expectedRowVersion
      || !target.active
      || (role !== null && current.managementScope.kind === 'locations')
      || (role !== null && role === target.role)
    ) return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    let result;
    try {
      result = await this.auth.withAccessToken((token) => role === null
        ? this.api.revokeMembership(
          token, membershipId, crypto.randomUUID(), targetMembershipId, expectedRowVersion,
        )
        : this.api.changeMembershipRole(
          token, membershipId, crypto.randomUUID(), targetMembershipId, expectedRowVersion, role,
        ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      return;
    }
    if (result.status === 'succeeded') {
      await this.retrySection('employees');
      const latest = this.state;
      if (latest.status === 'ready') {
        this.setState({
          ...latest,
          notice: role === null ? 'Zugang wurde entzogen.' : 'Rolle wurde geändert.',
        });
      }
      return;
    }
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result.status === 'conflict') {
      const notice = result.code === 'last_administrator'
        ? 'Die Rolle oder der Zugang konnte nicht geändert werden. Der Betrieb braucht mindestens einen aktiven Administrator. Ernennen Sie zuerst einen weiteren Administrator.'
        : result.code === 'self_revocation_forbidden'
          ? 'Der eigene Zugang konnte nicht entzogen werden. Damit Sie sich nicht selbst aussperren, ist dieser Vorgang gesperrt. Lassen Sie den Zugang von einem anderen Administrator entziehen.'
          : result.code === 'stale_row_version'
            ? 'Die Beschäftigtenzuordnung konnte nicht geändert werden. Sie wurde zwischenzeitlich aktualisiert. Laden Sie den Bereich neu und versuchen Sie es erneut.'
            : result.code === 'target_unavailable'
              ? 'Die Beschäftigtenzuordnung konnte nicht geändert werden. Sie ist nicht mehr verfügbar. Laden Sie den Bereich neu.'
              : 'Die Beschäftigtenzuordnung konnte nicht geändert werden. Eine andere Anfrage betrifft denselben Vorgang. Laden Sie den Bereich neu und versuchen Sie es erneut.';
      this.setState({ ...latest, notice });
    } else {
      this.setState({ ...latest, notice: 'Die Beschäftigtenzuordnung konnte nicht geändert werden. Der Server hat den Vorgang nicht bestätigt. Laden Sie den Bereich neu und versuchen Sie es erneut.' });
    }
  }

  dismissInvitation(): void {
    const current = this.state;
    if (current.status !== 'ready') return;
    this.invitationDisclosureEpoch += 1;
    this.setState({
      ...current,
      creatingEmployee: false,
      invitation: null,
      notice: current.invitation === null
        ? current.notice
        : 'Einladungsgeheimnis wurde verworfen.',
    });
  }

  prepareReassignment(nfcTagId: string, targetCustomerId: string): void {
    const current = this.state;
    if (current.status !== 'ready' || !this.session?.availableSections.includes('setup') || current.reassigning) return;
    const tag = current.projection.nfcTags.find((candidate) => candidate.id === nfcTagId);
    const target = current.projection.customers.find(
      (candidate) => candidate.id === targetCustomerId && candidate.active,
    );
    if (
      tag === undefined
      || target === undefined
      || tag.assignmentState !== 'assigned'
      || tag.assignmentType !== 'work'
      || tag.targetCustomerId === null
      || tag.activeAssignmentId === null
      || tag.targetCustomerId === target.id
    ) {
      this.setState({
        ...current,
        reassignmentIntent: null,
        notice: 'Die Zuordnung kann nicht vorbereitet werden. Der NFC-Tag oder das Arbeitsziel ist nicht mehr verfügbar. Laden Sie die Einrichtung neu und wählen Sie erneut.',
      });
      return;
    }
    this.setState({
      ...current,
      invitation: null,
      reassignmentIntent: Object.freeze({
        commandId: crypto.randomUUID(),
        nfcTagId: tag.id,
        expectedActiveAssignmentId: tag.activeAssignmentId,
        targetCustomerId: target.id,
      }),
      notice: null,
    });
  }

  cancelReassignment(): void {
    const current = this.state;
    if (current.status !== 'ready' || current.reassignmentIntent === null || current.reassigning) return;
    this.setState({
      ...current,
      reassignmentIntent: null,
      notice: 'Änderung wurde verworfen.',
    });
  }

  async confirmReassignment(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || current.reassignmentIntent === null
      || current.reassigning
      || membershipId === null
      || !this.session?.availableSections.includes('setup')
    ) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    const intent = current.reassignmentIntent;
    this.setState({ ...current, invitation: null, reassigning: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.reassignNfcTag(
        token,
        membershipId,
        intent.commandId,
        intent.nfcTagId,
        intent.expectedActiveAssignmentId,
        intent.targetCustomerId,
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || requestRefreshEpoch !== this.refreshEpoch
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.reassignmentIntent?.commandId !== intent.commandId) return;
    if (result?.status === 'succeeded') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation !== this.generation
        || followupRefreshEpoch !== this.refreshEpoch
      ) return;
      const refreshed = this.state;
      if (refreshed.status === 'ready') {
        this.setState({
          ...refreshed,
          notice: result.value.assignmentChanged
            ? 'NFC-Tag wurde sicher neu zugeordnet.'
            : 'Die Zuordnung war bereits korrekt.',
        });
      }
      return;
    }
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      return;
    }
    if (result.status === 'conflict' && result.code !== 'assignment_in_use') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation !== this.generation
        || followupRefreshEpoch !== this.refreshEpoch
      ) return;
      const refreshed = this.state;
      if (refreshed.status === 'ready') {
        const notice = result.code === 'assignment_target_unavailable'
          ? 'Der NFC-Tag konnte nicht neu zugeordnet werden. Der gewählte Kunde ist nicht mehr aktiv. Wählen Sie einen anderen aktiven Kunden.'
          : result.code === 'assignment_conflict'
            ? 'Der NFC-Tag konnte nicht neu zugeordnet werden. Die Zuordnung wurde zwischenzeitlich geändert. Prüfen Sie die neu geladenen Daten und versuchen Sie es erneut.'
            : 'Der NFC-Tag konnte nicht neu zugeordnet werden. Eine andere Anfrage betrifft denselben Vorgang. Laden Sie die Einrichtung neu und versuchen Sie es erneut.';
        this.setState({ ...refreshed, notice });
      }
      return;
    }
    this.setState({
      ...latest,
      reassigning: false,
      notice: result.status === 'conflict'
        ? 'Der NFC-Tag konnte nicht neu zugeordnet werden. Für das bisherige Arbeitsziel läuft noch eine Arbeitszeit. Beenden Sie diese Arbeitszeit und versuchen Sie es erneut.'
        : 'Der NFC-Tag konnte nicht neu zugeordnet werden. Der Server hat den Vorgang nicht bestätigt. Versuchen Sie es erneut; dieselbe Anfrage wird sicher weiterverwendet.',
    });
  }

  prepareCorrection(
    timeRecordId: string,
    startedAt: string,
    stoppedAt: string,
    reason: string,
  ): void {
    const current = this.state;
    if (current.status !== 'ready' || current.timeReviewBusy || !current.availableSections.includes('time_records')) return;
    const record = current.timeRecords.find((candidate) => candidate.timeRecordId === timeRecordId);
    if (
      record === undefined || record.status !== 'stopped' || record.stoppedAt === null
      || !isClosedInterval(startedAt, stoppedAt, this.now()) || !isValidTimeReviewReason(reason)
      || (record.startedAt === startedAt && record.stoppedAt === stoppedAt)
    ) {
      this.setState({ ...current, correctionIntent: null, notice: 'Die Korrektur kann nicht vorbereitet werden. Arbeitszeit, Zeitraum oder Begründung sind nicht mehr verwendbar. Prüfen Sie die erhaltenen Eingaben und versuchen Sie es erneut.' });
      return;
    }
    this.setState({
      ...current,
      invitation: null,
      reassignmentIntent: null,
      adjudicationIntent: null,
      correctionIntent: Object.freeze({
        commandId: crypto.randomUUID(), timeRecord: record, startedAt, stoppedAt, reason,
      }),
      notice: null,
    });
  }

  cancelCorrection(): void {
    const current = this.state;
    if (current.status !== 'ready' || !current.availableSections.includes('time_records') || current.correctionIntent === null || current.timeReviewBusy) return;
    this.setState({ ...current, correctionIntent: null, notice: 'Korrektur wurde verworfen.' });
  }

  async confirmCorrection(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || !current.availableSections.includes('time_records') || current.correctionIntent === null
      || current.timeReviewBusy || membershipId === null) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    const intent = current.correctionIntent;
    this.setState({ ...current, invitation: null, timeReviewBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.correctTimeRecord(
        token, membershipId, intent.commandId, intent.timeRecord,
        intent.startedAt, intent.stoppedAt, intent.reason,
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || requestRefreshEpoch !== this.refreshEpoch
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.correctionIntent?.commandId !== intent.commandId) return;
    if (result?.status === 'succeeded') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation === this.generation
        && followupRefreshEpoch === this.refreshEpoch
        && this.state.status === 'ready'
      ) {
        this.setState({ ...this.state, notice: 'Die Arbeitszeit wurde korrigiert. Die ursprüngliche Fassung bleibt lückenlos erhalten.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else if (result.status === 'conflict') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation === this.generation
        && followupRefreshEpoch === this.refreshEpoch
        && this.state.status === 'ready'
      ) {
        this.setState({ ...this.state, notice: correctionConflictNotice(result.code) });
      }
    } else {
      this.setState({
        ...latest, timeReviewBusy: false,
        notice: 'Die Korrektur konnte nicht gespeichert werden. Der Server hat den Vorgang nicht bestätigt. Bestätigen Sie erneut; dieselbe Anfrage wird sicher weiterverwendet.',
      });
    }
  }

  prepareAdjudication(
    reviewItemId: string,
    resolution: ReviewAdjudicationIntent['resolution'],
    timeRecordId: string | null,
    startedAt: string | null,
    stoppedAt: string | null,
    reason: string,
  ): void {
    const current = this.state;
    if (current.status !== 'ready' || current.timeReviewBusy || !current.availableSections.includes('review_items')) return;
    const reviewItem = current.reviewItems.find((candidate) => candidate.reviewItemId === reviewItemId);
    const record = timeRecordId === null
      ? null : current.timeRecords.find((candidate) => candidate.timeRecordId === timeRecordId) ?? null;
    const noChangeIsValid = resolution === 'no_time_record_change'
      && timeRecordId === null && startedAt === null && stoppedAt === null;
    const recoveredIsValid = resolution === 'create_recovered_time_record'
      && timeRecordId === null && startedAt !== null && stoppedAt !== null
      && isClosedInterval(startedAt, stoppedAt, this.now());
    const adjustmentIsValid = resolution === 'adjust_existing_time_record'
      && record?.status === 'stopped' && record.stoppedAt !== null
      && startedAt !== null && stoppedAt !== null
      && isClosedInterval(startedAt, stoppedAt, this.now())
      && (record.startedAt !== startedAt || record.stoppedAt !== stoppedAt);
    if (reviewItem === undefined || !isValidTimeReviewReason(reason)
      || (!noChangeIsValid && !recoveredIsValid && !adjustmentIsValid)) {
      this.setState({ ...current, adjudicationIntent: null, notice: 'Die Prüfentscheidung kann nicht vorbereitet werden. Prüffall, Zeitraum oder Begründung sind nicht mehr verwendbar. Prüfen Sie die erhaltenen Eingaben und versuchen Sie es erneut.' });
      return;
    }
    this.setState({
      ...current,
      invitation: null,
      reassignmentIntent: null,
      correctionIntent: null,
      adjudicationIntent: Object.freeze({
        commandId: crypto.randomUUID(), reviewItem, resolution,
        timeRecord: record, startedAt, stoppedAt, reason,
      }),
      notice: null,
    });
  }

  cancelAdjudication(): void {
    const current = this.state;
    if (current.status !== 'ready' || !current.availableSections.includes('review_items') || current.adjudicationIntent === null || current.timeReviewBusy) return;
    this.setState({ ...current, adjudicationIntent: null, notice: 'Die Prüfentscheidung wurde verworfen.' });
  }

  async confirmAdjudication(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || !current.availableSections.includes('review_items') || current.adjudicationIntent === null
      || current.timeReviewBusy || membershipId === null) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    const intent = current.adjudicationIntent;
    const resolution = buildResolution(intent);
    if (resolution === null) return;
    this.setState({ ...current, invitation: null, timeReviewBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.adjudicateReviewItem(
        token, membershipId, intent.commandId, intent.reviewItem.reviewItemId,
        resolution, intent.reason,
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || requestRefreshEpoch !== this.refreshEpoch
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.adjudicationIntent?.commandId !== intent.commandId) return;
    if (result?.status === 'succeeded') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation === this.generation
        && followupRefreshEpoch === this.refreshEpoch
        && this.state.status === 'ready'
      ) {
        this.setState({ ...this.state, notice: 'Die Prüfentscheidung wurde lückenlos protokolliert.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else if (result.status === 'conflict') {
      const refresh = this.refresh();
      const followupRefreshEpoch = this.refreshEpoch;
      await refresh;
      if (
        generation === this.generation
        && followupRefreshEpoch === this.refreshEpoch
        && this.state.status === 'ready'
      ) {
        this.setState({ ...this.state, notice: adjudicationConflictNotice(result.code) });
      }
    } else {
      this.setState({
        ...latest, timeReviewBusy: false,
        notice: 'Die Prüfentscheidung konnte nicht gespeichert werden. Der Server hat den Vorgang nicht bestätigt. Bestätigen Sie erneut; dieselbe Anfrage wird sicher weiterverwendet.',
      });
    }
  }

  async loadMoreTimeRecords(): Promise<void> {
    await this.loadMoreCursorSection('timeRecords');
  }

  async loadMoreReviewItems(): Promise<void> {
    await this.loadMoreCursorSection('reviewItems');
  }

  async exportTimeRecords(version: 3 | 4 = 3): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || current.timeReviewBusy
      || membershipId === null
      || !current.availableSections.includes('time_export')
    ) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    this.setState({ ...current, timeReviewBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.exportTimeEntries(
        token, membershipId, current.timeWindow.fromInclusive, current.timeWindow.toExclusive, ...(version===3?[]:[version] as const),
      ));
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || requestRefreshEpoch !== this.refreshEpoch
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      try {
        const href = URL.createObjectURL(result.value.blob);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = result.value.filename;
        anchor.rel = 'noopener';
        anchor.click();
        URL.revokeObjectURL(href);
        this.setState({ ...latest, timeReviewBusy: false, notice: 'Die CSV-Datei wurde erstellt und heruntergeladen.' });
      } catch {
        this.setState({ ...latest, timeReviewBusy: false, notice: 'Die CSV-Datei konnte nicht bereitgestellt werden. Die Serverantwort war unvollständig. Versuchen Sie den Download erneut.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
    } else {
      this.setState({ ...latest, timeReviewBusy: false, notice: 'Die CSV-Datei konnte nicht heruntergeladen werden. Der Dienst ist derzeit nicht erreichbar. Versuchen Sie es später erneut.' });
    }
  }

  private async loadMoreCursorSection(section: 'timeRecords' | 'reviewItems'): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || !isAdminSectionAvailable(current.availableSections, section)
    ) return;
    const requestedCursor = section === 'timeRecords'
      ? current.timeRecordsNextCursor
      : current.reviewItemsNextCursor;
    if (requestedCursor === null || current.sections[section].status === 'loading') return;
    const generation = this.generation;
    const refreshEpoch = this.refreshEpoch;
    const sectionEpoch = ++this.sectionEpochs[section];
    this.setState({
      ...current,
      invitation: null,
      sections: { ...current.sections, [section]: { status: 'loading' } },
    });
    let result;
    try {
      result = section === 'timeRecords'
        ? await this.auth.withAccessToken((token) => this.api.timeRecords(
            token,
            membershipId,
            current.timeWindow.fromInclusive,
            current.timeWindow.toExclusive,
            requestedCursor,
          ))
        : await this.auth.withAccessToken(
            (token) => this.api.reviewItems(token, membershipId, requestedCursor),
          );
    } catch {
      result = { status: 'unreachable' as const };
    }
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs[section]
    ) return;
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      return;
    }
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result.status !== 'succeeded') {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          [section]: {
            status: 'unavailable',
            message: sectionUnavailableMessage(section, apiFailureStatus(result)),
          },
        },
      });
      return;
    }
    const merged = section === 'timeRecords'
      ? mergeCursorPage(latest.timeRecords, result.value as CursorPage<SafeTimeRecord>, requestedCursor, 'timeRecordId')
      : mergeCursorPage(latest.reviewItems, result.value as CursorPage<SafeReviewItem>, requestedCursor, 'reviewItemId');
    if (merged === null) {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          [section]: {
            status: 'unavailable',
            message: 'Weitere Daten konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
          },
        },
      });
      return;
    }
    if (section === 'timeRecords') {
      this.setState({
        ...latest,
        timeRecords: merged.items as readonly SafeTimeRecord[],
        timeRecordsNextCursor: merged.nextCursor,
        sections: { ...latest.sections, timeRecords: { status: 'ready' } },
      });
    } else {
      this.setState({
        ...latest,
        reviewItems: merged.items as readonly SafeReviewItem[],
        reviewItemsNextCursor: merged.nextCursor,
        sections: { ...latest.sections, reviewItems: { status: 'ready' } },
      });
    }
  }

  private async loadReadyData(
    session: Session,
    requestedTimeWindow?: { readonly fromInclusive: string; readonly toExclusive: string },
    locationId: string | null = null,
  ): Promise<ReadyDataResult> {
    const timeWindow = requestedTimeWindow ?? boundedTimeWindow(this.now());
    const membershipId = session.membershipId;
    const [projection, employees, records, reviewItems] = await Promise.all([
      session.availableSections.includes('setup')
        ? this.safeSectionRead(
            () => this.auth.withAccessToken(
              (token) => this.api.projection(token, membershipId, null),
            ),
          )
        : Promise.resolve({ status: 'closed' as const }),
      session.availableSections.includes('employees')
        ? this.safeSectionRead(
            () => this.auth.withAccessToken(
              (token) => this.api.employeeProjection(token, membershipId, null, locationId),
            ),
          )
        : Promise.resolve({ status: 'closed' as const }),
      session.availableSections.includes('time_records')
        ? this.safeSectionRead(
            () => this.auth.withAccessToken((token) => this.api.timeRecords(
              token, membershipId, timeWindow.fromInclusive, timeWindow.toExclusive, null,
            )),
          )
        : Promise.resolve({ status: 'closed' as const }),
      session.availableSections.includes('review_items')
        ? this.safeSectionRead(
            () => this.auth.withAccessToken(
              (token) => this.api.reviewItems(token, membershipId, null),
            ),
          )
        : Promise.resolve({ status: 'closed' as const }),
    ]);
    if ([projection, employees, records, reviewItems].some(
      (result) => result.status === 'rejected',
    )) return { status: 'rejected' };
    if (
      employees.status === 'conflict'
      && employees.code === 'location_scope_forbidden'
    ) return { status: 'location_scope_forbidden' };
    const normalizedProjection = normalizeSectionResult(projection);
    const normalizedEmployees = normalizeSectionResult(employees);
    const normalizedRecords = normalizeSectionResult(records);
    const normalizedReviewItems = normalizeSectionResult(reviewItems);
    return {
      status: [
        normalizedProjection,
        normalizedEmployees,
        normalizedRecords,
        normalizedReviewItems,
      ].every((result) => result.status === 'succeeded' || result.status === 'closed')
        ? 'succeeded'
        : 'partial',
      projection: normalizedProjection,
      employeeProjection: normalizedEmployees,
      timeRecords: normalizedRecords,
      reviewItems: normalizedReviewItems,
      timeWindow,
    };
  }

  private async safeSectionRead<Value>(
    operation: () => Promise<ApiResult<Value> | null>,
  ): Promise<ApiResult<Value>> {
    try {
      return await operation() ?? { status: 'rejected' };
    } catch {
      return { status: 'unreachable' };
    }
  }

  private async loadSection(
    section: AdminSection,
    membershipId: string,
    timeWindow: { readonly fromInclusive: string; readonly toExclusive: string },
  ): Promise<
    | { readonly status: 'succeeded'; readonly value: unknown }
    | { readonly status: 'rejected' | ApiFailureStatus }
    | null
  > {
    const current = this.state;
    if (
      current.status !== 'ready'
      || !isAdminSectionAvailable(current.availableSections, section)
    ) return { status: 'invalid_response' };
    try {
      let result: ApiResult<unknown> | null;
      if (section === 'setup') {
        result = await this.auth.withAccessToken(
          (token) => this.api.projection(token, membershipId, null),
        );
      } else if (section === 'employees') {
        result = await this.auth.withAccessToken(
          (token) => this.api.employeeProjection(
            token,
            membershipId,
            null,
            current.selectedLocation?.id ?? null,
          ),
        );
      } else if (section === 'timeRecords') {
        result = await this.auth.withAccessToken((token) => this.api.timeRecords(
          token, membershipId, timeWindow.fromInclusive, timeWindow.toExclusive, null,
        ));
      } else {
        result = await this.auth.withAccessToken(
          (token) => this.api.reviewItems(token, membershipId, null),
        );
      }
      if (result === null || result.status === 'rejected') return result;
      switch (result.status) {
        case 'succeeded': return result;
        case 'unreachable':
        case 'invalid_response': return result;
        case 'conflict': return { status: 'invalid_response' };
        default: return result satisfies never;
      }
    } catch {
      return { status: 'unreachable' };
    }
  }

  private async completeSignIn(generation: number, email: string, password: string): Promise<void> {
    try {
      const outcome = await this.auth.signIn(email, password);
      if (outcome !== 'signed_in') {
        await this.safeSignOut();
        if (generation === this.generation) this.setState({
          status: 'signed_out',
          notice: signInFailureNotice(outcome),
        });
        return;
      }
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      const sessionResult = await this.auth.withAccessToken((token) => this.api.session(token));
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      if (sessionResult?.status !== 'succeeded') {
        await this.rejectWithinAuthentication(generation, 'Die Anmeldung konnte nicht abgeschlossen werden. Die Sitzung wurde vom Server nicht bestätigt. Melden Sie sich erneut an.');
        return;
      }
      const session = sessionResult.value;
      if (session.availableSections.length === 0) {
        await this.rejectWithinAuthentication(
          generation,
          'Für diesen Zugang ist derzeit kein Verwaltungsbereich geöffnet. Wenden Sie sich an die Betriebsverwaltung, wenn Sie hier arbeiten sollen.',
          true,
        );
        return;
      }
      this.membershipId = session.membershipId;
      this.session = session;
      this.setState({ status: 'loading' });
      let locationId = session.locationsEnabled && session.managementScope.kind === 'locations'
        ? this.requestedLocationId ?? session.managementScope.locations[0]?.id ?? null
        : null;
      let projection = await this.loadReadyData(session, undefined, locationId);
      let notice: string | null = null;
      if (projection.status === 'location_scope_forbidden') {
        const fallback = session.managementScope.kind === 'locations'
          ? session.managementScope.locations[0]?.id ?? null
          : null;
        if (fallback === null || fallback === locationId) {
          throw new Error('The reported management Location is unavailable');
        }
        locationId = fallback;
        this.requestedLocationId = fallback;
        projection = await this.loadReadyData(session, undefined, fallback);
        notice = 'Der angeforderte Standort gehört nicht zu Ihren Verwaltungsstandorten. Stattdessen wurde Ihr erster verfügbarer Standort geöffnet.';
      }
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      if (projection.status === 'rejected') {
        await this.rejectWithinAuthentication(generation, 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.');
      } else if (projection.status === 'location_scope_forbidden') {
        throw new Error('The fallback management Location was rejected');
      } else if (
        projection.projection.status === 'succeeded'
        || projection.employeeProjection.status === 'succeeded'
        || session.availableSections.includes('own_time')
        || session.availableSections.includes('manual_capture')
      ) {
        const boundOrganization = projection.projection.status === 'succeeded'
          ? projection.projection.value.organization
          : projection.employeeProjection.status === 'succeeded'
            ? projection.employeeProjection.value.organization
            : { id: session.organizationId, name: 'Ihr Betrieb' };
        if (
          boundOrganization === null
          || boundOrganization.id !== session.organizationId
        ) throw new Error('Organization binding unavailable');
        const setupProjection = projection.projection.status === 'succeeded'
          ? projection.projection.value
          : emptyProjection(boundOrganization);
        const employeeProjection = projection.employeeProjection.status === 'succeeded'
          ? projection.employeeProjection.value
          : emptyEmployeeProjection(boundOrganization);
        const selectedLocation = session.managementScope.kind === 'locations'
          ? session.managementScope.locations.find((location) => location.id === locationId) ?? null
          : null;
        if (
          session.locationsEnabled
          && session.managementScope.kind === 'locations'
          && session.availableSections.includes('employees')
          && selectedLocation === null
        ) throw new Error('Selected management Location is absent from the Session');
        const next = readyState(
          session,
          selectedLocation,
          setupProjection,
          employeeProjection,
          projection.timeRecords.status === 'succeeded'
            ? projection.timeRecords.value
            : { items: [], nextCursor: null },
          projection.reviewItems.status === 'succeeded'
            ? projection.reviewItems.value
            : { items: [], nextCursor: null },
          projection.timeWindow,
          sectionStates(projection),
        );
        this.setState({ ...next, notice });
        await this.refreshLocationSetup();
      } else {
        const failure = readyDataFailureStatus(projection);
        this.setState({
          status: 'unavailable',
          message: administrationUnavailableMessage(failure),
        });
      }
    } catch {
      await this.safeSignOut();
      if (generation === this.generation) {
        this.membershipId = null;
        this.session = null;
    this.pendingManual = null;
        this.setState({ status: 'unavailable', message: 'Die Anmeldung konnte nicht abgeschlossen werden. Der Anmeldedienst ist derzeit nicht erreichbar. Versuchen Sie es später erneut.' });
      }
    }
  }

  private async rejectWithinAuthentication(generation: number, message: string, forbidden = false): Promise<void> {
    if (generation !== this.generation) { await this.safeSignOut(); return; }
    this.membershipId = null;
    this.session = null;
    this.pendingManual = null;
    const invalidatedGeneration = ++this.generation;
    await this.safeSignOut();
    if (invalidatedGeneration === this.generation) this.setState({ status: forbidden ? 'forbidden' : 'unavailable', message });
  }

  private async rejectOutsideAuthentication(generation: number, message: string): Promise<void> {
    if (generation !== this.generation) return;
    this.membershipId = null;
    this.session = null;
    this.pendingManual = null;
    this.generation += 1;
    this.setState({ status: 'unavailable', message });
    await this.enqueueAuthentication(() => this.safeSignOut());
  }

  private enqueueAuthentication(operation: () => Promise<void>): Promise<void> {
    const queued = this.authenticationQueue.then(operation, operation);
    this.authenticationQueue = queued.catch(() => undefined);
    return queued;
  }

  private async safeSignOut(): Promise<void> {
    try { await this.auth.signOut(); } catch { /* local state remains invalidated */ }
  }

  private setState(requestedState: AdminWebState): void {
    this.clearInvitationExpiryTimer();
    const previousInvitation = this.state.status === 'ready' ? this.state.invitation : null;
    let state = requestedState;
    if (state.status === 'ready' && state.invitation !== null) {
      const recordedEpoch = this.invitationDisclosureEpochs.get(state.invitation);
      if (recordedEpoch === undefined) {
        this.invitationDisclosureEpoch += 1;
        this.invitationDisclosureEpochs.set(state.invitation, this.invitationDisclosureEpoch);
      } else if (recordedEpoch !== this.invitationDisclosureEpoch) {
        state = {
          ...state,
          invitation: this.state.status === 'ready' ? this.state.invitation : null,
        };
      }
    }
    const nextInvitation = state.status === 'ready' ? state.invitation : null;
    if (previousInvitation !== null && nextInvitation === null) {
      this.invitationDisclosureEpoch += 1;
    }
    this.state = Object.freeze(state);
    if (state.status === 'ready' && state.invitation !== null) {
      const generation = this.generation;
      const invitation = state.invitation;
      const remaining = Date.parse(invitation.expiresAt) - Date.now();
      if (remaining <= 0) {
        this.state = Object.freeze({
          ...state,
          invitation: null,
          notice: 'Die Einladung kann nicht mehr verwendet werden. Ihre Gültigkeitsdauer ist abgelaufen. Erzeugen Sie eine neue Einladung.',
        });
      } else {
        this.invitationExpiryTimer = setTimeout(() => {
          const current = this.state;
          if (
            generation === this.generation
            && current.status === 'ready'
            && current.invitation?.value === invitation.value
          ) {
            this.setState({
              ...current,
              invitation: null,
              notice: 'Die Einladung kann nicht mehr verwendet werden. Ihre Gültigkeitsdauer ist abgelaufen. Erzeugen Sie eine neue Einladung.',
            });
          }
        }, Math.min(remaining, 2_147_483_647));
      }
    }
    for (const listener of this.listeners) listener();
  }

  private clearInvitationExpiryTimer(): void {
    if (this.invitationExpiryTimer !== null) {
      clearTimeout(this.invitationExpiryTimer);
      this.invitationExpiryTimer = null;
    }
  }
}

async function loadAllAssignableLocations(
  api: AdminWebApiPort,
  token: string,
  membershipId: string,
): Promise<readonly AdministrationLocation[] | null> {
  if (api.assignableLocations === undefined) return null;
  const locations: AdministrationLocation[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.assignableLocations(token, membershipId, cursor);
    if (page.status !== 'succeeded') return null;
    locations.push(...page.value.items);
    cursor = page.value.nextCursor;
  } while (cursor !== null);
  return Object.freeze(locations);
}

async function loadAllLocationSetupItems(
  api: AdminWebApiPort,
  token: string,
  membershipId: string,
  kind: 'locations' | 'memberships' | 'work_targets' | 'activation_gaps',
): Promise<{ readonly locationsEnabled: boolean; readonly items: readonly unknown[] } | null> {
  if (api.locationSetupPage === undefined) return null;
  const items: unknown[] = [];
  let cursor: string | null = null;
  let locationsEnabled: boolean | null = null;
  do {
    const page = await api.locationSetupPage(token, membershipId, kind, cursor);
    if (page.status !== 'succeeded'
      || (locationsEnabled !== null && locationsEnabled !== page.value.locationsEnabled)) return null;
    locationsEnabled = page.value.locationsEnabled;
    items.push(...page.value.items);
    cursor = page.value.nextCursor;
  } while (cursor !== null);
  return { locationsEnabled: locationsEnabled ?? false, items: Object.freeze(items) };
}

function locationMutationNotice(code:
  | 'command_id_conflict'
  | 'assignment_conflict'
  | 'assignment_in_use'
  | 'assignment_target_unavailable'
  | 'invitation_created_token_unavailable'
  | 'invitation_limit_reached'
  | 'time_review_conflict'
  | 'not_adjustable'
  | 'invalid_evidence'
  | 'project_in_use'
  | 'project_unavailable'
  | 'stale_row_version'
  | 'last_administrator'
  | 'self_revocation_forbidden'
  | 'location_scope_forbidden'
  | 'home_work_conflict'
  | 'location_in_use'
  | 'location_unavailable'
  | 'management_role_required'
  | 'membership_unavailable'
  | 'setup_incomplete'
  | 'target_unavailable'
): string {
  switch (code) {
    case 'setup_incomplete': return 'Die Standort-Funktion bleibt ausgeschaltet. Mindestens eine der namentlich aufgeführten Bindungen fehlt noch.';
    case 'location_in_use': return 'Der Standort bleibt aktiv, weil noch eine aktuelle Bindung daran hängt. Weisen Sie diese zuerst einem anderen Standort zu.';
    case 'management_role_required': return 'Die Verwaltungszuweisung wurde abgewiesen. Sie ist ausschließlich für die Rolle Standortleitung zulässig.';
    case 'home_work_conflict': return 'Heimatstandort und zusätzliche Arbeitszuweisung müssen getrennt bleiben. Widerrufen Sie zuerst die kollidierende Arbeitszuweisung.';
    case 'stale_row_version': return 'Der Standort wurde zwischenzeitlich geändert. Die aktuelle Fassung wurde neu geladen.';
    case 'location_unavailable': return 'Der gewählte Standort ist nicht mehr aktiv oder nicht verfügbar.';
    case 'membership_unavailable': return 'Die gewählte Zugehörigkeit ist nicht mehr aktiv oder nicht verfügbar.';
    case 'target_unavailable': return 'Das gewählte Arbeitsziel ist nicht mehr aktiv oder nicht verfügbar.';
    default: return 'Die Standort-Änderung kollidiert mit einem anderen Vorgang. Die aktuelle Fassung wurde neu geladen.';
  }
}

function readyState(
  session: Session,
  selectedLocation: AdministrationLocation | null,
  projection: SafeProjection,
  employeeProjection: SafeEmployeeProjection,
  timeRecords: CursorPage<SafeTimeRecord>,
  reviewItems: CursorPage<SafeReviewItem>,
  timeWindow: { readonly fromInclusive: string; readonly toExclusive: string },
  sections = sectionStatesWithValue(session.availableSections, { status: 'ready' } as const),
): Extract<AdminWebState, { readonly status: 'ready' }> {
  if (
    projection.organization.id !== employeeProjection.organization.id
    || projection.organization.name !== employeeProjection.organization.name
    || !isSafeEmployeeProjectionPage(employeeProjection, null)
  ) {
    throw new Error('Administration projections disagree about the Organization');
  }
  return {
    status: 'ready',
    role: session.role,
    membershipId: session.membershipId,
    locationsEnabled: session.locationsEnabled,
    availableSections: session.availableSections,
    managementScope: session.managementScope,
    selectedLocation,
    assignableLocations: [],
    locationSetup: null,
    locationSetupBusy: false,
    projection,
    employeeProjection,
    creating: false,
    creatingEmployee: false,
    invitation: null,
    reassignmentIntent: null,
    reassigning: false,
    timeRecords: timeRecords.items,
    timeRecordsNextCursor: timeRecords.nextCursor,
    reviewItems: reviewItems.items,
    reviewItemsNextCursor: reviewItems.nextCursor,
    sections,
    timeWindow,
    timeReviewBusy: false,
    correctionIntent: null,
    adjudicationIntent: null,
    notice: null,
    completedAction: null,
  };
}

function emptyProjection(
  organization: SafeProjection['organization'],
): SafeProjection {
  return Object.freeze({
    organization,
    customers: Object.freeze([]),
    nfcTags: Object.freeze([]),
    nextCursor: null,
    customersComplete: true,
    nfcTagsComplete: true,
  });
}

function emptyEmployeeProjection(
  organization: SafeEmployeeProjection['organization'],
): SafeEmployeeProjection {
  return Object.freeze({
    organization,
    employeeMemberships: Object.freeze([]),
    nextCursor: null,
  });
}

function normalizeSectionResult<Value>(
  result: ApiResult<Value> | { readonly status: 'closed' },
): ApiSectionResult<Value> {
  switch (result.status) {
    case 'succeeded':
    case 'closed':
    case 'unreachable':
    case 'invalid_response':
      return result;
    case 'rejected':
    case 'conflict':
      return { status: 'invalid_response' };
    default:
      return result satisfies never;
  }
}

function sectionStates(
  result: Extract<ReadyDataResult, { readonly projection: ApiSectionResult<SafeProjection> }>,
): Extract<AdminWebState, { readonly status: 'ready' }>['sections'] {
  return Object.freeze({
    setup: sectionStatus(result.projection, 'setup'),
    employees: sectionStatus(result.employeeProjection, 'employees'),
    timeRecords: sectionStatus(result.timeRecords, 'timeRecords'),
    reviewItems: sectionStatus(result.reviewItems, 'reviewItems'),
  });
}

function sectionStatesWithValue(
  availableSections: readonly AdministrationSection[],
  value: Extract<AdminWebState, { readonly status: 'ready' }>['sections'][AdminSection],
): Extract<AdminWebState, { readonly status: 'ready' }>['sections'] {
  return Object.freeze({
    setup: availableSections.includes('setup') ? value : { status: 'closed' },
    employees: availableSections.includes('employees') ? value : { status: 'closed' },
    timeRecords: availableSections.includes('time_records') ? value : { status: 'closed' },
    reviewItems: availableSections.includes('review_items') ? value : { status: 'closed' },
  });
}

function allSections(
  value: Extract<AdminWebState, { readonly status: 'ready' }>['sections'][AdminSection],
): Extract<AdminWebState, { readonly status: 'ready' }>['sections'] {
  return Object.freeze({
    setup: value,
    employees: value,
    timeRecords: value,
    reviewItems: value,
  });
}

function mergeRefreshResult(
  current: Extract<AdminWebState, { readonly status: 'ready' }>,
  result: Extract<ReadyDataResult, { readonly status: 'succeeded' | 'partial' }>,
): Extract<AdminWebState, { readonly status: 'ready' }> {
  let next = current;
  if (
    (result.projection.status === 'succeeded' && !sameOrganization(
      current.projection.organization,
      result.projection.value.organization,
    ))
    || (result.employeeProjection.status === 'succeeded' && !sameOrganization(
      current.projection.organization,
      result.employeeProjection.value.organization,
    ))
    || (
      result.projection.status === 'succeeded'
      && result.employeeProjection.status === 'succeeded'
      && !sameOrganization(
        result.projection.value.organization,
        result.employeeProjection.value.organization,
      )
    )
  ) {
    return {
      ...current,
      sections: allSections({
        status: 'unavailable',
        message: 'Die Verwaltungsbereiche konnten nicht übernommen werden. Die Betriebszuordnung der Antworten widerspricht sich. Melden Sie sich ab und erneut an.',
      }),
    };
  }
  next = result.projection.status === 'succeeded'
    ? { ...next, projection: result.projection.value }
    : next;
  next = result.employeeProjection.status === 'succeeded'
    ? { ...next, employeeProjection: result.employeeProjection.value }
    : next;
  next = result.timeRecords.status === 'succeeded'
    ? {
        ...next,
        timeRecords: result.timeRecords.value.items,
        timeRecordsNextCursor: result.timeRecords.value.nextCursor,
        timeWindow: result.timeWindow,
      }
    : next;
  next = result.reviewItems.status === 'succeeded'
    ? {
        ...next,
        reviewItems: result.reviewItems.value.items,
        reviewItemsNextCursor: result.reviewItems.value.nextCursor,
      }
    : next;
  return {
    ...next,
    timeWindow: result.timeWindow,
    creating: false,
    creatingEmployee: false,
    reassigning: false,
    timeReviewBusy: false,
    sections: {
      setup: sectionStatus(result.projection, 'setup'),
      employees: sectionStatus(result.employeeProjection, 'employees'),
      timeRecords: sectionStatus(result.timeRecords, 'timeRecords'),
      reviewItems: sectionStatus(result.reviewItems, 'reviewItems'),
    },
  };
}

function sectionStatus(
  result: ApiSectionResult<unknown>,
  section: AdminSection,
): Extract<AdminWebState, { readonly status: 'ready' }>['sections'][AdminSection] {
  switch (result.status) {
    case 'succeeded': return { status: 'ready' };
    case 'closed': return { status: 'closed' };
    case 'unreachable':
    case 'invalid_response':
      return {
        status: 'unavailable',
        message: sectionUnavailableMessage(section, result.status),
      };
    default: return result satisfies never;
  }
}

function isAdminSectionAvailable(
  availableSections: readonly AdministrationSection[],
  section: AdminSection,
): boolean {
  if (section === 'setup') return availableSections.includes('setup');
  if (section === 'employees') return availableSections.includes('employees');
  if (section === 'timeRecords') return availableSections.includes('time_records');
  return availableSections.includes('review_items');
}

function sectionUnavailableMessage(
  section: AdminSection,
  failure: ApiFailureStatus,
): string {
  if (section === 'setup') return setupPageUnavailableMessage(failure, false);
  switch (failure) {
    case 'unreachable':
      switch (section) {
        case 'employees': return 'Die Beschäftigten konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.';
        case 'timeRecords': return 'Die Arbeitszeiten konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.';
        case 'reviewItems': return 'Die offenen Prüfungen konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.';
        default: return section satisfies never;
      }
    case 'invalid_response':
      switch (section) {
        case 'employees': return 'Die Beschäftigten konnten nicht übernommen werden. Die Antwort des Dienstes ist nicht verwertbar. Laden Sie den Bereich erneut.';
        case 'timeRecords': return 'Die Arbeitszeiten konnten nicht übernommen werden. Die Antwort des Dienstes ist nicht verwertbar. Laden Sie den Bereich erneut.';
        case 'reviewItems': return 'Die offenen Prüfungen konnten nicht übernommen werden. Die Antwort des Dienstes ist nicht verwertbar. Laden Sie den Bereich erneut.';
        default: return section satisfies never;
      }
    default: return failure satisfies never;
  }
}

function setupPageUnavailableMessage(failure: ApiFailureStatus, additionalPage: boolean): string {
  const subject = additionalPage ? 'Weitere Einrichtungsdaten' : 'Die Einrichtung';
  switch (failure) {
    case 'unreachable':
      return `${subject} konnte${additionalPage ? 'n' : ''} nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.`;
    case 'invalid_response':
      return `${subject} konnte${additionalPage ? 'n' : ''} nicht übernommen werden. Die Antwort des Dienstes ist nicht verwertbar. Laden Sie den Bereich erneut.`;
    default:
      return failure satisfies never;
  }
}

function apiFailureStatus(
  result: Exclude<ApiResult<unknown>, { readonly status: 'succeeded' | 'rejected' }>,
): ApiFailureStatus {
  switch (result.status) {
    case 'unreachable':
    case 'invalid_response': return result.status;
    case 'conflict': return 'invalid_response';
    default: return result satisfies never;
  }
}

function readyDataFailureStatus(
  result: Extract<ReadyDataResult, { readonly status: 'succeeded' | 'partial' }>,
): ApiFailureStatus {
  const sections = [
    result.projection,
    result.employeeProjection,
    result.timeRecords,
    result.reviewItems,
  ];
  if (sections.some((section) => section.status === 'invalid_response')) {
    return 'invalid_response';
  }
  if (sections.some((section) => section.status === 'unreachable')) {
    return 'unreachable';
  }
  throw new TypeError('Administration ready-data result has no failed section');
}

function administrationUnavailableMessage(failure: ApiFailureStatus): string {
  switch (failure) {
    case 'unreachable':
      return 'Die Verwaltung konnte nicht geöffnet werden. Die Betriebsdaten sind derzeit nicht erreichbar. Melden Sie sich erneut an oder versuchen Sie es später.';
    case 'invalid_response':
      return 'Die Verwaltung konnte nicht geöffnet werden. Die Antwort des Dienstes ist nicht verwertbar. Melden Sie sich erneut an oder laden Sie die Seite später neu.';
    default:
      return failure satisfies never;
  }
}

function applySectionResult(
  current: Extract<AdminWebState, { readonly status: 'ready' }>,
  section: AdminSection,
  value: unknown,
): Extract<AdminWebState, { readonly status: 'ready' }> {
  if (section === 'setup') {
    const projection = value as SafeProjection;
    if (!sameOrganization(current.projection.organization, projection.organization)) {
      return {
        ...current,
        sections: {
          ...current.sections,
          setup: {
            status: 'unavailable',
            message: 'Die Einrichtung konnte nicht übernommen werden. Die Daten gehören nicht zum angemeldeten Betrieb. Melden Sie sich ab und erneut an.',
          },
        },
      };
    }
    return {
      ...current,
      projection,
      sections: { ...current.sections, setup: { status: 'ready' } },
    };
  }
  if (section === 'employees') {
    const employeeProjection = value as SafeEmployeeProjection;
    if (!sameOrganization(current.projection.organization, employeeProjection.organization)) {
      return {
        ...current,
        sections: {
          ...current.sections,
          employees: {
            status: 'unavailable',
            message: 'Die Beschäftigten konnten nicht übernommen werden. Die Daten gehören nicht zum angemeldeten Betrieb. Melden Sie sich ab und erneut an.',
          },
        },
      };
    }
    return {
      ...current,
      employeeProjection,
      sections: { ...current.sections, employees: { status: 'ready' } },
    };
  }
  if (section === 'timeRecords') {
    const page = value as CursorPage<SafeTimeRecord>;
    return {
      ...current,
      timeRecords: page.items,
      timeRecordsNextCursor: page.nextCursor,
      sections: { ...current.sections, timeRecords: { status: 'ready' } },
    };
  }
  const page = value as CursorPage<SafeReviewItem>;
  return {
    ...current,
    reviewItems: page.items,
    reviewItemsNextCursor: page.nextCursor,
    sections: { ...current.sections, reviewItems: { status: 'ready' } },
  };
}

function sameOrganization(
  left: { readonly id: string; readonly name: string },
  right: { readonly id: string; readonly name: string },
): boolean {
  return left.id === right.id && left.name === right.name;
}

function mergeCursorPage<Value extends Record<Key, string>, Key extends keyof Value>(
  current: readonly Value[],
  next: CursorPage<Value>,
  requestedCursor: string,
  key: Key,
): CursorPage<Value> | null {
  if (next.nextCursor === requestedCursor) return null;
  const ids = new Set(current.map((item) => item[key]));
  if (next.items.some((item) => ids.has(item[key]))) return null;
  return Object.freeze({
    items: Object.freeze([...current, ...next.items]),
    nextCursor: next.nextCursor,
  });
}

function mergeProjection(current: SafeProjection, next: SafeProjection, requestedCursor: string): SafeProjection | null {
  if (current.organization.id !== next.organization.id || current.organization.name !== next.organization.name || next.nextCursor === requestedCursor) return null;
  const customerIds = new Set(current.customers.map((customer) => customer.id));
  const tagIds = new Set(current.nfcTags.map((tag) => tag.id));
  if (next.customers.some((customer) => customerIds.has(customer.id)) || next.nfcTags.some((tag) => tagIds.has(tag.id))) return null;
  return Object.freeze({
    organization: current.organization,
    customers: Object.freeze([...current.customers, ...next.customers]),
    nfcTags: Object.freeze([...current.nfcTags, ...next.nfcTags]),
    nextCursor: next.nextCursor,
    customersComplete: current.customersComplete && next.customersComplete,
    nfcTagsComplete: current.nfcTagsComplete && next.nfcTagsComplete,
  });
}

function mergeEmployeeProjection(
  current: SafeEmployeeProjection,
  next: SafeEmployeeProjection,
  requestedCursor: string,
): SafeEmployeeProjection | null {
  if (
    current.organization.id !== next.organization.id
    || current.organization.name !== next.organization.name
    || next.nextCursor === requestedCursor
    || !isSafeEmployeeProjectionPage(next, requestedCursor)
  ) return null;
  const membershipIds = new Set(current.employeeMemberships.map((membership) => membership.id));
  if (next.employeeMemberships.some((membership) => membershipIds.has(membership.id))) return null;
  return Object.freeze({
    organization: current.organization,
    employeeMemberships: Object.freeze([
      ...current.employeeMemberships,
      ...next.employeeMemberships,
    ]),
    nextCursor: next.nextCursor,
  });
}

function boundedTimeWindow(now: number): { readonly fromInclusive: string; readonly toExclusive: string } {
  const maximumRangeMilliseconds = 31 * 24 * 60 * 60 * 1_000;
  return Object.freeze({
    fromInclusive: new Date(now - maximumRangeMilliseconds).toISOString(),
    toExclusive: new Date(now).toISOString(),
  });
}

function isBoundedTimeWindow(fromInclusive: string, toExclusive: string): boolean {
  const from = Date.parse(fromInclusive);
  const to = Date.parse(toExclusive);
  return Number.isFinite(from)
    && Number.isFinite(to)
    && new Date(from).toISOString() === fromInclusive
    && new Date(to).toISOString() === toExclusive
    && from < to
    && to - from <= TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS;
}

function isClosedInterval(startedAt: string, stoppedAt: string, now: number): boolean {
  const canonical = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  if (!canonical.test(startedAt) || !canonical.test(stoppedAt)) return false;
  const start = Date.parse(startedAt);
  const stop = Date.parse(stoppedAt);
  return Number.isFinite(start) && Number.isFinite(stop)
    && new Date(start).toISOString() === startedAt
    && new Date(stop).toISOString() === stoppedAt
    && start <= stop && stop <= now;
}

function buildResolution(intent: ReviewAdjudicationIntent): object | null {
  if (intent.resolution === 'no_time_record_change') return Object.freeze({ type: intent.resolution });
  if (intent.startedAt === null || intent.stoppedAt === null) return null;
  if (intent.resolution === 'create_recovered_time_record') {
    return Object.freeze({
      type: intent.resolution, startedAt: intent.startedAt, stoppedAt: intent.stoppedAt,
    });
  }
  if (intent.timeRecord === null) return null;
  return Object.freeze({
    type: intent.resolution,
    timeRecordId: intent.timeRecord.timeRecordId,
    expectedBaseRowVersion: intent.timeRecord.baseRowVersion,
    expectedRevisionNumber: intent.timeRecord.effectiveRevisionNumber,
    startedAt: intent.startedAt,
    stoppedAt: intent.stoppedAt,
  });
}

function correctionConflictNotice(code: string): string {
  if (code === 'not_adjustable') {
    return 'Die Korrektur konnte nicht gespeichert werden. Nur abgeschlossene Arbeitszeiten können korrigiert werden. Wählen Sie eine abgeschlossene Arbeitszeit.';
  }
  if (code === 'command_id_conflict') {
    return 'Die Korrektur konnte nicht gespeichert werden. Die Anfrage wurde bereits für einen anderen Vorgang verwendet. Laden Sie die Arbeitszeiten neu und versuchen Sie es erneut.';
  }
  return 'Die Korrektur konnte nicht gespeichert werden. Die Arbeitszeit wurde zwischenzeitlich verändert. Prüfen Sie die neu geladenen Daten und versuchen Sie es erneut.';
}

function adjudicationConflictNotice(code: string): string {
  if (code === 'invalid_evidence') {
    return 'Die Prüfentscheidung konnte nicht gespeichert werden. Die ausgewählten Prüffälle lassen sich nicht gemeinsam entscheiden. Entscheiden Sie die Prüffälle einzeln.';
  }
  if (code === 'command_id_conflict') {
    return 'Die Prüfentscheidung konnte nicht gespeichert werden. Die Anfrage wurde bereits für einen anderen Vorgang verwendet. Laden Sie die Prüfungen neu und versuchen Sie es erneut.';
  }
  return 'Die Prüfentscheidung konnte nicht gespeichert werden. Der Prüfstand wurde zwischenzeitlich verändert. Prüfen Sie die neu geladenen Daten und versuchen Sie es erneut.';
}

function signInFailureNotice(outcome: Exclude<AdminWebSignInOutcome, 'signed_in'>): string {
  switch (outcome) {
    case 'credentials_rejected':
    case 'email_not_confirmed':
    case 'access_blocked':
    case 'rate_limited':
    case 'service_unavailable':
      return SIGN_IN_FAILURE_NOTICES[outcome];
    default:
      return outcome satisfies never;
  }
}

function sameActiveRecord(a:MobileOwnTimeQueryResponse['activeRecord'],b:MobileOwnTimeQueryResponse['activeRecord']):boolean {
  if(a === null || b === null) return a === b;
  const ad=a.details,bd=b.details;
  if(ad===undefined || bd===undefined) {if(ad!==bd) return false;}
  else {
    if(['origin','baseRowVersion','effectiveRevisionNumber','comment','changed','overlapsAnotherRecord'].some(key=>ad[key as keyof typeof ad]!==bd[key as keyof typeof bd])) return false;
    if(ad.change===null || bd.change===null) {if(ad.change!==bd.change) return false;}
    else if(ad.change.at!==bd.change.at || ad.change.reason!==bd.change.reason || ad.change.actor!==bd.change.actor) return false;
  }
  return (Object.keys(a) as (keyof typeof a)[]).every(key=>key==='details' || a[key]===b[key]);
}
