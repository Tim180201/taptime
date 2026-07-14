import type { AuthenticatedRequestCapability } from '../auth/contracts';
import { utf8ByteLength } from './strictJson';

const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAXIMUM_JSON_BODY_BYTES = 16 * 1024;

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
    }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'transient_failure' }
  | { readonly status: 'unavailable' };

export interface AuthenticatedJsonPostPort {
  post(endpoint: URL, body: string): Promise<AuthenticatedHttpResult>;
}

export class AuthenticatedHttpRequestExecutor implements AuthenticatedJsonPostPort {
  constructor(
    private readonly authentication: AuthenticatedRequestCapability,
    private readonly fetchRequest: AuthenticatedFetchPort = fetch,
    private readonly requestTimeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
  ) {
    if (!Number.isSafeInteger(requestTimeoutMilliseconds) || requestTimeoutMilliseconds <= 0) {
      throw new Error('Authenticated request timeout must be a positive safe integer');
    }
  }

  async post(endpoint: URL, body: string): Promise<AuthenticatedHttpResult> {
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
          if (response.status === 401) {
            return { status: 'authority_rejected' };
          }
          if (
            response.redirected
            || (response.status >= 300 && response.status < 400)
          ) {
            return { status: 'completed', value: { status: 'unavailable' } };
          }
          if (response.status === 429 || response.status >= 500) {
            return { status: 'completed', value: { status: 'transient_failure' } };
          }

          const declaredLength = response.headers.get('content-length');
          if (declaredLength !== null) {
            const parsedLength = Number(declaredLength);
            if (
              !Number.isSafeInteger(parsedLength)
              || parsedLength < 0
              || parsedLength > MAXIMUM_JSON_BODY_BYTES
            ) {
              return { status: 'completed', value: { status: 'unavailable' } };
            }
          }
          const responseBody = await readBoundedResponseText(response);
          if (responseBody === null) {
            return { status: 'completed', value: { status: 'unavailable' } };
          }
          return {
            status: 'completed',
            value: {
              status: 'response',
              statusCode: response.status,
              contentType: response.headers.get('content-type'),
              body: responseBody,
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

async function readBoundedResponseText(response: Response): Promise<string | null> {
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
      if (bytes > MAXIMUM_JSON_BODY_BYTES) {
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

function isRedirectRejection(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('redirect');
}
