// Frozen production transport before T-068a, used only for old-client compatibility tests.
import { TIME_DETAILS_ACCEPT } from '@taptime/mobile-work-contract';
import type { AuthenticatedRequestCapability } from '../../src/auth/contracts';
import {
  OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES,
  OFFLINE_REQUEST_MAXIMUM_BYTES,
  OFFLINE_RESPONSE_MAXIMUM_BYTES,
  isValidRetryAfterSeconds,
} from '@taptime/offline-sync-contract';
import { utf8ByteLength } from '../../src/transport/strictJson';

const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAXIMUM_JSON_BODY_BYTES = OFFLINE_REQUEST_MAXIMUM_BYTES;
const TIME_DETAILS_RESPONSE_MAXIMUM_BYTES = 256 * 1024;

export interface AuthenticatedFetchRequestInit {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly credentials: 'omit';
  readonly redirect: 'manual';
  readonly signal: AbortSignal;
}

export type AuthenticatedFetchPort = (
  input: string,
  init: AuthenticatedFetchRequestInit,
) => Promise<Response>;

export type AuthenticatedHttpResult =
  | {
      readonly status: 'response';
      readonly statusCode: number;
      readonly contentType: string | null;
      readonly body: string;
      readonly retryAfterSeconds?: number;
    }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'transient_failure'; readonly retryAfterSeconds?: number }
  | { readonly status: 'unavailable' };

export interface AuthenticatedJsonPostPort {
  post(
    endpoint: URL,
    body: string,
    options?: AuthenticatedJsonPostOptions,
  ): Promise<AuthenticatedHttpResult>;
}

export interface AuthenticatedJsonPostOptions {
  readonly includeTimeDetails?: boolean;
  /** Compare-only lifecycle expectation. No caller can inject arbitrary headers through this port. */
  readonly expectedMembershipId?: string;
  /** Closed response-size exception used only by the immutable offline lease-page route. */
  readonly maximumResponseBytes?: number;
}

export class AuthenticatedHttpRequestExecutor implements AuthenticatedJsonPostPort {
  constructor(
    private readonly authentication: AuthenticatedRequestCapability,
    private readonly fetchRequest: AuthenticatedFetchPort = fetch,
    private readonly requestTimeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
    private readonly preserveAccountInvitationErrors = false,
  ) {
    if (!Number.isSafeInteger(requestTimeoutMilliseconds) || requestTimeoutMilliseconds <= 0) {
      throw new Error('Authenticated request timeout must be a positive safe integer');
    }
  }

  async post(
    endpoint: URL,
    body: string,
    options?: AuthenticatedJsonPostOptions,
  ): Promise<AuthenticatedHttpResult> {
    if (utf8ByteLength(body) > MAXIMUM_JSON_BODY_BYTES) {
      return { status: 'unavailable' };
    }

    const execution = await this.authentication.executeAuthenticatedRequest<AuthenticatedHttpResult>(
      async (accessToken) => {
        const abortController = new AbortController();
        const timeout = setTimeout(
          () => abortController.abort(),
          this.requestTimeoutMilliseconds,
        );
        try {
          const response = await this.fetchRequest(endpoint.href, {
            method: 'POST',
            headers: {
              Accept: options?.includeTimeDetails === true ? TIME_DETAILS_ACCEPT : 'application/json',
              Authorization: `Bearer ${accessToken()}`,
              'Cache-Control': 'no-store',
              'Content-Type': 'application/json',
              ...(options?.expectedMembershipId === undefined
                ? {}
                : { 'X-TapTime-Expected-Membership-Id': options.expectedMembershipId }),
            },
            body,
            credentials: 'omit',
            redirect: 'manual',
            signal: abortController.signal,
          });
          if (response.status === 401) {
            return { status: 'authority_rejected' };
          }
          if (
            response.redirected
            || (response.status >= 300 && response.status < 400)
          ) {
            return { status: 'completed', value: { status: 'unavailable' } };
          }
          // T-047 has named business outcomes on 429/503. Only its dedicated client
          // opts into reading their bounded bodies; existing transport behavior is unchanged.
          const accountInvitation = this.preserveAccountInvitationErrors
            && endpoint.pathname === '/v1/administration/employee-account-invitations';
          if ((response.status === 429 || response.status >= 500) && !accountInvitation) {
            const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
            if (retryAfter.status === 'invalid') {
              return { status: 'completed', value: { status: 'unavailable' } };
            }
            return {
              status: 'completed',
              value: {
                status: 'transient_failure',
                ...(retryAfter.status === 'valid'
                  ? { retryAfterSeconds: retryAfter.seconds }
                  : {}),
              },
            };
          }

          const timeDetails = options?.includeTimeDetails === true
            && (endpoint.pathname === '/v1/mobile/own-time/query'
              || endpoint.pathname === '/v1/administration/managed-person-time');
          const maximumResponseBytes = timeDetails ? TIME_DETAILS_RESPONSE_MAXIMUM_BYTES
            : options?.maximumResponseBytes ?? OFFLINE_RESPONSE_MAXIMUM_BYTES;
          if (
            maximumResponseBytes !== OFFLINE_RESPONSE_MAXIMUM_BYTES
            && maximumResponseBytes !== OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES
            && !(timeDetails && maximumResponseBytes === TIME_DETAILS_RESPONSE_MAXIMUM_BYTES)
          ) {
            return { status: 'completed', value: { status: 'unavailable' } };
          }
          const declaredLength = response.headers.get('content-length');
          if (declaredLength !== null) {
            const parsedLength = Number(declaredLength);
            if (
              !Number.isSafeInteger(parsedLength)
              || parsedLength < 0
              || parsedLength > maximumResponseBytes
            ) {
              return { status: 'completed', value: { status: 'unavailable' } };
            }
          }
          const responseBody = await readBoundedResponseText(response, maximumResponseBytes);
          if (responseBody === null) {
            return { status: 'completed', value: { status: 'unavailable' } };
          }
          const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
          if (retryAfter.status === 'invalid') {
            return { status: 'completed', value: { status: 'unavailable' } };
          }
          return {
            status: 'completed',
            value: {
              status: 'response',
              statusCode: response.status,
              contentType: response.headers.get('content-type'),
              body: responseBody,
              ...(retryAfter.status === 'valid'
                ? { retryAfterSeconds: retryAfter.seconds }
                : {}),
            },
          };
        } catch (error) {
          return {
            status: 'completed',
            value: {
              status: isRedirectRejection(error) ? 'unavailable' : 'transient_failure',
            },
          };
        } finally {
          clearTimeout(timeout);
        }
      },
    );

    if (execution.status === 'completed') {
      return execution.value;
    }
    return execution.status === 'authority_rejected'
      ? { status: 'authority_rejected' }
      : { status: 'transient_failure' };
  }
}

async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string | null> {
  const body = response.body;
  if (body === null) {
    return '';
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        text += decoder.decode();
        return text;
      }
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) {
        try {
          await reader.cancel('TapTim.e response body exceeded its byte limit');
        } catch {
          // The response is already unavailable; cancellation is best-effort cleanup only.
        }
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    return null;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A failed or canceled stream cannot provide application data regardless of lock cleanup.
    }
  }
}

type ParsedRetryAfter =
  | { readonly status: 'absent' }
  | { readonly status: 'valid'; readonly seconds: number }
  | { readonly status: 'invalid' };

function parseRetryAfter(value: string | null): ParsedRetryAfter {
  if (value === null) return { status: 'absent' };
  if (!/^[1-9][0-9]{0,2}$/.test(value)) return { status: 'invalid' };
  const seconds = Number(value);
  return isValidRetryAfterSeconds(seconds)
    ? { status: 'valid', seconds }
    : { status: 'invalid' };
}

function isRedirectRejection(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('redirect');
}
