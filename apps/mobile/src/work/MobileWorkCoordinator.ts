import { dayStart, shiftMonth } from '@taptime/core';
import { captureFeedback, type MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import type { CustomerHoursResult } from '@taptime/mobile-work-contract';
import type { SafeWorkTarget } from '@taptime/mobile-work-contract';
import type {
  MobileWorkApiPort,
  MobileWorkCapability,
  MobileWorkSessionReader,
  MobileWorkState,
} from './contracts';
import type { ManualOfflineCapturePort } from '../offline/OfflineCaptureCoordinator';

export class MobileWorkCoordinator implements MobileWorkCapability {
  private state: MobileWorkState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private unsubscribeManualAcknowledgements: (() => void) | null = null;
  private generation = 0;
  private ownTimeCursors = new Set<string>();
  private boundSessionGeneration: number | null = null;
  private pendingManualEventIds: string[] = [];
  private readonly pendingCapture = new Map<string, {before:MobileOwnTimeQueryResponse; followup?:SafeWorkTarget}>();
  private manualAcknowledgementFlight: Promise<void> | null = null;
  private manualAcknowledgementRequested = false;

  constructor(
    private readonly session: MobileWorkSessionReader,
    private readonly api: MobileWorkApiPort,
    private readonly offlineCapture: ManualOfflineCapturePort | null = null,
  ) {}

  getState(): MobileWorkState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.unsubscribe !== null) return;
    this.unsubscribe = this.session.subscribe(() => {
      const snapshot = this.session.capture();
      if (
        snapshot === null
        || (
          this.boundSessionGeneration !== null
          && snapshot.generation !== this.boundSessionGeneration
        )
      ) {
        this.generation += 1;
        this.ownTimeCursors.clear();
        this.boundSessionGeneration = snapshot?.generation ?? null;
        this.pendingManualEventIds = [];
        this.pendingCapture.clear();
        this.setState({ status: 'inactive' });
      }
    });
    this.unsubscribeManualAcknowledgements =
      this.offlineCapture?.subscribeManualAcknowledgements?.(
        () => { void this.handleManualAcknowledgement(); },
      ) ?? null;
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeManualAcknowledgements?.();
    this.unsubscribeManualAcknowledgements = null;
    this.generation += 1;
    this.ownTimeCursors.clear();
    this.boundSessionGeneration = null;
    this.pendingManualEventIds = [];
    this.pendingCapture.clear();
    this.setState({ status: 'inactive' });
  }

  async setCustomerQuota(customerId:string,minutes:number|null):Promise<import('@taptime/mobile-work-contract').SetCustomerQuotaResult> {
    const snapshot=this.session.capture();
    if(!snapshot || snapshot.session.role==='employee') return {status:'forbidden'};
    try {
      const result=await this.api.setCustomerQuota?.(snapshot.session.membershipId,customerId,minutes)??{status:'unavailable' as const};
      return this.session.isCurrent(snapshot)?result:{status:'forbidden'};
    } catch {return {status:'unavailable'};}
  }

  async readCustomerHours(month: string): Promise<CustomerHoursResult> {
    const snapshot = this.session.capture();
    if (!snapshot) return {status:'authority_rejected'};
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return {status:'unavailable'};
    try {
      const result = await this.api.readCustomerHours?.({responseVersion:'customer-hours.v2',expectedMembershipId:snapshot.session.membershipId,
        fromInclusive:new Date(dayStart(`${month}-01`)).toISOString(),
        toExclusive:new Date(dayStart(`${shiftMonth(month,1)}-01`)).toISOString()}) ?? {status:'unavailable' as const};
      return this.session.isCurrent(snapshot) ? result : {status:'authority_rejected'};
    } catch { return {status:'unavailable'}; }
  }

  async refresh(): Promise<void> {
    if (this.state.status === 'ready' && this.state.submitting) return;
    const snapshot = this.session.capture();
    if (snapshot === null) {
      this.setState({ status: 'inactive' });
      return;
    }
    this.boundSessionGeneration = snapshot.generation;
    const generation = ++this.generation;
    this.ownTimeCursors.clear();
    this.setState({ status: 'loading' });
    const result = await this.api.read(snapshot.session.membershipId);
    if (
      generation !== this.generation
      || !this.session.isCurrent(snapshot)
    ) return;
    if (result.status === 'ready') {
      if (!validOwnTimeProjection(result.ownTime)) {
        this.setState({
          status: 'unavailable',
          message: 'Arbeitsdaten sind derzeit nicht erreichbar.',
        });
        return;
      }
      this.setState({
        status: 'ready',
        ownTime: freezeOwnTime(result.ownTime),
        targets: result.targets,
        submitting: false,
        loadingMore: false,
        outcome: this.pendingManualEventIds.length === 0 ? null : 'pending',
      });
      return;
    }
    this.setState({
      status: 'unavailable',
      message: result.status === 'authority_rejected'
        ? 'Die Sitzung ist nicht mehr gültig.'
        : 'Arbeitsdaten sind derzeit nicht erreichbar.',
    });
  }

  async loadMoreOwnTime(): Promise<void> {
    const snapshot = this.session.capture();
    const current = this.state;
    if (
      snapshot === null
      || current.status !== 'ready'
      || current.submitting
      || current.loadingMore
      || current.ownTime.nextCursor === null
      || this.ownTimeCursors.has(current.ownTime.nextCursor)
    ) return;
    const generation = this.generation;
    const cursor = current.ownTime.nextCursor;
    this.ownTimeCursors.add(cursor);
    this.setState({ ...current, loadingMore: true });
    const result = await this.api.readOwnTimePage(snapshot.session.membershipId, cursor);
    if (
      generation !== this.generation
      || !this.session.isCurrent(snapshot)
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (
      result.status !== 'ready'
      || !sameOwnTimeFrame(latest.ownTime, result.ownTime)
      || !validOwnTimeContinuation(latest.ownTime, result.ownTime)
      || (
        result.ownTime.nextCursor !== null
        && this.ownTimeCursors.has(result.ownTime.nextCursor)
      )
    ) {
      this.setState({
        status: 'unavailable',
        message: result.status === 'authority_rejected'
          ? 'Die Sitzung ist nicht mehr gültig.'
          : 'Arbeitsdaten sind derzeit nicht erreichbar.',
      });
      return;
    }
    this.setState({
      ...latest,
      loadingMore: false,
      ownTime: freezeOwnTime({
        ...result.ownTime,
        records: [...latest.ownTime.records, ...result.ownTime.records],
      }),
    });
  }

  async triggerManual(target: SafeWorkTarget): Promise<void> {
    const current = this.state;
    if (current.status !== 'ready' || !current.targets.targets.some(candidate =>
      candidate.targetType === target.targetType && candidate.targetId === target.targetId)) return;
    await this.capture(target);
  }

  async triggerBreak(): Promise<void> { await this.capture('break'); }

  async stopActiveTime(): Promise<void> {
    const current = this.state;
    if (current.status !== 'ready' || !current.ownTime.activeRecord?.targetId) return;
    const active = current.ownTime.activeRecord;
    const target:SafeWorkTarget = {targetType:active.targetType,targetId:active.targetId!,displayName:active.targetDisplayName};
    await this.capture(active.breakStartedAt ? 'break' : target, active.breakStartedAt ? target : undefined);
  }

  private async capture(target: SafeWorkTarget | 'break', followup?: SafeWorkTarget): Promise<void> {
    const snapshot = this.session.capture(), current = this.state;
    if (!snapshot || current.status !== 'ready' || current.submitting) return;
    const generation = ++this.generation, before = current.ownTime;
    this.ownTimeCursors.clear();
    this.setState({...current, submitting:true, loadingMore:false, outcome:null, feedback:null});
    try {
      if (this.offlineCapture) {
        await this.enqueueCapture(target, before, followup);
        return;
      }
      let result = target === 'break' ? await this.api.triggerBreak?.(snapshot.session.membershipId)
        : await this.api.triggerManual(snapshot.session.membershipId,target);
      if (generation !== this.generation || !this.session.isCurrent(snapshot)) return;
      if (followup && result?.status === 'accepted' && result.outcome === 'break_stopped') {
        result = await this.api.triggerManual(snapshot.session.membershipId,followup);
        if (generation !== this.generation || !this.session.isCurrent(snapshot)) return;
      }
      const outcome = result?.status === 'accepted' ? result.outcome : result?.status === 'authority_rejected' ? 'rejected' : 'pending';
      await this.reloadAfterCapture(outcome,before,generation);
    } catch {
      if (generation === this.generation && this.session.isCurrent(snapshot) && this.state.status === 'ready')
        this.setState({...this.state,submitting:false,outcome:'pending'});
    }
  }

  private async enqueueCapture(target: SafeWorkTarget | 'break', before:MobileOwnTimeQueryResponse, followup?:SafeWorkTarget):Promise<void> {
    const snapshot=this.session.capture(), generation=this.generation;
    const result=target==='break' ? await this.offlineCapture!.captureBreak?.() : await this.offlineCapture!.captureManual(target);
    if (!snapshot || generation!==this.generation || !this.session.isCurrent(snapshot) || this.state.status!=='ready') return;
    if (result?.status==='saved') {
      this.pendingCapture.set(result.workEventId,{before,followup});
      this.pendingManualEventIds.push(result.workEventId);
    }
    this.setState({...this.state,submitting:result?.status==='saved' && this.offlineCapture?.readManualAcknowledgement!==undefined,
      outcome:result?.status==='saved'?'pending':'rejected'});
    if(result?.status==='saved') await this.handleManualAcknowledgement();
  }

  private async reloadAfterCapture(outcome:import('./contracts').ManualTriggerOutcome, before:MobileOwnTimeQueryResponse, generation:number):Promise<void> {
    const snapshot=this.session.capture();if(!snapshot)return;
    const result=await this.api.read(snapshot.session.membershipId).catch(()=>({status:'unavailable' as const}));
    if(generation!==this.generation || !this.session.isCurrent(snapshot) || this.state.status!=='ready')return;
    this.ownTimeCursors.clear();
    if(result.status==='ready' && validOwnTimeProjection(result.ownTime)) {
      this.setState({...this.state,ownTime:freezeOwnTime(result.ownTime),targets:result.targets,
        submitting:false,loadingMore:false,outcome,feedback:captureFeedback(outcome,before,result.ownTime)});
    } else this.setState({status:'unavailable',message:'Bestätigte Zeiten konnten nicht neu geladen werden. Bitte erneut laden.'});
  }

  private async enqueueFollowup(target:SafeWorkTarget,before:MobileOwnTimeQueryResponse,generation:number):Promise<void> {
    const snapshot=this.session.capture();
    const result=await this.offlineCapture!.captureManual(target).catch(()=>({status:'unavailable' as const}));
    if(!snapshot || generation!==this.generation || !this.session.isCurrent(snapshot) || this.state.status!=='ready')return;
    if(result.status==='saved') {
      this.pendingCapture.set(result.workEventId,{before});this.pendingManualEventIds.push(result.workEventId);
      this.setState({...this.state,submitting:true,outcome:'pending'});
    } else await this.reloadAfterCapture('rejected',before,generation);
  }

  private setState(state: MobileWorkState): void {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }

  private handleManualAcknowledgement(): Promise<void> {
    this.manualAcknowledgementRequested = true;
    if (this.manualAcknowledgementFlight !== null) {
      return this.manualAcknowledgementFlight;
    }
    let flight!: Promise<void>;
    flight = (async () => {
      do { this.manualAcknowledgementRequested = false; await this.processManualAcknowledgements(); }
      while (this.manualAcknowledgementRequested);
    })().finally(() => {
      if (this.manualAcknowledgementFlight === flight) {
        this.manualAcknowledgementFlight = null;
        if (this.manualAcknowledgementRequested) {
          void this.handleManualAcknowledgement();
        }
      }
    });
    this.manualAcknowledgementFlight = flight;
    return flight;
  }

  private async processManualAcknowledgements(): Promise<void> {
    const offlineCapture = this.offlineCapture;
    if (offlineCapture?.readManualAcknowledgement === undefined) return;
    while (this.pendingManualEventIds.length > 0) {
      const workEventId = this.pendingManualEventIds[0]!;
      const acknowledgement = offlineCapture.readManualAcknowledgement(workEventId);
      if (
        acknowledgement === null
        || acknowledgement.status === 'pending'
        || acknowledgement.status === 'review_pending'
        || acknowledgement.status === 'protected'
      ) {
        if(acknowledgement?.status==='review_pending' || acknowledgement?.status==='protected') {
          const context=this.pendingCapture.get(workEventId);
          if(context)this.pendingCapture.set(workEventId,{before:context.before});
          if(this.state.status==='ready')this.setState({...this.state,submitting:false,outcome:'pending'});
        }
        return;
      }
      const snapshot = this.session.capture();
      const current = this.state;
      if (
        snapshot === null
        || current.status !== 'ready'
        || !this.session.isCurrent(snapshot)
        || workEventId !== this.pendingManualEventIds[0]
      ) return;
      this.pendingManualEventIds.shift();
      const context=this.pendingCapture.get(workEventId);
      this.pendingCapture.delete(workEventId);
      const outcome='outcome' in acknowledgement ? acknowledgement.outcome : 'rejected';
      const generation = ++this.generation;
      this.ownTimeCursors.clear();
      this.setState({...current,submitting:true,loadingMore:false});
      if (context?.followup && outcome==='break_stopped') {
        await this.enqueueFollowup(context.followup,context.before,generation);
        continue;
      }
      await this.reloadAfterCapture(outcome,context?.before??current.ownTime,generation);
    }
  }
}

function validOwnTimeProjection(
  ownTime: Extract<MobileWorkState, { status: 'ready' }>['ownTime'],
): boolean {
  const identities = new Set<string>();
  if (ownTime.activeRecord !== null) identities.add(ownTime.activeRecord.timeRecordId);
  for (const record of ownTime.records) {
    if (identities.has(record.timeRecordId)) return false;
    identities.add(record.timeRecordId);
  }
  return true;
}

function validOwnTimeContinuation(
  current: Extract<MobileWorkState, { status: 'ready' }>['ownTime'],
  next: Extract<MobileWorkState, { status: 'ready' }>['ownTime'],
): boolean {
  const identities = new Set(current.records.map((record) => record.timeRecordId));
  if (current.activeRecord !== null) identities.add(current.activeRecord.timeRecordId);
  for (const record of next.records) {
    if (identities.has(record.timeRecordId)) return false;
    identities.add(record.timeRecordId);
  }
  return true;
}

function sameOwnTimeFrame(
  current: Extract<MobileWorkState, { status: 'ready' }>['ownTime'],
  next: Extract<MobileWorkState, { status: 'ready' }>['ownTime'],
): boolean {
  return current.windowStartedAt === next.windowStartedAt
    && current.windowEndedAt === next.windowEndedAt
    && (
      current.activeRecord === null
        ? next.activeRecord === null
        : next.activeRecord !== null
          && sameOwnTimeRecord(current.activeRecord, next.activeRecord)
    );
}

function sameOwnTimeRecord(
  left: NonNullable<Extract<MobileWorkState, { status: 'ready' }>['ownTime']['activeRecord']>,
  right: NonNullable<Extract<MobileWorkState, { status: 'ready' }>['ownTime']['activeRecord']>,
): boolean {
  return left.targetId === right.targetId && left.breakStartedAt === right.breakStartedAt
    && left.timeRecordId === right.timeRecordId
    && left.source === right.source
    && left.targetType === right.targetType
    && left.targetDisplayName === right.targetDisplayName
    && left.status === right.status
    && left.startedAt === right.startedAt
    && left.stoppedAt === right.stoppedAt
    && left.startedVia === right.startedVia
    && left.stoppedVia === right.stoppedVia;
}

function freezeOwnTime(
  ownTime: Extract<MobileWorkState, { status: 'ready' }>['ownTime'],
): Extract<MobileWorkState, { status: 'ready' }>['ownTime'] {
  return Object.freeze({
    ...ownTime,
    activeRecord: ownTime.activeRecord === null
      ? null
      : Object.freeze({ ...ownTime.activeRecord }),
    records: Object.freeze(ownTime.records.map((record) => Object.freeze({ ...record }))),
  });
}
