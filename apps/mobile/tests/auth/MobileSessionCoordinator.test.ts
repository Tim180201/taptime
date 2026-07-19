import { describe, expect, it, vi } from 'vitest';
import { MobileSessionCoordinator } from '../../src/auth/MobileSessionCoordinator';
import type {
  BackendSessionPort,
  BackendSessionResolution,
  EmployeeEnrollmentPort,
  EmployeeEnrollmentRedemption,
  EphemeralAccessTokenReader,
  ProductSessionContext,
  ProviderAuthEvent,
  ProviderAuthPort,
  ProviderRefreshResult,
  ProviderSignInResult,
  RefreshTokenStore,
} from '../../src/auth/contracts';

const productSession: ProductSessionContext = {
  userId: '10000000-0000-4000-8000-000000000101',
  membershipId: '12000000-0000-4000-8000-000000000101',
  organizationId: '00000000-0000-4000-8000-000000000101',
  role: 'employee',
};

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeProvider implements ProviderAuthPort {
  readonly signInCalls: Array<[string, string]> = [];
  readonly refreshCalls: string[] = [];
  signOutCalls = 0;
  subscribeCalls = 0;
  unsubscribeCalls = 0;
  startAutoRefreshCalls = 0;
  stopAutoRefreshCalls = 0;
  signInImplementation: (email: string, password: string) => Promise<ProviderSignInResult> =
    async () => ({
      status: 'authenticated',
      tokens: { accessToken: 'signed-in-access', refreshToken: 'signed-in-refresh' },
    });
  refreshImplementation: (refreshToken: string) => Promise<ProviderRefreshResult> =
    async () => ({
      status: 'refreshed',
      tokens: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' },
    });
  signOutImplementation: () => Promise<void> = async () => undefined;
  private readonly listeners = new Set<(event: ProviderAuthEvent) => void>();

  async signInWithPassword(email: string, password: string): Promise<ProviderSignInResult> {
    this.signInCalls.push([email, password]);
    return this.signInImplementation(email, password);
  }

  async refreshSession(refreshToken: string): Promise<ProviderRefreshResult> {
    this.refreshCalls.push(refreshToken);
    return this.refreshImplementation(refreshToken);
  }

  async signOutLocal(): Promise<void> {
    this.signOutCalls += 1;
    await this.signOutImplementation();
  }

  subscribe(listener: (event: ProviderAuthEvent) => void): () => void {
    this.subscribeCalls += 1;
    this.listeners.add(listener);
    return () => {
      this.unsubscribeCalls += 1;
      this.listeners.delete(listener);
    };
  }

  async startAutoRefresh(): Promise<void> {
    this.startAutoRefreshCalls += 1;
  }

  async stopAutoRefresh(): Promise<void> {
    this.stopAutoRefreshCalls += 1;
  }

  emit(event: ProviderAuthEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

class FakeRefreshTokenStore implements RefreshTokenStore {
  value: string | null;
  readonly writes: string[] = [];
  clearCalls = 0;
  readCalls = 0;
  availableCalls = 0;
  availableImplementation: () => Promise<boolean> = async () => true;
  readImplementation: () => Promise<string | null>;
  writeImplementation: (value: string) => Promise<void> = async () => undefined;
  clearImplementation: () => Promise<void> = async () => undefined;

  constructor(value: string | null = null) {
    this.value = value;
    this.readImplementation = async () => this.value;
  }

  async isAvailable(): Promise<boolean> {
    this.availableCalls += 1;
    return this.availableImplementation();
  }

  async read(): Promise<string | null> {
    this.readCalls += 1;
    return this.readImplementation();
  }

  async write(value: string): Promise<void> {
    this.writes.push(value);
    await this.writeImplementation(value);
    this.value = value;
  }

  async clear(): Promise<void> {
    this.clearCalls += 1;
    await this.clearImplementation();
    this.value = null;
  }
}

class FakeBackendSession implements BackendSessionPort {
  readonly accessTokens: string[] = [];
  implementation: (accessToken: string) => Promise<BackendSessionResolution> =
    async () => ({ status: 'resolved', session: productSession });

  async resolve(accessToken: string): Promise<BackendSessionResolution> {
    this.accessTokens.push(accessToken);
    return this.implementation(accessToken);
  }
}

class FakeEmployeeEnrollment implements EmployeeEnrollmentPort {
  readonly calls: Array<{ commandId: string; invitationSecret: string; accessToken: string }> = [];
  retainedReader: EphemeralAccessTokenReader | null = null;
  implementation: () => Promise<EmployeeEnrollmentRedemption> =
    async () => ({ status: 'enrollment_unavailable' });

  async redeem(
    accessToken: EphemeralAccessTokenReader,
    commandId: string,
    invitationSecret: string,
  ): Promise<EmployeeEnrollmentRedemption> {
    this.retainedReader = accessToken;
    this.calls.push({ commandId, invitationSecret, accessToken: accessToken() });
    return this.implementation();
  }
}

function setup(storedRefreshToken: string | null = null) {
  const provider = new FakeProvider();
  const store = new FakeRefreshTokenStore(storedRefreshToken);
  const backend = new FakeBackendSession();
  const enrollment = new FakeEmployeeEnrollment();
  const coordinator = new MobileSessionCoordinator(
    provider,
    store,
    backend,
    enrollment,
    () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  );
  return { provider, store, backend, enrollment, coordinator };
}

describe('MobileSessionCoordinator', () => {
  it('starts signed out when no refresh token exists', async () => {
    const { coordinator, provider, store } = setup();
    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'unauthenticated', reason: 'not_signed_in' });
    expect(store.readCalls).toBe(1);
    expect(provider.refreshCalls).toEqual([]);
    expect(provider.subscribeCalls).toBe(1);
  });

  it('restores in order, persists only the rotated refresh token, then resolves backend authority', async () => {
    const { coordinator, provider, store, backend } = setup('stored-refresh');
    await coordinator.start();

    expect(provider.refreshCalls).toEqual(['stored-refresh']);
    expect(store.writes).toEqual(['rotated-refresh']);
    expect(store.value).toBe('rotated-refresh');
    expect(backend.accessTokens).toEqual(['rotated-access']);
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
    expect(coordinator.isOfflineCaptureRestorationAllowed()).toBe(true);
    expect(JSON.stringify(store.writes)).not.toContain('rotated-access');
  });

  it('allows offline restoration when stored credentials refresh but backend context is unavailable',
    async () => {
      const { coordinator, backend } = setup('stored-refresh');
      backend.implementation = async () => ({ status: 'unavailable' });

      await coordinator.start();

      expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
      expect(coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
      expect(coordinator.isOfflineCaptureRestorationAllowed()).toBe(true);
    });

  it('makes parallel start calls share one restore operation', async () => {
    const { coordinator, provider } = setup('stored-refresh');
    const refresh = deferred<ProviderRefreshResult>();
    provider.refreshImplementation = () => refresh.promise;

    const first = coordinator.start();
    const second = coordinator.start();
    await vi.waitFor(() => expect(provider.refreshCalls).toHaveLength(1));
    refresh.resolve({
      status: 'refreshed',
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });
    await Promise.all([first, second]);
    expect(provider.refreshCalls).toHaveLength(1);
    expect(provider.subscribeCalls).toBe(1);
  });

  it('makes parallel explicit refresh calls single-flight', async () => {
    const { coordinator, provider, store, backend } = setup('stored-refresh');
    await coordinator.start();
    const refresh = deferred<ProviderRefreshResult>();
    provider.refreshImplementation = () => refresh.promise;
    const initialCount = provider.refreshCalls.length;

    const first = coordinator.refresh();
    const second = coordinator.refresh();
    await vi.waitFor(() => expect(provider.refreshCalls).toHaveLength(initialCount + 1));
    refresh.resolve({
      status: 'refreshed',
      tokens: { accessToken: 'next-access', refreshToken: 'next-refresh' },
    });
    await Promise.all([first, second]);
    expect(provider.refreshCalls).toHaveLength(initialCount + 1);

    const writesBeforeEventRefresh = store.writes.length;
    const backendCallsBeforeEventRefresh = backend.accessTokens.length;
    provider.refreshImplementation = async () => {
      const tokens = { accessToken: 'event-access', refreshToken: 'event-refresh' };
      provider.emit({ type: 'token_refreshed', tokens });
      return { status: 'refreshed', tokens };
    };
    await coordinator.refresh();
    expect(store.writes.slice(writesBeforeEventRefresh)).toEqual(['event-refresh']);
    expect(backend.accessTokens.slice(backendCallsBeforeEventRefresh)).toEqual(['event-access']);
  });

  it('signs in with exact email/password while storage sees neither password nor access token', async () => {
    const { coordinator, provider, store, backend } = setup();
    const result = await coordinator.signIn('employee@example.invalid', 'exact-password');

    expect(result).toEqual({ status: 'authenticated' });
    expect(provider.signInCalls).toEqual([['employee@example.invalid', 'exact-password']]);
    expect(store.writes).toEqual(['signed-in-refresh']);
    expect(JSON.stringify(store.writes)).not.toContain('exact-password');
    expect(JSON.stringify(store.writes)).not.toContain('signed-in-access');
    expect(backend.accessTokens).toEqual(['signed-in-access']);
  });

  it('keeps normal 401 sign-in fail-closed while explicit enrollment intent opens no product authority', async () => {
    const normal = setup();
    normal.backend.implementation = async () => ({ status: 'authority_rejected' });
    await expect(normal.coordinator.signIn('employee@example.invalid', 'password'))
      .resolves.toEqual({ status: 'authority_rejected' });
    expect(normal.coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'authority_rejected',
    });
    expect(normal.provider.signOutCalls).toBe(1);
    expect(normal.store.value).toBeNull();

    const enrollment = setup();
    enrollment.backend.implementation = async () => ({ status: 'authority_rejected' });
    await expect(enrollment.coordinator.signInForEmployeeEnrollment(
      'employee@example.invalid',
      'password',
    )).resolves.toEqual({ status: 'enrollment_required' });
    expect(enrollment.coordinator.getState()).toEqual({ status: 'enrollment_only', notice: null });
    expect(enrollment.provider.signOutCalls).toBe(0);
    expect(enrollment.store.value).toBe('signed-in-refresh');
    expect(enrollment.coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
    await expect(enrollment.coordinator.executeAuthenticatedRequest(async () => ({
      status: 'completed', value: 'must-not-run',
    }))).resolves.toEqual({ status: 'unavailable' });
  });

  it('does not enter enrollment-only after a backend transport failure', async () => {
    const { coordinator, backend } = setup();
    backend.implementation = async () => ({ status: 'unavailable' });
    await expect(coordinator.signInForEmployeeEnrollment('employee@example.invalid', 'password'))
      .resolves.toEqual({ status: 'context_unavailable' });
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
    expect(coordinator.isOfflineCaptureRestorationAllowed()).toBe(false);
  });

  it('redeems through an ephemeral token reader, clears input responsibility, and retains only the authority-free shell on 404', async () => {
    const { coordinator, backend, enrollment } = setup();
    backend.implementation = async () => ({ status: 'authority_rejected' });
    await coordinator.signInForEmployeeEnrollment('employee@example.invalid', 'password');
    enrollment.implementation = async () => ({ status: 'enrollment_unavailable' });

    await expect(coordinator.redeemEmployeeInvitation('canonical-secret'))
      .resolves.toEqual({ status: 'enrollment_unavailable' });
    expect(enrollment.calls).toEqual([{
      commandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      invitationSecret: 'canonical-secret',
      accessToken: 'signed-in-access',
    }]);
    expect(coordinator.getState()).toEqual({
      status: 'enrollment_only', notice: 'enrollment_unavailable',
    });
    expect(() => enrollment.retainedReader?.()).toThrow('Employee enrollment access has expired');
  });

  it('requires the unchanged session endpoint to establish product authority after redemption', async () => {
    const { coordinator, backend, enrollment } = setup();
    let sessionAttempt = 0;
    backend.implementation = async () => (++sessionAttempt === 1
      ? { status: 'authority_rejected' }
      : { status: 'resolved', session: productSession });
    await coordinator.signInForEmployeeEnrollment('employee@example.invalid', 'password');
    enrollment.implementation = async () => ({ status: 'succeeded' });

    await expect(coordinator.redeemEmployeeInvitation('canonical-secret'))
      .resolves.toEqual({ status: 'enrolled' });
    expect(backend.accessTokens).toEqual(['signed-in-access', 'signed-in-access']);
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
  });

  it('signs out and clears provider state when redemption rejects the provider token', async () => {
    const { coordinator, backend, enrollment, provider, store } = setup();
    backend.implementation = async () => ({ status: 'authority_rejected' });
    await coordinator.signInForEmployeeEnrollment('employee@example.invalid', 'password');
    enrollment.implementation = async () => ({ status: 'authority_rejected' });

    await expect(coordinator.redeemEmployeeInvitation('canonical-secret'))
      .resolves.toEqual({ status: 'authority_rejected' });
    expect(coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'authority_rejected',
    });
    expect(provider.signOutCalls).toBe(1);
    expect(store.value).toBeNull();
  });

  it('rotates provider tokens inside the enrollment generation without granting context', async () => {
    const { coordinator, backend, provider, store } = setup();
    await coordinator.start();
    backend.implementation = async () => ({ status: 'authority_rejected' });
    await coordinator.signInForEmployeeEnrollment('employee@example.invalid', 'password');
    const backendCalls = backend.accessTokens.length;

    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'enrollment-rotated-access', refreshToken: 'enrollment-rotated-refresh' },
    });
    await vi.waitFor(() => expect(store.value).toBe('enrollment-rotated-refresh'));
    expect(coordinator.getState()).toEqual({ status: 'enrollment_only', notice: null });
    expect(backend.accessTokens).toHaveLength(backendCalls);
    expect(coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
  });

  it('prevents duplicate concurrent sign-in submission at the capability boundary', async () => {
    const { coordinator, provider } = setup();
    const signIn = deferred<ProviderSignInResult>();
    provider.signInImplementation = () => signIn.promise;
    const first = coordinator.signIn('first@example.invalid', 'password');
    const second = coordinator.signIn('second@example.invalid', 'different');
    await vi.waitFor(() => expect(provider.signInCalls).toHaveLength(1));
    signIn.resolve({
      status: 'authenticated',
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'authenticated' },
      { status: 'authenticated' },
    ]);
    expect(provider.signInCalls).toEqual([['first@example.invalid', 'password']]);
  });

  it('distinguishes invalid credentials from provider infrastructure failure without details', async () => {
    const invalid = setup();
    invalid.provider.signInImplementation = async () => ({ status: 'invalid_credentials' });
    await expect(invalid.coordinator.signIn('a@example.invalid', 'bad'))
      .resolves.toEqual({ status: 'invalid_credentials' });
    expect(invalid.coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'invalid_credentials',
    });

    const unavailable = setup();
    unavailable.provider.signInImplementation = async () => { throw new Error('provider secret'); };
    await expect(unavailable.coordinator.signIn('a@example.invalid', 'bad'))
      .resolves.toEqual({ status: 'infrastructure_error' });
    expect(unavailable.coordinator.getState()).toEqual({
      status: 'runtime_unavailable', reason: 'authentication_unavailable',
    });
  });

  it('clears a terminally rejected restored provider session', async () => {
    const { coordinator, provider, store } = setup('expired-refresh');
    provider.refreshImplementation = async () => ({ status: 'rejected' });
    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'unauthenticated', reason: 'not_signed_in' });
    expect(store.value).toBeNull();
    expect(provider.signOutCalls).toBe(1);

    const unavailable = setup('stored-refresh');
    unavailable.provider.refreshImplementation = async () => {
      throw new Error('provider infrastructure detail');
    };
    await unavailable.coordinator.start();
    expect(unavailable.coordinator.getState()).toEqual({ status: 'context_unavailable' });
    expect(unavailable.store.value).toBe('stored-refresh');
    expect(unavailable.coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
    expect(unavailable.coordinator.isOfflineCaptureRestorationAllowed()).toBe(true);
  });

  it('restores a suspended cold-start session through one shared retry', async () => {
    const { coordinator, provider, store, backend } = setup('stored-refresh');
    provider.refreshImplementation = async () => {
      throw new Error('provider temporarily unavailable');
    };
    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });

    provider.refreshImplementation = async () => ({
      status: 'refreshed',
      tokens: { accessToken: 'recovered-access', refreshToken: 'recovered-refresh' },
    });
    await Promise.all([coordinator.retryContext(), coordinator.retryContext()]);

    expect(provider.refreshCalls).toEqual(['stored-refresh', 'stored-refresh']);
    expect(backend.accessTokens).toEqual(['recovered-access']);
    expect(store.value).toBe('recovered-refresh');
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
    expect(coordinator.captureAuthenticatedSessionSnapshot()).toEqual({
      generation: 0,
      session: productSession,
    });
  });

  it('clears product/provider state when authoritative backend rejects Membership', async () => {
    const { coordinator, provider, store, backend } = setup();
    backend.implementation = async () => ({ status: 'authority_rejected' });
    await expect(coordinator.signIn('a@example.invalid', 'password'))
      .resolves.toEqual({ status: 'authority_rejected' });
    expect(coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'authority_rejected',
    });
    expect(store.value).toBeNull();
    expect(provider.signOutCalls).toBe(1);

    const failingStorage = setup();
    failingStorage.backend.implementation = async () => ({ status: 'authority_rejected' });
    failingStorage.store.clearImplementation = async () => {
      if (failingStorage.store.clearCalls > 1) {
        throw new Error('secure storage unavailable');
      }
    };
    await failingStorage.coordinator.signIn('a@example.invalid', 'password');
    expect(failingStorage.coordinator.getState()).toEqual({
      status: 'runtime_unavailable', reason: 'storage_unavailable',
    });
    expect(failingStorage.provider.signOutCalls).toBe(1);
  });

  it('retains a retryable context-unavailable gate and resolves it without re-authenticating', async () => {
    const { coordinator, provider, store, backend } = setup();
    backend.implementation = async () => ({ status: 'unavailable' });
    await expect(coordinator.signIn('a@example.invalid', 'password'))
      .resolves.toEqual({ status: 'context_unavailable' });
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
    expect(store.value).toBe('signed-in-refresh');
    expect(coordinator.isOfflineCaptureRestorationAllowed()).toBe(false);

    backend.implementation = async () => ({ status: 'resolved', session: productSession });
    await Promise.all([coordinator.retryContext(), coordinator.retryContext()]);
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
    expect(provider.signInCalls).toHaveLength(1);
    expect(backend.accessTokens).toEqual(['signed-in-access', 'signed-in-access']);
  });

  it('maps a thrown backend call to the same closed retryable context state', async () => {
    const { coordinator, backend } = setup();
    backend.implementation = async () => { throw new Error('network detail'); };
    await expect(coordinator.signIn('a@example.invalid', 'password'))
      .resolves.toEqual({ status: 'context_unavailable' });
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
    expect(coordinator.isOfflineCaptureRestorationAllowed()).toBe(false);
  });

  it('sign-out removes SecureStore and in-memory authority even if provider cleanup fails', async () => {
    const { coordinator, provider, store } = setup();
    await coordinator.signIn('a@example.invalid', 'password');
    provider.signOutImplementation = async () => { throw new Error('network'); };
    await coordinator.signOut();
    expect(store.value).toBeNull();
    expect(coordinator.getState()).toEqual({ status: 'signed_out' });
  });

  it('fails closed and cleans provider state when refresh-token persistence fails', async () => {
    const { coordinator, provider, store } = setup();
    store.writeImplementation = async () => { throw new Error('secure storage unavailable'); };
    await expect(coordinator.signIn('a@example.invalid', 'password'))
      .resolves.toEqual({ status: 'infrastructure_error' });
    expect(coordinator.getState()).toEqual({
      status: 'runtime_unavailable', reason: 'storage_unavailable',
    });
    expect(store.value).toBeNull();
    expect(provider.signOutCalls).toBe(1);
  });

  it('re-resolves authority after TOKEN_REFRESHED and clears a newly rejected Membership', async () => {
    const { coordinator, provider, store, backend } = setup();
    await coordinator.start();
    await coordinator.signIn('a@example.invalid', 'password');
    backend.implementation = async () => ({ status: 'authority_rejected' });

    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'auto-access', refreshToken: 'auto-refresh' },
    });

    await vi.waitFor(() => expect(coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'authority_rejected',
    }));
    expect(backend.accessTokens.at(-1)).toBe('auto-access');
    expect(store.value).toBeNull();
    expect(provider.signOutCalls).toBe(1);
  });

  it('orders auth-state refresh writes so the newest rotation wins', async () => {
    const { coordinator, provider, store } = setup();
    await coordinator.start();
    await coordinator.signIn('a@example.invalid', 'password');
    const firstWrite = deferred<void>();
    store.writeImplementation = async (value) => {
      if (value === 'event-refresh-1') {
        await firstWrite.promise;
      }
    };

    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access-1', refreshToken: 'event-refresh-1' },
    });
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access-2', refreshToken: 'event-refresh-2' },
    });
    await vi.waitFor(() => expect(store.writes).toContain('event-refresh-1'));
    firstWrite.resolve();
    await vi.waitFor(() => expect(store.value).toBe('event-refresh-2'));
    expect(store.writes.slice(-2)).toEqual(['event-refresh-1', 'event-refresh-2']);
  });

  it('does not let a stale refresh failure suspend a newer provider event', async () => {
    const { coordinator, provider, store } = setup();
    await coordinator.start();
    await coordinator.signIn('a@example.invalid', 'password');
    const refresh = deferred<ProviderRefreshResult>();
    provider.refreshImplementation = () => refresh.promise;
    const refreshing = coordinator.refresh();
    await vi.waitFor(() => expect(provider.refreshCalls).toEqual(['signed-in-refresh']));

    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access', refreshToken: 'event-refresh' },
    });
    refresh.reject(new Error('stale provider failure'));
    await refreshing;

    expect(store.value).toBe('event-refresh');
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
    expect(coordinator.captureAuthenticatedSessionSnapshot()).not.toBeNull();
  });

  it('ignores a stale backend rejection after a newer provider token was accepted', async () => {
    const { coordinator, provider, backend } = setup();
    await coordinator.start();
    await coordinator.signIn('a@example.invalid', 'password');
    const oldResolution = deferred<BackendSessionResolution>();
    backend.implementation = (token) => token === 'old-event-access'
      ? oldResolution.promise
      : Promise.resolve({ status: 'resolved', session: productSession });

    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'old-event-access', refreshToken: 'old-event-refresh' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('old-event-access'));
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'new-event-access', refreshToken: 'new-event-refresh' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('new-event-access'));
    oldResolution.resolve({ status: 'authority_rejected' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
    expect(provider.signOutCalls).toBe(0);
  });

  it('prevents a delayed restore from repopulating state after sign-out', async () => {
    const { coordinator, provider, store } = setup('stored-refresh');
    const refresh = deferred<ProviderRefreshResult>();
    provider.refreshImplementation = () => refresh.promise;
    const restoring = coordinator.start();
    await vi.waitFor(() => expect(provider.refreshCalls).toEqual(['stored-refresh']));

    const signingOut = coordinator.signOut();
    refresh.resolve({
      status: 'refreshed',
      tokens: { accessToken: 'late-access', refreshToken: 'late-refresh' },
    });
    await Promise.all([restoring, signingOut]);
    expect(coordinator.getState()).toEqual({ status: 'signed_out' });
    expect(store.value).toBeNull();
    expect(store.writes).not.toContain('late-refresh');
  });

  it('ignores provider token events after sign-out', async () => {
    const { coordinator, provider, store, backend } = setup();
    await coordinator.start();
    await coordinator.signOut();
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'late-access', refreshToken: 'late-refresh' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.value).toBeNull();
    expect(backend.accessTokens).toEqual([]);
    expect(coordinator.getState()).toEqual({ status: 'signed_out' });
  });

  it('prevents a stopped delayed start from opening authority and can restart cleanly', async () => {
    const { coordinator, store, provider } = setup();
    const availability = deferred<boolean>();
    store.availableImplementation = () => availability.promise;
    const starting = coordinator.start();
    coordinator.stop();
    availability.resolve(true);
    await starting;
    expect(provider.refreshCalls).toEqual([]);
    expect(provider.unsubscribeCalls).toBe(1);

    store.availableImplementation = async () => true;
    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'unauthenticated', reason: 'not_signed_in' });
    expect(provider.subscribeCalls).toBe(2);
  });

  it('exposes the access token only through an attempt-scoped reader that expires afterwards', async () => {
    const { coordinator } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    let retainedReader: (() => string) | null = null;

    await expect(coordinator.executeAuthenticatedRequest(async (readAccessToken) => {
      retainedReader = readAccessToken;
      expect(readAccessToken()).toBe('signed-in-access');
      return { status: 'completed', value: 'accepted' };
    })).resolves.toEqual({ status: 'completed', value: 'accepted' });

    expect(() => retainedReader?.()).toThrow('access has expired');
  });

  it('refreshes and re-resolves authority once before one authenticated retry', async () => {
    const { coordinator, provider, backend, store } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    const tokens: string[] = [];

    await expect(coordinator.executeAuthenticatedRequest(async (readAccessToken) => {
      const token = readAccessToken();
      tokens.push(token);
      return token === 'signed-in-access'
        ? { status: 'authority_rejected' }
        : { status: 'completed', value: 'server-result' };
    })).resolves.toEqual({ status: 'completed', value: 'server-result' });

    expect(tokens).toEqual(['signed-in-access', 'rotated-access']);
    expect(provider.refreshCalls).toEqual(['signed-in-refresh']);
    expect(backend.accessTokens).toEqual(['signed-in-access', 'rotated-access']);
    expect(store.value).toBe('rotated-refresh');
  });

  it('shares one refresh and token rotation across concurrent 401 operations', async () => {
    const { coordinator, provider } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    const refresh = deferred<ProviderRefreshResult>();
    provider.refreshImplementation = () => refresh.promise;
    const attempts = [0, 0, 0];

    const operations = attempts.map(async (_value, index) => coordinator.executeAuthenticatedRequest(
      async (readAccessToken) => {
        attempts[index] += 1;
        return readAccessToken() === 'signed-in-access'
          ? { status: 'authority_rejected' as const }
          : { status: 'completed' as const, value: `result-${index}` };
      },
    ));
    await vi.waitFor(() => expect(provider.refreshCalls).toEqual(['signed-in-refresh']));
    refresh.resolve({
      status: 'refreshed',
      tokens: { accessToken: 'shared-access', refreshToken: 'shared-refresh' },
    });

    await expect(Promise.all(operations)).resolves.toEqual([
      { status: 'completed', value: 'result-0' },
      { status: 'completed', value: 'result-1' },
      { status: 'completed', value: 'result-2' },
    ]);
    expect(provider.refreshCalls).toHaveLength(1);
    expect(attempts).toEqual([2, 2, 2]);
  });

  it('clears local authority after a second 401 and never performs a third attempt', async () => {
    const { coordinator, provider, store } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    let attempts = 0;

    await expect(coordinator.executeAuthenticatedRequest(async (readAccessToken) => {
      readAccessToken();
      attempts += 1;
      return { status: 'authority_rejected' };
    })).resolves.toEqual({ status: 'authority_rejected' });

    expect(attempts).toBe(2);
    expect(provider.refreshCalls).toEqual(['signed-in-refresh']);
    expect(provider.signOutCalls).toBe(1);
    expect(store.value).toBeNull();
    expect(coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'authority_rejected',
    });
  });

  it('does not retry or discard the refresh token when 401 renewal infrastructure fails', async () => {
    const { coordinator, provider, store } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    provider.refreshImplementation = async () => { throw new Error('provider detail'); };
    let attempts = 0;

    await expect(coordinator.executeAuthenticatedRequest(async () => {
      attempts += 1;
      return { status: 'authority_rejected' };
    })).resolves.toEqual({ status: 'unavailable' });

    expect(attempts).toBe(1);
    expect(store.value).toBe('signed-in-refresh');
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
    expect(coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
    expect(coordinator.isOfflineCaptureRestorationAllowed()).toBe(true);
  });

  it('does not retry when renewed server context is unavailable and keeps the rotation', async () => {
    const { coordinator, backend, store } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    backend.implementation = async (accessToken) => accessToken === 'rotated-access'
      ? { status: 'unavailable' }
      : { status: 'resolved', session: productSession };
    let attempts = 0;

    await expect(coordinator.executeAuthenticatedRequest(async () => {
      attempts += 1;
      return { status: 'authority_rejected' };
    })).resolves.toEqual({ status: 'unavailable' });

    expect(attempts).toBe(1);
    expect(store.value).toBe('rotated-refresh');
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
  });

  it('clears authority without retry when renewed server context rejects Membership', async () => {
    const { coordinator, backend, provider, store } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    backend.implementation = async (accessToken) => accessToken === 'rotated-access'
      ? { status: 'authority_rejected' }
      : { status: 'resolved', session: productSession };
    let attempts = 0;

    await expect(coordinator.executeAuthenticatedRequest(async () => {
      attempts += 1;
      return { status: 'authority_rejected' };
    })).resolves.toEqual({ status: 'authority_rejected' });

    expect(attempts).toBe(1);
    expect(store.value).toBeNull();
    expect(provider.signOutCalls).toBe(1);
    expect(coordinator.getState()).toEqual({
      status: 'unauthenticated', reason: 'authority_rejected',
    });
  });

  it('uses an already rotated provider token without starting a redundant refresh', async () => {
    const { coordinator, provider, backend } = setup();
    await coordinator.start();
    await coordinator.signIn('employee@example.invalid', 'password');
    const firstAttempt = deferred<void>();
    const seenTokens: string[] = [];

    const operation = coordinator.executeAuthenticatedRequest(async (readAccessToken) => {
      const token = readAccessToken();
      seenTokens.push(token);
      if (token === 'signed-in-access') {
        await firstAttempt.promise;
        return { status: 'authority_rejected' };
      }
      return { status: 'completed', value: 'rotated-result' };
    });
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access', refreshToken: 'event-refresh' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('event-access'));
    firstAttempt.resolve();

    await expect(operation).resolves.toEqual({ status: 'completed', value: 'rotated-result' });
    expect(seenTokens).toEqual(['signed-in-access', 'event-access']);
    expect(provider.refreshCalls).toEqual([]);
  });

  it('does not clear a newer provider session when a retried 401 belongs to an old token', async () => {
    const { coordinator, provider, backend, store } = setup();
    await coordinator.start();
    await coordinator.signIn('employee@example.invalid', 'password');
    const retry = deferred<void>();
    let attempts = 0;

    const operation = coordinator.executeAuthenticatedRequest(async () => {
      attempts += 1;
      if (attempts === 2) {
        await retry.promise;
      }
      return { status: 'authority_rejected' };
    });
    await vi.waitFor(() => expect(attempts).toBe(2));
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'newest-access', refreshToken: 'newest-refresh' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('newest-access'));
    retry.resolve();

    await expect(operation).resolves.toEqual({ status: 'unavailable' });
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
    expect(store.value).toBe('newest-refresh');
    expect(provider.signOutCalls).toBe(0);
  });

  it('never replays an old-generation request under a newly signed-in session', async () => {
    const { coordinator, provider, backend, store } = setup();
    await coordinator.start();
    await coordinator.signIn('user-a@example.invalid', 'password-a');
    const firstAttempt = deferred<void>();
    const eventResolution = deferred<BackendSessionResolution>();
    backend.implementation = (accessToken) => accessToken === 'event-access'
      ? eventResolution.promise
      : Promise.resolve({ status: 'resolved', session: productSession });
    const seenTokens: string[] = [];

    const oldOperation = coordinator.executeAuthenticatedRequest(async (readAccessToken) => {
      seenTokens.push(readAccessToken());
      await firstAttempt.promise;
      return { status: 'authority_rejected' };
    });
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access', refreshToken: 'event-refresh' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('event-access'));
    firstAttempt.resolve();

    await coordinator.signOut();
    provider.signInImplementation = async () => ({
      status: 'authenticated',
      tokens: { accessToken: 'user-b-access', refreshToken: 'user-b-refresh' },
    });
    await expect(coordinator.signIn('user-b@example.invalid', 'password-b'))
      .resolves.toEqual({ status: 'authenticated' });
    eventResolution.resolve({ status: 'resolved', session: productSession });

    await expect(oldOperation).resolves.toEqual({ status: 'unavailable' });
    expect(seenTokens).toEqual(['signed-in-access']);
    expect(store.value).toBe('user-b-refresh');
    expect(coordinator.getState()).toEqual({ status: 'authenticated', session: productSession });
  });

  it('drains every newer provider event before retrying with the latest resolved token', async () => {
    const { coordinator, provider, backend } = setup();
    await coordinator.start();
    await coordinator.signIn('employee@example.invalid', 'password');
    const firstAttempt = deferred<void>();
    const firstEventResolution = deferred<BackendSessionResolution>();
    const secondEventResolution = deferred<BackendSessionResolution>();
    backend.implementation = (accessToken) => {
      if (accessToken === 'event-access-1') {
        return firstEventResolution.promise;
      }
      if (accessToken === 'event-access-2') {
        return secondEventResolution.promise;
      }
      return Promise.resolve({ status: 'resolved', session: productSession });
    };
    const seenTokens: string[] = [];

    const operation = coordinator.executeAuthenticatedRequest(async (readAccessToken) => {
      const token = readAccessToken();
      seenTokens.push(token);
      if (token === 'signed-in-access') {
        await firstAttempt.promise;
        return { status: 'authority_rejected' };
      }
      return { status: 'completed', value: 'latest-result' };
    });
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access-1', refreshToken: 'event-refresh-1' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('event-access-1'));
    firstAttempt.resolve();
    provider.emit({
      type: 'token_refreshed',
      tokens: { accessToken: 'event-access-2', refreshToken: 'event-refresh-2' },
    });
    await vi.waitFor(() => expect(backend.accessTokens).toContain('event-access-2'));
    firstEventResolution.resolve({ status: 'resolved', session: productSession });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seenTokens).toEqual(['signed-in-access']);
    secondEventResolution.resolve({ status: 'resolved', session: productSession });

    await expect(operation).resolves.toEqual({ status: 'completed', value: 'latest-result' });
    expect(seenTokens).toEqual(['signed-in-access', 'event-access-2']);
    expect(provider.refreshCalls).toEqual([]);
  });

  it('contains every late concurrent result after a shared 401 renewal enters fail-state', async () => {
    const { coordinator, provider } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    provider.refreshImplementation = async () => { throw new Error('provider unavailable'); };
    const lateUnauthorized = deferred<void>();
    const lateCompleted = deferred<void>();
    let firstAttempts = 0;
    let unauthorizedAttempts = 0;
    let completedAttempts = 0;

    const first = coordinator.executeAuthenticatedRequest(async () => {
      firstAttempts += 1;
      return { status: 'authority_rejected' };
    });
    const second = coordinator.executeAuthenticatedRequest(async () => {
      unauthorizedAttempts += 1;
      await lateUnauthorized.promise;
      return { status: 'authority_rejected' };
    });
    const third = coordinator.executeAuthenticatedRequest(async () => {
      completedAttempts += 1;
      await lateCompleted.promise;
      return { status: 'completed', value: 'stale-result' };
    });
    await expect(first).resolves.toEqual({ status: 'unavailable' });
    expect(coordinator.getState()).toEqual({ status: 'context_unavailable' });
    expect(coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
    lateUnauthorized.resolve();
    lateCompleted.resolve();

    await expect(second).resolves.toEqual({ status: 'unavailable' });
    await expect(third).resolves.toEqual({ status: 'unavailable' });
    expect(provider.refreshCalls).toEqual(['signed-in-refresh']);
    expect(firstAttempts).toBe(1);
    expect(unauthorizedAttempts).toBe(1);
    expect(completedAttempts).toBe(1);
  });

  it('keeps the private authenticated snapshot current only for its exact session generation', async () => {
    const { coordinator } = setup();
    expect(coordinator.captureAuthenticatedSessionSnapshot()).toBeNull();
    await coordinator.signIn('employee@example.invalid', 'password');
    const snapshot = coordinator.captureAuthenticatedSessionSnapshot();
    expect(snapshot).not.toBeNull();
    expect(coordinator.isAuthenticatedSessionSnapshotCurrent(snapshot!)).toBe(true);

    await coordinator.signOut();
    expect(coordinator.isAuthenticatedSessionSnapshotCurrent(snapshot!)).toBe(false);
    await coordinator.signIn('employee@example.invalid', 'password');
    expect(coordinator.isAuthenticatedSessionSnapshotCurrent(snapshot!)).toBe(false);
    expect(coordinator.captureAuthenticatedSessionSnapshot()!.generation)
      .toBeGreaterThan(snapshot!.generation);
  });

  it('invalidates a private snapshot when authoritative Membership context changes', async () => {
    const { coordinator, backend } = setup();
    await coordinator.signIn('employee@example.invalid', 'password');
    const snapshot = coordinator.captureAuthenticatedSessionSnapshot()!;
    backend.implementation = async () => ({
      status: 'resolved',
      session: {
        ...productSession,
        membershipId: '12000000-0000-4000-8000-000000000202',
        organizationId: '00000000-0000-4000-8000-000000000202',
      },
    });

    await coordinator.refresh();

    expect(coordinator.isAuthenticatedSessionSnapshotCurrent(snapshot)).toBe(false);
    expect(coordinator.captureAuthenticatedSessionSnapshot()!.session.organizationId)
      .toBe('00000000-0000-4000-8000-000000000202');
  });
});
