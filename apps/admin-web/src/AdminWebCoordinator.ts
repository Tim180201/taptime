import type {
  AdminWebCapability,
  AdminWebState,
  ReviewAdjudicationIntent,
  SafeEmployeeProjection,
  SafeProjection,
  SafeReviewItem,
  SafeTimeRecord,
  VolatileInvitationSecret,
} from './contracts';
import { AdminWebApiClient, type AdminWebApiPort } from './AdminWebApiClient';
import { isSafeEmployeeProjectionPage } from './employeeProjectionSafety';
import { isValidTimeReviewReason } from '@taptime/time-review-contract';

export interface AdminWebAuthPort {
  signIn(email: string, password: string): Promise<boolean>;
  withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null>;
  signOut(): Promise<void>;
}

export class AdminWebCoordinator implements AdminWebCapability {
  private state: AdminWebState = Object.freeze({ status: 'signed_out' });
  private membershipId: string | null = null;
  private generation = 0;
  private authenticationQueue: Promise<void> = Promise.resolve();
  private invitationExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private invitationDisclosureEpoch = 0;
  private readonly invitationDisclosureEpochs = new WeakMap<VolatileInvitationSecret, number>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly auth: AdminWebAuthPort,
    private readonly api: AdminWebApiPort = new AdminWebApiClient(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  getState(): AdminWebState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async signIn(email: string, password: string): Promise<void> {
    const generation = ++this.generation;
    this.membershipId = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signing_in' });
    await this.enqueueAuthentication(() => this.completeSignIn(generation, email, password));
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    this.membershipId = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signed_out' });
    await this.enqueueAuthentication(() => this.safeSignOut());
  }

  async refresh(): Promise<void> {
    const membershipId = this.membershipId;
    if (membershipId === null) return;
    const generation = this.generation;
    this.setState({ status: 'loading' });
    let result;
    try {
      result = await this.loadReadyData(membershipId);
    } catch {
      result = null;
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') {
      this.setState(readyState(
        result.projection,
        result.employeeProjection,
        result.timeRecords,
        result.reviewItems,
        result.timeWindow,
      ));
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ status: 'unavailable', message: 'Administrationsdaten sind derzeit nicht erreichbar.' });
    }
  }

  async loadMore(): Promise<void> {
    let current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || current.projection.nextCursor === null) return;
    const generation = this.generation;
    const requestedCursor = current.projection.nextCursor;
    current = {
      ...current,
      invitation: null,
      reassignmentIntent: null,
      reassigning: false,
    };
    this.setState({ status: 'loading' });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.projection(token, membershipId, requestedCursor));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') {
      const merged = mergeProjection(current.projection, result.value, requestedCursor);
      if (merged !== null) {
        this.setState({ ...current, projection: merged, creating: false });
      } else {
        this.setState({ status: 'unavailable', message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ status: 'unavailable', message: 'Weitere Einrichtungsdaten sind derzeit nicht erreichbar.' });
    }
  }

  async createCustomer(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || displayName.trim().length < 1 || Array.from(displayName.normalize('NFC').trim()).length > 120) return;
    const generation = this.generation;
    this.setState({ ...current, creating: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createCustomer(token, membershipId, crypto.randomUUID(), displayName));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') {
      await this.refresh();
      if (generation !== this.generation) return;
      const next = this.state;
      if (next.status === 'ready') this.setState({ ...next, notice: 'Kunde wurde sicher angelegt.' });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      const latest = this.state;
      if (latest.status === 'ready') {
        this.setState({
          ...latest,
          creating: false,
          notice: 'Kunde konnte nicht bestätigt angelegt werden.',
        });
      }
    }
  }

  async loadMoreEmployees(): Promise<void> {
    let current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || current.employeeProjection.nextCursor === null
    ) return;
    const requestedCursor = current.employeeProjection.nextCursor;
    current = {
      ...current,
      reassignmentIntent: null,
      reassigning: false,
    };
    this.setState(current);
    const generation = this.generation;
    let result;
    try {
      result = await this.auth.withAccessToken(
        (token) => this.api.employeeProjection(token, membershipId, requestedCursor),
      );
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
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
        this.setState({ ...latest, employeeProjection: merged });
      } else {
        this.setState({ status: 'unavailable', message: 'Weitere Beschäftigtendaten konnten nicht sicher bestätigt werden.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ ...latest, notice: 'Weitere Beschäftigtendaten sind derzeit nicht erreichbar.' });
    }
  }

  async createEmployeeInvitation(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || displayName.trim().length < 1
      || Array.from(displayName.normalize('NFC').trim()).length > 120
    ) return;
    const generation = this.generation;
    this.setState({
      ...current,
      creatingEmployee: true,
      invitation: null,
      notice: null,
    });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createEmployeeInvitation(
        token,
        membershipId,
        crypto.randomUUID(),
        displayName,
      ));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      this.setState({
        ...latest,
        creatingEmployee: false,
        invitation: result.value,
        notice: 'Einladung wurde einmalig erzeugt.',
      });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else if (result.status === 'conflict') {
      const notice = result.code === 'invitation_limit_reached'
        ? 'Es sind bereits fünf aktive Einladungen vorhanden.'
        : result.code === 'invitation_created_token_unavailable'
          ? 'Diese Einladung wurde bereits erzeugt; ihr Geheimnis kann nicht erneut angezeigt werden.'
          : 'Die Einladungsanfrage steht mit einer vorhandenen Anfrage in Konflikt.';
      this.setState({ ...latest, creatingEmployee: false, invitation: null, notice });
    } else {
      this.setState({
        ...latest,
        creatingEmployee: false,
        invitation: null,
        notice: 'Einladung konnte nicht sicher erzeugt werden.',
      });
    }
  }

  dismissInvitation(): void {
    const current = this.state;
    if (current.status !== 'ready' || current.invitation === null) return;
    this.setState({ ...current, invitation: null, notice: 'Einladungsgeheimnis wurde verworfen.' });
  }

  prepareReassignment(nfcTagId: string, targetCustomerId: string): void {
    const current = this.state;
    if (current.status !== 'ready' || current.reassigning) return;
    const tag = current.projection.nfcTags.find((candidate) => candidate.id === nfcTagId);
    const target = current.projection.customers.find(
      (candidate) => candidate.id === targetCustomerId && candidate.active,
    );
    if (
      tag === undefined
      || target === undefined
      || tag.assignmentState !== 'assigned'
      || tag.targetCustomerId === null
      || tag.activeAssignmentId === null
      || tag.targetCustomerId === target.id
    ) {
      this.setState({
        ...current,
        reassignmentIntent: null,
        notice: 'Die gewünschte Zuordnung ist nicht sicher verfügbar.',
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
    ) return;
    const generation = this.generation;
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
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.reassignmentIntent?.commandId !== intent.commandId) return;
    if (result?.status === 'succeeded') {
      await this.refresh();
      if (generation !== this.generation) return;
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
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
      return;
    }
    if (result.status === 'conflict' && result.code !== 'assignment_in_use') {
      await this.refresh();
      if (generation !== this.generation) return;
      const refreshed = this.state;
      if (refreshed.status === 'ready') {
        const notice = result.code === 'assignment_target_unavailable'
          ? 'Der Zielkunde ist nicht mehr aktiv verfügbar.'
          : result.code === 'assignment_conflict'
            ? 'Die Zuordnung wurde zwischenzeitlich geändert. Daten wurden neu geladen.'
            : 'Die Änderungsanfrage steht mit einer vorhandenen Anfrage in Konflikt.';
        this.setState({ ...refreshed, notice });
      }
      return;
    }
    this.setState({
      ...latest,
      reassigning: false,
      notice: result.status === 'conflict'
        ? 'Für diese Zuordnung läuft noch eine Arbeitszeit. Bitte zuerst stoppen und dann erneut bestätigen.'
        : 'Zuordnung konnte nicht sicher bestätigt werden. Erneut bestätigen verwendet dieselbe Anfrage.',
    });
  }

  prepareCorrection(
    timeRecordId: string,
    startedAt: string,
    stoppedAt: string,
    reason: string,
  ): void {
    const current = this.state;
    if (current.status !== 'ready' || current.timeReviewBusy) return;
    const record = current.timeRecords.find((candidate) => candidate.timeRecordId === timeRecordId);
    if (
      record === undefined || record.status !== 'stopped' || record.stoppedAt === null
      || !isClosedInterval(startedAt, stoppedAt, this.now()) || !isValidTimeReviewReason(reason)
      || (record.startedAt === startedAt && record.stoppedAt === stoppedAt)
    ) {
      this.setState({ ...current, correctionIntent: null, notice: 'Die Korrekturangaben sind nicht sicher verwendbar.' });
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
    if (current.status !== 'ready' || current.correctionIntent === null || current.timeReviewBusy) return;
    this.setState({ ...current, correctionIntent: null, notice: 'Korrektur wurde verworfen.' });
  }

  async confirmCorrection(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || current.correctionIntent === null
      || current.timeReviewBusy || membershipId === null) return;
    const generation = this.generation;
    const intent = current.correctionIntent;
    this.setState({ ...current, invitation: null, timeReviewBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.correctTimeRecord(
        token, membershipId, intent.commandId, intent.timeRecord,
        intent.startedAt, intent.stoppedAt, intent.reason,
      ));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.correctionIntent?.commandId !== intent.commandId) return;
    if (result?.status === 'succeeded') {
      await this.refresh();
      if (generation === this.generation && this.state.status === 'ready') {
        this.setState({ ...this.state, notice: 'Arbeitszeit wurde append-only korrigiert.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else if (result.status === 'conflict') {
      await this.refresh();
      if (generation === this.generation && this.state.status === 'ready') {
        this.setState({ ...this.state, notice: correctionConflictNotice(result.code) });
      }
    } else {
      this.setState({
        ...latest, timeReviewBusy: false,
        notice: 'Korrektur konnte nicht sicher bestätigt werden. Erneut bestätigen verwendet dieselbe Anfrage.',
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
    if (current.status !== 'ready' || current.timeReviewBusy) return;
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
      this.setState({ ...current, adjudicationIntent: null, notice: 'Die Review-Entscheidung ist nicht sicher verwendbar.' });
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
    if (current.status !== 'ready' || current.adjudicationIntent === null || current.timeReviewBusy) return;
    this.setState({ ...current, adjudicationIntent: null, notice: 'Review-Entscheidung wurde verworfen.' });
  }

  async confirmAdjudication(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || current.adjudicationIntent === null
      || current.timeReviewBusy || membershipId === null) return;
    const generation = this.generation;
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
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    const latest = this.state;
    if (latest.status !== 'ready' || latest.adjudicationIntent?.commandId !== intent.commandId) return;
    if (result?.status === 'succeeded') {
      await this.refresh();
      if (generation === this.generation && this.state.status === 'ready') {
        this.setState({ ...this.state, notice: 'Review-Entscheidung wurde append-only protokolliert.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else if (result.status === 'conflict') {
      await this.refresh();
      if (generation === this.generation && this.state.status === 'ready') {
        this.setState({ ...this.state, notice: adjudicationConflictNotice(result.code) });
      }
    } else {
      this.setState({
        ...latest, timeReviewBusy: false,
        notice: 'Review-Entscheidung konnte nicht sicher bestätigt werden. Erneut bestätigen verwendet dieselbe Anfrage.',
      });
    }
  }

  async exportTimeRecords(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || current.timeReviewBusy || membershipId === null) return;
    const generation = this.generation;
    this.setState({ ...current, timeReviewBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.exportTimeEntries(
        token, membershipId, current.timeWindow.fromInclusive, current.timeWindow.toExclusive,
      ));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
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
        this.setState({ ...latest, timeReviewBusy: false, notice: 'CSV-Export wurde erzeugt.' });
      } catch {
        this.setState({ ...latest, timeReviewBusy: false, notice: 'CSV-Export konnte nicht sicher bereitgestellt werden.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ ...latest, timeReviewBusy: false, notice: 'CSV-Export ist derzeit nicht verfügbar.' });
    }
  }

  private async loadReadyData(membershipId: string): Promise<
    | {
        readonly status: 'succeeded'; readonly projection: SafeProjection;
        readonly employeeProjection: SafeEmployeeProjection;
        readonly timeRecords: readonly SafeTimeRecord[];
        readonly reviewItems: readonly SafeReviewItem[];
        readonly timeWindow: { readonly fromInclusive: string; readonly toExclusive: string };
      }
    | { readonly status: 'rejected' | 'unavailable' }
  > {
    const timeWindow = boundedTimeWindow(this.now());
    const projection = await this.auth.withAccessToken(
      (token) => this.api.projection(token, membershipId, null),
    );
    if (projection?.status !== 'succeeded') return classifyLoadFailure(projection);
    const employees = await this.auth.withAccessToken(
      (token) => this.api.employeeProjection(token, membershipId, null),
    );
    if (employees?.status !== 'succeeded') return classifyLoadFailure(employees);
    const records = await this.auth.withAccessToken((token) => this.api.timeRecords(
      token, membershipId, timeWindow.fromInclusive, timeWindow.toExclusive,
    ));
    if (records?.status !== 'succeeded') return classifyLoadFailure(records);
    const reviewItems = await this.auth.withAccessToken(
      (token) => this.api.reviewItems(token, membershipId),
    );
    if (reviewItems?.status !== 'succeeded') return classifyLoadFailure(reviewItems);
    return {
      status: 'succeeded', projection: projection.value,
      employeeProjection: employees.value, timeRecords: records.value,
      reviewItems: reviewItems.value, timeWindow,
    };
  }

  private async completeSignIn(generation: number, email: string, password: string): Promise<void> {
    try {
      if (!await this.auth.signIn(email, password)) {
        await this.safeSignOut();
        if (generation === this.generation) this.setState({ status: 'signed_out' });
        return;
      }
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      const session = await this.auth.withAccessToken((token) => this.api.session(token));
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      if (session?.status !== 'succeeded') {
        await this.rejectWithinAuthentication(generation, 'Sitzung konnte nicht sicher bestätigt werden.');
        return;
      }
      if (session.value.role !== 'administrator') {
        await this.rejectWithinAuthentication(generation, 'Diese Oberfläche ist nur für Administratoren verfügbar.', true);
        return;
      }
      this.membershipId = session.value.membershipId;
      this.setState({ status: 'loading' });
      const projection = await this.loadReadyData(session.value.membershipId);
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      if (projection?.status === 'succeeded') {
        this.setState(readyState(
          projection.projection, projection.employeeProjection, projection.timeRecords,
          projection.reviewItems, projection.timeWindow,
        ));
      } else if (projection === null || projection.status === 'rejected') {
        await this.rejectWithinAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
      } else {
        this.setState({ status: 'unavailable', message: 'Einrichtungsdaten sind derzeit nicht erreichbar.' });
      }
    } catch {
      await this.safeSignOut();
      if (generation === this.generation) {
        this.membershipId = null;
        this.setState({ status: 'unavailable', message: 'Anmeldung derzeit nicht verfügbar.' });
      }
    }
  }

  private async rejectWithinAuthentication(generation: number, message: string, forbidden = false): Promise<void> {
    if (generation !== this.generation) { await this.safeSignOut(); return; }
    this.membershipId = null;
    const invalidatedGeneration = ++this.generation;
    await this.safeSignOut();
    if (invalidatedGeneration === this.generation) this.setState({ status: forbidden ? 'forbidden' : 'unavailable', message });
  }

  private async rejectOutsideAuthentication(generation: number, message: string): Promise<void> {
    if (generation !== this.generation) return;
    this.membershipId = null;
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
        this.state = Object.freeze({ ...state, invitation: null, notice: 'Einladung ist abgelaufen.' });
      } else {
        this.invitationExpiryTimer = setTimeout(() => {
          const current = this.state;
          if (
            generation === this.generation
            && current.status === 'ready'
            && current.invitation?.value === invitation.value
          ) {
            this.setState({ ...current, invitation: null, notice: 'Einladung ist abgelaufen.' });
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

function readyState(
  projection: SafeProjection,
  employeeProjection: SafeEmployeeProjection,
  timeRecords: readonly SafeTimeRecord[],
  reviewItems: readonly SafeReviewItem[],
  timeWindow: { readonly fromInclusive: string; readonly toExclusive: string },
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
    projection,
    employeeProjection,
    creating: false,
    creatingEmployee: false,
    invitation: null,
    reassignmentIntent: null,
    reassigning: false,
    timeRecords,
    reviewItems,
    timeWindow,
    timeReviewBusy: false,
    correctionIntent: null,
    adjudicationIntent: null,
    notice: null,
  };
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

function classifyLoadFailure(
  result: { readonly status: string } | null,
): { readonly status: 'rejected' | 'unavailable' } {
  return { status: result === null || result.status === 'rejected' ? 'rejected' : 'unavailable' };
}

function correctionConflictNotice(code: string): string {
  if (code === 'not_adjustable') return 'Nur abgeschlossene Arbeitszeiten können korrigiert werden.';
  if (code === 'command_id_conflict') return 'Die Command-ID gehört bereits zu einer anderen Anfrage.';
  return 'Die Arbeitszeit wurde zwischenzeitlich verändert. Daten wurden sicher neu geladen.';
}

function adjudicationConflictNotice(code: string): string {
  if (code === 'invalid_evidence') return 'Die ausgewählte Review-Evidence kann nicht gemeinsam entschieden werden.';
  if (code === 'command_id_conflict') return 'Die Command-ID gehört bereits zu einer anderen Anfrage.';
  return 'Der Review-Stand wurde zwischenzeitlich verändert. Daten wurden sicher neu geladen.';
}
