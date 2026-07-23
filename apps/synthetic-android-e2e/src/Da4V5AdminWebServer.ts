import { createHash } from 'node:crypto';
import {
  lstat,
  readFile,
  readdir,
  realpath,
  stat,
} from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import {
  DA4_V5_READ_PROJECTION_ROUTES,
  type Da4V5ReadSection,
} from './Da4V5Profile.js';

const ADMIN_WEB_PORT = 5_173;
const API_PORT = 3_000;
const LOOPBACK_HOST = '127.0.0.1';
const allowedResponseHeaders = new Set([
  'cache-control',
  'content-disposition',
  'content-length',
  'content-type',
]);

export interface Da4V5ArtifactFile {
  readonly bytes: number;
  readonly path: string;
  readonly sha256: string;
}

export interface Da4V5ArtifactManifest {
  readonly files: readonly Da4V5ArtifactFile[];
  readonly version: 1;
}

export type Da4V5ReadFaultState =
  | Readonly<{ state: 'disarmed' }>
  | Readonly<{ section: Da4V5ReadSection; state: 'armed' }>
  | Readonly<{ section: Da4V5ReadSection; state: 'consumed' }>;

export class Da4V5ReadFaultController {
  private value: Da4V5ReadFaultState = Object.freeze({ state: 'disarmed' });

  arm(section: Da4V5ReadSection): void {
    if (this.value.state !== 'disarmed' || !(section in DA4_V5_READ_PROJECTION_ROUTES)) {
      throw new Error('DA4 V5 read fault cannot be armed');
    }
    this.value = Object.freeze({ state: 'armed', section });
  }

  consume(method: string | undefined, path: string): boolean {
    if (
      this.value.state !== 'armed'
      || method !== 'POST'
      || DA4_V5_READ_PROJECTION_ROUTES[this.value.section] !== path
    ) {
      return false;
    }
    const { section } = this.value;
    this.value = Object.freeze({ state: 'consumed', section });
    return true;
  }

  getState(): Da4V5ReadFaultState {
    return this.value;
  }
}

export interface Da4V5AdminWebServer {
  readonly inventory: readonly Da4V5ArtifactFile[];
  readonly origin: 'http://127.0.0.1:5173';
  readonly readFault: Da4V5ReadFaultController;
  close(): Promise<void>;
}

export async function createDa4V5ArtifactManifest(
  rootDirectory: string,
): Promise<Da4V5ArtifactManifest> {
  const root = await validateArtifactRoot(rootDirectory);
  const paths = await listRegularFiles(root);
  const files = await Promise.all(paths.map(async (path) => {
    const contents = await readFile(join(root, ...path.split('/')));
    return Object.freeze({
      path,
      bytes: contents.byteLength,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
  }));
  return Object.freeze({ version: 1, files: Object.freeze(files) });
}

export async function loadAndVerifyDa4V5Artifact(
  rootDirectory: string,
  manifestPath: string,
): Promise<Da4V5ArtifactManifest> {
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, 'utf8')) as unknown);
  const actual = await createDa4V5ArtifactManifest(rootDirectory);
  if (
    manifest.files.length !== actual.files.length
    || manifest.files.some((file, index) => {
      const candidate = actual.files[index];
      return candidate === undefined
        || file.path !== candidate.path
        || file.bytes !== candidate.bytes
        || file.sha256 !== candidate.sha256;
    })
    || !manifest.files.some((file) => file.path === 'index.html')
  ) {
    throw new Error('DA4 V5 Admin Web artifact manifest mismatch');
  }
  return manifest;
}

export async function createDa4V5AdminWebServer(options: {
  readonly manifestPath: string;
  readonly rootDirectory: string;
  readonly onSafeEvent?: (event: string) => void;
}): Promise<Da4V5AdminWebServer> {
  const root = await validateArtifactRoot(options.rootDirectory);
  const manifest = await loadAndVerifyDa4V5Artifact(root, options.manifestPath);
  const manifestByPath = new Map(manifest.files.map((file) => [file.path, file]));
  const readFault = new Da4V5ReadFaultController();
  const server = createServer((incoming, response) => {
    void handleRequest(
      incoming,
      response,
      root,
      manifestByPath,
      readFault,
      options.onSafeEvent ?? (() => undefined),
    ).catch(() => {
      if (!response.headersSent) {
        respondJson(response, 503, { code: 'service_unavailable' });
      } else {
        response.destroy();
      }
    });
  });
  try {
    await listenLoopback(server, ADMIN_WEB_PORT);
  } catch (error) {
    await closeServer(server);
    throw error;
  }
  return Object.freeze({
    inventory: manifest.files,
    origin: 'http://127.0.0.1:5173',
    readFault,
    close: () => closeServer(server),
  });
}

function parseManifest(value: unknown): Da4V5ArtifactManifest {
  if (
    !isRecord(value)
    || Object.keys(value).sort().join(',') !== 'files,version'
    || value.version !== 1
    || !Array.isArray(value.files)
  ) {
    throw new Error('Invalid DA4 V5 Admin Web artifact manifest');
  }
  let previousPath = '';
  const files = value.files.map((candidate): Da4V5ArtifactFile => {
    if (
      !isRecord(candidate)
      || Object.keys(candidate).sort().join(',') !== 'bytes,path,sha256'
      || typeof candidate.path !== 'string'
      || !isSafeRelativePath(candidate.path)
      || candidate.path <= previousPath
      || typeof candidate.bytes !== 'number'
      || !Number.isSafeInteger(candidate.bytes)
      || candidate.bytes < 0
      || typeof candidate.sha256 !== 'string'
      || !/^[0-9a-f]{64}$/.test(candidate.sha256)
    ) {
      throw new Error('Invalid DA4 V5 Admin Web artifact file');
    }
    previousPath = candidate.path;
    return Object.freeze({
      path: candidate.path,
      bytes: candidate.bytes,
      sha256: candidate.sha256,
    });
  });
  return Object.freeze({ version: 1, files: Object.freeze(files) });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  root: string,
  manifestByPath: ReadonlyMap<string, Da4V5ArtifactFile>,
  readFault: Da4V5ReadFaultController,
  onSafeEvent: (event: string) => void,
): Promise<void> {
  if (
    !isLoopbackAddress(request.socket.remoteAddress)
    || request.headers.host !== `${LOOPBACK_HOST}:${ADMIN_WEB_PORT}`
    || request.url === undefined
  ) {
    request.resume();
    respondJson(response, 400, { code: 'invalid_request' });
    return;
  }
  const url = new URL(request.url, `http://${LOOPBACK_HOST}:${ADMIN_WEB_PORT}`);
  if (url.origin !== `http://${LOOPBACK_HOST}:${ADMIN_WEB_PORT}`) {
    request.resume();
    respondJson(response, 400, { code: 'invalid_request' });
    return;
  }
  if (url.pathname.startsWith('/v1')) {
    if (readFault.consume(request.method, url.pathname)) {
      request.resume();
      onSafeEvent('da4_v5_read_fault_consumed');
      respondJson(response, 503, { code: 'service_unavailable' });
      return;
    }
    await proxyApiRequest(request, response, url);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    request.resume();
    response.setHeader('Allow', 'GET, HEAD');
    respondJson(response, 405, { code: 'method_not_allowed' });
    return;
  }
  const requested = staticArtifactPath(url.pathname);
  const artifactPath = manifestByPath.has(requested) ? requested : 'index.html';
  const manifestEntry = manifestByPath.get(artifactPath);
  if (manifestEntry === undefined) {
    request.resume();
    respondJson(response, 404, { code: 'not_found' });
    return;
  }
  const filePath = join(root, ...artifactPath.split('/'));
  const file = await readFile(filePath);
  if (
    file.byteLength !== manifestEntry.bytes
    || createHash('sha256').update(file).digest('hex') !== manifestEntry.sha256
  ) {
    throw new Error('DA4 V5 Admin Web artifact changed after startup');
  }
  applyBrowserSecurityHeaders(response);
  response.statusCode = 200;
  response.setHeader('Content-Length', String(file.byteLength));
  response.setHeader('Content-Type', contentType(artifactPath));
  response.end(request.method === 'HEAD' ? undefined : file);
}

async function proxyApiRequest(
  incoming: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  if (!url.pathname.startsWith('/v1/') || url.search.length > 0) {
    incoming.resume();
    respondJson(response, 400, { code: 'invalid_request' });
    return;
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const outgoing = httpRequest({
      host: LOOPBACK_HOST,
      port: API_PORT,
      method: incoming.method,
      path: url.pathname,
      headers: proxyRequestHeaders(incoming),
    }, (apiResponse) => {
      response.statusCode = apiResponse.statusCode ?? 503;
      for (const [name, value] of Object.entries(apiResponse.headers)) {
        if (allowedResponseHeaders.has(name) && value !== undefined) {
          response.setHeader(name, value);
        }
      }
      applyBrowserSecurityHeaders(response);
      apiResponse.once('error', rejectPromise);
      apiResponse.once('end', resolvePromise);
      apiResponse.pipe(response);
    });
    outgoing.once('error', rejectPromise);
    incoming.once('error', rejectPromise);
    incoming.pipe(outgoing);
  });
}

function proxyRequestHeaders(incoming: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {
    host: `${LOOPBACK_HOST}:${API_PORT}`,
  };
  for (const name of ['accept', 'authorization', 'content-length', 'content-type']) {
    const value = incoming.headers[name];
    if (typeof value === 'string') {
      headers[name] = value;
    }
  }
  return headers;
}

async function validateArtifactRoot(rootDirectory: string): Promise<string> {
  if (!resolve(rootDirectory).startsWith(sep) || resolve(rootDirectory) !== rootDirectory) {
    throw new Error('DA4 V5 Admin Web artifact root must be absolute and normalized');
  }
  const root = await realpath(rootDirectory);
  if (root !== rootDirectory || !(await stat(root)).isDirectory()) {
    throw new Error('DA4 V5 Admin Web artifact root must be a real directory');
  }
  return root;
}

async function listRegularFiles(root: string): Promise<readonly string[]> {
  const results: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        throw new Error('DA4 V5 Admin Web artifact may not contain symlinks');
      }
      if (info.isDirectory()) {
        await visit(absolute);
      } else if (info.isFile()) {
        const path = relative(root, absolute).split(sep).join('/');
        if (!isSafeRelativePath(path)) {
          throw new Error('DA4 V5 Admin Web artifact path is unsafe');
        }
        results.push(path);
      } else {
        throw new Error('DA4 V5 Admin Web artifact contains a non-regular entry');
      }
    }
  };
  await visit(root);
  return Object.freeze(results.sort());
}

function staticArtifactPath(pathname: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new Error('DA4 V5 Admin Web request path is malformed');
  }
  if (decoded.includes('\\') || decoded.includes('\0')) {
    throw new Error('DA4 V5 Admin Web request path is unsafe');
  }
  const path = decoded.replace(/^\/+/, '');
  if (path === '') {
    return 'index.html';
  }
  if (!isSafeRelativePath(path)) {
    throw new Error('DA4 V5 Admin Web request path is unsafe');
  }
  return path;
}

function isSafeRelativePath(path: string): boolean {
  return path.length > 0
    && !path.startsWith('/')
    && !path.includes('\\')
    && !path.includes('\0')
    && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isLoopbackAddress(value: string | undefined): boolean {
  return value === '127.0.0.1' || value === '::ffff:127.0.0.1';
}

function contentType(path: string): string {
  switch (extname(path)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function applyBrowserSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; connect-src 'self' http://127.0.0.1:54321; img-src 'self' data:; "
      + "style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; "
      + "base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

function respondJson(response: ServerResponse, status: number, body: object): void {
  response.statusCode = status;
  applyBrowserSecurityHeaders(response);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function listenLoopback(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(port, LOOPBACK_HOST, resolvePromise);
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => error === undefined ? resolvePromise() : rejectPromise(error));
  });
}
