import {
  PostgresIdentityMembershipResolver,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import { Pool } from 'pg';
import { B4SessionAuthorityResolver } from './B4SessionAuthorityResolver.js';
import { createSessionHttpServer, type SessionHttpServerOptions } from './SessionHttpServer.js';

export interface SessionApiRuntimeConfiguration {
  readonly databaseUrl: string;
  readonly supabaseIssuer: string;
}

export interface SessionApiRuntime {
  readonly server: ReturnType<typeof createSessionHttpServer>;
  close(): Promise<void>;
}

export function createSessionApiRuntime(
  configuration: SessionApiRuntimeConfiguration,
  options: SessionHttpServerOptions = {},
): SessionApiRuntime {
  const databaseUrl = validateDatabaseUrl(configuration.databaseUrl);
  const issuer = configuration.supabaseIssuer.replace(/\/+$/, '');
  const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer,
    jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['ES256', 'RS256'],
  });
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
  const authority = new B4SessionAuthorityResolver(
    verifier,
    new PostgresIdentityMembershipResolver(pool),
  );
  const server = createSessionHttpServer(authority, options);

  return Object.freeze({
    server,
    async close(): Promise<void> {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error === undefined ? resolve() : reject(error));
        });
      }
      await pool.end();
    },
  });
}

function validateDatabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Session API database URL must be an absolute PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('Session API database URL must use PostgreSQL with an explicit host');
  }
  return url.href;
}
