import { createServer, type Server } from 'node:http';
import {
  exportJWK,
  generateKeyPair,
  generateSecret,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MembershipId, OrganizationId, UserId } from '@taptime/core';
import {
  B4_IDENTITY_RESOLVER_ROLE,
  PostgresIdentityMembershipResolver,
  RequestActorResolutionService,
  SupabaseJwtAccessTokenVerifier,
  withRequestActorTransaction,
  type RequestActorContext,
} from '../src/index.js';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  loadMigrations,
  migrate,
} from '../../backend-schema/src/index.js';
import {
  B4_RESOLVER_PARENT_CONTAMINATION_ROLE,
  B4_RESOLVER_TEST_LOGIN,
  b4Ids,
  b4RuntimeConnectionString,
  contaminateExistingResolverRole,
  ensureSyntheticResolverLogin,
  postgresErrorCode,
  resetAndSeedB4,
} from './fixtures.js';

const installerConnectionString = process.env.B4_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b4';
const runtimePassword = process.env.B4_RUNTIME_PASSWORD ?? 'b4-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 4 });
const resolverPool = new Pool({
  connectionString: b4RuntimeConnectionString(installerConnectionString, runtimePassword),
  max: 1,
});

const rsaKeyId = 'b4-local-rs256';
const sessionId = '90000000-0000-4000-8000-000000000101';
let signingKey: CryptoKey;
let otherSigningKey: CryptoKey;
let jwksServer: Server;
let issuerA: string;
let issuerB: string;
let jwksUrlA: URL;
let jwksUrlB: URL;
let verifierA: SupabaseJwtAccessTokenVerifier;
let verifierB: SupabaseJwtAccessTokenVerifier;
let resolver: PostgresIdentityMembershipResolver;
let serviceA: RequestActorResolutionService;
let serviceB: RequestActorResolutionService;

interface AccessTokenOptions {
  readonly issuer?: string;
  readonly subject?: string | null;
  readonly audience?: string;
  readonly expiresAt?: number;
  readonly notBefore?: number;
  readonly typ?: string;
  readonly key?: CryptoKey;
  readonly omitClaims?: readonly string[];
  readonly claims?: Readonly<Record<string, unknown>>;
}

async function accessToken(options: AccessTokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  const payload: Record<string, unknown> = {
    aal: 'aal1',
    email: 'synthetic@example.invalid',
    is_anonymous: false,
    phone: '',
    role: 'authenticated',
    session_id: sessionId,
    ...options.claims,
  };
  for (const claim of options.omitClaims ?? []) {
    delete payload[claim];
  }

  let token = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: rsaKeyId, typ: options.typ ?? 'JWT' })
    .setIssuer(options.issuer ?? issuerA)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 300);
  if (options.subject !== null) {
    token = token.setSubject(options.subject ?? b4Ids.sharedSubject);
  }
  if (options.notBefore !== undefined) {
    token = token.setNotBefore(options.notBefore);
  }
  return token.sign(options.key ?? signingKey);
}

async function symmetricToken(): Promise<string> {
  const secret = await generateSecret('HS256');
  return new SignJWT({
    aal: 'aal1',
    email: 'synthetic@example.invalid',
    is_anonymous: false,
    phone: '',
    role: 'authenticated',
    session_id: sessionId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuerA)
    .setAudience('authenticated')
    .setSubject(b4Ids.sharedSubject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

function unsecuredToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: issuerA,
    aud: 'authenticated',
    sub: b4Ids.sharedSubject,
    exp: Math.floor(Date.now() / 1_000) + 300,
  })).toString('base64url');
  return `${header}.${payload}.`;
}

async function resolveA(
  token: string,
  requestedOrganizationId: string = b4Ids.organizationA,
) {
  return serviceA.resolve({
    accessToken: token,
    requestedOrganizationId: OrganizationId(requestedOrganizationId),
  });
}

async function withResolverRole<Value>(
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await resolverPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${B4_IDENTITY_RESOLVER_ROLE}`);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function startJwksServer(jwk: JWK): Promise<{ server: Server; origin: URL }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', kid: rsaKeyId, use: 'sig' }] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic JWKS server did not expose a TCP address');
  }
  return { server, origin: new URL(`http://127.0.0.1:${address.port}`) };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

beforeAll(async () => {
  const primaryKeyPair = await generateKeyPair('RS256');
  const secondaryKeyPair = await generateKeyPair('RS256');
  signingKey = primaryKeyPair.privateKey;
  otherSigningKey = secondaryKeyPair.privateKey;
  const jwksInfrastructure = await startJwksServer(
    await exportJWK(primaryKeyPair.publicKey),
  );
  jwksServer = jwksInfrastructure.server;
  issuerA = new URL('/synthetic-a/auth/v1', jwksInfrastructure.origin).href;
  issuerB = new URL('/synthetic-b/auth/v1', jwksInfrastructure.origin).href;
  jwksUrlA = new URL(`${issuerA}/.well-known/jwks.json`);
  jwksUrlB = new URL(`${issuerB}/.well-known/jwks.json`);

  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await contaminateExistingResolverRole(installerPool);
  await migrate(installerPool);
  await ensureSyntheticResolverLogin(installerPool, runtimePassword);

  verifierA = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer: issuerA,
    jwksUrl: jwksUrlA,
    allowedAlgorithms: ['RS256'],
  });
  verifierB = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer: issuerB,
    jwksUrl: jwksUrlB,
    allowedAlgorithms: ['RS256'],
  });
  resolver = new PostgresIdentityMembershipResolver(resolverPool);
  serviceA = new RequestActorResolutionService(verifierA, resolver);
  serviceB = new RequestActorResolutionService(verifierB, resolver);
}, 30_000);

beforeEach(async () => {
  await resetAndSeedB4(installerPool, { issuerA, issuerB });
});

afterAll(async () => {
  await resolverPool.end();
  await installerPool.end();
  await closeServer(jwksServer);
});

describe('versioned B4 migration', () => {
  it('applies migrations 001 through 004 once and records the immutable ledger', async () => {
    const migrations = await loadMigrations();
    expect(migrations.map(({ version }) => version)).toEqual(['001', '002', '003', '004']);

    const ledger = await installerPool.query<{ version: string; checksum: string }>(
      `SELECT version, checksum FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
    );
    expect(ledger.rows.map(({ version }) => version)).toEqual(['001', '002', '003', '004']);
    expect(ledger.rows.every(({ checksum }) => /^[0-9a-f]{64}$/.test(checksum))).toBe(true);

    const rerun = await migrate(installerPool);
    expect(rerun).toEqual({ applied: [], alreadyApplied: ['001', '002', '003', '004'] });
  });
});

describe('Supabase access-token verification boundary', () => {
  it('accepts a locally signed asymmetric access token and exposes only issuer and subject', async () => {
    const result = await verifierA.verify(await accessToken({
      claims: { app_metadata: { organization_id: b4Ids.organizationB, role: 'administrator' } },
    }));

    expect(result).toEqual({
      status: 'verified',
      identity: { issuer: issuerA, subject: b4Ids.sharedSubject },
    });
    if (result.status === 'verified') {
      expect(Object.isFrozen(result.identity)).toBe(true);
      expect(Object.keys(result.identity)).toEqual(['issuer', 'subject']);
    }
  });

  it('rejects a token signed by an untrusted key', async () => {
    expect(await verifierA.verify(await accessToken({ key: otherSigningKey }))).toEqual({
      status: 'rejected', reason: 'invalid_signature',
    });
  });

  it('rejects an issuer mismatch', async () => {
    expect(await verifierA.verify(await accessToken({ issuer: issuerB }))).toEqual({
      status: 'rejected', reason: 'issuer_mismatch',
    });
  });

  it('rejects an audience mismatch', async () => {
    expect(await verifierA.verify(await accessToken({ audience: 'anon' }))).toEqual({
      status: 'rejected', reason: 'audience_mismatch',
    });
  });

  it('rejects an expired token', async () => {
    expect(await verifierA.verify(await accessToken({
      expiresAt: Math.floor(Date.now() / 1_000) - 1,
    }))).toEqual({ status: 'rejected', reason: 'token_expired' });
  });

  it('rejects a token whose not-before time is still in the future', async () => {
    expect(await verifierA.verify(await accessToken({
      notBefore: Math.floor(Date.now() / 1_000) + 300,
    }))).toEqual({ status: 'rejected', reason: 'token_not_active' });
  });

  it('rejects a missing subject', async () => {
    expect(await verifierA.verify(await accessToken({ subject: null }))).toEqual({
      status: 'rejected', reason: 'subject_missing',
    });
  });

  it('rejects an empty subject', async () => {
    expect(await verifierA.verify(await accessToken({ subject: '   ' }))).toEqual({
      status: 'rejected', reason: 'subject_missing',
    });
  });

  it.each(['anon', 'service_role'])(
    'rejects the unsuitable provider role %s',
    async (role) => {
      expect(await verifierA.verify(await accessToken({ claims: { role } }))).toEqual({
        status: 'rejected', reason: 'unsuitable_token',
      });
    },
  );

  it('rejects an anonymous authenticated token', async () => {
    expect(await verifierA.verify(await accessToken({ claims: { is_anonymous: true } }))).toEqual({
      status: 'rejected', reason: 'unsuitable_token',
    });
  });

  it('rejects a token without a provider session identifier', async () => {
    expect(await verifierA.verify(await accessToken({ omitClaims: ['session_id'] }))).toEqual({
      status: 'rejected', reason: 'unsuitable_token',
    });
  });

  it('rejects a token with an unsuitable token type', async () => {
    expect(await verifierA.verify(await accessToken({ typ: 'at+jwt' }))).toEqual({
      status: 'rejected', reason: 'unsuitable_token',
    });
  });

  it('rejects symmetric algorithm-confusion input before key resolution', async () => {
    expect(await verifierA.verify(await symmetricToken())).toEqual({
      status: 'rejected', reason: 'unsupported_algorithm',
    });
  });

  it('rejects an unsafe algorithm even if untyped runtime configuration attempts to allow it', () => {
    expect(() => SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: issuerA,
      jwksUrl: jwksUrlA,
      allowedAlgorithms: ['HS256' as never],
    })).toThrow('Only ES256 and RS256');
  });

  it('rejects a JWKS endpoint that is not anchored below the configured issuer', () => {
    expect(() => SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: issuerA,
      jwksUrl: jwksUrlB,
      allowedAlgorithms: ['RS256'],
    })).toThrow('Supabase JWKS URL must match the configured issuer');
  });

  it.each([
    ['remote HTTP host', 'http://auth.example.com/auth/v1'],
    ['localhost hostname', 'http://localhost/auth/v1'],
    ['loopback-like foreign hostname', 'http://127.0.0.1.evil.example/auth/v1'],
  ])('rejects unencrypted transport for a %s', (_case, issuer) => {
    expect(() => SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer,
      jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    })).toThrow('Supabase JWT issuer must use HTTPS');
  });

  it.each([
    'ftp://auth.example.com/auth/v1',
    'file:///synthetic/auth/v1',
  ])('rejects the non-HTTP(S) issuer protocol in %s', (issuer) => {
    expect(() => SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer,
      jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    })).toThrow('Supabase JWT issuer must use HTTPS');
  });

  it('accepts an HTTPS Supabase issuer with its exactly derived JWKS URL', () => {
    const issuer = 'https://synthetic.supabase.co/auth/v1';
    expect(SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer,
      jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    })).toBeInstanceOf(SupabaseJwtAccessTokenVerifier);
  });

  it('accepts numeric IPv6 loopback HTTP for synthetic local JWKS infrastructure', () => {
    const issuer = 'http://[::1]:54321/auth/v1';
    expect(SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer,
      jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    })).toBeInstanceOf(SupabaseJwtAccessTokenVerifier);
  });

  it('rejects an unsecured alg-none token', async () => {
    expect(await verifierA.verify(unsecuredToken())).toEqual({
      status: 'rejected', reason: 'unsupported_algorithm',
    });
  });

  it('rejects malformed compact serialization', async () => {
    expect(await verifierA.verify('not-a-jwt')).toEqual({
      status: 'rejected', reason: 'malformed_token',
    });
  });
});

describe('authoritative identity and Membership resolution', () => {
  it('resolves a verified identity to an immutable employee RequestActorContext', async () => {
    const result = await resolveA(await accessToken());

    expect(result).toEqual({
      status: 'accepted',
      actor: {
        userId: b4Ids.employeeA,
        organizationId: b4Ids.organizationA,
        membershipId: b4Ids.employeeAMembership,
        role: 'employee',
      },
    });
    if (result.status === 'accepted') {
      expect(Object.isFrozen(result.actor)).toBe(true);
    }
  });

  it.each([
    ['unknown binding', b4Ids.unknownSubject],
    ['revoked binding', b4Ids.revokedBindingSubject],
    ['missing Membership', b4Ids.missingMembershipSubject],
    ['revoked Membership', b4Ids.revokedMembershipSubject],
  ])('returns one generic rejection for %s', async (_case, subject) => {
    expect(await resolveA(await accessToken({ subject }))).toEqual({
      status: 'rejected', reason: 'identity_or_membership_unavailable',
    });
  });

  it('ends normal access immediately after Membership revocation', async () => {
    expect((await resolveA(await accessToken())).status).toBe('accepted');
    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [b4Ids.employeeAMembership],
    );
    expect(await resolveA(await accessToken())).toEqual({
      status: 'rejected', reason: 'identity_or_membership_unavailable',
    });
  });

  it('keeps the same subject under another issuer as a distinct identity', async () => {
    const result = await serviceB.resolve({
      accessToken: await accessToken({ issuer: issuerB }),
      requestedOrganizationId: OrganizationId(b4Ids.organizationB),
    });

    expect(result).toEqual({
      status: 'accepted',
      actor: {
        userId: b4Ids.employeeB,
        organizationId: b4Ids.organizationB,
        membershipId: b4Ids.employeeBMembership,
        role: 'employee',
      },
    });
  });

  it('ignores forged user, organization, tenant, role, and TimeEntry claims', async () => {
    const result = await resolveA(await accessToken({ claims: {
      user_id: b4Ids.employeeB,
      organization_id: b4Ids.organizationB,
      tenant_id: b4Ids.organizationB,
      role: 'authenticated',
      membership_role: 'administrator',
      time_entry_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      app_metadata: {
        user_id: b4Ids.employeeB,
        organization_id: b4Ids.organizationB,
        role: 'administrator',
      },
    } }));

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.actor).toEqual({
        userId: b4Ids.employeeA,
        organizationId: b4Ids.organizationA,
        membershipId: b4Ids.employeeAMembership,
        role: 'employee',
      });
    }
  });

  it('uses the current database role even when the token carries a stale employee claim', async () => {
    const result = await resolveA(await accessToken({
      subject: b4Ids.administratorASubject,
      claims: { membership_role: 'employee' },
    }));

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.actor.role).toBe('administrator');
      expect(result.actor.userId).toBe(b4Ids.administratorA);
    }
  });

  it('rejects a requested Organization that differs from the resolved Membership', async () => {
    expect(await resolveA(await accessToken(), b4Ids.organizationB)).toEqual({
      status: 'rejected', reason: 'requested_organization_mismatch',
    });
  });

  it('does not disclose Tenant B data through an Organization mismatch', async () => {
    const result = await resolveA(await accessToken(), b4Ids.organizationB);
    expect(result).toEqual({ status: 'rejected', reason: 'requested_organization_mismatch' });
    expect(JSON.stringify(result)).not.toContain(b4Ids.employeeB);
    expect(JSON.stringify(result)).not.toContain(b4Ids.employeeBMembership);
  });

  it('does not link an unknown subject by a matching email claim', async () => {
    expect(await resolveA(await accessToken({
      subject: b4Ids.unknownSubject,
      claims: { email: 'employee-a@example.invalid' },
    }))).toEqual({ status: 'rejected', reason: 'identity_or_membership_unavailable' });
  });

  it('does not use email differences to override a valid issuer-subject binding', async () => {
    const result = await resolveA(await accessToken({
      claims: { email: 'completely-different@example.invalid' },
    }));
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.actor.userId).toBe(b4Ids.employeeA);
    }
  });

  it('does not accept request-supplied decision or lifecycle output fields', async () => {
    const command = {
      accessToken: await accessToken(),
      requestedOrganizationId: OrganizationId(b4Ids.organizationA),
      decision_type: 'time_entry_stopped',
      reason: 'request-controlled',
      userId: b4Ids.employeeB,
      organizationId: b4Ids.organizationB,
      role: 'administrator',
      timeEntryId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    };

    const result = await serviceA.resolve(command);
    expect(result.status).toBe('accepted');
    const decisions = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.canonical_decisions`,
    );
    expect(decisions.rows[0]?.count).toBe('0');
  });
});

describe('least-privilege resolver database boundary', () => {
  it('uses a non-owner login and a NOLOGIN resolver role without privilege bypasses', async () => {
    const result = await installerPool.query<{
      rolname: string;
      rolsuper: boolean;
      rolinherit: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolcanlogin: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin,
         rolreplication, rolbypassrls
       FROM pg_catalog.pg_roles
       WHERE rolname = ANY($1::text[])
       ORDER BY rolname`,
      [[B4_RESOLVER_TEST_LOGIN, B4_IDENTITY_RESOLVER_ROLE]],
    );

    expect(result.rows).toEqual([
      {
        rolname: B4_RESOLVER_TEST_LOGIN,
        rolsuper: false,
        rolinherit: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolcanlogin: true,
        rolreplication: false,
        rolbypassrls: false,
      },
      {
        rolname: B4_IDENTITY_RESOLVER_ROLE,
        rolsuper: false,
        rolinherit: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolcanlogin: false,
        rolreplication: false,
        rolbypassrls: false,
      },
    ]);

    const ownership = await installerPool.query<{ owned: string }>(
      `SELECT count(*)::text AS owned
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = relation.relowner
       WHERE namespace.nspname = $1
         AND owner_role.rolname = ANY($2::text[])`,
      [B3_SCHEMA, [B4_RESOLVER_TEST_LOGIN, B4_IDENTITY_RESOLVER_ROLE]],
    );
    expect(ownership.rows[0]?.owned).toBe('0');
  });

  it('normalizes the exact resolver role graph after a contaminated existing-role migration', async () => {
    const contaminationRole = await installerPool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1
       ) AS exists`,
      [B4_RESOLVER_PARENT_CONTAMINATION_ROLE],
    );
    expect(contaminationRole.rows[0]?.exists).toBe(true);

    const memberships = await installerPool.query<{
      member_name: string;
      parent_roles: string[];
    }>(
      `SELECT
         member.rolname AS member_name,
         ARRAY(
           SELECT parent.rolname::text
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
           WHERE membership.member = member.oid
           ORDER BY parent.rolname
         )::text[] AS parent_roles
       FROM pg_catalog.pg_roles AS member
       WHERE member.rolname = ANY($1::text[])
       ORDER BY member.rolname`,
      [[B4_RESOLVER_TEST_LOGIN, B4_IDENTITY_RESOLVER_ROLE]],
    );

    expect(memberships.rows).toEqual([
      {
        member_name: B4_RESOLVER_TEST_LOGIN,
        parent_roles: [B4_IDENTITY_RESOLVER_ROLE],
      },
      {
        member_name: B4_IDENTITY_RESOLVER_ROLE,
        parent_roles: [],
      },
    ]);
  });

  it('grants the resolver role only schema usage and the dedicated function execution', async () => {
    const grants = await installerPool.query<{
      can_use_schema: boolean;
      can_execute: boolean;
      table_grants: string;
    }>(
      `SELECT
         has_schema_privilege($1, $2, 'USAGE') AS can_use_schema,
         has_function_privilege($1, $3, 'EXECUTE') AS can_execute,
         (SELECT count(*)::text
          FROM information_schema.role_table_grants
          WHERE grantee = $1) AS table_grants`,
      [
        B4_IDENTITY_RESOLVER_ROLE,
        B3_SCHEMA,
        `${B3_SCHEMA}.resolve_request_actor(text,text)`,
      ],
    );
    expect(grants.rows[0]).toEqual({
      can_use_schema: true,
      can_execute: true,
      table_grants: '0',
    });
  });

  it('uses a security-definer function with a fixed safe search path', async () => {
    const result = await installerPool.query<{
      security_definer: boolean;
      configuration: string[] | null;
      public_execute: boolean;
    }>(
      `SELECT
         procedure.prosecdef AS security_definer,
         procedure.proconfig AS configuration,
         has_function_privilege('public', procedure.oid, 'EXECUTE') AS public_execute
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = $1 AND procedure.proname = 'resolve_request_actor'`,
      [B3_SCHEMA],
    );
    expect(result.rows).toEqual([{
      security_definer: true,
      configuration: ['search_path=pg_catalog, taptime_server, pg_temp'],
      public_execute: false,
    }]);
  });

  it('can execute only the dedicated resolver function and no unrelated schema function', async () => {
    const resolution = await withResolverRole((client) => client.query<{
      user_id: string;
      organization_id: string;
    }>(
      `SELECT user_id, organization_id
       FROM ${B3_SCHEMA}.resolve_request_actor($1, $2)`,
      [issuerA, b4Ids.sharedSubject],
    ));
    expect(resolution.rows).toEqual([{
      user_id: b4Ids.employeeA,
      organization_id: b4Ids.organizationA,
    }]);
    expect(await postgresErrorCode(withResolverRole((client) => client.query(
      `SELECT ${B3_SCHEMA}.current_user_id()`,
    )))).toBe('42501');
  });

  it.each(['identity_bindings', 'memberships', 'users', 'organizations'])(
    'cannot directly read %s while the resolver role is active',
    async (table) => {
      expect(await postgresErrorCode(withResolverRole((client) => client.query(
        `SELECT * FROM ${B3_SCHEMA}.${table} LIMIT 1`,
      )))).toBe('42501');
    },
  );

  it('cannot read tables or execute the resolver function after RESET ROLE', async () => {
    const client = await resolverPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${B4_IDENTITY_RESOLVER_ROLE}`);
      await client.query('RESET ROLE');
      expect(await postgresErrorCode(client.query(
        `SELECT * FROM ${B3_SCHEMA}.identity_bindings LIMIT 1`,
      ))).toBe('42501');
      await client.query('ROLLBACK');

      await client.query('BEGIN');
      expect(await postgresErrorCode(client.query(
        `SELECT * FROM ${B3_SCHEMA}.resolve_request_actor($1, $2)`,
        [issuerA, b4Ids.sharedSubject],
      ))).toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('cannot create roles, schemas, or alter resolver ownership', async () => {
    expect(await postgresErrorCode(resolverPool.query(
      'CREATE ROLE taptime_b4_forbidden_role NOLOGIN',
    ))).toBe('42501');
    expect(await postgresErrorCode(resolverPool.query(
      'CREATE SCHEMA taptime_b4_forbidden_schema',
    ))).toBe('42501');
    expect(await postgresErrorCode(resolverPool.query(
      `ALTER FUNCTION ${B3_SCHEMA}.resolve_request_actor(text, text) OWNER TO ${B4_RESOLVER_TEST_LOGIN}`,
    ))).toBe('42501');
  });

  it('clears SET LOCAL ROLE after successful resolution on a reused pool connection', async () => {
    expect(await resolver.resolve({ issuer: issuerA, subject: b4Ids.sharedSubject })).toMatchObject({
      status: 'resolved',
    });
    const state = await resolverPool.query<{
      current_user: string;
      session_user: string;
      current_role: string;
    }>('SELECT current_user, session_user, current_role');
    expect(state.rows[0]).toEqual({
      current_user: B4_RESOLVER_TEST_LOGIN,
      session_user: B4_RESOLVER_TEST_LOGIN,
      current_role: B4_RESOLVER_TEST_LOGIN,
    });
  });

  it('clears transaction-local actor context after commit on a reused connection', async () => {
    const actor: RequestActorContext = {
      userId: UserId(b4Ids.employeeA),
      organizationId: OrganizationId(b4Ids.organizationA),
      membershipId: MembershipId(b4Ids.employeeAMembership),
      role: 'employee',
    };
    await withRequestActorTransaction(resolverPool, actor, async (client) => {
      const current = await client.query<{ organization_id: string }>(
        "SELECT current_setting('app.organization_id', true) AS organization_id",
      );
      expect(current.rows[0]?.organization_id).toBe(b4Ids.organizationA);
    });

    const state = await resolverPool.query<{ context_value: string }>(
      `SELECT COALESCE(NULLIF(current_setting('app.organization_id', true), ''), '<unset>')
         AS context_value`,
    );
    expect(state.rows[0]?.context_value).toBe('<unset>');
  });

  it('clears transaction-local actor context after rollback on a reused connection', async () => {
    const actor: RequestActorContext = {
      userId: UserId(b4Ids.employeeA),
      organizationId: OrganizationId(b4Ids.organizationA),
      membershipId: MembershipId(b4Ids.employeeAMembership),
      role: 'employee',
    };
    await expect(withRequestActorTransaction(resolverPool, actor, async () => {
      throw new Error('synthetic rollback');
    })).rejects.toThrow('synthetic rollback');

    const state = await resolverPool.query<{ context_value: string }>(
      `SELECT COALESCE(NULLIF(current_setting('app.user_id', true), ''), '<unset>')
         AS context_value`,
    );
    expect(state.rows[0]?.context_value).toBe('<unset>');
  });
});
