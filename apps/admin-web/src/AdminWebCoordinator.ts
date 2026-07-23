import type {
  AdminWebCapability,
  AdminSection,
  AdminWebState,
  CursorPage,
  ReviewAdjudicationIntent,
  SafeEmployeeProjection,
  SafeProjection,
  SafeReviewItem,
  SafeTimeRecord,
  VolatileInvitationSecret,
} from './contracts';
import {
  AdminWebApiClient,
  type AdminWebApiPort,
  type ApiResult,
} from './AdminWebApiClient';
import { isSafeEmployeeProjectionPage } from './employeeProjectionSafety';
import { isValidTimeReviewReason } from '@taptime/time-review-contract';

export interface AdminWebAuthPort {
  signIn(email: string, password: string): Promise<boolean>;
  withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null>;
  signOut(): Promise<void>;
}

type ApiSectionResult<Value> =
  | { readonly status: 'succeeded'; readonly value: Value }
  | { readonly status: 'unavailable' };

type ReadyDataResult =
  | {
      readonly status: 'succeeded' | 'partial';
      readonly projection: ApiSectionResult<SafeProjection>;
      readonly employeeProjection: ApiSectionResult<SafeEmployeeProjection>;
      readonly timeRecords: ApiSectionResult<CursorPage<SafeTimeRecord>>;
      readonly reviewItems: ApiSectionResult<CursorPage<SafeReviewItem>>;
      readonly timeWindow: { readonly fromInclusive: string; readonly toExclusive: string };
    }
  | { readonly status: 'rejected' };

export class AdminWebCoordinator implements AdminWebCapability {
  private state: AdminWebState = Object.freeze({ status: 'signed_out' });
  private membershipId: string | null = null;
  private generation = 0;
  private refreshEpoch = 0;
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
  ) {}

  getState(): AdminWebState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  invalidateTimeBoundIntents(): void {
    const current = this.state;
    if (
      current.status !== 'ready'
      || (
        current.correctionIntent === null
        && current.adjudicationIntent === null
        && !current.timeReviewBusy
      )
    ) return;
    this.setState({
      ...current,
      correctionIntent: null,
      adjudicationIntent: null,
      timeReviewBusy: false,
      notice: 'Zeitzone wurde geändert; offene Zeitangaben wurden sicher verworfen.',
    });
    void this.refresh();
  }

  async signIn(email: string, password: string): Promise<void> {
    const generation = ++this.generation;
    this.refreshEpoch += 1;
    this.membershipId = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signing_in' });
    await this.enqueueAuthentication(() => this.completeSignIn(generation, email, password));
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    this.refreshEpoch += 1;
    this.membershipId = null;
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
      sections: allSections({ status: 'loading' }),
      notice: null,
    });
    const result = await this.loadReadyData(membershipId);
    if (generation !== this.generation || refreshEpoch !== this.refreshEpoch) return;
    if (result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
      return;
    }
    const latest = this.state;
    if (latest.status !== 'ready') return;
    this.setState(mergeRefreshResult(latest, result));
  }

  async retrySection(section: AdminSection): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null) return;
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
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
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
            message: sectionUnavailableMessage(section),
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
    if (current.status !== 'ready' || membershipId === null || current.projection.nextCursor === null) return;
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
      result = { status: 'unavailable' as const };
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
              message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.',
            },
          },
        });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          setup: {
            status: 'unavailable',
            message: 'Weitere Einrichtungsdaten sind derzeit nicht erreichbar.',
          },
        },
      });
    }
  }

  async createCustomer(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || displayName.trim().length < 1 || Array.from(displayName.normalize('NFC').trim()).length > 120) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    this.setState({ ...current, creating: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createCustomer(token, membershipId, crypto.randomUUID(), displayName));
    } catch {
      result = { status: 'unavailable' as const };
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
        (token) => this.api.employeeProjection(token, membershipId, requestedCursor),
      );
    } catch {
      result = { status: 'unavailable' as const };
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
              message: 'Weitere Beschäftigtendaten konnten nicht sicher bestätigt werden.',
            },
          },
        });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({
        ...latest,
        sections: {
          ...latest.sections,
          employees: {
            status: 'unavailable',
            message: 'Weitere Beschäftigtendaten sind derzeit nicht erreichbar.',
          },
        },
      });
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
    const requestRefreshEpoch = this.refreshEpoch;
    this.setState({
      ...current,
      creatingEmployee: true,
      invitation: null,
      notice: null,
    });
    const disclosureEpoch = this.invitationDisclosureEpoch;
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
      result = { status: 'unavailable' as const };
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
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
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
      result = { status: 'unavailable' as const };
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
        this.setState({ ...this.state, notice: 'Arbeitszeit wurde append-only korrigiert.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
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
      result = { status: 'unavailable' as const };
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
        this.setState({ ...this.state, notice: 'Review-Entscheidung wurde append-only protokolliert.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
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
        notice: 'Review-Entscheidung konnte nicht sicher bestätigt werden. Erneut bestätigen verwendet dieselbe Anfrage.',
      });
    }
  }

  async loadMoreTimeRecords(): Promise<void> {
    await this.loadMoreCursorSection('timeRecords');
  }

  async loadMoreReviewItems(): Promise<void> {
    await this.loadMoreCursorSection('reviewItems');
  }

  async exportTimeRecords(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || current.timeReviewBusy || membershipId === null) return;
    const generation = this.generation;
    const requestRefreshEpoch = this.refreshEpoch;
    this.setState({ ...current, timeReviewBusy: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.exportTimeEntries(
        token, membershipId, current.timeWindow.fromInclusive, current.timeWindow.toExclusive,
      ));
    } catch {
      result = { status: 'unavailable' as const };
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

  private async loadMoreCursorSection(section: 'timeRecords' | 'reviewItems'): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null) return;
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
      result = { status: 'unavailable' as const };
    }
    if (
      generation !== this.generation
      || refreshEpoch !== this.refreshEpoch
      || sectionEpoch !== this.sectionEpochs[section]
    ) return;
    if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
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
            message: sectionUnavailableMessage(section),
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
            message: 'Die nächste Seite konnte nicht in bestätigter Reihenfolge übernommen werden.',
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

  private async loadReadyData(membershipId: string): Promise<ReadyDataResult> {
    const timeWindow = boundedTimeWindow(this.now());
    const [projection, employees, records, reviewItems] = await Promise.all([
      this.safeSectionRead(
        () => this.auth.withAccessToken((token) => this.api.projection(token, membershipId, null)),
      ),
      this.safeSectionRead(
        () => this.auth.withAccessToken(
          (token) => this.api.employeeProjection(token, membershipId, null),
        ),
      ),
      this.safeSectionRead(
        () => this.auth.withAccessToken((token) => this.api.timeRecords(
          token, membershipId, timeWindow.fromInclusive, timeWindow.toExclusive, null,
        )),
      ),
      this.safeSectionRead(
        () => this.auth.withAccessToken(
          (token) => this.api.reviewItems(token, membershipId, null),
        ),
      ),
    ]);
    if ([projection, employees, records, reviewItems].some(
      (result) => result === null || result.status === 'rejected',
    )) return { status: 'rejected' };
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
      ].every((result) => result.status === 'succeeded') ? 'succeeded' : 'partial',
      projection: normalizedProjection,
      employeeProjection: normalizedEmployees,
      timeRecords: normalizedRecords,
      reviewItems: normalizedReviewItems,
      timeWindow,
    };
  }

  private async safeSectionRead<Value>(
    operation: () => Promise<ApiResult<Value> | null>,
  ): Promise<ApiResult<Value> | null> {
    try {
      return await operation();
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async loadSection(
    section: AdminSection,
    membershipId: string,
    timeWindow: { readonly fromInclusive: string; readonly toExclusive: string },
  ): Promise<{ readonly status: 'succeeded'; readonly value: unknown } | { readonly status: 'rejected' | 'unavailable' } | null> {
    try {
      let result: ApiResult<unknown> | null;
      if (section === 'setup') {
        result = await this.auth.withAccessToken(
          (token) => this.api.projection(token, membershipId, null),
        );
      } else if (section === 'employees') {
        result = await this.auth.withAccessToken(
          (token) => this.api.employeeProjection(token, membershipId, null),
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
      return result.status === 'succeeded' ? result : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
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
      if (projection.status === 'rejected') {
        await this.rejectWithinAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
      } else if (
        projection.projection.status === 'succeeded'
        || projection.employeeProjection.status === 'succeeded'
      ) {
        const boundOrganization = projection.projection.status === 'succeeded'
          ? projection.projection.value.organization
          : projection.employeeProjection.status === 'succeeded'
            ? projection.employeeProjection.value.organization
            : null;
        if (boundOrganization === null) throw new Error('Organization binding unavailable');
        const setupProjection = projection.projection.status === 'succeeded'
          ? projection.projection.value
          : emptyProjection(boundOrganization);
        const employeeProjection = projection.employeeProjection.status === 'succeeded'
          ? projection.employeeProjection.value
          : emptyEmployeeProjection(boundOrganization);
        this.setState(readyState(
          setupProjection,
          employeeProjection,
          projection.timeRecords.status === 'succeeded'
            ? projection.timeRecords.value
            : { items: [], nextCursor: null },
          projection.reviewItems.status === 'succeeded'
            ? projection.reviewItems.value
            : { items: [], nextCursor: null },
          projection.timeWindow,
          {
            setup: projection.projection.status === 'succeeded'
              ? { status: 'ready' }
              : { status: 'unavailable', message: sectionUnavailableMessage('setup') },
            employees: projection.employeeProjection.status === 'succeeded'
              ? { status: 'ready' }
              : { status: 'unavailable', message: sectionUnavailableMessage('employees') },
            timeRecords: projection.timeRecords.status === 'succeeded'
              ? { status: 'ready' }
              : { status: 'unavailable', message: sectionUnavailableMessage('timeRecords') },
            reviewItems: projection.reviewItems.status === 'succeeded'
              ? { status: 'ready' }
              : { status: 'unavailable', message: sectionUnavailableMessage('reviewItems') },
          },
        ));
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
  timeRecords: CursorPage<SafeTimeRecord>,
  reviewItems: CursorPage<SafeReviewItem>,
  timeWindow: { readonly fromInclusive: string; readonly toExclusive: string },
  sections = allSections({ status: 'ready' } as const),
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
  result: ApiResult<Value> | null,
): ApiSectionResult<Value> {
  return result?.status === 'succeeded'
    ? result
    : { status: 'unavailable' };
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
  result: Exclude<ReadyDataResult, { readonly status: 'rejected' }>,
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
        message: 'Die Administrationsbereiche widersprechen sich und wurden nicht übernommen.',
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
  return result.status === 'succeeded'
    ? { status: 'ready' }
    : { status: 'unavailable', message: sectionUnavailableMessage(section) };
}

function sectionUnavailableMessage(section: AdminSection): string {
  if (section === 'setup') return 'Einrichtungsdaten sind derzeit nicht erreichbar.';
  if (section === 'employees') return 'Beschäftigtendaten sind derzeit nicht erreichbar.';
  if (section === 'timeRecords') return 'Arbeitszeiten sind derzeit nicht erreichbar.';
  return 'Review-Evidence ist derzeit nicht erreichbar.';
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
            message: 'Einrichtungsdaten gehören nicht zur bestätigten Organisation.',
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
            message: 'Beschäftigtendaten gehören nicht zur bestätigten Organisation.',
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
