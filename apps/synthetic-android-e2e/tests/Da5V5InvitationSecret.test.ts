import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  Da5V5UsbSerialBinding,
  type Da5V5AndroidAdbRunner,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  Da5V5InvitationSecretOwner,
  Da5V5InvitationSecretTransfer,
  createDa5V5InvitationSecret,
} from '../src/Da5V5InvitationSecret.js';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_PUBLISHABLE_KEY,
  syntheticIds,
} from '../src/constants.js';

const now = 1_800_000_000_000;
const passwordText = 'a'.repeat(64);
const invitationText = Buffer.alloc(32, 0x11).toString('base64url');
const refreshToken = Buffer.alloc(32, 0x22).toString('base64url');
const accessToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.signature';
const authBaseUrl = 'http://127.0.0.1:54321';
const apiBaseUrl = 'http://127.0.0.1:3000';
const commandId = '70000000-0000-4000-8000-000000000701';
const deviceBinding = Object.freeze({
  androidBuild: 'synthetic/vendor/device:15/BUILD/1:user/release-keys',
  androidModel: 'unused',
  deviceModel: 'Synthetic Galaxy',
  fontScale: '1.0' as const,
});

describe('DA5 V5 one-shot invitation-secret source and transfer', () => {
  it('binds the two exact loopback requests and returns only the canonical secret Buffer',
    async () => {
      const requests: Array<{ body: Buffer | string; headers: Headers; url: string }> = [];
      const fetchRequest = vi.fn(async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => {
        const url = String(input);
        const body = Buffer.isBuffer(init?.body)
          ? Buffer.from(init.body)
          : String(init?.body ?? '');
        requests.push({ body, headers: new Headers(init?.headers), url });
        return exactJsonResponse(
          url,
          url.startsWith(authBaseUrl) ? validAuthSession() : validInvitation(),
        );
      }) as unknown as typeof fetch;
      const password = Buffer.from(passwordText, 'ascii');

      const secret = await createDa5V5InvitationSecret({
        apiBaseUrl,
        authBaseUrl,
        createCommandId: () => commandId,
        fetchRequest,
        now: () => now,
        password,
      });

      expect(secret.toString('ascii')).toBe(invitationText);
      expect(requests).toHaveLength(2);
      expect(requests[0]?.url).toBe(
        `${authBaseUrl}/auth/v1/token?grant_type=password`,
      );
      expect(requests[0]?.headers.get('apikey')).toBe(SYNTHETIC_PUBLISHABLE_KEY);
      expect(requests[0]?.headers.get('authorization')).toBeNull();
      expect(JSON.parse((requests[0]?.body as Buffer).toString('utf8'))).toEqual({
        email: SYNTHETIC_ADMIN_AUTH_EMAIL,
        password: passwordText,
      });
      expect(requests[1]?.url).toBe(
        `${apiBaseUrl}/v1/administration/employee-invitations`,
      );
      expect(requests[1]?.headers.get('authorization')).toBe(`Bearer ${accessToken}`);
      expect(JSON.parse(requests[1]?.body as string)).toEqual({
        commandId,
        displayName: 'DA5 V5 Synthetic Employee',
        expectedMembershipId: syntheticIds.administratorMembership,
      });
      expect(password.toString('ascii')).toBe(passwordText);
      secret.fill(0);
      (requests[0]?.body as Buffer).fill(0);
    });

  it.each([
    'https://127.0.0.1:54321',
    'http://localhost:54321',
    'http://127.0.0.1:54321/path',
    'http://127.0.0.1',
  ])('rejects non-exact loopback origin %s before fetch', async (invalidOrigin) => {
    const fetchRequest = vi.fn() as unknown as typeof fetch;
    const password = Buffer.from(passwordText, 'ascii');
    await expect(createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl: invalidOrigin,
      fetchRequest,
      password,
    })).rejects.toThrow('origin mismatch');
    expect(fetchRequest).not.toHaveBeenCalled();
    password.fill(0);
  });

  it.each([
    ['extra key', { ...validAuthSession(), extra: true }],
    ['expired token', { ...validAuthSession(), expires_at: Math.floor(now / 1_000) }],
    ['wrong identity', {
      ...validAuthSession(),
      user: { ...(validAuthSession().user as Record<string, unknown>), email: 'wrong@example.invalid' },
    }],
  ])('rejects exact Administrator Auth response drift: %s', async (_label, session) => {
    const password = Buffer.from(passwordText, 'ascii');
    const fetchRequest = fetchSequence(exactJsonResponse(
      `${authBaseUrl}/auth/v1/token?grant_type=password`,
      session,
    ));
    await expect(createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl,
      createCommandId: () => commandId,
      fetchRequest,
      now: () => now,
      password,
    })).rejects.toThrow('Auth response mismatch');
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    password.fill(0);
  });

  it('rejects a noncanonical command UUID and an already-aborted request before fetch', async () => {
    const fetchRequest = vi.fn() as unknown as typeof fetch;
    const password = Buffer.from(passwordText, 'ascii');
    await expect(createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl,
      createCommandId: () => 'not-a-command-id',
      fetchRequest,
      password,
    })).rejects.toThrow('command binding mismatch');
    const abort = new AbortController();
    abort.abort();
    await expect(createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl,
      createCommandId: () => commandId,
      fetchRequest,
      password,
      signal: abort.signal,
    })).rejects.toThrow('request aborted');
    expect(fetchRequest).not.toHaveBeenCalled();
    password.fill(0);
  });

  it('bounds a streamed response even without Content-Length', async () => {
    const password = Buffer.from(passwordText, 'ascii');
    await expect(createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl,
      createCommandId: () => commandId,
      fetchRequest: fetchSequence(
        exactJsonResponse(
          `${authBaseUrl}/auth/v1/token?grant_type=password`,
          validAuthSession(),
        ),
        exactJsonResponse(
          `${apiBaseUrl}/v1/administration/employee-invitations`,
          { ...validInvitation(), padding: 'x'.repeat(17 * 1024) },
        ),
      ),
      now: () => now,
      password,
    })).rejects.toThrow('response bound mismatch');
    password.fill(0);
  });

  it('times out and cancels an uncooperative never-ending response body', async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    const password = Buffer.from(passwordText, 'ascii');
    try {
      const operation = createDa5V5InvitationSecret({
        apiBaseUrl,
        authBaseUrl,
        createCommandId: () => commandId,
        fetchRequest: fetchSequence(
          exactJsonResponse(
            `${authBaseUrl}/auth/v1/token?grant_type=password`,
            validAuthSession(),
          ),
          hangingJsonResponse(
            `${apiBaseUrl}/v1/administration/employee-invitations`,
            cancelled,
          ),
        ),
        now: () => now,
        password,
      });
      const rejected = expect(operation).rejects.toThrow('request aborted');
      await vi.advanceTimersByTimeAsync(15_000);
      await rejected;
      expect(cancelled).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      password.fill(0);
      vi.useRealTimers();
    }
  });

  it('cancels a hanging response body on external abort and removes its listeners', async () => {
    const cancelled = vi.fn();
    const externalAbort = new AbortController();
    const addListener = vi.spyOn(externalAbort.signal, 'addEventListener');
    const removeListener = vi.spyOn(externalAbort.signal, 'removeEventListener');
    const password = Buffer.from(passwordText, 'ascii');
    let requestCount = 0;
    let markHangingRequest!: () => void;
    const hangingRequest = new Promise<void>((resolvePromise) => {
      markHangingRequest = resolvePromise;
    });
    const hangingResponse = hangingJsonResponse(
      `${apiBaseUrl}/v1/administration/employee-invitations`,
      cancelled,
    );
    const fetchRequest = vi.fn(async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return exactJsonResponse(
          `${authBaseUrl}/auth/v1/token?grant_type=password`,
          validAuthSession(),
        );
      }
      markHangingRequest();
      return hangingResponse;
    }) as unknown as typeof fetch;
    const operation = createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl,
      createCommandId: () => commandId,
      fetchRequest,
      now: () => now,
      password,
      signal: externalAbort.signal,
    });
    const rejected = expect(operation).rejects.toThrow('request aborted');
    await hangingRequest;
    await Promise.resolve();
    externalAbort.abort();
    await rejected;
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledTimes(2);
    expect(removeListener).toHaveBeenCalledTimes(2);
    password.fill(0);
  });

  it.each([
    ['redirect', { redirected: true }],
    ['status', { status: 201 }],
    ['cache', { cacheControl: 'private' }],
    ['content-type', { contentType: 'application/json' }],
    ['origin', { responseUrl: 'http://127.0.0.1:3001/wrong' }],
  ] as const)('rejects invitation HTTP %s drift without disclosing the sentinel',
    async (_label, drift) => {
      const sentinel = `${invitationText.slice(0, -1)}A`;
      const fetchRequest = fetchSequence(
        exactJsonResponse(
          `${authBaseUrl}/auth/v1/token?grant_type=password`,
          validAuthSession(),
        ),
        exactJsonResponse(
          `${apiBaseUrl}/v1/administration/employee-invitations`,
          { ...validInvitation(), invitationSecret: sentinel },
          drift,
        ),
      );
      const password = Buffer.from(passwordText, 'ascii');
      const error = await createDa5V5InvitationSecret({
        apiBaseUrl,
        authBaseUrl,
        createCommandId: () => commandId,
        fetchRequest,
        now: () => now,
        password,
      }).catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(sentinel);
      password.fill(0);
    });

  it.each([
    ['extra key', { ...validInvitation(), extra: true }],
    ['wrong status', { ...validInvitation(), status: 'failed' }],
    ['expired', { ...validInvitation(), expiresAt: new Date(now).toISOString() }],
    ['invalid alphabet', { ...validInvitation(), invitationSecret: `${'A'.repeat(42)}!` }],
    ['invalid length', { ...validInvitation(), invitationSecret: 'A'.repeat(42) }],
    ['noncanonical pad bits', { ...validInvitation(), invitationSecret: `${'A'.repeat(42)}B` }],
  ])('rejects exact-response drift: %s', async (_label, invitation) => {
    const password = Buffer.from(passwordText, 'ascii');
    await expect(createDa5V5InvitationSecret({
      apiBaseUrl,
      authBaseUrl,
      createCommandId: () => commandId,
      fetchRequest: fetchSequence(
        exactJsonResponse(
          `${authBaseUrl}/auth/v1/token?grant_type=password`,
          validAuthSession(),
        ),
        exactJsonResponse(
          `${apiBaseUrl}/v1/administration/employee-invitations`,
          invitation,
        ),
      ),
      now: () => now,
      password,
    })).rejects.toThrow(/response|secret/u);
    password.fill(0);
  });

  it('owns, injects and consumes one secret while zeroing candidate and stdin frame', async () => {
    const adb = new InvitationAdb();
    const serialBinding = new Da5V5UsbSerialBinding();
    expect(serialBinding.bind(adb.serial)).toBe('match');
    const owner = new Da5V5InvitationSecretOwner();
    const transfer = new Da5V5InvitationSecretTransfer(
      owner,
      adb,
      serialBinding,
      deviceBinding,
    );
    const candidate = Buffer.from(invitationText, 'ascii');

    expect(owner.capture(candidate)).toBe('match');
    expect(transfer.confirmEmptyActiveField()).toBe('match');
    await expect(transfer.inject()).resolves.toBe('match');
    expect(candidate.every((byte) => byte === 0)).toBe(true);
    expect(adb.injectionSnapshot.toString('ascii')).toBe(`${invitationText}\n`);
    expect(adb.injectionFrame?.every((byte) => byte === 0)).toBe(true);
    expect(JSON.stringify(adb.commands)).not.toContain(invitationText);
    expect(transfer.confirmRedemption('pass')).toBe('match');
    expect(transfer.state()).toBe('consumed');
    await expect(transfer.inject()).resolves.toBe('mismatch');
    expect(adb.injectionCount).toBe(1);
    adb.injectionSnapshot.fill(0);
  });

  it.each([
    Buffer.from('A'.repeat(42), 'ascii'),
    Buffer.from(`${'A'.repeat(42)}!`, 'ascii'),
    Buffer.from(`${'A'.repeat(42)}B`, 'ascii'),
  ])('rejects invalid length/alphabet/pad bits and zeroes the candidate', (candidate) => {
    const owner = new Da5V5InvitationSecretOwner();
    expect(owner.capture(candidate)).toBe('mismatch');
    expect(candidate.every((byte) => byte === 0)).toBe(true);
    expect(owner.state()).toBe('failed');
  });

  it('rejects the 64-hex password master before any ADB operation', async () => {
    const adb = new InvitationAdb();
    const serialBinding = new Da5V5UsbSerialBinding();
    expect(serialBinding.bind(adb.serial)).toBe('match');
    const owner = new Da5V5InvitationSecretOwner();
    const transfer = new Da5V5InvitationSecretTransfer(
      owner,
      adb,
      serialBinding,
      deviceBinding,
    );
    const password = Buffer.from(passwordText, 'ascii');
    expect(owner.capture(password)).toBe('mismatch');
    expect(password.every((byte) => byte === 0)).toBe(true);
    expect(transfer.confirmEmptyActiveField()).toBe('mismatch');
    await expect(transfer.inject()).resolves.toBe('mismatch');
    expect(adb.commands).toHaveLength(0);
  });

  it('zeroes owned bytes and fails closed when an abort prevents ADB injection', async () => {
    const adb = new InvitationAdb();
    const serialBinding = new Da5V5UsbSerialBinding();
    expect(serialBinding.bind(adb.serial)).toBe('match');
    const owner = new Da5V5InvitationSecretOwner();
    const transfer = new Da5V5InvitationSecretTransfer(
      owner,
      adb,
      serialBinding,
      deviceBinding,
    );
    const candidate = Buffer.from(invitationText, 'ascii');
    expect(owner.capture(candidate)).toBe('match');
    expect(transfer.confirmEmptyActiveField()).toBe('match');
    const abort = new AbortController();
    abort.abort();
    await expect(transfer.inject(abort.signal)).resolves.toBe('mismatch');
    expect(candidate.every((byte) => byte === 0)).toBe(true);
    expect(transfer.state()).toBe('failed');
    expect(adb.injectionCount).toBe(0);
    transfer.destroy();
    expect(transfer.state()).toBe('destroyed');
  });

  it('contains no clipboard, environment, argv, logging or evidence sink', async () => {
    const source = await readFile(
      new URL('../src/Da5V5InvitationSecret.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/pbcopy|pbpaste|clipboard|process\.env|process\.argv/iu);
    expect(source).not.toMatch(/console\.|writeOperatorOutput|evidence|manifest/iu);
    expect(source).toContain('JavaScript strings');
    expect(source).toContain('Owned byte buffers are zeroed');
  });
});

function validAuthSession(): Record<string, unknown> {
  const timestamp = new Date(now - 60_000).toISOString();
  return {
    access_token: accessToken,
    expires_at: Math.floor(now / 1_000) + 300,
    expires_in: 300,
    refresh_token: refreshToken,
    token_type: 'bearer',
    user: {
      app_metadata: { provider: 'email', providers: ['email'] },
      aud: 'authenticated',
      created_at: timestamp,
      email: SYNTHETIC_ADMIN_AUTH_EMAIL,
      id: syntheticIds.administratorProviderSubject,
      identities: [],
      is_anonymous: false,
      phone: '',
      role: 'authenticated',
      updated_at: timestamp,
      user_metadata: {},
    },
  };
}

function validInvitation(): Record<string, unknown> {
  return {
    expiresAt: new Date(now + 60_000).toISOString(),
    invitationSecret: invitationText,
    status: 'succeeded',
  };
}

function exactJsonResponse(
  expectedUrl: string,
  body: unknown,
  drift: Readonly<{
    cacheControl?: string;
    contentType?: string;
    redirected?: boolean;
    responseUrl?: string;
    status?: number;
  }> = {},
): Response {
  const response = new Response(JSON.stringify(body), {
    headers: {
      'cache-control': drift.cacheControl ?? 'no-store',
      'content-type': drift.contentType ?? 'application/json; charset=utf-8',
    },
    status: drift.status ?? 200,
  });
  Object.defineProperties(response, {
    redirected: { configurable: true, value: drift.redirected ?? false },
    url: { configurable: true, value: drift.responseUrl ?? expectedUrl },
  });
  return response;
}

function hangingJsonResponse(url: string, cancelled: () => void): Response {
  const stream = new ReadableStream<Uint8Array>({
    cancel: cancelled,
    pull: () => new Promise<void>(() => undefined),
  });
  const response = new Response(stream, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
    status: 200,
  });
  Object.defineProperties(response, {
    redirected: { configurable: true, value: false },
    url: { configurable: true, value: url },
  });
  return response;
}

function fetchSequence(...responses: Response[]): typeof fetch {
  return vi.fn(async () => {
    const response = responses.shift();
    if (response === undefined) throw new Error('unexpected fetch');
    return response;
  }) as unknown as typeof fetch;
}

class InvitationAdb implements Da5V5AndroidAdbRunner {
  commands: string[][] = [];
  injectionCount = 0;
  injectionFrame: Buffer | null = null;
  injectionSnapshot = Buffer.alloc(0);
  serial = 'synthetic-device';

  async run(
    arguments_: readonly string[],
    options: Readonly<{ requireEmptyOutput?: true; stdinBytes?: Buffer }> = {},
  ): Promise<string> {
    this.commands.push([...arguments_]);
    if (arguments_.join(' ') === 'devices -l') {
      return `List of devices attached\n${this.serial}\tdevice usb:synthetic\n`;
    }
    if (arguments_[0] !== '-s' || arguments_[1] !== this.serial) {
      throw new Error('unexpected fake device');
    }
    const command = arguments_.slice(2).join(' ');
    if (command === 'shell getprop ro.product.model') return `${deviceBinding.deviceModel}\n`;
    if (command === 'shell getprop ro.build.fingerprint') {
      return `${deviceBinding.androidBuild}\n`;
    }
    if (command === 'reverse --list') {
      return 'UsbFfs tcp:54321 tcp:54321\nUsbFfs tcp:3000 tcp:3000\n';
    }
    if (command === 'shell cmd package list packages -a -u --user 0 com.tim180201.mobile.synthetic') {
      return 'package:com.tim180201.mobile.synthetic\n';
    }
    if (command === 'shell cmd package path --user 0 com.tim180201.mobile.synthetic') {
      return 'package:/data/app/synthetic/base.apk\n';
    }
    if (command === 'shell ps -A -w -o NAME:4') {
      return 'NAME\ncom.tim180201.mobile.synthetic\n';
    }
    if (command === 'shell settings get system font_scale') return '1.0\n';
    if (command === 'shell settings get secure accessibility_enabled') return '0\n';
    if (command === 'shell settings get secure enabled_accessibility_services') return 'null\n';
    if (command.startsWith("shell -T sh -c 'IFS= read -r v || exit 40;")) {
      if (options.stdinBytes === undefined || options.requireEmptyOutput !== true) {
        throw new Error('missing invitation stdin binding');
      }
      this.injectionCount += 1;
      this.injectionFrame = options.stdinBytes;
      this.injectionSnapshot = Buffer.from(options.stdinBytes);
      return '';
    }
    throw new Error(`unexpected command: ${command}`);
  }
}
