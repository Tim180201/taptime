import {
  B4SessionAuthorityResolver,
  B5ScanContextResolver,
  createBackendHttpServer,
} from '@taptime/backend-api';
import {
  PostgresIdentityMembershipResolver,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import { ServerCanonicalLifecycleIngestionCoordinator } from '@taptime/backend-lifecycle';
import { TenantReadSessionCoordinator } from '@taptime/backend-read-model';
import { Pool } from 'pg';
import { SYNTHETIC_AUTH_EMAIL, SYNTHETIC_PUBLISHABLE_KEY } from './constants.js';
import {
  cleanSyntheticDatabase,
  prepareSyntheticDatabase,
  readSyntheticEvidenceCounts,
  type SyntheticEvidenceCounts,
} from './database.js';
import {
  FingerprintProvisioningScanContextResolver,
  type SyntheticSafeEvent,
} from './FingerprintProvisioningScanContextResolver.js';
import { SyntheticLocalAuthServer } from './SyntheticLocalAuthServer.js';

export type SyntheticEnvironmentSafeEvent =
  | SyntheticSafeEvent
  | 'api_lifecycle_unavailable'
  | 'api_scan_context_unavailable'
  | 'api_session_unavailable';

export interface SyntheticAndroidE2eEnvironmentOptions {
  readonly apiPort?: number;
  readonly authPort?: number;
  readonly installerDatabaseUrl: string;
  readonly password: string;
  readonly onSafeEvent?: (event: SyntheticEnvironmentSafeEvent) => void;
}

export interface SyntheticAndroidE2eEnvironment {
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
  readonly email: typeof SYNTHETIC_AUTH_EMAIL;
  readonly publishableKey: typeof SYNTHETIC_PUBLISHABLE_KEY;
  armTagA(expectedFingerprint: string): void;
  provisioningState(): 'armed' | 'disarmed' | 'provisioning';
  evidenceCounts(): Promise<SyntheticEvidenceCounts>;
  close(): Promise<void>;
}

export async function createSyntheticAndroidE2eEnvironment(
  options: SyntheticAndroidE2eEnvironmentOptions,
): Promise<SyntheticAndroidE2eEnvironment> {
  const onSafeEvent = options.onSafeEvent ?? (() => undefined);
  const auth = await SyntheticLocalAuthServer.create({
    password: options.password,
    port: validatePort(options.authPort ?? 54_321),
  });
  const installerPool = createPool(options.installerDatabaseUrl, 2);
  let sessionPool: Pool | null = null;
  let readModelPool: Pool | null = null;
  let lifecyclePool: Pool | null = null;
  let provisionerPool: Pool | null = null;
  let apiServer: ReturnType<typeof createBackendHttpServer> | null = null;

  try {
    await auth.start();
    const database = await prepareSyntheticDatabase(
      installerPool,
      options.installerDatabaseUrl,
      auth.issuer,
    );
    sessionPool = createPool(database.connectionStrings.session);
    readModelPool = createPool(database.connectionStrings.readModel);
    lifecyclePool = createPool(database.connectionStrings.lifecycle);
    provisionerPool = createPool(database.connectionStrings.provisioner, 1);

    const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: auth.issuer,
      jwksUrl: new URL(`${auth.issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const realScanContext = new B5ScanContextResolver(
      new TenantReadSessionCoordinator(readModelPool, verifier),
    );
    const provisioningScanContext = new FingerprintProvisioningScanContextResolver(
      realScanContext,
      provisionerPool,
      onSafeEvent,
    );
    const lifecycleCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
      lifecyclePool,
      verifier,
    );
    apiServer = createBackendHttpServer(
      {
        sessionAuthority: new B4SessionAuthorityResolver(
          verifier,
          new PostgresIdentityMembershipResolver(sessionPool),
        ),
        scanContextResolver: provisioningScanContext,
        lifecycleIngestor: lifecycleCoordinator,
        deferredLifecycleIngestor: lifecycleCoordinator,
      },
      {
        onDiagnostic(diagnostic) {
          switch (diagnostic.code) {
            case 'lifecycle_ingestion_failed':
              onSafeEvent('api_lifecycle_unavailable');
              return;
            case 'scan_context_resolution_failed':
              onSafeEvent('api_scan_context_unavailable');
              return;
            case 'session_resolution_failed':
              onSafeEvent('api_session_unavailable');
              return;
            default:
              return diagnostic.code satisfies never;
          }
        },
      },
    );
    const apiPort = validatePort(options.apiPort ?? 3_000);
    await listenLoopback(apiServer, apiPort);
    const address = apiServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Synthetic C2 API did not expose a TCP port');
    }
    const activeApiServer = apiServer;
    const pools = [sessionPool, readModelPool, lifecyclePool, provisionerPool] as const;
    let closed = false;
    return Object.freeze({
      apiBaseUrl: `http://127.0.0.1:${address.port}`,
      authBaseUrl: auth.publicUrl,
      email: SYNTHETIC_AUTH_EMAIL,
      publishableKey: SYNTHETIC_PUBLISHABLE_KEY,
      armTagA: (expectedFingerprint: string) => {
        provisioningScanContext.armTagA(expectedFingerprint);
      },
      provisioningState: () => provisioningScanContext.getState(),
      evidenceCounts: () => readSyntheticEvidenceCounts(installerPool),
      async close(): Promise<void> {
        if (closed) {
          return;
        }
        closed = true;
        await Promise.allSettled([
          closeServer(activeApiServer),
          ...pools.map((pool) => pool.end()),
          auth.close(),
        ]);
        try {
          await cleanSyntheticDatabase(installerPool);
        } finally {
          await installerPool.end();
        }
      },
    });
  } catch (error) {
    await Promise.allSettled([
      apiServer === null ? Promise.resolve() : closeServer(apiServer),
      sessionPool?.end() ?? Promise.resolve(),
      readModelPool?.end() ?? Promise.resolve(),
      lifecyclePool?.end() ?? Promise.resolve(),
      provisionerPool?.end() ?? Promise.resolve(),
      auth.close(),
    ]);
    try {
      await cleanSyntheticDatabase(installerPool);
    } catch {
      // Preserve the original startup failure; cleanup is best effort only.
    }
    await installerPool.end();
    throw error;
  }
}

function createPool(connectionString: string, max: number = 4): Pool {
  return new Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
}

function validatePort(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error('Synthetic E2E port must be an integer between 0 and 65535');
  }
  return value;
}

async function listenLoopback(
  server: ReturnType<typeof createBackendHttpServer>,
  port: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function closeServer(server: ReturnType<typeof createBackendHttpServer>): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}
