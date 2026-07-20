export type ProductMembershipRole = 'administrator' | 'employee';

export interface ProductSessionContext {
  readonly userId: string;
  readonly membershipId: string;
  readonly organizationId: string;
  readonly role: ProductMembershipRole;
}

export interface ProviderSessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export type ProviderSignInResult =
  | { readonly status: 'authenticated'; readonly tokens: ProviderSessionTokens }
  | { readonly status: 'invalid_credentials' };

export type ProviderRefreshResult =
  | { readonly status: 'refreshed'; readonly tokens: ProviderSessionTokens }
  | { readonly status: 'rejected' };

export type ProviderAuthEvent =
  | { readonly type: 'token_refreshed'; readonly tokens: ProviderSessionTokens }
  | { readonly type: 'signed_out' };

export interface ProviderAuthPort {
  signInWithPassword(email: string, password: string): Promise<ProviderSignInResult>;
  refreshSession(refreshToken: string): Promise<ProviderRefreshResult>;
  signOutLocal(): Promise<void>;
  subscribe(listener: (event: ProviderAuthEvent) => void): () => void;
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
}

export interface RefreshTokenStore {
  isAvailable(): Promise<boolean>;
  read(): Promise<string | null>;
  write(refreshToken: string): Promise<void>;
  clear(): Promise<void>;
}

export type BackendSessionResolution =
  | { readonly status: 'resolved'; readonly session: ProductSessionContext }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable' };

export interface BackendSessionPort {
  resolve(accessToken: string): Promise<BackendSessionResolution>;
}

export type EmployeeEnrollmentRedemption =
  | { readonly status: 'succeeded' }
  | { readonly status: 'enrollment_unavailable' }
  | { readonly status: 'invalid_request' }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'transient_failure' };

export interface EmployeeEnrollmentPort {
  redeem(
    accessToken: EphemeralAccessTokenReader,
    commandId: string,
    invitationSecret: string,
  ): Promise<EmployeeEnrollmentRedemption>;
}

export type MobileSessionState =
  | { readonly status: 'initializing' }
  | {
      readonly status: 'unauthenticated';
      readonly reason: 'not_signed_in' | 'invalid_credentials' | 'authority_rejected';
    }
  | { readonly status: 'signing_in' }
  | { readonly status: 'authenticated'; readonly session: ProductSessionContext }
  | {
      readonly status: 'enrollment_only';
      readonly notice: 'enrollment_unavailable' | 'invalid_request' | 'request_failed' | null;
    }
  | { readonly status: 'context_unavailable' }
  | {
      readonly status: 'runtime_unavailable';
      readonly reason: 'authentication_unavailable' | 'storage_unavailable';
    }
  | { readonly status: 'signed_out' };

export type SignInResult =
  | { readonly status: 'authenticated' }
  | { readonly status: 'invalid_credentials' }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'context_unavailable' }
  | { readonly status: 'infrastructure_error' }
  | { readonly status: 'enrollment_required' };

export type EmployeeEnrollmentResult =
  | { readonly status: 'enrolled' }
  | { readonly status: 'enrollment_unavailable' }
  | { readonly status: 'invalid_request' }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'context_unavailable' };

export interface MobileSessionCapability {
  getState(): MobileSessionState;
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<SignInResult>;
  signInForEmployeeEnrollment(email: string, password: string): Promise<SignInResult>;
  redeemEmployeeInvitation(invitationSecret: string): Promise<EmployeeEnrollmentResult>;
  retryContext(): Promise<void>;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
}

/**
 * Private runtime snapshot used to invalidate work across authentication/authority changes. It is
 * intentionally absent from MobileSessionCapability and therefore never reaches React.
 */
export interface InternalAuthenticatedSessionSnapshot {
  readonly generation: number;
  readonly session: ProductSessionContext;
}

/**
 * Private runtime snapshot proving that offline restoration still belongs to the exact retained
 * provider context which opened the local capture window. It intentionally contains no credential
 * material and is absent from MobileSessionCapability.
 */
export interface InternalOfflineRestorationSnapshot {
  readonly generation: number;
  readonly restorationRevision: number;
  readonly source: 'provider_suspended' | 'backend_context_unavailable';
}

/**
 * An access-token reader is valid only while one infrastructure attempt is running. The
 * coordinator invalidates it as soon as that attempt settles, so it cannot become a retained
 * token capability in a screen, queue or later callback.
 */
export type EphemeralAccessTokenReader = () => string;

export type AuthenticatedRequestAttempt<Value> =
  | { readonly status: 'completed'; readonly value: Value }
  | { readonly status: 'authority_rejected' };

export type AuthenticatedRequestExecution<Value> =
  | { readonly status: 'completed'; readonly value: Value }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable' };

/** Internal infrastructure capability. It is deliberately absent from MobileSessionCapability. */
export interface AuthenticatedRequestCapability {
  executeAuthenticatedRequest<Value>(
    attempt: (
      accessToken: EphemeralAccessTokenReader,
    ) => Promise<AuthenticatedRequestAttempt<Value>>,
  ): Promise<AuthenticatedRequestExecution<Value>>;
}
