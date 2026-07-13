import type {
  BackendSessionPort,
  BackendSessionResolution,
  ProductMembershipRole,
  ProductSessionContext,
} from './contracts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 10_000;

type FetchPort = typeof fetch;

export class TapTimeSessionApiClient implements BackendSessionPort {
  private readonly endpoint: URL;

  constructor(
    baseUrl: string,
    private readonly fetchRequest: FetchPort = fetch,
    private readonly requestTimeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
  ) {
    this.endpoint = new URL('v1/session', withTrailingSlash(baseUrl));
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
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: abortController.signal,
      });
      if (response.status === 401) {
        return { status: 'authority_rejected' };
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
}

function parseSession(value: unknown): ProductSessionContext | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'membershipId,organizationId,role,userId'
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
  });
}

function isMembershipRole(value: unknown): value is ProductMembershipRole {
  return value === 'administrator' || value === 'employee';
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
