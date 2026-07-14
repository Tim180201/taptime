import { Writable } from 'node:stream';
import type { AccessTokenVerificationResult } from '@taptime/backend-identity';
import { describe, expect, it, vi } from 'vitest';
import { runBootstrapCli, type BootstrapCliDependencies } from '../src/cli.js';
import { InvalidBootstrapRequestError, type BootstrapOrganizationResult } from '../src/types.js';

const validArguments = [
  '--profile', '/etc/taptime/bootstrap.json',
  '--operator-login', 'taptime_bootstrap_operator_aaaaaaaaaaaa',
  '--request-id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '--organization-name', 'TapTim.e GmbH',
  '--secrets-stdin',
];

const profile = Object.freeze({
  version: 1 as const,
  supabaseIssuer: 'https://issuer.example.com/auth/v1',
  database: Object.freeze({
    mode: 'loopback-test' as const,
    host: '127.0.0.1',
    port: 5432,
    database: 'taptime_c3b',
    ssl: false as const,
  }),
});

describe('official C3B CLI composition', () => {
  it('rejects invalid arguments with exit 2 and one fixed safe line before reading profile or secrets', async () => {
    const harness = cliHarness({ verification: verified(), capabilityResult: succeeded(false) });
    const code = await runBootstrapCli(['--access-token', 'secret-sentinel'], {}, harness.output, harness.dependencies);
    expect(code).toBe(2);
    expect(harness.text()).toBe('{"status":"rejected","reason":"invalid_request"}\n');
    expect(harness.loadProfile).not.toHaveBeenCalled();
    expect(harness.readAccessToken).not.toHaveBeenCalled();
    assertOneSafeLine(harness.text());
  });

  it('rejects an invalid Organization name with exit 2 before verification or password input', async () => {
    const harness = cliHarness({ verification: verified(), capabilityResult: succeeded(false) });
    const args = replaceArgument(validArguments, '--organization-name', '   ');
    expect(await runBootstrapCli(args, {}, harness.output, harness.dependencies)).toBe(2);
    expect(harness.verify).not.toHaveBeenCalled();
    expect(harness.readDatabasePassword).not.toHaveBeenCalled();
    expect(harness.text()).toBe('{"status":"rejected","reason":"invalid_request"}\n');
  });

  it('returns exit 3 for token rejection without reading the database password or leaking token detail', async () => {
    const harness = cliHarness({
      verification: { status: 'rejected', reason: 'invalid_signature' },
      capabilityResult: succeeded(false),
    });
    expect(await runBootstrapCli(validArguments, {}, harness.output, harness.dependencies)).toBe(3);
    expect(harness.readDatabasePassword).not.toHaveBeenCalled();
    expect(harness.text()).toBe('{"status":"rejected","reason":"access_token_rejected"}\n');
    expect(harness.text()).not.toContain('invalid_signature');
    expect(harness.text()).not.toContain('token-secret-sentinel');
  });

  it('returns exit 1 for verifier infrastructure failure with no password read or raw error', async () => {
    const harness = cliHarness({ verificationError: new Error('provider-private-sentinel'), capabilityResult: succeeded(false) });
    expect(await runBootstrapCli(validArguments, {}, harness.output, harness.dependencies)).toBe(1);
    expect(harness.readDatabasePassword).not.toHaveBeenCalled();
    expect(harness.text()).toBe('{"status":"unavailable","reason":"service_unavailable"}\n');
    expect(harness.text()).not.toContain('provider-private-sentinel');
  });

  it('maps malformed second-channel input to exit 2 after successful verification', async () => {
    const harness = cliHarness({
      verification: verified(),
      capabilityResult: succeeded(false),
      passwordError: new InvalidBootstrapRequestError('invalid_secret_input'),
    });
    expect(await runBootstrapCli(validArguments, {}, harness.output, harness.dependencies)).toBe(2);
    expect(harness.verify).toHaveBeenCalledOnce();
    expect(harness.readDatabasePassword).toHaveBeenCalledOnce();
    expect(harness.text()).toBe('{"status":"rejected","reason":"invalid_request"}\n');
  });

  it.each([
    ['database policy', { status: 'rejected', reason: 'identity_unavailable' } as const, 4,
      '{"status":"rejected","reason":"identity_unavailable"}\n'],
    ['success', succeeded(false), 0,
      '{"status":"succeeded","idempotentRetry":false,"userId":"10000000-0000-4000-8000-000000000001","identityBindingId":"11000000-0000-4000-8000-000000000001","organizationId":"20000000-0000-4000-8000-000000000001","membershipId":"21000000-0000-4000-8000-000000000001"}\n'],
    ['exact replay', succeeded(true), 0,
      '{"status":"succeeded","idempotentRetry":true,"userId":"10000000-0000-4000-8000-000000000001","identityBindingId":"11000000-0000-4000-8000-000000000001","organizationId":"20000000-0000-4000-8000-000000000001","membershipId":"21000000-0000-4000-8000-000000000001"}\n'],
  ])('maps %s to its exact exit/output contract and requests password only after verification', async (
    _label,
    capabilityResult,
    expectedExit,
    expectedOutput,
  ) => {
    const harness = cliHarness({ verification: verified(), capabilityResult });
    expect(await runBootstrapCli(validArguments, {}, harness.output, harness.dependencies)).toBe(expectedExit);
    expect(harness.order).toEqual(['access-token', 'verify', 'database-password', 'finish', 'capability']);
    expect(harness.text()).toBe(expectedOutput);
    expect(harness.text()).not.toContain('token-secret-sentinel');
    expect(harness.text()).not.toContain('password-secret-sentinel');
    assertOneSafeLine(harness.text());
  });
});

function cliHarness(configuration: {
  readonly verification?: AccessTokenVerificationResult;
  readonly verificationError?: Error;
  readonly capabilityResult: BootstrapOrganizationResult;
  readonly passwordError?: Error;
}) {
  const chunks: Buffer[] = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const order: string[] = [];
  const loadProfile = vi.fn().mockResolvedValue(profile);
  const readAccessToken = vi.fn().mockImplementation(async () => {
    order.push('access-token');
    return 'token-secret-sentinel';
  });
  const readDatabasePassword = vi.fn().mockImplementation(async () => {
    order.push('database-password');
    if (configuration.passwordError !== undefined) {
      throw configuration.passwordError;
    }
    return 'password-secret-sentinel';
  });
  const finish = vi.fn().mockImplementation(async () => { order.push('finish'); });
  const verify = vi.fn().mockImplementation(async () => {
    order.push('verify');
    if (configuration.verificationError !== undefined) {
      throw configuration.verificationError;
    }
    return configuration.verification!;
  });
  const dependencies: Partial<BootstrapCliDependencies> = {
    loadProfile,
    createVerifier: () => ({ verify }),
    createSecrets: () => ({
      readAccessToken,
      readDatabasePassword,
      finish,
      close: vi.fn(),
    }),
    createCapability: ({ passwordProvider }) => ({
      execute: async () => {
        await passwordProvider();
        order.push('capability');
        return configuration.capabilityResult;
      },
    }),
  };
  return {
    output,
    dependencies,
    order,
    loadProfile,
    verify,
    readAccessToken,
    readDatabasePassword,
    text: () => Buffer.concat(chunks).toString('utf8'),
  };
}

function verified(): AccessTokenVerificationResult {
  return {
    status: 'verified',
    identity: { issuer: profile.supabaseIssuer, subject: 'subject-a' },
  };
}

function succeeded(idempotentRetry: boolean): BootstrapOrganizationResult {
  return {
    status: 'succeeded',
    idempotentRetry,
    userId: '10000000-0000-4000-8000-000000000001',
    identityBindingId: '11000000-0000-4000-8000-000000000001',
    organizationId: '20000000-0000-4000-8000-000000000001',
    membershipId: '21000000-0000-4000-8000-000000000001',
  };
}

function replaceArgument(arguments_: readonly string[], option: string, value: string): string[] {
  const copy = [...arguments_];
  copy[copy.indexOf(option) + 1] = value;
  return copy;
}

function assertOneSafeLine(value: string): void {
  expect(value.endsWith('\n')).toBe(true);
  expect(value.slice(0, -1)).not.toContain('\n');
  expect(() => JSON.parse(value)).not.toThrow();
}
