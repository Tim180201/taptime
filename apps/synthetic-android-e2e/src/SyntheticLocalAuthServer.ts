import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_AUTH_EMAIL,
  SYNTHETIC_PUBLISHABLE_KEY,
  syntheticIds,
} from './constants.js';

const maximumBodyBytes = 4_096;
const accessTokenLifetimeSeconds = 300;
const keyId = 'taptime-synthetic-android-e2e-rs256';
const allowedBrowserRequestHeaders = 'apikey, authorization, content-type, x-client-info, x-supabase-api-version';
type SyntheticSigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

interface SyntheticAuthAccount {
  readonly email: string;
  readonly providerSession: string;
  readonly providerSubject: string;
}

const syntheticAuthAccounts: readonly SyntheticAuthAccount[] = Object.freeze([
  Object.freeze({
    email: SYNTHETIC_AUTH_EMAIL,
    providerSession: syntheticIds.providerSession,
    providerSubject: syntheticIds.providerSubject,
  }),
  Object.freeze({
    email: SYNTHETIC_ADMIN_AUTH_EMAIL,
    providerSession: syntheticIds.administratorProviderSession,
    providerSubject: syntheticIds.administratorProviderSubject,
  }),
]);

interface PasswordDigest {
  readonly digest: Buffer;
  readonly salt: Buffer;
}

export interface SyntheticLocalAuthServerOptions {
  readonly allowedBrowserOrigin?: string;
  readonly password: string;
  readonly port?: number;
}

export class SyntheticLocalAuthServer {
  private publicUrlValue: string | null = null;
  private readonly refreshTokens = new Map<string, SyntheticAuthAccount>();

  private constructor(
    private readonly passwordDigest: PasswordDigest,
    private readonly privateKey: SyntheticSigningKey,
    private readonly publicJwk: JWK,
    private readonly requestedPort: number,
    private readonly allowedBrowserOrigin: string,
    readonly server: Server,
  ) {}

  static async create(options: SyntheticLocalAuthServerOptions): Promise<SyntheticLocalAuthServer> {
    validateSyntheticPassword(options.password);
    const allowedBrowserOrigin = validateAllowedBrowserOrigin(
      options.allowedBrowserOrigin ?? 'http://127.0.0.1:5173',
    );
    const passwordDigest = await digestPassword(options.password);
    const keyPair = await generateKeyPair('RS256', { extractable: true });
    const publicJwk = await exportJWK(keyPair.publicKey);
    let instance: SyntheticLocalAuthServer;
    const server = createServer((request, response) => {
      void instance.handle(request, response).catch(() => {
        respondJson(response, 503, { code: 'service_unavailable' });
      });
    });
    instance = new SyntheticLocalAuthServer(
      passwordDigest,
      keyPair.privateKey,
      publicJwk,
      options.port ?? 0,
      allowedBrowserOrigin,
      server,
    );
    return instance;
  }

  get publicUrl(): string {
    if (this.publicUrlValue === null) {
      throw new Error('Synthetic local Auth server has not started');
    }
    return this.publicUrlValue;
  }

  get issuer(): string {
    return `${this.publicUrl}/auth/v1`;
  }

  async start(): Promise<void> {
    if (this.publicUrlValue !== null) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.requestedPort, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Synthetic local Auth server did not expose a TCP port');
    }
    this.publicUrlValue = `http://127.0.0.1:${address.port}`;
  }

  async close(): Promise<void> {
    this.refreshTokens.clear();
    if (!this.server.listening) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => error === undefined ? resolve() : reject(error));
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestOrigin = request.headers.origin;
    const allowedOrigin = requestOrigin === this.allowedBrowserOrigin
      ? this.allowedBrowserOrigin
      : undefined;
    applySafeHeaders(response, allowedOrigin);
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/auth/v1/')) {
      request.resume();
      if (allowedOrigin === undefined) {
        respondJson(response, 403, { code: 'origin_rejected' });
        return;
      }
      response.setHeader('Access-Control-Allow-Headers', allowedBrowserRequestHeaders);
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Max-Age', '300');
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === 'GET'
      && url.pathname === '/auth/v1/.well-known/jwks.json'
      && url.search.length === 0
    ) {
      respondJson(response, 200, {
        keys: [{ ...this.publicJwk, alg: 'RS256', kid: keyId, use: 'sig' }],
      });
      return;
    }

    if (!hasSyntheticApiKey(request)) {
      request.resume();
      respondJson(response, 401, { code: 'unauthorized' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/v1/logout') {
      request.resume();
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method !== 'POST'
      || url.pathname !== '/auth/v1/token'
      || !isJsonRequest(request)
    ) {
      request.resume();
      respondJson(response, 404, { code: 'not_found' });
      return;
    }

    const body = await readJsonObject(request);
    if (body === null) {
      respondJson(response, 400, { code: 'invalid_request' });
      return;
    }
    const grantType = url.searchParams.get('grant_type');
    if (grantType === 'password') {
      await this.signIn(body, response);
      return;
    }
    if (grantType === 'refresh_token') {
      await this.refresh(body, response);
      return;
    }
    respondJson(response, 400, { code: 'unsupported_grant_type' });
  }

  private async signIn(body: Record<string, unknown>, response: ServerResponse): Promise<void> {
    const password = body.password;
    const account = syntheticAuthAccounts.find(({ email }) => body.email === email);
    if (
      account === undefined
      || typeof password !== 'string'
      || !await passwordMatches(password, this.passwordDigest)
    ) {
      respondJson(response, 400, {
        code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      });
      return;
    }
    respondJson(response, 200, await this.issueSession(account));
  }

  private async refresh(body: Record<string, unknown>, response: ServerResponse): Promise<void> {
    const refreshToken = body.refresh_token;
    const account = typeof refreshToken === 'string'
      ? this.refreshTokens.get(refreshToken)
      : undefined;
    if (typeof refreshToken !== 'string' || account === undefined) {
      respondJson(response, 400, {
        code: 'refresh_token_not_found',
        msg: 'Refresh token is unavailable',
      });
      return;
    }
    this.refreshTokens.delete(refreshToken);
    respondJson(response, 200, await this.issueSession(account));
  }

  private async issueSession(account: SyntheticAuthAccount): Promise<Record<string, unknown>> {
    const now = Math.floor(Date.now() / 1_000);
    const refreshToken = randomBytes(32).toString('base64url');
    this.refreshTokens.set(refreshToken, account);
    const accessToken = await new SignJWT({
      aal: 'aal1',
      email: account.email,
      is_anonymous: false,
      phone: '',
      role: 'authenticated',
      session_id: account.providerSession,
    })
      .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
      .setIssuer(this.issuer)
      .setAudience('authenticated')
      .setSubject(account.providerSubject)
      .setJti(randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + accessTokenLifetimeSeconds)
      .sign(this.privateKey);
    const timestamp = new Date(now * 1_000).toISOString();
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: accessTokenLifetimeSeconds,
      expires_at: now + accessTokenLifetimeSeconds,
      refresh_token: refreshToken,
      user: {
        id: account.providerSubject,
        aud: 'authenticated',
        role: 'authenticated',
        email: account.email,
        phone: '',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: timestamp,
        updated_at: timestamp,
        is_anonymous: false,
      },
    };
  }
}

function validateSyntheticPassword(password: string): void {
  if (
    password.length < 16
    || password.length > 256
    || password.trim() !== password
    || password.toLowerCase().includes('production')
  ) {
    throw new Error('Synthetic E2E password must be a 16–256 character test-only value');
  }
}

function validateAllowedBrowserOrigin(value: string): string {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new Error('Synthetic E2E browser origin must be an absolute loopback origin');
  }
  if (
    origin.protocol !== 'http:'
    || origin.hostname !== '127.0.0.1'
    || origin.port !== '5173'
    || origin.pathname !== '/'
    || origin.search.length > 0
    || origin.hash.length > 0
  ) {
    throw new Error('Synthetic E2E browser origin must be http://127.0.0.1:5173');
  }
  return origin.origin;
}

async function digestPassword(password: string): Promise<PasswordDigest> {
  const salt = randomBytes(16);
  return { salt, digest: await scryptAsync(password, salt) };
}

async function passwordMatches(password: string, expected: PasswordDigest): Promise<boolean> {
  const actual = await scryptAsync(password, expected.salt);
  return actual.length === expected.digest.length && timingSafeEqual(actual, expected.digest);
}

function scryptAsync(value: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(value, salt, 64, (error, derivedKey) => {
      if (error === null) {
        resolve(derivedKey);
      } else {
        reject(error);
      }
    });
  });
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maximumBodyBytes) {
      return null;
    }
    chunks.push(buffer);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function hasSyntheticApiKey(request: IncomingMessage): boolean {
  const value = request.headers.apikey;
  return typeof value === 'string' && value === SYNTHETIC_PUBLISHABLE_KEY;
}

function isJsonRequest(request: IncomingMessage): boolean {
  const contentType = request.headers['content-type'];
  return typeof contentType === 'string'
    && contentType.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

function applySafeHeaders(response: ServerResponse, allowedOrigin?: string): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Supabase-Api-Version', '2024-01-01');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (allowedOrigin !== undefined) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Vary', 'Origin');
  }
}

function respondJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.writableEnded || response.destroyed) {
    return;
  }
  applySafeHeaders(response);
  response.writeHead(status);
  response.end(JSON.stringify(body));
}
