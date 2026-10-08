import { alwaysForeground, type SessionActivity } from '../runtime/MobileAppActivity';
import type {
  ConfirmedSessionIdentity,
  AuthenticatedRequestAttempt,
  AuthenticatedRequestCapability,
  AuthenticatedRequestExecution,
  BackendSessionPort,
  EmployeeEnrollmentPort,
  EmployeeEnrollmentResult,
  EphemeralAccessTokenReader,
  InternalAuthenticatedSessionSnapshot,
  InternalOfflineRestorationSnapshot,
  MobileSessionCapability,
  MobileSessionState,
  ProviderAuthEvent,
  ProviderAuthPort,
  ProviderSessionTokens,
  RefreshTokenStore,
  SignInResult,
} from './contracts';

interface CredentialSnapshot {
  readonly accessToken: string;
  readonly generation: number;
  readonly tokenRevision: number;
}

type CredentialRenewal =
  | { readonly status: 'ready'; readonly credentials: CredentialSnapshot }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable' };

interface UnauthorizedRefreshFlight {
  readonly generation: number;
  readonly tokenRevision: number;
  readonly operation: Promise<CredentialRenewal>;
}

type AttemptInvocation<Value> =
  | AuthenticatedRequestAttempt<Value>
  | { readonly status: 'unavailable' };

export class MobileSessionCoordinator implements
  MobileSessionCapability,
  AuthenticatedRequestCapability {
  private state: MobileSessionState = Object.freeze({ status: 'initializing' });
  private pausedOrganization = false;
  private updateRequired = false;
  private pauseRevision = 0;
  private readonly listeners = new Set<() => void>();
  private started = false;
  private expiredColdStartGeneration: number | null = null;
  private unsubscribeProvider: (() => void) | null = null;
  private generation = 0;
  private confirmedIdentity: ConfirmedSessionIdentity | null = null;
  private providerIdentity: ConfirmedSessionIdentity | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private providerSessionAllowed = false;
  private offlineCaptureRestorationAllowed = false;
  private offlineRestorationRevision = 0;
  private offlineCredentialsChanged = false;
  private contextUnavailableSource:
    | InternalOfflineRestorationSnapshot['source']
    | null = null;
  private tokenRevision = 0;
  private refreshFlight: Promise<void> | null = null;
  private startFlight: Promise<void> | null = null;
  private signInFlight: Promise<SignInResult> | null = null;
  private contextFlight: Promise<void> | null = null;
  private storageTail: Promise<void> = Promise.resolve();
  private providerOperationTail: Promise<void> = Promise.resolve();
  private providerEventFlight: Promise<void> = Promise.resolve();
  private unauthorizedRefreshFlight: UnauthorizedRefreshFlight | null = null;
  private deferredRefresh = false;
  private deferredContext = false;
  private pendingPersistence: { generation: number; revision: number; token: string;
    failures: number; resume: MobileSessionState; identity?: ConfirmedSessionIdentity } | null = null;
  private persistenceTimer: ReturnType<typeof setTimeout> | null = null;
  private persistenceFlight: Promise<void> | null = null;
  private cleanupTarget: MobileSessionState | null = null;
  private signInGeneration: number | null = null;
  private readonly refreshPolicyListeners = new Set<() => void>();
  private enrollmentIntentGeneration: number | null = null;

  constructor(
    private readonly provider: ProviderAuthPort,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly backendSession: BackendSessionPort,
    private readonly employeeEnrollment: EmployeeEnrollmentPort = {
      async redeem() { return { status: 'transient_failure' }; },
    },
    private readonly createCommandId: () => string = () => globalThis.crypto.randomUUID(),
    private readonly activity: SessionActivity = alwaysForeground,
  ) {}

  async onActive(): Promise<void> {
    if (this.pendingPersistence !== null || this.cleanupTarget !== null
      || this.state.status === 'runtime_unavailable') await this.retryContext();
    if (this.pendingPersistence !== null || this.cleanupTarget !== null) return;
    if (this.deferredRefresh) { this.deferredRefresh = false; await this.refresh(); }
    await this.resumeDeferredContext();
  }

  canAutoRefresh(): boolean {
    return this.pendingPersistence === null && this.cleanupTarget === null
      && this.state.status !== 'runtime_unavailable' && this.state.status !== 'recovery_required';
  }

  subscribeRefreshPolicy(listener: () => void): () => void {
    this.refreshPolicyListeners.add(listener);
    return () => this.refreshPolicyListeners.delete(listener);
  }

  private notifyRefreshPolicy(): void {
    for (const listener of this.refreshPolicyListeners) { try { listener(); } catch {} }
  }

  getState(): MobileSessionState {
    return this.state;
  }

  appUpdateRequired(accessToken: string): void {
    if (this.accessToken !== accessToken || !this.providerSessionAllowed) return;
    this.updateRequired = true;
    this.pauseRevision += 1;
    this.offlineCaptureRestorationAllowed = false;
    this.offlineRestorationRevision += 1;
    this.contextUnavailableSource = null;
    this.setState({status:'context_unavailable', updateRequired:true});
  }

  organizationPaused(accessToken: string): void {
    if (this.accessToken !== accessToken || !this.providerSessionAllowed) return;
    this.pausedOrganization = true;
    this.pauseRevision += 1;
    this.offlineCaptureRestorationAllowed = false;
    this.offlineRestorationRevision += 1;
    this.contextUnavailableSource = null;
    this.setState({ status: 'context_unavailable', organizationPaused: true });
  }

  captureAuthenticatedSessionSnapshot(): InternalAuthenticatedSessionSnapshot | null {
    if (this.state.status !== 'authenticated' || !this.providerSessionAllowed) {
      return null;
    }
    return Object.freeze({ generation: this.generation, session: this.state.session });
  }

  isAuthenticatedSessionSnapshotCurrent(
    snapshot: InternalAuthenticatedSessionSnapshot,
  ): boolean {
    const current = this.captureAuthenticatedSessionSnapshot();
    return current !== null
      && current.generation === snapshot.generation
      && current.session.userId === snapshot.session.userId
      && current.session.organizationId === snapshot.session.organizationId
      && current.session.membershipId === snapshot.session.membershipId
      && current.session.role === snapshot.session.role
      && current.session.nfcSetupAvailable === snapshot.session.nfcSetupAvailable;
  }

  isOfflineCaptureRestorationAllowed(): boolean {
    return this.offlineCaptureRestorationAllowed;
  }

  captureOfflineRestorationSnapshot(): InternalOfflineRestorationSnapshot | null {
    if (
      this.state.status !== 'context_unavailable'
      || !this.offlineCaptureRestorationAllowed
      || this.refreshToken === null
      || this.refreshToken.length === 0
      || this.contextUnavailableSource === null
    ) {
      return null;
    }
    return Object.freeze({
      generation: this.generation,
      restorationRevision: this.offlineRestorationRevision,
      source: this.contextUnavailableSource,
    });
  }

  isOfflineRestorationSnapshotCurrent(
    snapshot: InternalOfflineRestorationSnapshot,
  ): boolean {
    const current = this.captureOfflineRestorationSnapshot();
    return current !== null
      && current.generation === snapshot.generation
      && current.restorationRevision === snapshot.restorationRevision
      && current.source === snapshot.source;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): Promise<void> {
    if (this.startFlight !== null) {
      return this.startFlight;
    }
    if (this.started) {
      return Promise.resolve();
    }
    this.started = true;
    const generation = this.generation;
    this.setState({ status: 'initializing' });
    try {
      this.unsubscribeProvider = this.provider.subscribe((event) => this.onProviderEvent(event));
    } catch {
      this.started = false;
      this.setState({ status: 'runtime_unavailable', reason: 'authentication_unavailable' });
      return Promise.resolve();
    }
    const operation = this.performStart(generation);
    this.startFlight = operation;
    return operation.finally(() => {
      if (this.startFlight === operation) {
        this.startFlight = null;
      }
    });
  }

  private async performStart(generation: number): Promise<void> {
    try {
      if (!await this.refreshTokenStore.isAvailable()) {
        if (!this.started || generation !== this.generation) {
          return;
        }
        this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
        return;
      }
      if (!this.started || generation !== this.generation) {
        return;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.refresh(),
          new Promise<void>((resolve) => {
            timer = setTimeout(() => {
              if (this.started && generation === this.generation) {
                this.expiredColdStartGeneration = generation;
                this.presentPendingOfflineRestoration(generation);
              }
              resolve();
            }, 2000);
          }),
        ]);
      } finally { clearTimeout(timer); }
    } catch {
      if (this.started && generation === this.generation) {
        this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
      }
    }
  }

  private presentPendingOfflineRestoration(generation: number): void {
    if (this.started && generation === this.generation
      && this.expiredColdStartGeneration === generation
      && this.state.status === 'initializing'
      && this.offlineCaptureRestorationAllowed && this.refreshToken !== null) {
      // This is only a display deadline. Preserve the pending request's tokenRevision.
      this.offlineRestorationRevision += 1;
      this.contextUnavailableSource = this.providerSessionAllowed
        ? 'backend_context_unavailable' : 'provider_suspended';
      this.setState({ status: 'context_unavailable' });
    }
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.invalidateInMemorySession();
    this.startFlight = null;
    this.refreshFlight = null;
    this.signInFlight = null;
    this.contextFlight = null;
    this.unsubscribeProvider?.();
    this.unsubscribeProvider = null;
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    return this.startSignIn(email, password, false);
  }

  async signInForEmployeeEnrollment(email: string, password: string): Promise<SignInResult> {
    return this.startSignIn(email, password, true);
  }

  async requestPasswordReset(email: string): Promise<'requested' | 'unavailable'> {
    if (this.provider.requestPasswordReset === undefined || email.trim().length < 3) {
      return 'unavailable';
    }
    try {
      return await this.enqueueProviderOperation(() => this.provider.requestPasswordReset!(
        email.trim(),
      )) ? 'requested' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  private async startSignIn(
    email: string,
    password: string,
    employeeEnrollmentIntent: boolean,
  ): Promise<SignInResult> {
    if (this.signInFlight !== null) {
      return this.signInFlight;
    }
    const operation = this.performSignIn(email, password, employeeEnrollmentIntent);
    this.signInFlight = operation;
    try {
      return await operation;
    } finally {
      if (this.signInFlight === operation) {
        this.signInFlight = null;
      }
    }
  }

  async redeemEmployeeInvitation(invitationSecret: string): Promise<EmployeeEnrollmentResult> {
    if (
      this.state.status !== 'enrollment_only'
      || this.enrollmentIntentGeneration !== this.generation
      || this.accessToken === null
      || !this.providerSessionAllowed
    ) return { status: 'context_unavailable' };
    const generation = this.generation;
    const tokenRevision = this.tokenRevision;
    const pauseRevision = this.pauseRevision;
    const accessToken = this.accessToken;
    let active = true;
    let result;
    try {
      result = await this.employeeEnrollment.redeem(
        () => {
          if (!active) throw new Error('Employee enrollment access has expired');
          return accessToken;
        },
        this.createCommandId(),
        invitationSecret,
      );
    } catch {
      result = { status: 'transient_failure' as const };
    } finally {
      active = false;
    }
    if (generation !== this.generation || tokenRevision !== this.tokenRevision || pauseRevision !== this.pauseRevision) {
      return { status: 'context_unavailable' };
    }
    if (result.status === 'authority_rejected') {
      await this.clearRejectedSession('authority_rejected');
      return { status: 'authority_rejected' };
    }
    if (result.status === 'enrollment_unavailable' || result.status === 'invalid_request') {
      this.setState({ status: 'enrollment_only', notice: result.status });
      return { status: result.status };
    }
    if (result.status === 'transient_failure') {
      this.setState({ status: 'enrollment_only', notice: 'request_failed' });
      return { status: 'context_unavailable' };
    }
    this.enrollmentIntentGeneration = null;
    const sessionResult = await this.resolveBackendContext(accessToken, generation, tokenRevision);
    return sessionResult.status === 'authenticated'
      ? { status: 'enrolled' }
      : sessionResult.status === 'authority_rejected'
        ? { status: 'authority_rejected' }
        : { status: 'context_unavailable' };
  }

  async refresh(): Promise<void> {
    if (this.activity.isBackground()) { this.deferredRefresh = true; return; }
    if (this.pendingPersistence !== null || this.cleanupTarget !== null) return;
    if (this.refreshFlight !== null) {
      return this.refreshFlight;
    }
    const generation = this.generation;
    const operation = this.performRefresh(generation);
    this.refreshFlight = operation;
    try {
      await operation;
    } finally {
      if (this.refreshFlight === operation) {
        this.refreshFlight = null;
      }
    }
  }

  async retryContext(): Promise<void> {
    if (this.activity.isBackground()) { this.deferredContext = true; return; }
    if (this.cleanupTarget !== null) {
      await this.retryCleanup();
      return;
    }
    if (this.pendingPersistence !== null) {
      await this.retryPersistence(true);
      await this.resumeDeferredContext();
      return;
    }
    if (this.state.status === 'runtime_unavailable') {
      // A fresh start must read the confirmed identity as well as the token.
      this.stop();
      await this.start();
      return;
    }
    if (this.contextFlight !== null) {
      return this.contextFlight;
    }
    if (this.state.status !== 'context_unavailable') {
      return;
    }
    const generation = this.generation;
    const accessToken = this.accessToken;
    const operation = accessToken === null
      ? this.refresh()
      : this.resolveBackendContext(
          accessToken,
          generation,
          this.tokenRevision,
        ).then(() => undefined);
    this.contextFlight = operation;
    try {
      await operation;
    } finally {
      if (this.contextFlight === operation) {
        this.contextFlight = null;
      }
    }
  }

  async signOut(): Promise<void> {
    const generation = this.invalidateInMemorySession();
    this.refreshFlight = null;
    this.signInFlight = null;
    this.contextFlight = null;
    this.setState({ status: 'signed_out' });
    let storageFailed = false;
    try {
      await this.enqueueStorageClear(generation);
    } catch {
      storageFailed = true;
    }
    try {
      await this.enqueueProviderOperation(() => this.provider.signOutLocal());
    } catch {
      // Local product authority is still removed; provider/network details are never surfaced.
    }
    if (generation === this.generation) {
      if (storageFailed) this.requireCleanup({ status: 'signed_out' });
      else this.setState({ status: 'signed_out' });
    }
  }

  async executeAuthenticatedRequest<Value>(
    attempt: (
      accessToken: EphemeralAccessTokenReader,
    ) => Promise<AuthenticatedRequestAttempt<Value>>,
  ): Promise<AuthenticatedRequestExecution<Value>> {
    if (this.activity.isBackground()) return { status: 'unavailable' };
    const initialCredentials = this.captureAuthenticatedCredentials();
    if (initialCredentials === null) {
      return { status: 'unavailable' };
    }

    const firstAttempt = await this.invokeAuthenticatedAttempt(attempt, initialCredentials);
    if (firstAttempt.status === 'unavailable') {
      return firstAttempt;
    }
    if (firstAttempt.status === 'completed') {
      return this.isCurrentCredentials(initialCredentials)
        ? firstAttempt
        : this.currentUnavailableOrRejectedResult();
    }

    const renewal = await this.renewAfterUnauthorized(initialCredentials);
    if (renewal.status !== 'ready') {
      return renewal;
    }

    if (this.activity.isBackground() || this.pendingPersistence !== null) return { status: 'unavailable' };
    const secondAttempt = await this.invokeAuthenticatedAttempt(attempt, renewal.credentials);
    if (secondAttempt.status === 'unavailable') {
      return secondAttempt;
    }
    if (secondAttempt.status === 'completed') {
      return this.isCurrentCredentials(renewal.credentials)
        ? secondAttempt
        : this.currentUnavailableOrRejectedResult();
    }

    if (!this.isCurrentCredentials(renewal.credentials)) {
      return this.currentUnavailableOrRejectedResult();
    }
    await this.clearRejectedSession('authority_rejected');
    return { status: 'authority_rejected' };
  }

  private async performSignIn(
    email: string,
    password: string,
    employeeEnrollmentIntent: boolean,
  ): Promise<SignInResult> {
    const generation = this.invalidateInMemorySession();
    this.signInGeneration = generation;
    this.enrollmentIntentGeneration = employeeEnrollmentIntent ? generation : null;
    this.setState({ status: 'signing_in' });
    try {
      await this.enqueueStorageClear(generation);
    } catch {
      if (generation === this.generation) {
        this.cleanupTarget = { status: 'unauthenticated', reason: 'sign_in_unavailable' };
        this.setState(this.cleanupTarget);
      }
      return { status: 'infrastructure_error' };
    }

    let result;
    try {
      result = await this.enqueueProviderOperation(
        () => this.provider.signInWithPassword(email, password),
      );
    } catch {
      if (generation === this.generation) {
        await this.handleStorageFailure(generation);
      }
      return { status: 'infrastructure_error' };
    }
    if (generation !== this.generation) {
      return { status: 'infrastructure_error' };
    }
    if (result.status === 'invalid_credentials') {
      this.setState({ status: 'unauthenticated', reason: 'invalid_credentials' });
      return { status: 'invalid_credentials' };
    }

    const tokenRevision = this.acceptProviderTokens(result.tokens);
    try {
      await this.persistTokens(result.tokens.refreshToken, generation, tokenRevision);
    } catch {
      await this.handleStorageFailure(generation, tokenRevision);
      return { status: 'infrastructure_error' };
    }
    return this.resolveBackendContext(result.tokens.accessToken, generation, tokenRevision);
  }

  private async invokeAuthenticatedAttempt<Value>(
    attempt: (
      accessToken: EphemeralAccessTokenReader,
    ) => Promise<AuthenticatedRequestAttempt<Value>>,
    credentials: CredentialSnapshot,
  ): Promise<AttemptInvocation<Value>> {
    if (this.activity.isBackground()) return { status: 'unavailable' };
    let active = true;
    const readAccessToken = (): string => {
      if (!active) {
        throw new Error('Authenticated request access has expired');
      }
      return credentials.accessToken;
    };
    try {
      return await attempt(readAccessToken);
    } catch {
      return { status: 'unavailable' };
    } finally {
      active = false;
    }
  }

  private async renewAfterUnauthorized(
    rejectedCredentials: CredentialSnapshot,
  ): Promise<CredentialRenewal> {
    if (this.activity.isBackground() || this.pendingPersistence !== null || this.cleanupTarget !== null) {
      return { status: 'unavailable' };
    }
    if (rejectedCredentials.generation !== this.generation) {
      return this.currentRenewalFailure();
    }
    if (rejectedCredentials.tokenRevision !== this.tokenRevision) {
      return this.awaitStableProviderCredentials(rejectedCredentials);
    }
    if (!this.isCurrentCredentials(rejectedCredentials)) {
      return this.currentRenewalFailure();
    }

    const existingFlight = this.unauthorizedRefreshFlight;
    if (
      existingFlight !== null
      && existingFlight.generation === rejectedCredentials.generation
      && existingFlight.tokenRevision === rejectedCredentials.tokenRevision
    ) {
      return existingFlight.operation;
    }

    const operation = this.performUnauthorizedRenewal(rejectedCredentials);
    const flight: UnauthorizedRefreshFlight = {
      generation: rejectedCredentials.generation,
      tokenRevision: rejectedCredentials.tokenRevision,
      operation,
    };
    this.unauthorizedRefreshFlight = flight;
    try {
      return await operation;
    } finally {
      if (this.unauthorizedRefreshFlight === flight) {
        this.unauthorizedRefreshFlight = null;
      }
    }
  }

  private async performUnauthorizedRenewal(
    rejectedCredentials: CredentialSnapshot,
  ): Promise<CredentialRenewal> {
    await this.refresh();
    return this.awaitStableProviderCredentials(rejectedCredentials);
  }

  private async awaitStableProviderCredentials(
    rejectedCredentials: CredentialSnapshot,
  ): Promise<CredentialRenewal> {
    while (rejectedCredentials.generation === this.generation) {
      if (this.activity.isBackground() || this.pendingPersistence !== null) return { status: 'unavailable' };
      const observedFlight = this.providerEventFlight;
      await observedFlight;
      if (rejectedCredentials.generation !== this.generation) {
        return this.currentRenewalFailure();
      }
      if (observedFlight !== this.providerEventFlight) {
        continue;
      }
      if (this.activity.isBackground() || this.pendingPersistence !== null) return { status: 'unavailable' };
      const currentCredentials = this.captureAuthenticatedCredentials();
      if (
        currentCredentials === null
        || currentCredentials.tokenRevision === rejectedCredentials.tokenRevision
      ) {
        return this.currentRenewalFailure();
      }
      return { status: 'ready', credentials: currentCredentials };
    }
    return this.currentRenewalFailure();
  }

  private captureAuthenticatedCredentials(): CredentialSnapshot | null {
    if (
      this.state.status !== 'authenticated'
      || !this.providerSessionAllowed
      || this.accessToken === null
    ) {
      return null;
    }
    return {
      accessToken: this.accessToken,
      generation: this.generation,
      tokenRevision: this.tokenRevision,
    };
  }

  private isCurrentCredentials(credentials: CredentialSnapshot): boolean {
    return this.state.status === 'authenticated'
      && this.providerSessionAllowed
      && credentials.generation === this.generation
      && credentials.tokenRevision === this.tokenRevision
      && credentials.accessToken === this.accessToken;
  }

  private currentRenewalFailure(): CredentialRenewal {
    return this.state.status === 'unauthenticated' || this.state.status === 'signed_out'
      ? { status: 'authority_rejected' }
      : { status: 'unavailable' };
  }

  private currentUnavailableOrRejectedResult(): AuthenticatedRequestExecution<never> {
    return this.state.status === 'unauthenticated' || this.state.status === 'signed_out'
      ? { status: 'authority_rejected' }
      : { status: 'unavailable' };
  }

  private async performRefresh(generation: number): Promise<void> {
    const pauseRevision = this.pauseRevision;
    const enrollmentNotice = this.state.status === 'enrollment_only'
      && this.enrollmentIntentGeneration === generation
      ? this.state.notice
      : undefined;
    let storedRefreshToken: string | null;
    try {
      storedRefreshToken = this.refreshToken ?? await this.refreshTokenStore.read();
    } catch {
      if (generation === this.generation) {
        this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
      }
      return;
    }
    if (storedRefreshToken === null || storedRefreshToken.length === 0) {
      if (generation === this.generation) {
        this.setState({ status: 'unauthenticated', reason: 'not_signed_in' });
      }
      return;
    }
    if (generation !== this.generation) return;
    if (this.state.status === 'initializing') {
      let identity: ConfirmedSessionIdentity | null;
      try { identity = await this.refreshTokenStore.readIdentity(); }
      catch {
        if (generation === this.generation) this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
        return;
      }
      if (generation !== this.generation) return;
      this.confirmedIdentity = identity;
      this.refreshToken = storedRefreshToken;
      this.offlineCaptureRestorationAllowed = true;
      // Secure storage may finish after the timer; never lose the expired deadline.
      this.presentPendingOfflineRestoration(generation);
    }

    const tokenRevisionBeforeProviderRefresh = this.tokenRevision;
    let result;
    try {
      result = await this.enqueueProviderOperation(
        () => {
          if (this.activity.isBackground()) { this.deferredRefresh = true; throw new Error('Session renewal deferred'); }
          if (generation !== this.generation || this.pendingPersistence !== null) throw new Error('Session renewal superseded');
          return this.provider.refreshSession(storedRefreshToken);
        },
      );
    } catch {
      if (generation !== this.generation) return;
      if (tokenRevisionBeforeProviderRefresh !== this.tokenRevision) {
        await this.providerEventFlight;
        return;
      }
      if (this.activity.isBackground()) return;
      this.suspendProviderSession(storedRefreshToken);
      return;
    }
    if (generation !== this.generation) {
      return;
    }
    if (tokenRevisionBeforeProviderRefresh !== this.tokenRevision) {
      await this.providerEventFlight;
      return;
    }
    if (result.status === 'rejected') {
      await this.clearRejectedSession('not_signed_in');
      return;
    }

    const tokenRevision = this.acceptProviderTokens(result.tokens);
    try {
      await this.persistTokens(result.tokens.refreshToken, generation, tokenRevision);
    } catch {
      await this.handleStorageFailure(generation, tokenRevision);
      return;
    }
    if (enrollmentNotice !== undefined) {
      if (pauseRevision !== this.pauseRevision) return;
      this.setState({ status: 'enrollment_only', notice: enrollmentNotice });
      return;
    }
    await this.resolveBackendContext(result.tokens.accessToken, generation, tokenRevision);
  }

  private suspendProviderSession(refreshToken: string): void {
    const sameRetainedProviderContext = !this.providerSessionAllowed
      && this.accessToken === null
      && this.refreshToken === refreshToken
      && this.state.status === 'context_unavailable'
      && this.contextUnavailableSource === 'provider_suspended';
    if (!sameRetainedProviderContext) {
      this.offlineRestorationRevision += 1;
    }
    this.providerSessionAllowed = false;
    this.accessToken = null;
    this.refreshToken = refreshToken;
    this.contextUnavailableSource = 'provider_suspended';
    this.tokenRevision += 1;
    this.unauthorizedRefreshFlight = null;
    this.setState({ status: 'context_unavailable' });
  }

  private async resumeDeferredContext(): Promise<void> {
    if (!this.deferredContext || this.activity.isBackground() || this.pendingPersistence !== null
      || this.cleanupTarget !== null) return;
    this.deferredContext = false;
    if (this.accessToken !== null && this.providerSessionAllowed) {
      await this.resolveBackendContext(this.accessToken, this.generation, this.tokenRevision);
    } else if (this.state.status === 'context_unavailable') {
      await this.retryContext();
    }
  }

  private async resolveBackendContext(
    accessToken: string,
    generation: number,
    tokenRevision: number,
  ): Promise<SignInResult> {
    const pauseRevision = this.pauseRevision;
    const contextIsCurrent = () => generation === this.generation
      && tokenRevision === this.tokenRevision && pauseRevision === this.pauseRevision;
    if (!contextIsCurrent()) return { status: 'infrastructure_error' };
    if (this.activity.isBackground() || this.pendingPersistence !== null) {
      this.deferredContext = true;
      return { status: 'context_unavailable' };
    }
    let result;
    try {
      result = await this.backendSession.resolve(accessToken);
    } catch {
      if (contextIsCurrent()) {
        this.publishBackendContextUnavailable();
      }
      return { status: 'context_unavailable' };
    }
    if (!contextIsCurrent()) {
      return { status: 'infrastructure_error' };
    }
    if (this.activity.isBackground()) {
      this.deferredContext = true;
      return { status: 'context_unavailable' };
    }
    if (result.status === 'resolved') {
      const identity = this.providerIdentity;
      try {
        if (identity?.providerUserId !== this.confirmedIdentity?.providerUserId
          || identity?.email !== this.confirmedIdentity?.email) {
          if (identity !== null && identity.providerUserId === this.confirmedIdentity?.providerUserId) {
            this.pendingPersistence ??= { generation, revision: tokenRevision,
              token: this.refreshToken!, failures: 0, resume: this.state };
            this.pendingPersistence.identity = identity;
            this.notifyRefreshPolicy();
            await this.retryPersistence(false);
          } else {
            await this.enqueueStorage(generation, async () => {
              if (contextIsCurrent()) await this.refreshTokenStore.writeIdentity(identity);
            });
          }
        }
      } catch {
        if (generation === this.generation) await this.handleStorageFailure(generation, tokenRevision);
        return { status: 'infrastructure_error' };
      }
      if (!contextIsCurrent()) {
        return { status: 'infrastructure_error' };
      }
      this.pausedOrganization = false;
      this.updateRequired = false;
      this.confirmedIdentity = identity;
      this.signInGeneration = null;
      this.offlineCredentialsChanged = false;
      this.enrollmentIntentGeneration = null;
      this.offlineCaptureRestorationAllowed = true;
      this.offlineRestorationRevision += 1;
      this.contextUnavailableSource = null;
      this.setState({ status: 'authenticated', session: result.session });
      return { status: 'authenticated' };
    }
    if (result.status === 'update_required') {
      this.appUpdateRequired(accessToken);
      return {status:'context_unavailable'};
    }
    if (result.status === 'organization_paused') {
      this.organizationPaused(accessToken);
      return { status: 'context_unavailable' };
    }
    if (result.status === 'unavailable') {
      this.publishBackendContextUnavailable();
      return { status: 'context_unavailable' };
    }
    if (
      this.enrollmentIntentGeneration === generation
      && this.providerSessionAllowed
      && this.accessToken === accessToken
    ) {
      this.setState({ status: 'enrollment_only', notice: null });
      return { status: 'enrollment_required' };
    }
    await this.clearRejectedSession('authority_rejected');
    return { status: 'authority_rejected' };
  }

  private async clearRejectedSession(
    reason: 'authority_rejected' | 'not_signed_in',
  ): Promise<void> {
    const generation = this.invalidateInMemorySession();
    this.setState({ status: 'unauthenticated', reason });
    let storageFailed = false;
    try {
      await this.enqueueStorageClear(generation);
    } catch {
      storageFailed = true;
    }
    try {
      await this.enqueueProviderOperation(() => this.provider.signOutLocal());
    } catch {
      // Product state remains fail-closed even when the provider cannot complete local cleanup.
    }
    if (generation === this.generation && storageFailed) {
      this.requireCleanup({ status: 'unauthenticated', reason });
    }
  }

  private onProviderEvent(event: ProviderAuthEvent): void {
    if (event.type === 'signed_out') {
      if (!this.providerSessionAllowed) {
        return;
      }
      const generation = this.invalidateInMemorySession();
      this.setState({ status: 'signed_out' });
      const operation = this.enqueueStorageClear(generation).then(
        () => {
          if (generation === this.generation && this.state.status !== 'signed_out') {
            this.setState({ status: 'signed_out' });
          }
        },
        () => {
          if (generation === this.generation) {
            this.requireCleanup({ status: 'signed_out' });
          }
        },
      );
      this.providerEventFlight = operation.then(() => undefined, () => undefined);
      return;
    }
    if (!this.providerSessionAllowed) {
      return;
    }
    const generation = this.generation;
    const preserveEnrollmentShell = this.state.status === 'enrollment_only'
      && this.enrollmentIntentGeneration === generation;
    const tokenRevision = this.acceptProviderTokens(event.tokens);
    const operation = this.persistTokens(event.tokens.refreshToken, generation, tokenRevision).then(
      () => preserveEnrollmentShell
        ? undefined
        : this.resolveBackendContext(event.tokens.accessToken, generation, tokenRevision),
      () => this.handleStorageFailure(generation, tokenRevision),
    ).catch(() => undefined);
    this.providerEventFlight = operation.then(() => undefined);
  }

  private acceptProviderTokens(tokens: ProviderSessionTokens): number {
    const identity = tokens.identity ?? null;
    if (this.confirmedIdentity !== null
      && this.confirmedIdentity.providerUserId !== identity?.providerUserId) {
      this.confirmedIdentity = null;
      this.offlineCaptureRestorationAllowed = false;
      this.setState({ status: 'context_unavailable' });
    }
    this.providerIdentity = identity;
    // Renewing the same retained account does not end its offline window. The backend
    // may still be pending; keep in-flight NFC/manual captures valid until it answers.
    this.offlineCredentialsChanged = this.captureOfflineRestorationSnapshot() !== null;
    if (!this.offlineCredentialsChanged) {
      this.offlineRestorationRevision += 1;
      this.contextUnavailableSource = null;
    }
    this.providerSessionAllowed = true;
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenRevision += 1;
    return this.tokenRevision;
  }

  private invalidateInMemorySession(): number {
    this.deferredRefresh = false;
    this.deferredContext = false;
    this.pendingPersistence = null;
    this.persistenceFlight = null;
    this.cleanupTarget = null;
    this.signInGeneration = null;
    clearTimeout(this.persistenceTimer ?? undefined);
    this.persistenceTimer = null;
    this.notifyRefreshPolicy();
    this.pausedOrganization = false;
    this.updateRequired = false;
    this.generation += 1;
    this.expiredColdStartGeneration = null;
    this.offlineCredentialsChanged = false;
    this.confirmedIdentity = null;
    this.providerIdentity = null;
    this.offlineRestorationRevision += 1;
    this.contextUnavailableSource = null;
    this.providerSessionAllowed = false;
    this.accessToken = null;
    this.refreshToken = null;
    this.offlineCaptureRestorationAllowed = false;
    this.tokenRevision += 1;
    this.unauthorizedRefreshFlight = null;
    this.enrollmentIntentGeneration = null;
    return this.generation;
  }

  private publishBackendContextUnavailable(): void {
    if (this.offlineCredentialsChanged || this.contextUnavailableSource !== 'backend_context_unavailable') {
      this.offlineRestorationRevision += 1;
    }
    this.offlineCredentialsChanged = false;
    this.contextUnavailableSource = 'backend_context_unavailable';
    this.setState({ status: 'context_unavailable' });
  }

  private enqueueTokenWrite(refreshToken: string, generation: number, revision: number): Promise<void> {
    return this.enqueueStorage(generation, async () => {
      if (revision !== this.tokenRevision) return;
      // Clear the old account before persisting any new account's token.
      if (this.confirmedIdentity === null) await this.refreshTokenStore.writeIdentity(null);
      await this.activity.waitForForeground();
      if (generation === this.generation && revision === this.tokenRevision) await this.refreshTokenStore.write(refreshToken);
    });
  }

  private enqueueStorageClear(generation: number): Promise<void> {
    return this.enqueueStorage(generation, () => this.refreshTokenStore.clear());
  }

  private enqueueStorage(generation: number, operation: () => Promise<void>): Promise<void> {
    const queued = this.storageTail.catch(() => undefined).then(async () => {
      if (generation !== this.generation) {
        return;
      }
      await this.activity.waitForForeground();
      if (generation !== this.generation) return;
      await operation();
    });
    this.storageTail = queued;
    return queued;
  }

  private enqueueProviderOperation<T>(operation: () => Promise<T>): Promise<T> {
    const queued = this.providerOperationTail.catch(() => undefined).then(operation);
    this.providerOperationTail = queued.then(() => undefined, () => undefined);
    return queued;
  }

  private async handleStorageFailure(expectedGeneration: number, expectedRevision?: number): Promise<void> {
    if (expectedGeneration !== this.generation
      || expectedRevision !== undefined && expectedRevision !== this.tokenRevision) return;
    const duringSignIn = this.signInGeneration === this.generation;
    const generation = this.invalidateInMemorySession();
    const target: MobileSessionState = duringSignIn
      ? { status: 'unauthenticated', reason: 'sign_in_unavailable' }
      : { status: 'unauthenticated', reason: 'not_signed_in' };
    if (duringSignIn) { this.cleanupTarget = target; this.setState(target); }
    else this.requireCleanup(target);
    try {
      await this.enqueueStorageClear(generation);
      if (generation === this.generation) this.cleanupTarget = null;
    } catch { /* A later retry must clear before any restoration is allowed. */ }
    try { await this.enqueueProviderOperation(() => this.provider.signOutLocal()); } catch {}
    if (generation !== this.generation) return;
    if (duringSignIn) this.setState(target);
    else this.requireCleanup(target);
  }

  private requireCleanup(target: MobileSessionState): void {
    this.cleanupTarget = target;
    this.setState({ status: 'recovery_required', reason: 'session_cleanup' });
  }

  private async retryCleanup(): Promise<void> {
    const target = this.cleanupTarget;
    if (target === null) return;
    const generation = this.generation;
    const login = target.status === 'unauthenticated' && target.reason === 'sign_in_unavailable';
    if (!login) this.setState({ status: 'initializing' });
    try {
      await this.enqueueStorageClear(generation);
      if (generation !== this.generation) return;
      this.cleanupTarget = null;
      this.setState(target);
    } catch {
      if (generation === this.generation) {
        if (login) this.setState(target);
        else this.requireCleanup(target);
      }
    }
  }

  private async persistTokens(token: string, generation: number, revision: number): Promise<void> {
    if (generation !== this.generation || revision !== this.tokenRevision) return;
    const sameAccount = this.confirmedIdentity !== null
      && this.confirmedIdentity.providerUserId === this.providerIdentity?.providerUserId;
    if (!sameAccount) return this.enqueueTokenWrite(token, generation, revision);
    const pending = { generation, revision, token, failures: 0, resume: this.state };
    this.pendingPersistence = pending;
    this.notifyRefreshPolicy();
    await this.retryPersistence(false);
  }

  private retryPersistence(explicit: boolean): Promise<void> {
    if (this.persistenceFlight !== null) return this.persistenceFlight;
    const pending = this.pendingPersistence;
    if (pending === null || this.activity.isBackground()) return Promise.resolve();
    clearTimeout(this.persistenceTimer ?? undefined);
    this.persistenceTimer = null;
    if (explicit) {
      pending.failures = 0;
      if (this.state.status === 'recovery_required') this.setState({ status: 'initializing' });
    }
    const current = () => this.pendingPersistence === pending
      && pending.generation === this.generation && pending.revision === this.tokenRevision;
    const operation = async () => {
      try {
        await this.enqueueStorage(pending.generation, async () => {
          if (current()) await this.refreshTokenStore.write(pending.token);
          if (pending.identity !== undefined) {
            await this.activity.waitForForeground();
            if (current()) await this.refreshTokenStore.writeIdentity(pending.identity);
          }
        });
        if (!current()) return;
        this.pendingPersistence = null;
        if (this.state.status === 'initializing' || this.state.status === 'recovery_required') {
          this.setState(pending.resume);
        }
        this.notifyRefreshPolicy();
      } catch {
        if (!current()) return;
        if (!this.activity.isBackground()) pending.failures += 1;
        if (pending.failures >= 3) {
          this.setState({ status: 'recovery_required', reason: 'token_persistence' });
        } else if (!this.activity.isBackground()) {
          this.persistenceTimer = setTimeout(() => {
            void this.retryPersistence(false).then(() => this.resumeDeferredContext());
          }, 1000 * 2 ** pending.failures);
        }
      }
    };
    const flight = operation().finally(() => {
      if (this.persistenceFlight === flight) {
        this.persistenceFlight = null;
        // An already-running provider request can publish a newer token while a write is pending.
        if (this.pendingPersistence !== null && this.pendingPersistence !== pending) void this.retryPersistence(false);
      }
    });
    this.persistenceFlight = flight;
    return flight;
  }

  private setState(state: MobileSessionState): void {
    if (state.status === 'context_unavailable' && this.pausedOrganization) state = { ...state, organizationPaused: true };
    if (state.status === 'context_unavailable' && this.updateRequired) state = { ...state, updateRequired: true };
    if (this.pendingPersistence !== null && state.status !== 'initializing' && state.status !== 'recovery_required') {
      this.pendingPersistence.resume = state;
      if (this.pendingPersistence.failures >= 3) state = {status:'recovery_required', reason:'token_persistence'};
    }
    this.state = Object.freeze((state.status === 'authenticated' || state.status === 'context_unavailable')
      && this.confirmedIdentity !== null ? { ...state, identityLabel: this.confirmedIdentity.email } : state);
    for (const listener of this.listeners) {
      try { listener(); } catch { /* Observers cannot invalidate session authority. */ }
    }
    this.notifyRefreshPolicy();
  }
}
