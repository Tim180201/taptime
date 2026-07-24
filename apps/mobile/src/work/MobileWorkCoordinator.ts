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
  private pendingManualEventId: string | null = null;

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
        this.pendingManualEventId = null;
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
    this.pendingManualEventId = null;
    this.setState({ status: 'inactive' });
  }

  async refresh(): Promise<void> {
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
        outcome: this.pendingManualEventId === null ? null : 'pending',
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
    const snapshot = this.session.capture();
    const current = this.state;
    if (
      snapshot === null
      || current.status !== 'ready'
      || current.submitting
      || this.pendingManualEventId !== null
      || !current.targets.targets.some((candidate) => (
        candidate.targetType === target.targetType
        && candidate.targetId === target.targetId
      ))
    ) return;
    const generation = this.generation;
    this.setState({ ...current, submitting: true, outcome: null });
    const offlineCapture = this.offlineCapture;
    if (offlineCapture !== null) {
      const result = await offlineCapture.captureManual(target);
      if (
        generation !== this.generation
        || !this.session.isCurrent(snapshot)
      ) return;
      const latest = this.state;
      if (latest.status !== 'ready') return;
      if (result.status === 'saved') {
        this.pendingManualEventId = result.workEventId;
      }
      this.setState({
        ...latest,
        submitting: false,
        outcome: result.status === 'saved' ? 'pending' : 'rejected',
      });
      if (result.status === 'saved') {
        await this.handleManualAcknowledgement();
      }
      return;
    }
    const result = await this.api.triggerManual(snapshot.session.membershipId, target);
    if (
      generation !== this.generation
      || !this.session.isCurrent(snapshot)
    ) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result.status === 'accepted') {
      this.setState({ ...latest, submitting: false, outcome: result.outcome });
      await this.refresh();
      const refreshed = this.state;
      if (refreshed.status === 'ready') {
        this.setState({ ...refreshed, outcome: result.outcome });
      }
    } else {
      this.setState({
        ...latest,
        submitting: false,
        outcome: result.status === 'authority_rejected' ? 'rejected' : 'pending',
      });
    }
  }

  private setState(state: MobileWorkState): void {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }

  private async handleManualAcknowledgement(): Promise<void> {
    const workEventId = this.pendingManualEventId;
    const offlineCapture = this.offlineCapture;
    if (
      workEventId === null
      || offlineCapture?.readManualAcknowledgement === undefined
    ) return;
    const acknowledgement = offlineCapture.readManualAcknowledgement(workEventId);
    if (
      acknowledgement === null
      || acknowledgement.status === 'pending'
      || acknowledgement.status === 'review_pending'
      || acknowledgement.status === 'protected'
    ) return;
    const snapshot = this.session.capture();
    const current = this.state;
    if (
      snapshot === null
      || current.status !== 'ready'
      || !this.session.isCurrent(snapshot)
      || workEventId !== this.pendingManualEventId
    ) return;
    this.pendingManualEventId = null;
    if (acknowledgement.status === 'rejected') {
      this.setState({ ...current, submitting: false, outcome: 'rejected' });
      return;
    }
    if (!('outcome' in acknowledgement)) return;
    const outcome = acknowledgement.outcome;
    await this.refresh();
    if (!this.session.isCurrent(snapshot)) return;
    const refreshed = this.state;
    if (refreshed.status === 'ready') {
      this.setState({ ...refreshed, outcome });
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
  return left.timeRecordId === right.timeRecordId
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
