import { chmod, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { rootCertificates } from 'node:tls';
import type { Client, ClientConfig } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBootstrapCliArguments } from '../src/cliArguments.js';
import {
  assertNoAmbientSecretConfiguration,
  assertOperatorPrincipal,
  buildRemoteDatabaseTarget,
  loadBootstrapTargetProfile,
} from '../src/databaseTarget.js';
import { PostgresBootstrapCapability } from '../src/PostgresBootstrapCapability.js';
import { createProtectedSecretSource } from '../src/protectedSecretInput.js';
import { openSecureRegularFile } from '../src/secureFile.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('strict bootstrap CLI inputs', () => {
  const validArguments = [
    '--profile', '/etc/taptime/bootstrap.json',
    '--operator-login', 'taptime_bootstrap_operator_aaaaaaaaaaaa',
    '--request-id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '--organization-name', 'TapTim.e GmbH',
    '--secrets-stdin',
  ];

  it('accepts exactly the non-secret command surface', () => {
    expect(parseBootstrapCliArguments(validArguments)).toEqual({
      profilePath: '/etc/taptime/bootstrap.json',
      operatorPrincipal: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationName: 'TapTim.e GmbH',
      secretsStdin: true,
    });
  });

  it.each([
    [...validArguments, '--access-token', 'secret'],
    [...validArguments, '--password', 'secret'],
    [...validArguments, '--profile', '/tmp/other.json'],
    validArguments.filter((value) => value !== '--request-id'),
    ['--profile=/etc/taptime/bootstrap.json', ...validArguments.slice(2)],
    [...validArguments, '--unknown'],
    [...validArguments, '--secrets-stdin'],
  ].map((arguments_) => [arguments_] as const))('rejects unknown, duplicate, missing, joined, or secret-bearing arguments', (arguments_) => {
    expect(() => parseBootstrapCliArguments(arguments_)).toThrow('invalid_arguments');
  });

  it.each([
    { PGPASSWORD: 'secret' },
    { PGHOST: 'attacker.invalid' },
    { PGSERVICEFILE: '/tmp/evil' },
    { DATABASE_URL: 'postgresql://secret' },
    { SUPABASE_SERVICE_ROLE_KEY: 'secret' },
    { TAPTIME_BOOTSTRAP_ACCESS_TOKEN: 'secret' },
    { TAPTIME_BOOTSTRAP_DATABASE_PASSWORD: 'secret' },
  ])('rejects ambient PostgreSQL and secret configuration', (environment) => {
    expect(() => assertNoAmbientSecretConfiguration(environment)).toThrow(
      'ambient_secret_configuration_rejected',
    );
  });

  it('permits an environment containing no secret or PostgreSQL override', () => {
    expect(() => assertNoAmbientSecretConfiguration({ PATH: '/usr/bin', HOME: '/tmp' })).not.toThrow();
  });

  it.each([
    'postgres',
    'taptime_bootstrap_operator_shared',
    'taptime_bootstrap_operator_short',
    'taptime_bootstrap_operator_AAAAAAAAAAAA',
    'taptime_bootstrap_operator_aaaaaaaaaaaa_extra',
  ])('rejects generic or malformed operator principal %s', (principal) => {
    expect(() => assertOperatorPrincipal(principal)).toThrow('invalid_operator_principal');
  });

  it('accepts one opaque individual operator principal shape', () => {
    expect(() => assertOperatorPrincipal('taptime_bootstrap_operator_a1b2c3d4e5f6')).not.toThrow();
    expect(() => assertOperatorPrincipal(`taptime_bootstrap_operator_${'a'.repeat(36)}`)).not.toThrow();
    expect(() => assertOperatorPrincipal(`taptime_bootstrap_operator_${'a'.repeat(37)}`)).toThrow(
      'invalid_operator_principal',
    );
  });
});

describe('platform-owned target profile', () => {
  it('loads an exact numeric-loopback test target without TLS fallback', async () => {
    const path = await profileFile({
      version: 1,
      supabaseIssuer: 'http://127.0.0.1:54321/auth/v1/',
      database: { mode: 'loopback-test', host: '127.0.0.1', port: 5432, name: 'taptime_c3b' },
    });
    await expect(loadBootstrapTargetProfile(path)).resolves.toEqual({
      version: 1,
      supabaseIssuer: 'http://127.0.0.1:54321/auth/v1',
      database: {
        mode: 'loopback-test',
        host: '127.0.0.1',
        port: 5432,
        database: 'taptime_c3b',
        ssl: false,
      },
    });
  });

  it('canonicalizes bracketed IPv6 loopback before passing it to node-postgres', async () => {
    const path = await profileFile({
      version: 1,
      supabaseIssuer: 'http://[::1]:54321/auth/v1/',
      database: { mode: 'loopback-test', host: '[::1]', port: 5432, name: 'taptime_c3b' },
    });
    await expect(loadBootstrapTargetProfile(path)).resolves.toMatchObject({
      database: { mode: 'loopback-test', host: '::1', ssl: false },
    });
  });

  it.each([
    { mode: 'loopback-test', host: 'localhost', port: 5432, name: 'taptime_c3b' },
    { mode: 'loopback-test', host: '192.168.1.4', port: 5432, name: 'taptime_c3b' },
    { mode: 'loopback-test', host: '127.0.0.1', port: 0, name: 'taptime_c3b' },
    { mode: 'loopback-test', host: '127.0.0.1', port: 5432, name: 'bad-name' },
  ])('rejects an unsafe database target %#', async (database) => {
    const path = await profileFile({
      version: 1,
      supabaseIssuer: database.mode === 'remote' ? 'https://issuer.example.com/auth/v1' : 'http://127.0.0.1/auth/v1',
      database,
    });
    await expect(loadBootstrapTargetProfile(path)).rejects.toThrow('invalid_profile');
  });

  it('builds the exact remote TLS target from an otherwise trusted profile/CA snapshot', () => {
    const ca = rootCertificates[0]!;
    expect(buildRemoteDatabaseTarget({
      mode: 'remote',
      host: 'direct-postgres.example.internal',
      port: 5432,
      name: 'taptime',
      rootCaPath: '/etc/taptime/postgres-root-ca.pem',
    }, 0, ca)).toEqual({
      mode: 'remote',
      host: 'direct-postgres.example.internal',
      port: 5432,
      database: 'taptime',
      ssl: {
        ca,
        rejectUnauthorized: true,
        servername: 'direct-postgres.example.internal',
        minVersion: 'TLSv1.2',
      },
    });
  });

  it.each([
    ['numeric IPv4', '127.0.0.1'],
    ['localhost', 'localhost'],
    ['uppercase', 'DB.example.internal'],
    ['trailing dot', 'db.example.internal.'],
    ['single label', 'database'],
    ['invalid label', '-db.example.internal'],
  ])('rejects remote hostname policy violation: %s', (_label, host) => {
    expect(() => buildRemoteDatabaseTarget({
      mode: 'remote',
      host,
      port: 5432,
      name: 'taptime',
      rootCaPath: '/etc/taptime/postgres-root-ca.pem',
    }, 0, rootCertificates[0]!)).toThrow('invalid_profile');
  });

  it.each([
    ['non-root profile', 501, '/etc/taptime/postgres-root-ca.pem', rootCertificates[0]!],
    ['relative CA path', 0, 'relative-ca.pem', rootCertificates[0]!],
    ['missing CA', 0, '/etc/taptime/postgres-root-ca.pem', ''],
    ['malformed CA', 0, '/etc/taptime/postgres-root-ca.pem', '-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----'],
  ])('rejects remote trust-anchor violation: %s', (_label, uid, rootCaPath, ca) => {
    expect(() => buildRemoteDatabaseTarget({
      mode: 'remote',
      host: 'direct-postgres.example.internal',
      port: 5432,
      name: 'taptime',
      rootCaPath,
    }, uid, ca)).toThrow('invalid_profile');
  });

  it('rejects group/world-writable and symbolic-link profiles', async () => {
    const path = await profileFile({
      version: 1,
      supabaseIssuer: 'http://127.0.0.1/auth/v1',
      database: { mode: 'loopback-test', host: '127.0.0.1', port: 5432, name: 'taptime_c3b' },
    });
    await chmod(path, 0o666);
    await expect(loadBootstrapTargetProfile(path)).rejects.toThrow('invalid_profile');
    await chmod(path, 0o600);
    const link = `${path}.link`;
    await symlink(path, link);
    await expect(loadBootstrapTargetProfile(link)).rejects.toThrow('invalid_profile');
  });

  it.each([
    ['unknown top-level key', { debug: true }],
    ['top-level password', { password: 'secret-sentinel' }],
    ['top-level access token', { accessToken: 'secret-sentinel' }],
    ['top-level service role key', { serviceRoleKey: 'secret-sentinel' }],
  ])('rejects an otherwise valid profile with %s', async (_label, extra) => {
    const path = await profileFile({
      version: 1,
      supabaseIssuer: 'http://127.0.0.1/auth/v1',
      database: { mode: 'loopback-test', host: '127.0.0.1', port: 5432, name: 'taptime_c3b' },
      ...extra,
    });
    await expect(loadBootstrapTargetProfile(path)).rejects.toThrow('invalid_profile');
  });

  it.each([
    ['unknown key', { debug: true }],
    ['connection URL', { connectionString: 'postgresql://operator:secret@attacker.invalid/taptime' }],
    ['password', { password: 'secret-sentinel' }],
    ['access token', { accessToken: 'secret-sentinel' }],
    ['service role key', { serviceRoleKey: 'secret-sentinel' }],
    ['loopback CA override', { rootCaPath: '/tmp/attacker-ca.pem' }],
  ])('rejects an otherwise valid database profile with %s', async (_label, extra) => {
    const path = await profileFile({
      version: 1,
      supabaseIssuer: 'http://127.0.0.1/auth/v1',
      database: {
        mode: 'loopback-test', host: '127.0.0.1', port: 5432, name: 'taptime_c3b', ...extra,
      },
    });
    await expect(loadBootstrapTargetProfile(path)).rejects.toThrow('invalid_profile');
  });

  it('fails closed without reading a replacement when a writable ancestor swaps the pathname', async () => {
    const expected = JSON.stringify({ trusted: 'original-profile' });
    const path = await textFile('profile.json', expected);
    const replacement = await textFile('replacement.json', JSON.stringify({ password: 'secret-sentinel' }));
    const opened = await openSecureRegularFile(path, false);
    try {
      await rename(replacement, path);
      await expect(opened.readBounded(65_536)).rejects.toThrow('invalid_profile');
    } finally {
      await opened.close();
    }
    await expect(loadBootstrapTargetProfile(path)).rejects.toThrow('invalid_profile');
  });
});

describe('protected secret channel', () => {
  it('reads token first and password second from two bounded UTF-8 lines', async () => {
    const source = createProtectedSecretSource(
      true,
      Readable.from([Buffer.from('token-value\npassword-value\n')]) as Readable & AsyncIterable<Uint8Array>,
    );
    await expect(source.readAccessToken()).resolves.toBe('token-value');
    await expect(source.readDatabasePassword()).resolves.toBe('password-value');
    await expect(source.finish()).resolves.toBeUndefined();
  });

  it('rejects explicit stdin mode when the selected input is an echoing TTY', () => {
    const input = Readable.from([Buffer.from('token\npassword\n')]) as Readable
      & AsyncIterable<Uint8Array>
      & { isTTY: boolean };
    input.isTTY = true;
    expect(() => createProtectedSecretSource(true, input)).toThrow('protected_tty_required');
  });

  it('rejects hidden bytes after a zero-length post-password iterator chunk', async () => {
    const source = createProtectedSecretSource(
      true,
      Readable.from([
        Buffer.from('token\npassword\n'),
        Buffer.alloc(0),
        Buffer.from('hidden-extra'),
      ]) as Readable & AsyncIterable<Uint8Array>,
    );
    await source.readAccessToken();
    await source.readDatabasePassword();
    await expect(source.finish()).rejects.toThrow('invalid_secret_input');
    source.close();
  });

  it('rejects an oversized single stdin chunk before retaining it', async () => {
    const source = createProtectedSecretSource(
      true,
      Readable.from([Buffer.alloc(140_000, 0x61)]) as Readable & AsyncIterable<Uint8Array>,
    );
    await expect(source.readAccessToken()).rejects.toThrow('invalid_secret_input');
    source.close();
  });

  it.each([
    'token\r\npassword\n',
    'token\npassword\nextra\n',
    'token\n\n',
    `token\n${'p'.repeat(4097)}\n`,
  ])('rejects malformed, extra, empty, or oversized secret input', async (input) => {
    const source = createProtectedSecretSource(
      true,
      Readable.from([Buffer.from(input)]) as Readable & AsyncIterable<Uint8Array>,
    );
    try {
      await source.readAccessToken();
      await source.readDatabasePassword();
      await expect(source.finish()).rejects.toThrow('invalid_secret_input');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('invalid_secret_input');
    } finally {
      source.close();
    }
  });
});

describe('one-shot PostgreSQL capability', () => {
  const target = {
    mode: 'loopback-test' as const,
    host: '127.0.0.1',
    port: 5432,
    database: 'taptime_c3b',
    ssl: false as const,
  };
  const request = {
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    canonicalOrganizationName: 'TapTim.e',
    identity: { issuer: 'https://issuer.invalid', subject: 'subject-a' },
  };

  it.each([
    ['remote plaintext', {
      mode: 'remote', host: 'db.example.internal', port: 5432, database: 'taptime', ssl: false,
    }],
    ['remote TLS callback override', {
      mode: 'remote', host: 'db.example.internal', port: 5432, database: 'taptime',
      ssl: {
        ca: rootCertificates[0]!, rejectUnauthorized: true, servername: 'db.example.internal',
        minVersion: 'TLSv1.2', checkServerIdentity: () => undefined,
      },
    }],
    ['bracketed database IPv6', {
      mode: 'loopback-test', host: '[::1]', port: 5432, database: 'taptime_c3b', ssl: false,
    }],
    ['non-loopback test target', {
      mode: 'loopback-test', host: '192.168.1.20', port: 5432, database: 'taptime_c3b', ssl: false,
    }],
  ])('rejects an invalid programmatic target before requesting a password or creating a client: %s', async (
    _label,
    invalidTarget,
  ) => {
    const passwordProvider = vi.fn().mockResolvedValue('password-sentinel');
    const clientFactory = vi.fn();
    const capability = new PostgresBootstrapCapability({
      target: invalidTarget as never,
      operatorPrincipal: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      passwordProvider,
      clientFactory,
    });
    await expect(capability.execute(request)).rejects.toThrow('bootstrap_database_unavailable');
    expect(passwordProvider).not.toHaveBeenCalled();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('rejects an invalid programmatic operator before requesting a password or creating a client', async () => {
    const passwordProvider = vi.fn().mockResolvedValue('password-sentinel');
    const clientFactory = vi.fn();
    const capability = new PostgresBootstrapCapability({
      target,
      operatorPrincipal: 'shared-operator',
      passwordProvider,
      clientFactory,
    });
    await expect(capability.execute(request)).rejects.toThrow('bootstrap_database_unavailable');
    expect(passwordProvider).not.toHaveBeenCalled();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it('uses explicit connection fields, assumes the fixed role, commits, and closes once', async () => {
    let captured: ClientConfig | undefined;
    const fake = fakeClient({
      result_status: 'succeeded',
      idempotent_retry: false,
      result_user_id: '10000000-0000-4000-8000-000000000001',
      result_identity_binding_id: '11000000-0000-4000-8000-000000000001',
      result_organization_id: '20000000-0000-4000-8000-000000000001',
      result_membership_id: '21000000-0000-4000-8000-000000000001',
    });
    const capability = new PostgresBootstrapCapability({
      target,
      operatorPrincipal: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      passwordProvider: vi.fn().mockResolvedValue('password-sentinel'),
      clientFactory: (configuration) => {
        captured = configuration;
        return fake.client;
      },
    });
    await expect(capability.execute(request)).resolves.toMatchObject({ status: 'succeeded' });
    expect(captured).toMatchObject({
      host: '127.0.0.1',
      port: 5432,
      database: 'taptime_c3b',
      user: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      password: 'password-sentinel',
      ssl: false,
    });
    expect(captured).not.toHaveProperty('connectionString');
    expect(fake.queries).toContain('SET LOCAL ROLE taptime_bootstrap_executor');
    expect(fake.queries.at(-1)).toBe('COMMIT');
    expect(fake.end).toHaveBeenCalledOnce();
  });

  it('commits an ID-free cross-operator rejection instead of rolling its audit back', async () => {
    const fake = fakeClient({
      result_status: 'operator_replay_forbidden',
      idempotent_retry: false,
      result_user_id: null,
      result_identity_binding_id: null,
      result_organization_id: null,
      result_membership_id: null,
    });
    const capability = new PostgresBootstrapCapability({
      target,
      operatorPrincipal: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      passwordProvider: vi.fn().mockResolvedValue('password'),
      clientFactory: () => fake.client,
    });
    await expect(capability.execute(request)).resolves.toEqual({
      status: 'rejected', reason: 'operator_replay_forbidden',
    });
    expect(fake.queries.at(-1)).toBe('COMMIT');
  });

  it('rolls back and exposes no raw driver or secret detail for an unknown result', async () => {
    const fake = fakeClient({
      result_status: 'invented',
      idempotent_retry: false,
      result_user_id: null,
      result_identity_binding_id: null,
      result_organization_id: null,
      result_membership_id: null,
    });
    const capability = new PostgresBootstrapCapability({
      target,
      operatorPrincipal: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      passwordProvider: vi.fn().mockResolvedValue('password-sentinel'),
      clientFactory: () => fake.client,
    });
    await expect(capability.execute(request)).rejects.toThrow('bootstrap_database_unavailable');
    expect(fake.queries.at(-1)).toBe('ROLLBACK');
    expect(fake.end).toHaveBeenCalledOnce();
  });

  it.each([
    ['success with null flag', {
      result_status: 'succeeded', idempotent_retry: null,
      result_user_id: '10000000-0000-4000-8000-000000000001',
      result_identity_binding_id: '11000000-0000-4000-8000-000000000001',
      result_organization_id: '20000000-0000-4000-8000-000000000001',
      result_membership_id: '21000000-0000-4000-8000-000000000001',
    }],
    ['success with string flag', {
      result_status: 'succeeded', idempotent_retry: 'false',
      result_user_id: '10000000-0000-4000-8000-000000000001',
      result_identity_binding_id: '11000000-0000-4000-8000-000000000001',
      result_organization_id: '20000000-0000-4000-8000-000000000001',
      result_membership_id: '21000000-0000-4000-8000-000000000001',
    }],
    ['rejection with null flag', {
      result_status: 'invalid_request', idempotent_retry: null,
      result_user_id: null, result_identity_binding_id: null,
      result_organization_id: null, result_membership_id: null,
    }],
  ])('fails closed for a contradictory capability row: %s', async (_label, row) => {
    const fake = fakeClient(row);
    const capability = new PostgresBootstrapCapability({
      target,
      operatorPrincipal: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
      passwordProvider: vi.fn().mockResolvedValue('password'),
      clientFactory: () => fake.client,
    });
    await expect(capability.execute(request)).rejects.toThrow('bootstrap_database_unavailable');
    expect(fake.queries.at(-1)).toBe('ROLLBACK');
  });
});

async function profileFile(value: unknown): Promise<string> {
  return textFile('profile.json', JSON.stringify(value));
}

async function textFile(name: string, value: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'taptime-c3b-'));
  temporaryDirectories.push(directory);
  const path = join(directory, name);
  await writeFile(path, value, { mode: 0o600 });
  return path;
}

function fakeClient(capabilityRow: Record<string, unknown>) {
  const queries: string[] = [];
  const end = vi.fn().mockResolvedValue(undefined);
  const client = {
    connect: vi.fn().mockResolvedValue(undefined),
    end,
    query: vi.fn().mockImplementation(async (query: string) => {
      queries.push(query);
      if (query === 'SELECT session_user, current_user') {
        const assumed = queries.includes('SET LOCAL ROLE taptime_bootstrap_executor');
        return {
          rowCount: 1,
          rows: [{
            session_user: 'taptime_bootstrap_operator_aaaaaaaaaaaa',
            current_user: assumed
              ? 'taptime_bootstrap_executor'
              : 'taptime_bootstrap_operator_aaaaaaaaaaaa',
          }],
        };
      }
      if (query.startsWith('SELECT * FROM taptime_server.bootstrap_first_organization')) {
        return { rowCount: 1, rows: [capabilityRow] };
      }
      return { rowCount: null, rows: [] };
    }),
  };
  return { client: client as unknown as Client, queries, end };
}
