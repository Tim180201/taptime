import type {
  EmployeeEnrollmentPort,
  EmployeeEnrollmentRedemption,
  EphemeralAccessTokenReader,
} from './contracts';
import { hasExactKeys, isJsonContentType, isObject, parseJsonObject, utf8ByteLength } from '../transport/strictJson';

const maximumJsonBytes = 16 * 1024;
const commandIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const invitationSecretPattern = /^[A-Za-z0-9_-]{43}$/;

export class TapTimeEmployeeEnrollmentApiClient implements EmployeeEnrollmentPort {
  private readonly endpoint: URL;

  constructor(
    baseUrl: string,
    private readonly fetchRequest: typeof fetch = (input, init) => globalThis.fetch(input, init),
    private readonly timeoutMilliseconds = 10_000,
  ) {
    this.endpoint = new URL('v1/employee-enrollment/redeem', withTrailingSlash(baseUrl));
  }

  async redeem(
    accessToken: EphemeralAccessTokenReader,
    commandId: string,
    invitationSecret: string,
  ): Promise<EmployeeEnrollmentRedemption> {
    if (
      !commandIdPattern.test(commandId)
      || !isCanonicalInvitationSecret(invitationSecret)
    ) return { status: 'invalid_request' };
    const body = JSON.stringify({ commandId, invitationSecret });
    if (utf8ByteLength(body) > maximumJsonBytes) return { status: 'invalid_request' };
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMilliseconds);
    try {
      const response = await this.fetchRequest(this.endpoint.href, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken()}`,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
        body,
        credentials: 'omit',
        redirect: 'manual',
        signal: abortController.signal,
      });
      if (response.status === 401) return { status: 'authority_rejected' };
      if (response.status === 429 || response.status >= 500) return { status: 'transient_failure' };
      if (response.redirected || (response.status >= 300 && response.status < 400)) {
        return { status: 'transient_failure' };
      }
      const declaredLength = response.headers.get('content-length');
      if (declaredLength !== null) {
        const length = Number(declaredLength);
        if (!Number.isSafeInteger(length) || length < 0 || length > maximumJsonBytes) {
          return { status: 'transient_failure' };
        }
      }
      const responseBody = await readBoundedResponseText(response);
      if (responseBody === null || !isJsonContentType(response.headers.get('content-type'))) {
        return { status: 'transient_failure' };
      }
      const parsed = parseJsonObject(responseBody);
      if (response.status === 200) {
        return isEnrollmentSuccess(parsed) ? { status: 'succeeded' } : { status: 'transient_failure' };
      }
      if (response.status === 404 && errorCode(parsed) === 'enrollment_unavailable') {
        return { status: 'enrollment_unavailable' };
      }
      if (response.status === 400 && errorCode(parsed) === 'invalid_request') {
        return { status: 'invalid_request' };
      }
      return { status: 'transient_failure' };
    } catch {
      return { status: 'transient_failure' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isCanonicalInvitationSecret(value: string): boolean {
  if (!invitationSecretPattern.test(value)) return false;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return alphabet.indexOf(value.at(-1)!) % 4 === 0;
}

function isEnrollmentSuccess(value: Record<string, unknown> | null): boolean {
  return value !== null
    && hasExactKeys(value, ['status', 'organizationName', 'membershipDisplayName', 'role'])
    && value.status === 'succeeded'
    && typeof value.organizationName === 'string'
    && value.organizationName.length > 0
    && typeof value.membershipDisplayName === 'string'
    && value.membershipDisplayName.length > 0
    && value.role === 'employee';
}

function errorCode(value: Record<string, unknown> | null): unknown {
  return value !== null && hasExactKeys(value, ['error'])
    && isObject(value.error) && hasExactKeys(value.error, ['code'])
    ? value.error.code
    : null;
}

async function readBoundedResponseText(response: Response): Promise<string | null> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      bytes += chunk.value.byteLength;
      if (bytes > maximumJsonBytes) {
        try { await reader.cancel(); } catch { /* best-effort cleanup */ }
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    try { reader.releaseLock(); } catch { /* canceled streams have no usable lock */ }
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
