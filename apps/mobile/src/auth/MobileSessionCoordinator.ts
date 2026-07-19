import type {
  AuthenticatedRequestAttempt,
  AuthenticatedRequestCapability,
  AuthenticatedRequestExecution,
  BackendSessionPort,
  EmployeeEnrollmentPort,
  EmployeeEnrollmentResult,
  EphemeralAccessTokenReader,
  InternalAuthenticatedSessionSnapshot,
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
  private readonly listeners = new Set<() => void>();
  private started = false;
  private unsubscribeProvider: (() => void) | null = null;
  private generation = 0;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private providerSessionAllowed = false;
  private tokenRevision = 0;
  private refreshFlight: Promise<void> | null = null;
  private startFlight: Promise<void> | null = null;
  private signInFlight: Promise<SignInResult> | null = null;
  private contextFlight: Promise<void> | null = null;
  private storageTail: Promise<void> = Promise.resolve();
  private providerOperationTail: Promise<void> = Promise.resolve();
  private providerEventFlight: Promise<void> = Promise.resolve();
  private unauthorizedRefreshFlight: UnauthorizedRefreshFlight | null = null;
  private enrollmentIntentGeneration: number | null = null;

  constructor(
    private readonly provider: ProviderAuthPort,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly backendSession: BackendSessionPort,
    private readonly employeeEnrollment: EmployeeEnrollmentPort = {
      async redeem() { return { status: 'transient_failure' }; },
    },
    private readonly createCommandId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  getState(): MobileSessionState {
    return this.state;
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
      && current.session.role === snapshot.session.role;
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
      await this.refresh();
    } catch {
      if (this.started && generation === this.generation) {
        this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
      }
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
    if (generation !== this.generation || tokenRevision !== this.tokenRevision) {
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
      this.setState(storageFailed
        ? { status: 'runtime_unavailable', reason: 'storage_unavailable' }
        : { status: 'signed_out' });
    }
  }

  async executeAuthenticatedRequest<Value>(
    attempt: (
      accessToken: EphemeralAccessTokenReader,
    ) => Promise<AuthenticatedRequestAttempt<Value>>,
  ): Promise<AuthenticatedRequestExecution<Value>> {
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
    this.enrollmentIntentGeneration = employeeEnrollmentIntent ? generation : null;
    this.setState({ status: 'signing_in' });
    try {
      await this.enqueueStorageClear(generation);
    } catch {
      this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
      return { status: 'infrastructure_error' };
    }

    let result;
    try {
      result = await this.enqueueProviderOperation(
        () => this.provider.signInWithPassword(email, password),
      );
    } catch {
      if (generation === this.generation) {
        this.setState({ status: 'runtime_unavailable', reason: 'authentication_unavailable' });
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
      await this.enqueueTokenWrite(result.tokens.refreshToken, generation);
    } catch {
      await this.handleStorageFailure();
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
      const observedFlight = this.providerEventFlight;
      await observedFlight;
      if (rejectedCredentials.generation !== this.generation) {
        return this.currentRenewalFailure();
      }
      if (observedFlight !== this.providerEventFlight) {
        continue;
      }
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

    const tokenRevisionBeforeProviderRefresh = this.tokenRevision;
    let result;
    try {
      result = await this.enqueueProviderOperation(
        () => this.provider.refreshSession(storedRefreshToken),
      );
    } catch {
      if (generation !== this.generation) return;
      if (tokenRevisionBeforeProviderRefresh !== this.tokenRevision) {
        await this.providerEventFlight;
        return;
      }
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
      await this.enqueueTokenWrite(result.tokens.refreshToken, generation);
    } catch {
      await this.handleStorageFailure();
      return;
    }
    if (enrollmentNotice !== undefined) {
      this.setState({ status: 'enrollment_only', notice: enrollmentNotice });
      return;
    }
    await this.resolveBackendContext(result.tokens.accessToken, generation, tokenRevision);
  }

  private suspendProviderSession(refreshToken: string): void {
    this.providerSessionAllowed = false;
    this.accessToken = null;
    this.refreshToken = refreshToken;
    this.tokenRevision += 1;
    this.unauthorizedRefreshFlight = null;
    this.setState({ status: 'context_unavailable' });
  }

  private async resolveBackendContext(
    accessToken: string,
    generation: number,
    tokenRevision: number,
  ): Promise<SignInResult> {
    let result;
    try {
      result = await this.backendSession.resolve(accessToken);
    } catch {
      if (generation === this.generation && tokenRevision === this.tokenRevision) {
        this.setState({ status: 'context_unavailable' });
      }
      return { status: 'context_unavailable' };
    }
    if (generation !== this.generation || tokenRevision !== this.tokenRevision) {
      return { status: 'infrastructure_error' };
    }
    if (result.status === 'resolved') {
      this.enrollmentIntentGeneration = null;
      this.setState({ status: 'authenticated', session: result.session });
      return { status: 'authenticated' };
    }
    if (result.status === 'unavailable') {
      this.setState({ status: 'context_unavailable' });
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
    if (generation === this.generation) {
      this.setState(storageFailed
        ? { status: 'runtime_unavailable', reason: 'storage_unavailable' }
        : { status: 'unauthenticated', reason });
    }
  }

  private onProviderEvent(event: ProviderAuthEvent): void {
    if (event.type === 'signed_out') {
      if (!this.providerSessionAllowed) {
        return;
      }
      const generation = this.invalidateInMemorySession();
      const operation = this.enqueueStorageClear(generation).then(
        () => {
          if (generation === this.generation) {
            this.setState({ status: 'signed_out' });
          }
        },
        () => {
          if (generation === this.generation) {
            this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
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
    const operation = this.enqueueTokenWrite(event.tokens.refreshToken, generation).then(
      () => preserveEnrollmentShell
        ? undefined
        : this.resolveBackendContext(event.tokens.accessToken, generation, tokenRevision),
      () => this.handleStorageFailure(),
    ).catch(() => undefined);
    this.providerEventFlight = operation.then(() => undefined);
  }

  private acceptProviderTokens(tokens: ProviderSessionTokens): number {
    this.providerSessionAllowed = true;
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenRevision += 1;
    return this.tokenRevision;
  }

  private invalidateInMemorySession(): number {
    this.generation += 1;
    this.providerSessionAllowed = false;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenRevision += 1;
    this.unauthorizedRefreshFlight = null;
    this.enrollmentIntentGeneration = null;
    return this.generation;
  }

  private enqueueTokenWrite(refreshToken: string, generation: number): Promise<void> {
    return this.enqueueStorage(generation, () => this.refreshTokenStore.write(refreshToken));
  }

  private enqueueStorageClear(generation: number): Promise<void> {
    return this.enqueueStorage(generation, () => this.refreshTokenStore.clear());
  }

  private enqueueStorage(generation: number, operation: () => Promise<void>): Promise<void> {
    const queued = this.storageTail.catch(() => undefined).then(async () => {
      if (generation !== this.generation) {
        return;
      }
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

  private async handleStorageFailure(): Promise<void> {
    const generation = this.invalidateInMemorySession();
    try {
      await this.enqueueStorageClear(generation);
    } catch {
      // Secure storage already failed; retain the fail-closed state below.
    }
    try {
      await this.enqueueProviderOperation(() => this.provider.signOutLocal());
    } catch {
      // Provider cleanup cannot restore product authority.
    }
    if (generation === this.generation) {
      this.setState({ status: 'runtime_unavailable', reason: 'storage_unavailable' });
    }
  }

  private setState(state: MobileSessionState): void {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) {
      listener();
    }
  }
}
