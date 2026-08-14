import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import {
  requireDa5V5AccessibilityDisabled,
  withDa5V5VerifiedInstalledDevice,
  type Da5V5AndroidAdbRunner,
  type Da5V5UsbSerialBinding,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_PUBLISHABLE_KEY,
  syntheticIds,
} from './constants.js';
import type { Da5V5StandardCredentialBinding } from './Da5V5CredentialTransfer.js';

const requestTimeoutMilliseconds = 15_000;
const maximumResponseBytes = 16 * 1024;
const invitationDisplayName = 'DA5 V5 Synthetic Employee';
const compactJwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const invitationInputScript = [
  'IFS= read -r v || exit 40;',
  '[ "${#v}" -eq 43 ] || { unset v; exit 41; };',
  'case "$v" in *[!A-Za-z0-9_-]*) unset v; exit 41;; esac;',
  'IFS= read -r extra;',
  'extra_status=$?;',
  'if [ "$extra_status" -eq 0 ] || [ -n "$extra" ]; then',
  'unset v extra extra_status;',
  'exit 42;',
  'fi;',
  'input text "$v" >/dev/null 2>&1;',
  'input_status=$?;',
  'unset v extra extra_status;',
  'exit "$input_status"',
].join(' ');
const quotedInvitationInputScript = `'${invitationInputScript}'`;

export interface Da5V5InvitationCreationOptions {
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
  readonly createCommandId?: () => string;
  readonly fetchRequest?: typeof fetch;
  readonly now?: () => number;
  readonly password: Buffer;
  readonly signal?: AbortSignal;
}

export type Da5V5InvitationSecretState =
  | 'consumed'
  | 'destroyed'
  | 'failed'
  | 'field-ready'
  | 'held'
  | 'injecting'
  | 'injection-pending'
  | 'vacant';

export async function createDa5V5InvitationSecret(
  options: Da5V5InvitationCreationOptions,
): Promise<Buffer> {
  requireLoopbackBaseUrl(options.authBaseUrl);
  requireLoopbackBaseUrl(options.apiBaseUrl);
  if (!isDa5V5PasswordMaster(options.password)) {
    throw new Error('DA5 V5 invitation Auth credential mismatch');
  }
  const commandId = (options.createCommandId ?? randomUUID)();
  if (!canonicalUuidPattern.test(commandId)) {
    throw new Error('DA5 V5 invitation command binding mismatch');
  }
  const fetchRequest = options.fetchRequest ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const authUrl = `${options.authBaseUrl}/auth/v1/token?grant_type=password`;
  const apiUrl = `${options.apiBaseUrl}/v1/administration/employee-invitations`;
  const authBody = passwordAuthBody(options.password);
  // The platform fetch/JSON APIs necessarily materialize transient JavaScript strings for the
  // access token and returned secret. They are never logged, persisted or sent outside these
  // two loopback requests; references are dropped immediately. Owned byte buffers are zeroed.
  let accessToken = '';
  let authSession: Record<string, unknown> | null = null;
  try {
    authSession = await requestExactJson(fetchRequest, authUrl, {
      body: authBody,
      headers: {
        apikey: SYNTHETIC_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      method: 'POST',
      redirect: 'error',
    }, options.signal);
    accessToken = requireAdministratorSession(authSession, now());
    const invitation = await requestExactJson(fetchRequest, apiUrl, {
      body: JSON.stringify({
        commandId,
        displayName: invitationDisplayName,
        expectedMembershipId: syntheticIds.administratorMembership,
      }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
      redirect: 'error',
    }, options.signal);
    return requireInvitationResponse(invitation, now());
  } finally {
    authBody.fill(0);
    accessToken = '';
    if (authSession !== null) {
      authSession.access_token = '';
      authSession.refresh_token = '';
    }
    authSession = null;
  }
}

export class Da5V5InvitationSecretOwner {
  private secret: Buffer | null = null;
  private stateValue: Da5V5InvitationSecretState = 'vacant';

  capture(candidate: Buffer): 'match' | 'mismatch' {
    if (this.stateValue !== 'vacant' || !isCanonicalInvitationSecret(candidate)) {
      candidate.fill(0);
      return this.fail();
    }
    this.secret = candidate;
    this.stateValue = 'held';
    return 'match';
  }

  confirmEmptyActiveField(): 'match' | 'mismatch' {
    if (this.stateValue !== 'held' || this.secret === null) {
      return this.fail();
    }
    this.stateValue = 'field-ready';
    return 'match';
  }

  beginInjection(): Buffer | null {
    const secret = this.secret;
    if (this.stateValue !== 'field-ready' || secret === null) {
      this.fail();
      return null;
    }
    const frame = Buffer.alloc(secret.length + 1);
    secret.copy(frame);
    frame[secret.length] = 0x0a;
    secret.fill(0);
    this.secret = null;
    this.stateValue = 'injecting';
    return frame;
  }

  completeInjection(result: 'match' | 'mismatch'): 'match' | 'mismatch' {
    if (this.stateValue !== 'injecting' || result !== 'match') {
      return this.fail();
    }
    this.stateValue = 'injection-pending';
    return 'match';
  }

  confirmRedemption(result: 'ambiguous' | 'fail' | 'pass'): 'match' | 'mismatch' {
    if (this.stateValue !== 'injection-pending' || result !== 'pass') {
      return this.fail();
    }
    this.stateValue = 'consumed';
    return 'match';
  }

  destroy(): void {
    this.secret?.fill(0);
    this.secret = null;
    this.stateValue = 'destroyed';
  }

  state(): Da5V5InvitationSecretState {
    return this.stateValue;
  }

  private fail(): 'mismatch' {
    this.secret?.fill(0);
    this.secret = null;
    this.stateValue = 'failed';
    return 'mismatch';
  }
}

export class Da5V5InvitationSecretTransfer {
  constructor(
    private readonly owner: Da5V5InvitationSecretOwner,
    private readonly adb: Da5V5AndroidAdbRunner,
    private readonly serialBinding: Da5V5UsbSerialBinding,
    private readonly deviceBinding: Da5V5StandardCredentialBinding,
  ) {}

  confirmEmptyActiveField(): 'match' | 'mismatch' {
    return this.owner.confirmEmptyActiveField();
  }

  async inject(signal?: AbortSignal): Promise<'match' | 'mismatch'> {
    const frame = this.owner.beginInjection();
    if (frame === null) return 'mismatch';
    let result: 'match' | 'mismatch' = 'mismatch';
    try {
      if (signal?.aborted === true) {
        throw new Error('DA5 V5 invitation transfer aborted');
      }
      const output = await withDa5V5VerifiedInstalledDevice({
        deviceBinding: this.deviceBinding,
        runner: this.adb,
        serialBinding: this.serialBinding,
        signal,
      }, async (serial) => {
        const fontScale = exactSingleLine(await this.adb.run(
          ['-s', serial, 'shell', 'settings', 'get', 'system', 'font_scale'],
          { signal },
        ));
        const accessibilityEnabled = await this.adb.run(
          ['-s', serial, 'shell', 'settings', 'get', 'secure', 'accessibility_enabled'],
          { signal },
        );
        const enabledAccessibilityServices = await this.adb.run(
          [
            '-s', serial, 'shell', 'settings', 'get', 'secure',
            'enabled_accessibility_services',
          ],
          { signal },
        );
        if (fontScale !== '1.0') {
          throw new Error('DA5 V5 invitation profile mismatch');
        }
        requireDa5V5AccessibilityDisabled(
          accessibilityEnabled,
          enabledAccessibilityServices,
        );
        return this.adb.run(
          ['-s', serial, 'shell', '-T', 'sh', '-c', quotedInvitationInputScript],
          { requireEmptyOutput: true, signal, stdinBytes: frame },
        );
      });
      signal?.throwIfAborted();
      result = output === '' ? 'match' : 'mismatch';
    } catch {
      result = 'mismatch';
    } finally {
      frame.fill(0);
    }
    return this.owner.completeInjection(result);
  }

  confirmRedemption(result: 'ambiguous' | 'fail' | 'pass'): 'match' | 'mismatch' {
    return this.owner.confirmRedemption(result);
  }

  destroy(): void {
    this.owner.destroy();
  }

  state(): Da5V5InvitationSecretState {
    return this.owner.state();
  }
}

function requireLoopbackBaseUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DA5 V5 invitation origin mismatch');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port.length === 0
    || url.pathname !== '/'
    || url.search !== ''
    || url.hash !== ''
    || url.username !== ''
    || url.password !== ''
    || url.origin !== value
  ) {
    throw new Error('DA5 V5 invitation origin mismatch');
  }
}

async function requestExactJson(
  fetchRequest: typeof fetch,
  url: string,
  init: RequestInit,
  externalSignal?: AbortSignal,
): Promise<Record<string, unknown>> {
  if (externalSignal?.aborted === true) {
    throw new Error('DA5 V5 invitation request aborted');
  }
  const requestAbort = new AbortController();
  const abortFromExternal = (): void => requestAbort.abort();
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  const timer = setTimeout(() => requestAbort.abort(), requestTimeoutMilliseconds);
  timer.unref();
  try {
    let response: Response;
    try {
      response = await abortAware(
        fetchRequest(url, { ...init, signal: requestAbort.signal }),
        requestAbort.signal,
        undefined,
        cancelLateResponse,
      );
    } catch {
      throw new Error(requestAbort.signal.aborted
        ? 'DA5 V5 invitation request aborted'
        : 'DA5 V5 invitation request failed');
    }
    return await readExactJson(response, url, requestAbort.signal);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

async function readExactJson(
  response: Response,
  expectedUrl: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  if (
    response.status !== 200
    || response.redirected
    || (response.url !== '' && response.url !== expectedUrl)
    || response.headers.get('cache-control') !== 'no-store'
    || response.headers.get('content-type') !== 'application/json; charset=utf-8'
  ) {
    cancelLateResponse(response);
    throw new Error('DA5 V5 invitation response binding mismatch');
  }
  const length = response.headers.get('content-length');
  if (length !== null && (!/^(?:0|[1-9][0-9]*)$/u.test(length)
    || Number(length) > maximumResponseBytes)) {
    cancelLateResponse(response);
    throw new Error('DA5 V5 invitation response bound mismatch');
  }
  const body = response.body;
  if (body === null) throw new Error('DA5 V5 invitation response body mismatch');
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await abortAware(
        reader.read(),
        signal,
        () => cancelReader(reader),
        (lateItem) => {
          lateItem.value?.fill(0);
          cancelReader(reader);
        },
      );
      if (item.done) break;
      const value = item.value;
      total += value.byteLength;
      if (total > maximumResponseBytes) {
        value.fill(0);
        cancelReader(reader);
        throw new Error('DA5 V5 invitation response bound mismatch');
      }
      chunks.push(Buffer.from(value));
      value.fill(0);
    }
    const encoded = Buffer.concat(chunks, total);
    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed)) throw new Error('DA5 V5 invitation response schema mismatch');
      return parsed;
    } finally {
      text = '';
      encoded.fill(0);
    }
  } finally {
    for (const chunk of chunks) chunk.fill(0);
    try { reader.releaseLock(); } catch { /* a cancelled uncooperative read may remain pending */ }
  }
}

function abortAware<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  onAbort?: () => void,
  onLateValue?: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    let settled = false;
    const abort = (): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      onAbort?.();
      rejectPromise(new Error('DA5 V5 invitation request aborted'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void operation.then(
      (value) => {
        if (settled) {
          onLateValue?.(value);
          return;
        }
        settled = true;
        signal.removeEventListener('abort', abort);
        resolvePromise(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        rejectPromise(error);
      },
    );
  });
}

function cancelLateResponse(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}

function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
): void {
  void reader.cancel().catch(() => undefined);
}

function requireAdministratorSession(value: Record<string, unknown>, now: number): string {
  let refreshTokenIsCanonical = false;
  if (typeof value.refresh_token === 'string') {
    const refreshToken = Buffer.from(value.refresh_token, 'ascii');
    try {
      refreshTokenIsCanonical = isCanonicalInvitationSecret(refreshToken);
    } finally {
      refreshToken.fill(0);
    }
  }
  if (
    !hasExactKeys(value, [
      'access_token', 'expires_at', 'expires_in', 'refresh_token', 'token_type', 'user',
    ])
    || typeof value.access_token !== 'string'
    || !compactJwtPattern.test(value.access_token)
    || value.token_type !== 'bearer'
    || value.expires_in !== 300
    || !Number.isSafeInteger(value.expires_at)
    || Number(value.expires_at) <= Math.floor(now / 1_000)
    || typeof value.refresh_token !== 'string'
    || !refreshTokenIsCanonical
    || !isRecord(value.user)
    || !hasExactKeys(value.user, [
      'app_metadata', 'aud', 'created_at', 'email', 'id', 'identities', 'is_anonymous',
      'phone', 'role', 'updated_at', 'user_metadata',
    ])
    || value.user.id !== syntheticIds.administratorProviderSubject
    || value.user.email !== SYNTHETIC_ADMIN_AUTH_EMAIL
    || value.user.aud !== 'authenticated'
    || value.user.role !== 'authenticated'
    || value.user.phone !== ''
    || value.user.is_anonymous !== false
    || !Array.isArray(value.user.identities)
    || value.user.identities.length !== 0
    || !isRecord(value.user.app_metadata)
    || !hasExactKeys(value.user.app_metadata, ['provider', 'providers'])
    || value.user.app_metadata.provider !== 'email'
    || !Array.isArray(value.user.app_metadata.providers)
    || value.user.app_metadata.providers.length !== 1
    || value.user.app_metadata.providers[0] !== 'email'
    || !isRecord(value.user.user_metadata)
    || Object.keys(value.user.user_metadata).length !== 0
    || !isCanonicalTimestamp(value.user.created_at)
    || value.user.updated_at !== value.user.created_at
  ) {
    throw new Error('DA5 V5 invitation Auth response mismatch');
  }
  return value.access_token;
}

function requireInvitationResponse(value: Record<string, unknown>, now: number): Buffer {
  if (
    !hasExactKeys(value, ['expiresAt', 'invitationSecret', 'status'])
    || value.status !== 'succeeded'
    || typeof value.invitationSecret !== 'string'
    || typeof value.expiresAt !== 'string'
    || !isCanonicalTimestamp(value.expiresAt)
    || Date.parse(value.expiresAt) <= now
  ) {
    throw new Error('DA5 V5 invitation response mismatch');
  }
  const secret = Buffer.from(value.invitationSecret, 'ascii');
  value.invitationSecret = '';
  if (!isCanonicalInvitationSecret(secret)) {
    secret.fill(0);
    throw new Error('DA5 V5 invitation secret mismatch');
  }
  return secret;
}

function passwordAuthBody(password: Buffer): Buffer {
  const prefix = Buffer.from(`{"email":"${SYNTHETIC_ADMIN_AUTH_EMAIL}","password":"`, 'ascii');
  const suffix = Buffer.from('"}', 'ascii');
  const body = Buffer.alloc(prefix.length + password.length + suffix.length);
  prefix.copy(body);
  password.copy(body, prefix.length);
  suffix.copy(body, prefix.length + password.length);
  prefix.fill(0);
  suffix.fill(0);
  return body;
}

function isDa5V5PasswordMaster(value: Buffer): boolean {
  return value.length === 64 && value.every((byte) => (
    (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66)
  ));
}

function isCanonicalInvitationSecret(value: Buffer): boolean {
  if (value.length !== 43) return false;
  for (let index = 0; index < value.length; index += 1) {
    const byte = value[index];
    if (byte === undefined || base64UrlIndex(byte) < 0) return false;
  }
  const last = value.at(-1);
  return last !== undefined && (base64UrlIndex(last) & 0b11) === 0;
}

function base64UrlIndex(byte: number): number {
  if (byte >= 0x41 && byte <= 0x5a) return byte - 0x41;
  if (byte >= 0x61 && byte <= 0x7a) return byte - 0x61 + 26;
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30 + 52;
  if (byte === 0x2d) return 62;
  if (byte === 0x5f) return 63;
  return -1;
}

function isCanonicalTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && new Date(value).toISOString() === value;
}

function exactSingleLine(value: string): string {
  const normalized = value.replace(/\r?\n$/u, '');
  if (normalized.length === 0 || normalized.includes('\n') || normalized.includes('\r')) {
    throw new Error('DA5 V5 invitation device output mismatch');
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}
