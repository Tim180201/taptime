import {
  createServer,
  request as createUpstreamRequest,
  type ClientRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { Socket } from 'node:net';

export const SYNTHETIC_GATE_C_LISTEN_HOST = '127.0.0.1';
export const SYNTHETIC_GATE_C_LISTEN_PORT = 3_001;
export const SYNTHETIC_GATE_C_UPSTREAM_HOST = '127.0.0.1';
export const SYNTHETIC_GATE_C_UPSTREAM_PORT = 3_000;
export const SYNTHETIC_GATE_C_OFFLINE_PATH = '/v1/lifecycle-events/offline';

const maximumHeaderBytes = 8_192;
const maximumHeaderCount = 64;
const defaultUpstreamTimeoutMilliseconds = 15_000;
const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export type SyntheticGateCResponseDropState =
  | 'armed'
  | 'blocked'
  | 'closed'
  | 'created'
  | 'dropping'
  | 'failed';

export type SyntheticGateCResponseDropSafeEvent =
  | 'gate_c_proxy_armed'
  | 'gate_c_proxy_closed'
  | 'gate_c_response_drop_failed'
  | 'gate_c_response_dropped';

export interface SyntheticGateCResponseDropProxyOptions {
  /**
   * Test-only numeric port override. Runtime entrypoints deliberately supply no override.
   * Both listener and upstream hosts remain fixed to numeric loopback.
   */
  readonly listenPort?: number;
  readonly onSafeEvent?: (event: SyntheticGateCResponseDropSafeEvent) => void;
  /** Test-only numeric port override; the runtime entrypoint always uses port 3000. */
  readonly upstreamPort?: number;
  /** Test-only timeout override; the runtime entrypoint always uses 15 seconds. */
  readonly upstreamTimeoutMilliseconds?: number;
}

export interface SyntheticGateCResponseDropProxyControl {
  close(): Promise<void>;
  getListenPort(): number;
  getState(): SyntheticGateCResponseDropState;
  start(): Promise<void>;
}

/**
 * Strictly local, one-shot DA1 Gate-C transport-fault proxy.
 *
 * It never parses, retains or reports request/response data. The first exact offline lifecycle
 * request is allowed to finish at the upstream server, its complete synchronized response is
 * withheld, and every later request is blocked until the operator restores the direct ADB mapping.
 */
export class SyntheticGateCResponseDropProxy
implements SyntheticGateCResponseDropProxyControl {
  private readonly listenPort: number;
  private readonly onSafeEvent: (event: SyntheticGateCResponseDropSafeEvent) => void;
  private readonly upstreamPort: number;
  private readonly upstreamTimeoutMilliseconds: number;
  private readonly sockets = new Set<Socket>();
  private readonly upstreamRequests = new Set<ClientRequest>();
  private server: Server | null = null;
  private state: SyntheticGateCResponseDropState = 'created';

  constructor(options: SyntheticGateCResponseDropProxyOptions = {}) {
    this.listenPort = validatePort(options.listenPort ?? SYNTHETIC_GATE_C_LISTEN_PORT, true);
    this.upstreamPort = validatePort(options.upstreamPort ?? SYNTHETIC_GATE_C_UPSTREAM_PORT, false);
    this.upstreamTimeoutMilliseconds = validateTimeout(
      options.upstreamTimeoutMilliseconds ?? defaultUpstreamTimeoutMilliseconds,
    );
    this.onSafeEvent = options.onSafeEvent ?? (() => undefined);
  }

  async start(): Promise<void> {
    if (this.state !== 'created' || this.server !== null) {
      throw new Error('Synthetic Gate-C response-drop proxy cannot be started twice');
    }
    const server = createServer(
      { maxHeaderSize: maximumHeaderBytes },
      (request, response) => this.handleRequest(request, response),
    );
    server.maxHeadersCount = maximumHeaderCount;
    server.headersTimeout = 5_000;
    server.requestTimeout = 10_000;
    server.keepAliveTimeout = 5_000;
    server.on('connection', (socket) => {
      this.sockets.add(socket);
      socket.once('close', () => this.sockets.delete(socket));
    });
    server.on('clientError', (_error, socket) => socket.destroy());
    this.server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (): void => {
          server.off('listening', onListening);
          reject(new Error('Synthetic Gate-C response-drop proxy failed to bind'));
        };
        const onListening = (): void => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(this.listenPort, SYNTHETIC_GATE_C_LISTEN_HOST);
      });
    } catch {
      this.server = null;
      this.state = 'closed';
      throw new Error('Synthetic Gate-C response-drop proxy failed to bind');
    }
    server.on('error', () => {
      if (this.state === 'armed' || this.state === 'dropping') {
        this.state = 'failed';
        this.emitSafeEvent('gate_c_response_drop_failed');
      }
    });
    this.state = 'armed';
    this.emitSafeEvent('gate_c_proxy_armed');
  }

  getState(): SyntheticGateCResponseDropState {
    return this.state;
  }

  getListenPort(): number {
    const address = this.server?.address();
    if (address === null || address === undefined || typeof address === 'string') {
      return this.listenPort;
    }
    return address.port;
  }

  async close(): Promise<void> {
    if (this.state === 'closed') {
      return;
    }
    this.state = 'closed';
    const server = this.server;
    this.server = null;
    for (const request of this.upstreamRequests) {
      request.destroy();
    }
    this.upstreamRequests.clear();
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
    if (server !== null) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
    this.emitSafeEvent('gate_c_proxy_closed');
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    if (this.state !== 'armed') {
      blockRequest(request, response);
      return;
    }
    if (
      request.method === 'POST'
      && request.url === SYNTHETIC_GATE_C_OFFLINE_PATH
    ) {
      this.state = 'dropping';
      this.forwardDroppedRequest(request, response);
      return;
    }
    this.forwardPassThroughRequest(request, response);
  }

  private forwardDroppedRequest(request: IncomingMessage, response: ServerResponse): void {
    const upstream = this.createRequest(request, (upstreamResponse) => {
      let terminal = false;
      const fail = (): void => {
        if (terminal) {
          return;
        }
        terminal = true;
        this.failDrop(response);
      };
      upstreamResponse.once('aborted', fail);
      upstreamResponse.once('error', fail);
      upstreamResponse.once('end', () => {
        if (terminal) {
          return;
        }
        terminal = true;
        if (
          this.state !== 'dropping'
          || !upstreamResponse.complete
          || upstreamResponse.statusCode !== 200
        ) {
          this.failDrop(response);
          return;
        }
        this.state = 'blocked';
        response.destroy();
        this.emitSafeEvent('gate_c_response_dropped');
      });
      upstreamResponse.resume();
    });
    upstream.once('error', () => this.failDrop(response));
    pipeRequest(request, upstream, true);
  }

  private forwardPassThroughRequest(request: IncomingMessage, response: ServerResponse): void {
    const upstream = this.createRequest(request, (upstreamResponse) => {
      if (response.destroyed || response.writableEnded) {
        upstreamResponse.destroy();
        return;
      }
      const headers = forwardedHeaders(upstreamResponse.rawHeaders, this.upstreamPort, false);
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.statusMessage ?? '',
        headers,
      );
      upstreamResponse.once('error', () => response.destroy());
      upstreamResponse.pipe(response);
    });
    upstream.once('error', () => response.destroy());
    response.once('close', () => {
      if (!response.writableEnded) {
        upstream.destroy();
      }
    });
    pipeRequest(request, upstream, false);
  }

  private createRequest(
    request: IncomingMessage,
    onResponse: (response: IncomingMessage) => void,
  ): ClientRequest {
    const upstream = createUpstreamRequest({
      agent: false,
      headers: forwardedHeaders(request.rawHeaders, this.upstreamPort, true),
      host: SYNTHETIC_GATE_C_UPSTREAM_HOST,
      method: request.method,
      path: request.url,
      port: this.upstreamPort,
    }, onResponse);
    this.upstreamRequests.add(upstream);
    upstream.once('close', () => this.upstreamRequests.delete(upstream));
    upstream.setTimeout(this.upstreamTimeoutMilliseconds, () => upstream.destroy());
    return upstream;
  }

  private failDrop(response: ServerResponse): void {
    if (this.state !== 'dropping') {
      response.destroy();
      return;
    }
    this.state = 'failed';
    response.destroy();
    this.emitSafeEvent('gate_c_response_drop_failed');
  }

  private emitSafeEvent(event: SyntheticGateCResponseDropSafeEvent): void {
    try {
      this.onSafeEvent(event);
    } catch {
      // Fixed diagnostics must never affect one-shot transport behavior or cleanup.
    }
  }
}

function pipeRequest(
  request: IncomingMessage,
  upstream: ClientRequest,
  preserveAfterCompleteRequest: boolean,
): void {
  const abortIncompleteUpstream = (): void => {
    if (!preserveAfterCompleteRequest || !request.complete) {
      upstream.destroy();
    }
  };
  request.once('aborted', abortIncompleteUpstream);
  request.once('error', abortIncompleteUpstream);
  request.pipe(upstream);
}

function blockRequest(request: IncomingMessage, response: ServerResponse): void {
  request.destroy();
  response.destroy();
}

function forwardedHeaders(
  rawHeaders: readonly string[],
  upstreamPort: number,
  requestHeaders: boolean,
): string[] {
  const result: string[] = [];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    const name = rawHeaders[index] as string;
    const value = rawHeaders[index + 1] as string;
    const normalized = name.toLowerCase();
    if (normalized === 'host' || hopByHopHeaders.has(normalized)) {
      continue;
    }
    result.push(name, value);
  }
  if (requestHeaders) {
    result.push('Host', `${SYNTHETIC_GATE_C_UPSTREAM_HOST}:${upstreamPort}`);
  }
  result.push('Connection', 'close');
  return result;
}

function validatePort(value: number, allowZero: boolean): number {
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(value) || value < minimum || value > 65_535) {
    throw new Error('Synthetic Gate-C proxy port is invalid');
  }
  return value;
}

function validateTimeout(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 60_000) {
    throw new Error('Synthetic Gate-C proxy timeout is invalid');
  }
  return value;
}
