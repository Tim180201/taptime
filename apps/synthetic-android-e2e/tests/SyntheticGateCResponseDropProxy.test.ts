import {
  createServer,
  request as createRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SYNTHETIC_GATE_C_OFFLINE_PATH,
  SYNTHETIC_GATE_C_LISTEN_HOST,
  SYNTHETIC_GATE_C_UPSTREAM_HOST,
  SyntheticGateCResponseDropProxy,
  type SyntheticGateCResponseDropSafeEvent,
} from '../src/SyntheticGateCResponseDropProxy.js';

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.allSettled(cleanup.splice(0).reverse().map((close) => close()));
});

describe('SyntheticGateCResponseDropProxy', () => {
  it('binds numeric loopback and passes pre-target requests through without diagnostics data',
    async () => {
      const received: Array<{ authorization: string | undefined; body: string; url: string }> = [];
      const upstream = await startServer(async (request, response) => {
        received.push({
          authorization: request.headers.authorization,
          body: await readBody(request),
          url: request.url ?? '',
        });
        response.writeHead(201, {
          'Content-Type': 'application/json',
          'X-Synthetic-Safe': 'yes',
        });
        response.end('{"status":"ready"}');
      });
      const events: SyntheticGateCResponseDropSafeEvent[] = [];
      const proxy = await startProxy(upstream.port, events);

      const result = await send(proxy.port, 'POST', '/v1/session', {
        authorization: 'Bearer sensitive-synthetic-token',
        body: '{"sensitive":"synthetic-body"}',
      });

      expect(result).toEqual({
        body: '{"status":"ready"}',
        kind: 'response',
        statusCode: 201,
      });
      expect(received).toEqual([{
        authorization: 'Bearer sensitive-synthetic-token',
        body: '{"sensitive":"synthetic-body"}',
        url: '/v1/session',
      }]);
      expect(events).toEqual(['gate_c_proxy_armed']);
      expect(events.join(' ')).not.toMatch(/sensitive|token|body/i);
      expect(SYNTHETIC_GATE_C_LISTEN_HOST).toBe('127.0.0.1');
      expect(SYNTHETIC_GATE_C_UPSTREAM_HOST).toBe('127.0.0.1');
    });

  it('withholds the first exact synchronized response only after it completes', async () => {
    let finishResponse: (() => void) | null = null;
    let upstreamRequests = 0;
    const upstream = await startServer(async (request, response) => {
      upstreamRequests += 1;
      await readBody(request);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{"status":');
      await new Promise<void>((resolve) => {
        finishResponse = resolve;
      });
      response.end('"synchronized"}');
    });
    const events: SyntheticGateCResponseDropSafeEvent[] = [];
    const proxy = await startProxy(upstream.port, events);
    let settled = false;
    const observed = sendObserved(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
      authorization: 'Bearer never-log-this-token',
      body: '{"identifier":"never-log-this-id"}',
    });
    const dropped = observed.result.finally(() => {
      settled = true;
    });

    await waitFor(() => proxy.proxy.getState() === 'dropping' && finishResponse !== null);
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(observed.responseHeadersSeen()).toBe(false);
    expect(observed.responseBytesSeen()).toBe(0);
    expect(events).toEqual(['gate_c_proxy_armed']);

    (finishResponse as (() => void) | null)?.();
    await expect(dropped).resolves.toEqual({ kind: 'transport_error' });
    expect(observed.responseHeadersSeen()).toBe(false);
    expect(observed.responseBytesSeen()).toBe(0);
    expect(proxy.proxy.getState()).toBe('blocked');
    expect(upstreamRequests).toBe(1);
    expect(events).toEqual(['gate_c_proxy_armed', 'gate_c_response_dropped']);
    expect(events.join(' ')).not.toMatch(/never-log|token|identifier/i);
  });

  it('blocks concurrent and later requests from reaching upstream until explicit restore',
    async () => {
      let finishResponse: (() => void) | null = null;
      let upstreamRequests = 0;
      const upstream = await startServer(async (request, response) => {
        upstreamRequests += 1;
        await readBody(request);
        await new Promise<void>((resolve) => {
          finishResponse = resolve;
        });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"status":"synchronized"}');
      });
      const proxy = await startProxy(upstream.port, []);
      const first = send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
        body: '{}',
      });
      await waitFor(() => proxy.proxy.getState() === 'dropping' && finishResponse !== null);

      await expect(send(proxy.port, 'GET', '/v1/session')).resolves.toEqual({
        kind: 'transport_error',
      });
      expect(upstreamRequests).toBe(1);

      (finishResponse as (() => void) | null)?.();
      await first;
      expect(proxy.proxy.getState()).toBe('blocked');
      await expect(send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
        body: '{}',
      })).resolves.toEqual({ kind: 'transport_error' });
      expect(upstreamRequests).toBe(1);
    });

  it('continues the claimed upstream attempt after a fully sent client request disconnects',
    async () => {
      let bodyReceived: (() => void) | null = null;
      let finishResponse: (() => void) | null = null;
      const received = new Promise<void>((resolve) => {
        bodyReceived = resolve;
      });
      const upstream = await startServer(async (request, response) => {
        await readBody(request);
        bodyReceived?.();
        await new Promise<void>((resolve) => {
          finishResponse = resolve;
        });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"status":"synchronized"}');
      });
      const events: SyntheticGateCResponseDropSafeEvent[] = [];
      const proxy = await startProxy(upstream.port, events);
      const client = createRequest({
        agent: false,
        headers: {
          'Content-Length': '2',
          'Content-Type': 'application/json',
        },
        host: '127.0.0.1',
        method: 'POST',
        path: SYNTHETIC_GATE_C_OFFLINE_PATH,
        port: proxy.port,
      });
      client.once('error', () => undefined);
      client.end('{}');

      await received;
      client.destroy();
      (finishResponse as (() => void) | null)?.();
      await waitFor(() => proxy.proxy.getState() === 'blocked');
      expect(events).toEqual(['gate_c_proxy_armed', 'gate_c_response_dropped']);
    });

  it('claims only the exact POST path and never a method or query variant', async () => {
    const paths: string[] = [];
    const upstream = await startServer(async (request, response) => {
      paths.push(`${request.method} ${request.url}`);
      await readBody(request);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"status":"synchronized"}');
    });
    const proxy = await startProxy(upstream.port, []);

    expect(await send(proxy.port, 'GET', SYNTHETIC_GATE_C_OFFLINE_PATH)).toMatchObject({
      kind: 'response',
      statusCode: 200,
    });
    expect(await send(
      proxy.port,
      'POST',
      `${SYNTHETIC_GATE_C_OFFLINE_PATH}?unexpected=true`,
      { body: '{}' },
    )).toMatchObject({ kind: 'response', statusCode: 200 });
    expect(proxy.proxy.getState()).toBe('armed');

    await expect(send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
      body: '{}',
    })).resolves.toEqual({ kind: 'transport_error' });
    expect(paths).toEqual([
      `GET ${SYNTHETIC_GATE_C_OFFLINE_PATH}`,
      `POST ${SYNTHETIC_GATE_C_OFFLINE_PATH}?unexpected=true`,
      `POST ${SYNTHETIC_GATE_C_OFFLINE_PATH}`,
    ]);
    expect(proxy.proxy.getState()).toBe('blocked');
  });

  it.each([202, 409, 503])(
    'blocks terminally without claiming a synchronized drop for HTTP %i',
    async (statusCode) => {
      let upstreamRequests = 0;
      const upstream = await startServer(async (request, response) => {
        upstreamRequests += 1;
        await readBody(request);
        response.writeHead(statusCode, { 'Content-Type': 'application/json' });
        response.end('{"safe":"synthetic"}');
      });
      const events: SyntheticGateCResponseDropSafeEvent[] = [];
      const proxy = await startProxy(upstream.port, events);

      await expect(send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
        body: '{}',
      })).resolves.toEqual({ kind: 'transport_error' });
      expect(proxy.proxy.getState()).toBe('failed');
      expect(events).toEqual(['gate_c_proxy_armed', 'gate_c_response_drop_failed']);
      await send(proxy.port, 'GET', '/v1/session');
      expect(upstreamRequests).toBe(1);
    },
  );

  it('treats an incomplete HTTP 200 as failure and never rearms', async () => {
    let upstreamRequests = 0;
    const upstream = await startServer(async (request, response) => {
      upstreamRequests += 1;
      await readBody(request);
      response.writeHead(200, {
        'Content-Length': '128',
        'Content-Type': 'application/json',
      });
      response.write('{"truncated":true}');
      response.destroy();
    });
    const events: SyntheticGateCResponseDropSafeEvent[] = [];
    const proxy = await startProxy(upstream.port, events);

    await expect(send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
      body: '{}',
    })).resolves.toEqual({ kind: 'transport_error' });
    await waitFor(() => proxy.proxy.getState() === 'failed');
    await send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, { body: '{}' });
    expect(upstreamRequests).toBe(1);
    expect(events).toEqual(['gate_c_proxy_armed', 'gate_c_response_drop_failed']);
  });

  it('fails closed when the fixed loopback upstream connection cannot be established', async () => {
    const unavailablePort = await reserveUnusedPort();
    const events: SyntheticGateCResponseDropSafeEvent[] = [];
    const proxy = await startProxy(unavailablePort, events);

    await expect(send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
      body: '{}',
    })).resolves.toEqual({ kind: 'transport_error' });
    await waitFor(() => proxy.proxy.getState() === 'failed');
    expect(events).toEqual(['gate_c_proxy_armed', 'gate_c_response_drop_failed']);
  });

  it('fails closed on the bounded upstream timeout without forwarding another request',
    async () => {
      let upstreamRequests = 0;
      const upstream = await startServer(async (request) => {
        upstreamRequests += 1;
        await readBody(request);
      });
      const events: SyntheticGateCResponseDropSafeEvent[] = [];
      const proxy = await startProxy(upstream.port, events, 25);

      await expect(send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
        body: '{}',
      })).resolves.toEqual({ kind: 'transport_error' });
      await waitFor(() => proxy.proxy.getState() === 'failed');
      await send(proxy.port, 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, { body: '{}' });
      expect(upstreamRequests).toBe(1);
      expect(events).toEqual(['gate_c_proxy_armed', 'gate_c_response_drop_failed']);
    });

  it('isolates a throwing safe-event observer from drop and cleanup', async () => {
    const upstream = await startServer(async (request, response) => {
      await readBody(request);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{"status":"synchronized"}');
    });
    const proxy = new SyntheticGateCResponseDropProxy({
      listenPort: 0,
      upstreamPort: upstream.port,
      onSafeEvent() {
        throw new Error('synthetic observer failure');
      },
    });
    await expect(proxy.start()).resolves.toBeUndefined();
    cleanup.push(() => proxy.close());

    await expect(send(proxy.getListenPort(), 'POST', SYNTHETIC_GATE_C_OFFLINE_PATH, {
      body: '{}',
    })).resolves.toEqual({ kind: 'transport_error' });
    expect(proxy.getState()).toBe('blocked');
    await expect(proxy.close()).resolves.toBeUndefined();
    await expect(proxy.close()).resolves.toBeUndefined();
  });
});

async function startProxy(
  upstreamPort: number,
  events: SyntheticGateCResponseDropSafeEvent[],
  upstreamTimeoutMilliseconds?: number,
): Promise<{ port: number; proxy: SyntheticGateCResponseDropProxy }> {
  const proxy = new SyntheticGateCResponseDropProxy({
    listenPort: 0,
    upstreamPort,
    ...(upstreamTimeoutMilliseconds === undefined ? {} : { upstreamTimeoutMilliseconds }),
    onSafeEvent: (event) => events.push(event),
  });
  await proxy.start();
  cleanup.push(() => proxy.close());
  return { port: proxy.getListenPort(), proxy };
}

async function reserveUnusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic port reservation did not bind');
  }
  const port = address.port;
  await closeServer(server);
  return port;
}

async function startServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>,
): Promise<{ port: number; server: Server }> {
  const server = createServer((request, response) => {
    void handler(request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic upstream server did not bind');
  }
  cleanup.push(() => closeServer(server));
  return { port: address.port, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

interface SendOptions {
  readonly authorization?: string;
  readonly body?: string;
}

type SendResult =
  | { readonly body: string; readonly kind: 'response'; readonly statusCode: number }
  | { readonly kind: 'transport_error' };

async function send(
  port: number,
  method: string,
  path: string,
  options: SendOptions = {},
): Promise<SendResult> {
  return await new Promise<SendResult>((resolve) => {
    const body = options.body ?? '';
    const request = createRequest({
      agent: false,
      headers: {
        ...(options.authorization === undefined
          ? {}
          : { Authorization: options.authorization }),
        'Content-Length': Buffer.byteLength(body),
        'Content-Type': 'application/json',
      },
      host: '127.0.0.1',
      method,
      path,
      port,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.once('end', () => resolve({
        body: Buffer.concat(chunks).toString('utf8'),
        kind: 'response',
        statusCode: response.statusCode ?? 0,
      }));
      response.once('error', () => resolve({ kind: 'transport_error' }));
    });
    request.once('error', () => resolve({ kind: 'transport_error' }));
    request.setTimeout(3_000, () => {
      request.destroy();
      resolve({ kind: 'transport_error' });
    });
    request.end(body);
  });
}

function sendObserved(
  port: number,
  method: string,
  path: string,
  options: SendOptions = {},
): {
  readonly responseBytesSeen: () => number;
  readonly responseHeadersSeen: () => boolean;
  readonly result: Promise<SendResult>;
} {
  let bytesSeen = 0;
  let headersSeen = false;
  const result = new Promise<SendResult>((resolve) => {
    const body = options.body ?? '';
    const request = createRequest({
      agent: false,
      headers: {
        ...(options.authorization === undefined
          ? {}
          : { Authorization: options.authorization }),
        'Content-Length': Buffer.byteLength(body),
        'Content-Type': 'application/json',
      },
      host: '127.0.0.1',
      method,
      path,
      port,
    }, (response) => {
      headersSeen = true;
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => {
        const bytes = Buffer.from(chunk);
        bytesSeen += bytes.length;
        chunks.push(bytes);
      });
      response.once('end', () => resolve({
        body: Buffer.concat(chunks).toString('utf8'),
        kind: 'response',
        statusCode: response.statusCode ?? 0,
      }));
      response.once('error', () => resolve({ kind: 'transport_error' }));
    });
    request.once('error', () => resolve({ kind: 'transport_error' }));
    request.setTimeout(3_000, () => {
      request.destroy();
      resolve({ kind: 'transport_error' });
    });
    request.end(body);
  });
  return {
    responseBytesSeen: () => bytesSeen,
    responseHeadersSeen: () => headersSeen,
    result,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for synthetic Gate-C state');
}
