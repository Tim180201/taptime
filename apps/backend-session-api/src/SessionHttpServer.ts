import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { SessionApiDiagnosticSink, SessionAuthorityResolver } from './types.js';

const SESSION_PATH = '/v1/session';
const MAX_AUTHORIZATION_LENGTH = 4_096;
const MAX_HEADER_BYTES = 8_192;
const DEFAULT_AUTHORITY_TIMEOUT_MILLISECONDS = 8_000;
const compactJwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type ErrorCode =
  | 'invalid_request'
  | 'method_not_allowed'
  | 'not_found'
  | 'service_unavailable'
  | 'unauthorized';

export interface SessionHttpServerOptions {
  readonly onDiagnostic?: SessionApiDiagnosticSink;
  readonly authorityTimeoutMilliseconds?: number;
}

export function createSessionHttpServer(
  authority: SessionAuthorityResolver,
  options: SessionHttpServerOptions = {},
): Server {
  const authorityTimeoutMilliseconds = validateAuthorityTimeout(
    options.authorityTimeoutMilliseconds ?? DEFAULT_AUTHORITY_TIMEOUT_MILLISECONDS,
  );
  const server = createServer({ maxHeaderSize: MAX_HEADER_BYTES }, (request, response) => {
    void handleRequest(
      request,
      response,
      authority,
      options,
      authorityTimeoutMilliseconds,
    );
  });
  server.maxHeadersCount = 64;
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.on('clientError', (_error, socket) => {
    if (socket.writable) {
      const correlationId = randomUUID();
      socket.end(
        'HTTP/1.1 400 Bad Request\r\n'
        + 'Connection: close\r\n'
        + 'Cache-Control: no-store\r\n'
        + 'Content-Type: application/json; charset=utf-8\r\n'
        + `X-Request-Id: ${correlationId}\r\n`
        + 'X-Content-Type-Options: nosniff\r\n'
        + '\r\n'
        + JSON.stringify({ error: { code: 'invalid_request' } }),
      );
    }
  });
  return server;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  authority: SessionAuthorityResolver,
  options: SessionHttpServerOptions,
  authorityTimeoutMilliseconds: number,
): Promise<void> {
  const correlationId = randomUUID();
  applyResponseHeaders(response, correlationId);

  if (request.url !== SESSION_PATH) {
    request.resume();
    respondError(response, 404, 'not_found');
    return;
  }
  if (request.method !== 'GET') {
    request.resume();
    response.setHeader('Allow', 'GET');
    respondError(response, 405, 'method_not_allowed');
    return;
  }
  if (requestHasBody(request)) {
    request.resume();
    respondError(response, 400, 'invalid_request');
    return;
  }

  const accessToken = bearerToken(request);
  if (accessToken === null) {
    request.resume();
    respondError(response, 401, 'unauthorized');
    return;
  }

  try {
    const resolution = await withTimeout(
      authority.resolve(accessToken),
      authorityTimeoutMilliseconds,
    );
    if (resolution.status === 'rejected') {
      respondError(response, 401, 'unauthorized');
      return;
    }
    respondJson(response, 200, resolution.session);
  } catch {
    try {
      options.onDiagnostic?.({ code: 'session_resolution_failed', correlationId });
    } catch {
      // Diagnostics are deliberately non-authoritative and must never break the safe response.
    }
    respondError(response, 503, 'service_unavailable');
  }
}

async function withTimeout<Value>(operation: Promise<Value>, timeoutMilliseconds: number): Promise<Value> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Session authority timed out')),
          timeoutMilliseconds,
        );
        timeout.unref();
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function validateAuthorityTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Session authority timeout must be a positive safe integer');
  }
  return value;
}

function requestHasBody(request: IncomingMessage): boolean {
  if (request.headers['transfer-encoding'] !== undefined) {
    return true;
  }
  const contentLength = request.headers['content-length'];
  return contentLength !== undefined && contentLength !== '0';
}

function bearerToken(request: IncomingMessage): string | null {
  const values: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === 'authorization') {
      values.push(request.rawHeaders[index + 1] ?? '');
    }
  }
  if (values.length !== 1) {
    return null;
  }
  const value = values[0]!;
  if (value.length > MAX_AUTHORIZATION_LENGTH) {
    return null;
  }
  const match = /^Bearer ([^\s]+)$/i.exec(value);
  if (match === null || !compactJwtPattern.test(match[1]!)) {
    return null;
  }
  return match[1]!;
}

function applyResponseHeaders(response: ServerResponse, correlationId: string): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Request-Id', correlationId);
}

function respondError(response: ServerResponse, statusCode: number, code: ErrorCode): void {
  respondJson(response, statusCode, { error: { code } });
}

function respondJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.end(JSON.stringify(body));
}
