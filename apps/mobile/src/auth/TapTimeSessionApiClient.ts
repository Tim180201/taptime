import { isOrganizationPausedResponse, readBoundedResponseText } from '../transport/AuthenticatedHttpRequestExecutor';
import type {
  BackendSessionPort,
  BackendSessionResolution,
  PasswordResetAuditResult,
  ProductMembershipRole,
  ProductSessionContext,
} from './contracts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 10_000;

type FetchPort = typeof fetch;

export class TapTimeSessionApiClient implements BackendSessionPort {
  private readonly endpoint: URL;
  private readonly passwordResetAuditEndpoint: URL;

  constructor(
    baseUrl: string,
    private readonly fetchRequest: FetchPort = (input, init) => globalThis.fetch(input, init),
    private readonly requestTimeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
  ) {
    this.endpoint = new URL('v1/session', withTrailingSlash(baseUrl));
    this.passwordResetAuditEndpoint = new URL(
      'v1/auth/password-reset/audit', withTrailingSlash(baseUrl),
    );
    if (!Number.isSafeInteger(requestTimeoutMilliseconds) || requestTimeoutMilliseconds <= 0) {
      throw new Error('Session API request timeout must be a positive safe integer');
    }
  }

  async resolve(accessToken: string): Promise<BackendSessionResolution> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.requestTimeoutMilliseconds,
    );
    try {
      const response = await this.fetchRequest(this.endpoint.href, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.taptime.mobile-session.v2+json',
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: abortController.signal,
      });
      if (response.redirected) {
        return { status: 'unavailable' };
      }
      if (response.status === 401) {
        return { status: 'authority_rejected' };
      }
      if (response.status === 403 && isOrganizationPausedResponse(403, await readBoundedResponseText(response, 4096))) {
        return { status: 'organization_paused' };
      }
      if (response.status !== 200) {
        return { status: 'unavailable' };
      }
      const session = parseSession(await response.json());
      return session === null ? { status: 'unavailable' } : { status: 'resolved', session };
    } catch {
      return { status: 'unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }

  async recordPasswordReset(accessToken: string): Promise<PasswordResetAuditResult> {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      this.requestTimeoutMilliseconds,
    );
    try {
      const response = await this.fetchRequest(this.passwordResetAuditEndpoint.href, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: abortController.signal,
      });
      if (response.redirected) return { status: 'unavailable' };
      if (response.status === 401 || response.status === 403) {
        return { status: 'authority_rejected' };
      }
      if (response.status !== 200) return { status: 'unavailable' };
      const value: unknown = await response.json();
      if (
        typeof value !== 'object' || value === null || Array.isArray(value)
        || Object.keys(value).join(',') !== 'status'
        || (value as { readonly status?: unknown }).status !== 'succeeded'
      ) return { status: 'unavailable' };
      return { status: 'recorded' };
    } catch {
      return { status: 'unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseSession(value: unknown): ProductSessionContext | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    !['membershipId,organizationId,role,userId', 'membershipId,nfcSetupAvailable,organizationId,role,userId',
      'locationsEnabled,managementScope,membershipId,nfcSetupAvailable,organizationId,role,userId']
      .includes(Object.keys(record).sort().join(','))
    || ('managementScope' in record && (!validManagementScope(record.managementScope) || typeof record.locationsEnabled !== 'boolean'))
    || ('nfcSetupAvailable' in record && typeof record.nfcSetupAvailable !== 'boolean')
    || typeof record.userId !== 'string'
    || typeof record.membershipId !== 'string'
    || typeof record.organizationId !== 'string'
    || !uuidPattern.test(record.userId)
    || !uuidPattern.test(record.membershipId)
    || !uuidPattern.test(record.organizationId)
    || !isMembershipRole(record.role)
  ) {
    return null;
  }
  return Object.freeze({
    userId: record.userId,
    membershipId: record.membershipId,
    organizationId: record.organizationId,
    role: record.role,
    nfcSetupAvailable: record.nfcSetupAvailable === true,
    ...('managementScope' in record ? { managementScope: record.managementScope as ProductSessionContext['managementScope'], locationsEnabled: record.locationsEnabled as boolean } : {}),
  });
}

function isMembershipRole(value: unknown): value is ProductMembershipRole {
  return value === 'administrator' || value === 'standortleitung' || value === 'employee';
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function validManagementScope(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.kind === 'organization' ? Object.keys(v).join(',') === 'kind'
    : v.kind === 'location' && Object.keys(v).sort().join(',') === 'kind,locationId,locationName'
      && typeof v.locationId === 'string' && uuidPattern.test(v.locationId)
      && typeof v.locationName === 'string' && v.locationName.trim().length > 0 && [...v.locationName].length <= 120;
}
